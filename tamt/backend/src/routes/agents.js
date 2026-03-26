const express = require('express');
const db = require('../config/database');
const sseService = require('../services/sseService');

const { runPrereqAnalyst } = require('../agents/prereqAnalystAgent');
const { runTestCaseGenerator } = require('../agents/testCaseGeneratorAgent');
const { runScriptGenerator } = require('../agents/scriptGeneratorAgent');
const { runExecutionMonitor } = require('../agents/executionMonitorAgent');
const { runDefectTriage } = require('../agents/defectTriageAgent');
const { runReportNarrative } = require('../agents/reportNarrativeAgent');
const { runGapAnalyst } = require('../agents/gapAnalystAgent');

const router = express.Router();

const AGENT_MAP = {
  PREREQ_ANALYST: runPrereqAnalyst,
  TESTCASE_GENERATOR: runTestCaseGenerator,
  SCRIPT_GENERATOR: runScriptGenerator,
  EXECUTION_MONITOR: runExecutionMonitor,
  DEFECT_TRIAGE: runDefectTriage,
  REPORT_NARRATIVE: runReportNarrative,
  GAP_ANALYST: runGapAnalyst,
};

// POST /agents/run — launch agent
router.post('/run', async (req, res) => {
  const { agentType, triggerEntityType, triggerEntityId, additionalContext } = req.body;

  if (!agentType || !AGENT_MAP[agentType]) {
    return res.status(400).json({
      error: `Invalid agentType. Must be one of: ${Object.keys(AGENT_MAP).join(', ')}`,
    });
  }

  // Return immediately with a placeholder agentRunId; run async
  const placeholder = db.prepare(`
    INSERT INTO agent_runs (agent_type, trigger_entity_type, trigger_entity_id, status, triggered_by)
    VALUES (?, ?, ?, 'Running', ?)
  `).run(agentType, triggerEntityType, triggerEntityId, req.user.id);

  const agentRunId = placeholder.lastInsertRowid;

  // Build context for agent
  const context = {
    triggeredBy: req.user.id,
    featureId: triggerEntityId,
    testCaseId: triggerEntityId,
    testRunId: triggerEntityId,
    testPlanId: triggerEntityId,
    testExecutionId: triggerEntityId,
    ...additionalContext,
  };

  // Fire agent asynchronously
  setImmediate(async () => {
    try {
      await AGENT_MAP[agentType](context);
    } catch (err) {
      console.error(`[Agent ${agentType}] Error:`, err.message);
      db.prepare("UPDATE agent_runs SET status = 'Failed', error_message = ? WHERE id = ?")
        .run(err.message, agentRunId);
      sseService.sendToChannel(`agent-run:${agentRunId}`, 'message', {
        type: 'error', content: err.message,
      });
    }
  });

  res.json({ agentRunId, status: 'Running' });
});

// GET /agents/run/:id — get agent run details
router.get('/run/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'AgentRun not found' });
  res.json(run);
});

// GET /agents/run/:id/stream — SSE stream for agent activity
router.get('/run/:id/stream', (req, res) => {
  const channelId = `agent-run:${req.params.id}`;
  sseService.addClient(channelId, res);

  // If run is already completed, send done event immediately
  const run = db.prepare('SELECT status FROM agent_runs WHERE id = ?').get(req.params.id);
  if (run && (run.status === 'Completed' || run.status === 'Failed')) {
    sseService.sendToChannel(channelId, 'message', {
      type: run.status === 'Completed' ? 'done' : 'error',
      content: run.status === 'Completed' ? 'Agent run already completed' : 'Agent run failed',
    });
  }
});

// GET /agents/suggestions
router.get('/suggestions', (req, res) => {
  const { entityType, entityId, status, agent_run_id } = req.query;
  let sql = `
    SELECT as2.*, ar.agent_type
    FROM agent_suggestions as2
    JOIN agent_runs ar ON ar.id = as2.agent_run_id
    WHERE 1=1
  `;
  const params = [];
  if (agent_run_id) { sql += ' AND as2.agent_run_id = ?'; params.push(agent_run_id); }
  if (status) { sql += ' AND as2.status = ?'; params.push(status); }
  if (entityType && entityId) {
    sql += ' AND ar.trigger_entity_type = ? AND ar.trigger_entity_id = ?';
    params.push(entityType, entityId);
  }
  sql += ' ORDER BY as2.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// PATCH /agents/suggestions/:id — accept/reject/modify
router.patch('/suggestions/:id', (req, res) => {
  const { status, modifiedContent } = req.body;
  const suggestion = db.prepare('SELECT * FROM agent_suggestions WHERE id = ?').get(req.params.id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

  db.prepare(`
    UPDATE agent_suggestions SET
      status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
      content = COALESCE(?, content)
    WHERE id = ?
  `).run(status, req.user.id, modifiedContent ? JSON.stringify(modifiedContent) : null, req.params.id);

  // Auto-apply on Accept
  if (status === 'Accepted') {
    applyAcceptedSuggestion(suggestion, modifiedContent);
  }

  res.json(db.prepare('SELECT * FROM agent_suggestions WHERE id = ?').get(req.params.id));
});

function applyAcceptedSuggestion(suggestion, modifiedContent) {
  const content = modifiedContent || JSON.parse(suggestion.content || '{}');

  switch (suggestion.suggestion_type) {
    case 'PREREQ_ITEM':
      if (content.prereqId) {
        db.prepare('UPDATE prerequisites SET is_ready = ?, notes = ? WHERE id = ?')
          .run(content.is_ready ? 1 : 0, content.notes || null, content.prereqId);
      }
      break;

    case 'TEST_CASE':
      if (suggestion.entity_id) {
        db.prepare("UPDATE test_cases SET status = 'Approved' WHERE id = ?")
          .run(suggestion.entity_id);
      }
      break;

    case 'SCRIPT_CONTENT':
      if (suggestion.entity_id) {
        db.prepare("UPDATE robot_scripts SET status = 'Approved' WHERE id = ?")
          .run(suggestion.entity_id);
        // Also update test case automation status
        const script = db.prepare('SELECT test_case_id FROM robot_scripts WHERE id = ?').get(suggestion.entity_id);
        if (script) {
          db.prepare("UPDATE test_cases SET automation_status = 'Scripted' WHERE id = ?").run(script.test_case_id);
        }
      }
      break;

    case 'DEFECT':
      // Defect is already created; mark it as accepted
      break;

    default:
      break;
  }
}

// GET /agents/history
router.get('/history', (req, res) => {
  const { entityType, entityId, limit = 20 } = req.query;
  let sql = 'SELECT * FROM agent_runs WHERE 1=1';
  const params = [];
  if (entityType) { sql += ' AND trigger_entity_type = ?'; params.push(entityType); }
  if (entityId) { sql += ' AND trigger_entity_id = ?'; params.push(entityId); }
  sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
