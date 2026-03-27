/**
 * TAMT AI Assistant — scoped chat endpoint
 * Only answers questions about TAMT, testing, Robot Framework, and QA methodology.
 */
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const router = express.Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are TAMT Assistant — the built-in AI helper for the Test Automation Management Tool (TAMT).

YOUR SCOPE: You ONLY answer questions about:
- How to use TAMT (projects, test plans, features, test cases, test runs, defects, reports, settings)
- Robot Framework scripting, keywords, libraries, and best practices
- QA methodology: test case design, prerequisite readiness, coverage analysis, defect triage
- Understanding test execution results and fixing failures
- Setting up environments and managing prerequisites
- The 7 AI agents built into TAMT and how to trigger them

OUT OF SCOPE: If asked about anything else (general coding, personal topics, other tools unrelated to testing, etc.), politely decline and redirect back to TAMT or QA-related help.

KEY TAMT FACTS:
- Hierarchy: Project → Test Plan → Feature → Test Case → RF Script → Test Run → Execution
- Feature types: API (with sub-types Technical/Functional/Both), Functional, GUI, Performance
- Prerequisite readiness must be 100% before an RF script can be generated
- RF scripts use naming: {test_case_id}_{feature_type}_{slug}.robot
- Test case title inside .robot must exactly match the TestCase.title in the DB
- 7 Agents: PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- Every agent suggestion requires explicit Accept/Reject — no agent auto-writes without confirmation
- EXECUTION_MONITOR is the only auto-triggered agent (fires after a run completes)
- XLSX exports available for: test cases, execution summary, defects, coverage

TONE: Be concise, practical, and use QA/testing terminology naturally.`;

const MAX_HISTORY = 10; // keep last 10 turns of context

// POST /assistant/chat
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  // Build messages array (trim to last MAX_HISTORY turns)
  const trimmed = history.slice(-MAX_HISTORY);
  const messages = [
    ...trimmed.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0]?.text || '';
    res.json({
      reply,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    });
  } catch (err) {
    console.error('[Assistant] Claude API error:', err.message);
    res.status(500).json({ error: 'Assistant temporarily unavailable. Please try again.' });
  }
});

module.exports = router;
