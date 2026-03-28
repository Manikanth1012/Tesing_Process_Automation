/**
 * TAMT AI Assistant — RAG-enhanced, skill-aware, session-persistent chat
 */
const express = require('express');
const axios   = require('axios');
const db      = require('../config/database');
const { search } = require('../services/vectorService');

const router = express.Router();

function getCfg(key) {
  const row = db.prepare('SELECT value FROM platform_config WHERE key = ?').get(key);
  return row?.value || process.env[{
    llm_api_key: 'ANTHROPIC_API_KEY',
    llm_model:   'CLAUDE_MODEL',
    voyage_api_key: 'VOYAGE_API_KEY',
    vector_top_k: null,
    chat_max_history: null,
  }[key]] || '';
}

const BASE_SYSTEM = `You are TAMT Assistant — the built-in AI helper for the Test Automation Management Tool (TAMT).

YOUR SCOPE: You ONLY answer questions about:
- How to use TAMT (projects, test plans, features, test cases, test runs, defects, reports, settings)
- Robot Framework scripting, keywords, libraries, and best practices
- QA methodology: test case design, prerequisite readiness, coverage analysis, defect triage
- Understanding test execution results and fixing failures
- Setting up environments and managing prerequisites
- The 7 AI agents built into TAMT and how to trigger them
- Feature template upload/import process
- User and role management within the platform

OUT OF SCOPE: If asked about anything outside QA / TAMT / Robot Framework, politely decline and redirect.

KEY TAMT FACTS:
- Hierarchy: Project → Test Plan → Feature → Test Case → RF Script → Test Run → Execution
- Feature types: API (sub-types: Technical/Functional/Both), Functional, GUI, Performance
- Features can be imported in bulk using an Excel template (Features page → Import)
- Prerequisites must be 100% complete before an RF script can be generated
- 7 Agents: PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- Every agent suggestion requires explicit Accept/Reject — no agent auto-writes without confirmation
- Default admin credentials: admin@tamt.local / password

TONE: Adapt to the user's skill level (provided in the context block below). Be concise, practical, and use QA/testing terminology naturally.`;

function formatContext(items) {
  if (!items.length) return '';
  const lines = items.map(item => {
    const m = item.metadata;
    switch (item.entityType) {
      case 'Feature':  return `• Feature "${m.name || item.snippet}" [${m.type}/${m.priority}] status=${m.status}`;
      case 'TestCase': return `• TestCase "${m.title || item.snippet}" [${m.type}/${m.priority}] feature="${m.feature}"`;
      case 'TestPlan': return `• TestPlan "${m.name || item.snippet}" status=${m.status} release="${m.release}" project="${m.project}"`;
      case 'Project':  return `• Project "${m.name}" key=${m.key}`;
      default:         return `• ${item.entityType}: ${item.snippet}`;
    }
  });
  return `\n\n--- RELEVANT PLATFORM CONTEXT ---\n${lines.join('\n')}\n---`;
}

function formatSkills(skills) {
  if (!skills.length) return '';
  const byLevel = { Expert: [], Intermediate: [], Beginner: [] };
  skills.forEach(s => { (byLevel[s.skill_level] || byLevel.Intermediate).push(s.skill_name); });
  const parts = [];
  if (byLevel.Expert.length)       parts.push(`Expert in: ${byLevel.Expert.join(', ')}`);
  if (byLevel.Intermediate.length) parts.push(`Intermediate in: ${byLevel.Intermediate.join(', ')}`);
  if (byLevel.Beginner.length)     parts.push(`Beginner in: ${byLevel.Beginner.join(', ')}`);
  return `\n\n--- USER SKILL PROFILE ---\n${parts.join('\n')}\n---`;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
router.get('/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT cs.*, COUNT(cm.id) as message_count,
      MAX(cm.created_at) as last_message_at
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cm.session_id = cs.id
    WHERE cs.user_id = ?
    GROUP BY cs.id
    ORDER BY cs.updated_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(sessions);
});

router.post('/sessions', (req, res) => {
  const { title = 'New Conversation' } = req.body;
  const result = db.prepare(
    'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)'
  ).run(req.user.id, title);
  res.status(201).json({ id: result.lastInsertRowid, title, user_id: req.user.id });
});

router.get('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const messages = db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...session, messages });
});

router.delete('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, history = [], session_id } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const apiKey = getCfg('llm_api_key') || process.env.ANTHROPIC_API_KEY;
  const model  = getCfg('llm_model')   || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  if (!apiKey) return res.status(503).json({ error: 'LLM API key not configured. Set it in Settings → Integrations.' });

  const topK = parseInt(getCfg('vector_top_k') || '5', 10);
  const maxHistory = parseInt(getCfg('chat_max_history') || '10', 10);

  // Resolve or create session
  let sessionId = session_id;
  if (!sessionId && req.user) {
    // Auto-create a session if none provided
    const result = db.prepare('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)').run(
      req.user.id, message.trim().slice(0, 60) || 'Conversation'
    );
    sessionId = result.lastInsertRowid;
  }

  // 1. RAG context retrieval
  const contextItems = await search(message, topK);

  // 2. User skill profile
  const skills = req.user
    ? db.prepare('SELECT skill_name, skill_level FROM user_skills WHERE user_id = ? ORDER BY skill_level DESC').all(req.user.id)
    : [];

  // 3. Build messages — prefer DB session history over passed history
  let dbHistory = [];
  if (sessionId) {
    dbHistory = db.prepare(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId).slice(-(maxHistory * 2));
  }
  const historyToUse = dbHistory.length > 0 ? dbHistory : history.slice(-maxHistory);

  const systemPrompt = BASE_SYSTEM + formatContext(contextItems) + formatSkills(skills);
  const messages = [
    ...historyToUse.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model, max_tokens: 1024, system: systemPrompt, messages },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );

    const reply = response.data.content?.[0]?.text || '';

    // Persist to session
    if (sessionId) {
      db.prepare('INSERT INTO chat_messages (session_id, role, content, context_used) VALUES (?, ?, ?, ?)')
        .run(sessionId, 'user', message.trim(), contextItems.length);
      db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)')
        .run(sessionId, 'assistant', reply);
      db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);
      // Auto-update title from first user message
      const msgCount = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?').get(sessionId);
      if (msgCount.c <= 2) {
        db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?')
          .run(message.trim().slice(0, 60), sessionId);
      }
    }

    res.json({ reply, session_id: sessionId, context_used: contextItems.length, usage: response.data.usage });
  } catch (err) {
    console.error('[Assistant] API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Assistant temporarily unavailable.' });
  }
});

// ─── Context management ───────────────────────────────────────────────────────
router.post('/reindex', async (req, res) => {
  const { reindexAll } = require('../services/vectorService');
  try {
    const count = await reindexAll();
    res.json({ message: `Re-indexed ${count} documents.`, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/context-status', (req, res) => {
  const rows = db.prepare('SELECT entity_type, COUNT(*) as count FROM context_embeddings GROUP BY entity_type').all();
  const engine = process.env.VOYAGE_API_KEY || db.prepare("SELECT value FROM platform_config WHERE key = 'voyage_api_key'").get()?.value
    ? 'voyage-ai' : 'tfidf';
  res.json({ engine, indexed: rows });
});

module.exports = router;
