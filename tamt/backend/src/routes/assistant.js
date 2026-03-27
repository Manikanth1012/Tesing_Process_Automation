/**
 * TAMT AI Assistant — scoped chat endpoint (axios-based, no SDK needed)
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are TAMT Assistant — the built-in AI helper for the Test Automation Management Tool (TAMT).

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
- Features can be imported in bulk using an Excel template (download from Features page → Import)
- Prerequisites must be 100% complete before an RF script can be generated
- RF script naming: {test_case_id}_{feature_type}_{slug}.robot
- Test case title inside .robot must exactly match TestCase.title in the DB
- 7 Agents: PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- Every agent suggestion requires explicit Accept/Reject — no agent auto-writes without confirmation
- EXECUTION_MONITOR is the only auto-triggered agent (fires after a run completes)
- XLSX exports available for: test cases, execution summary, defects, coverage
- Default admin credentials: admin@tamt.local / password

TONE: Be concise, practical, and use QA/testing terminology naturally.`;

const MAX_HISTORY = 10;

router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const trimmed = history.slice(-MAX_HISTORY);
  const messages = [
    ...trimmed.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: CLAUDE_MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, messages },
      { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );

    const reply = response.data.content?.[0]?.text || '';
    res.json({
      reply,
      usage: response.data.usage,
    });
  } catch (err) {
    console.error('[Assistant] Claude API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Assistant temporarily unavailable.' });
  }
});

module.exports = router;
