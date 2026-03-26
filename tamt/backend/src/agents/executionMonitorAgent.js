/**
 * Execution Monitor Agent
 * Auto-trigger: fires after RF test run completes.
 * Also: "Analyse Run" button on TestRun detail page.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a QA lead analysing a completed Robot Framework test execution run.
Provide a concise, actionable execution analysis.

Your analysis must include:
1. Executive summary: 2-3 sentences on overall run health
2. Failure analysis: for each FAIL — most likely root cause category
   (Environment | Test Data | Application Bug | Script Issue | Flaky)
3. Pattern detection: are multiple failures in the same module/area?
4. Blocking defects: which failures are likely P1/P2 application bugs
   vs test infrastructure issues?
5. Re-run recommendation: which cases should be re-run (environment
   or test-data issues) vs escalated as defects?
6. Trend insight (if previous run data provided): is quality improving
   or degrading across runs?

Output as structured JSON:
{
  "summary": "string",
  "health_score": 0-100,
  "failure_categories": {
    "environment": [],
    "test_data": [],
    "application_bug": [],
    "script_issue": [],
    "flaky": []
  },
  "patterns": ["..."],
  "blocking_failures": [{ "testCaseId": ..., "reason": "..." }],
  "rerun_candidates": [{ "testCaseId": ..., "reason": "..." }],
  "trend": "Improving|Stable|Degrading|Insufficient data",
  "recommended_actions": ["..."]
}`;

const TOOLS = [
  {
    name: 'get_run_full',
    description: 'Returns all execution data and RF logs for a test run',
    input_schema: {
      type: 'object',
      properties: { testRunId: { type: 'number' } },
      required: ['testRunId'],
    },
  },
  {
    name: 'get_previous_runs',
    description: 'Returns historical run results for trend analysis',
    input_schema: {
      type: 'object',
      properties: {
        testPlanId: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['testPlanId'],
    },
  },
  {
    name: 'get_test_case_script',
    description: 'Returns script content for a test case to identify script issues',
    input_schema: {
      type: 'object',
      properties: { testCaseId: { type: 'number' } },
      required: ['testCaseId'],
    },
  },
  {
    name: 'create_defect_suggestion',
    description: 'Creates an AgentSuggestion of type DEFECT for a failed execution',
    input_schema: {
      type: 'object',
      properties: {
        testExecutionId: { type: 'number' },
        title: { type: 'string' },
        description: { type: 'string' },
        severity: { type: 'string' },
        agentRunId: { type: 'number' },
      },
      required: ['testExecutionId', 'title', 'severity'],
    },
  },
  {
    name: 'flag_for_rerun',
    description: 'Marks test executions for re-run',
    input_schema: {
      type: 'object',
      properties: {
        testExecutionIds: { type: 'array', items: { type: 'number' } },
      },
      required: ['testExecutionIds'],
    },
  },
];

function buildToolHandlers(testRunId, agentRunId) {
  return {
    get_run_full: ({ testRunId: trId }) => {
      const id = trId || testRunId;
      const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id);
      if (!run) return { error: 'TestRun not found' };
      const executions = db.prepare(`
        SELECT te.*, tc.title, tc.test_type, tc.priority
        FROM test_executions te
        JOIN test_cases tc ON tc.id = te.test_case_id
        WHERE te.test_run_id = ?
      `).all(id);
      const rfLog = db.prepare('SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(id);
      return { testRun: run, executions, rfExecutionLog: rfLog };
    },
    get_previous_runs: ({ testPlanId, limit = 5 }) => {
      const runs = db.prepare(`
        SELECT tr.*, rfl.total_tests, rfl.passed, rfl.failed, rfl.skipped
        FROM test_runs tr
        LEFT JOIN rf_execution_logs rfl ON rfl.test_run_id = tr.id
        WHERE tr.test_plan_id = ? AND tr.status IN ('Completed', 'Failed')
        ORDER BY tr.completed_at DESC LIMIT ?
      `).all(testPlanId, limit);
      return { previousRuns: runs };
    },
    get_test_case_script: ({ testCaseId }) => {
      const script = db.prepare(
        'SELECT * FROM robot_scripts WHERE test_case_id = ? ORDER BY version DESC LIMIT 1'
      ).get(testCaseId);
      return script || { message: 'No script found' };
    },
    create_defect_suggestion: ({ testExecutionId, title, description, severity }) => {
      const result = db.prepare(`
        INSERT INTO agent_suggestions (agent_run_id, suggestion_type, entity_id, content, status)
        VALUES (?, 'DEFECT', ?, ?, 'Pending')
      `).run(agentRunId, testExecutionId, JSON.stringify({ title, description, severity, testExecutionId }));
      return { suggestionId: result.lastInsertRowid, created: true };
    },
    flag_for_rerun: ({ testExecutionIds }) => {
      for (const id of testExecutionIds) {
        db.prepare("UPDATE test_executions SET notes = COALESCE(notes || ' | ', '') || 'Flagged for rerun' WHERE id = ?").run(id);
      }
      return { flagged: testExecutionIds.length };
    },
  };
}

async function runExecutionMonitor({ testRunId, triggeredBy }) {
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(testRunId);
  if (!run) throw new Error(`TestRun ${testRunId} not found`);

  const executions = db.prepare(`
    SELECT te.*, tc.title FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    WHERE te.test_run_id = ?
  `).all(testRunId);

  const rfLog = db.prepare('SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(testRunId);

  // Create agent run record first to pass agentRunId to tool handlers
  const agentRunRow = db.prepare(
    "INSERT INTO agent_runs (agent_type, trigger_entity_type, trigger_entity_id, status) VALUES ('EXECUTION_MONITOR', 'TestRun', ?, 'Running')"
  ).run(testRunId);
  const agentRunId = agentRunRow.lastInsertRowid;

  const failedExecs = executions.filter(e => e.status === 'Fail');

  const userMessage = `Analyse this completed test run:

TestRun: ${JSON.stringify(run, null, 2)}

Execution Summary:
- Total: ${executions.length}
- Passed: ${executions.filter(e => e.status === 'Pass').length}
- Failed: ${failedExecs.length}
- Pending: ${executions.filter(e => e.status === 'Pending').length}

RF Execution Log: ${JSON.stringify(rfLog, null, 2)}

Failed Test Cases:
${JSON.stringify(failedExecs.map(e => ({
  id: e.id,
  testCaseId: e.test_case_id,
  title: e.title,
  actualResult: e.actual_result,
  duration: e.duration_ms,
})), null, 2)}

Use the tools to:
1. Get full run details
2. Get previous run history for trend analysis
3. For each significant failure, create a defect suggestion
4. Flag environment/data failures for rerun`;

  const result = await agentService.runAgent({
    agentType: 'EXECUTION_MONITOR',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(testRunId, agentRunId),
    triggerEntityType: 'TestRun',
    triggerEntityId: testRunId,
    triggeredBy,
  });

  db.prepare('UPDATE agent_runs SET status = ? WHERE id = ?').run('Completed', agentRunId);
  return result;
}

module.exports = { runExecutionMonitor };
