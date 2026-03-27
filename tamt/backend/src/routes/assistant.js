/**
 * TAMT AI Assistant — RAG-enhanced, skill-aware chat endpoint
 *
 * On every user message:
 *  1. Retrieve top-K relevant platform entities via vector service (RAG)
 *  2. Load user's skill profile
 *  3. Inject both into the system prompt
 *  4. Call Claude claude-sonnet-4-6
 */
const express = require('express');
const axios   = require('axios');
const db      = require('../config/database');
const { search } = require('../services/vectorService');

const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL      = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

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
- RF script naming: {test_case_id}_{feature_type}_{slug}.robot
- Test case title inside .robot must exactly match TestCase.title in the DB
- 7 Agents: PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- Every agent suggestion requires explicit Accept/Reject — no agent auto-writes without confirmation
- EXECUTION_MONITOR is the only auto-triggered agent (fires after a run completes)
- XLSX exports available for: test cases, execution summary, defects, coverage
- Default admin credentials: admin@tamt.local / password

TONE: Adapt to the user's skill level (provided in the context block below). Be concise, practical, and use QA/testing terminology naturally.`;

const MAX_HISTORY = 10;

// Format retrieved context items for injection
function formatContext(items) {
  if (!items.length) return '';
  const lines = items.map(item => {
    const m = item.metadata;
    switch (item.entityType) {
      case 'Feature':  return `• Feature "${m.name || item.snippet}" [${m.type}/${m.priority}] status=${m.status}`;
      case 'TestCase': return `• TestCase "${m.title || item.snippet}" [${m.type}/${m.priority}] status=${m.status} feature="${m.feature}"`;
      case 'TestPlan': return `• TestPlan "${m.name || item.snippet}" status=${m.status} release="${m.release}" project="${m.project}"`;
      case 'Project':  return `• Project "${m.name}" key=${m.key} status=${m.status}`;
      default:         return `• ${item.entityType} "${item.snippet}"`;
    }
  });
  return `\n\n--- RELEVANT PLATFORM CONTEXT (top matches from this instance) ---\n${lines.join('\n')}\n---`;
}

// Format user skill profile for injection
function formatSkills(skills) {
  if (!skills.length) return '';
  const byLevel = { Expert: [], Intermediate: [], Beginner: [] };
  skills.forEach(s => { (byLevel[s.skill_level] || byLevel['Intermediate']).push(s.skill_name); });
  const parts = [];
  if (byLevel.Expert.length)       parts.push(`Expert in: ${byLevel.Expert.join(', ')}`);
  if (byLevel.Intermediate.length) parts.push(`Intermediate in: ${byLevel.Intermediate.join(', ')}`);
  if (byLevel.Beginner.length)     parts.push(`Beginner in: ${byLevel.Beginner.join(', ')}`);
  return `\n\n--- USER SKILL PROFILE ---\n${parts.join('\n')}\nCalibrate your answer depth and terminology to match this skill level.\n---`;
}

router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  // 1. Retrieve relevant context (RAG)
  const contextItems = await search(message, 5);

  // 2. Load user's skill profile
  const skills = req.user
    ? db.prepare('SELECT skill_name, skill_level FROM user_skills WHERE user_id = ? ORDER BY skill_level DESC').all(req.user.id)
    : [];

  // 3. Build dynamic system prompt
  const systemPrompt = BASE_SYSTEM + formatContext(contextItems) + formatSkills(skills);

  const trimmed  = history.slice(-MAX_HISTORY);
  const messages = [
    ...trimmed.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: CLAUDE_MODEL, max_tokens: 1024, system: systemPrompt, messages },
      { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );

    const reply = response.data.content?.[0]?.text || '';
    res.json({
      reply,
      context_used: contextItems.length,
      usage: response.data.usage,
    });
  } catch (err) {
    console.error('[Assistant] Claude API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Assistant temporarily unavailable.' });
  }
});

// GET /assistant/reindex — trigger full re-index of platform data
router.post('/reindex', async (req, res) => {
  const { reindexAll } = require('../services/vectorService');
  try {
    const count = await reindexAll();
    res.json({ message: `Re-indexed ${count} documents.`, count });
  } catch (err) {
    console.error('[Assistant] Re-index error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /assistant/context-status — how many docs are indexed
router.get('/context-status', (req, res) => {
  const rows = db.prepare(`
    SELECT entity_type, COUNT(*) as count FROM context_embeddings GROUP BY entity_type
  `).all();
  const engine = process.env.VOYAGE_API_KEY ? 'voyage-ai' : 'tfidf';
  res.json({ engine, indexed: rows });
});

module.exports = router;
