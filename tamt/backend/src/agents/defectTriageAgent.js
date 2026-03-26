/**
 * Defect Triage Agent
 * Trigger: "Log Defect" after test failure OR auto-triggered by Execution Monitor.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a QA lead performing defect triage for enterprise telecom BSS software.
Given a test failure, produce a well-structured defect report ready for developer assignment.

Your triage must:
1. Write a concise, actionable defect title (format: [Module] Short description)
2. Write a clear description: Steps to reproduce, Expected vs Actual, Evidence
3. Classify severity:
   - Critical: core flow broken, data corruption, security issue
   - Major: key feature broken, no workaround
   - Minor: partial functionality affected, workaround exists
   - Trivial: cosmetic, documentation
4. Classify priority (P1-P3) — may differ from severity
5. Suggest the most likely development team/module to assign to
6. Detect if this might be a duplicate of any provided recent defects
7. Suggest relevant test cases that may also be affected (regression scope)

Output as JSON:
{
  "title": "string",
  "description": "markdown formatted string",
  "severity": "Critical|Major|Minor|Trivial",
  "priority": "P1|P2|P3",
  "suggested_assignee_team": "string",
  "steps_to_reproduce": ["..."],
  "expected_behavior": "string",
  "actual_behavior": "string",
  "possible_duplicate_ids": [],
  "regression_scope": ["list of other test case titles likely affected"],
  "attachments_needed": ["output.xml", "screenshot", etc.]
}`;

const TOOLS = [
  {
    name: 'get_execution_context',
    description: 'Returns full execution context including test case, feature, and RF failure message',
    input_schema: {
      type: 'object',
      properties: { testExecutionId: { type: 'number' } },
      required: ['testExecutionId'],
    },
  },
  {
    name: 'search_recent_defects',
    description: 'Finds potential duplicate defects in the same feature',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number' },
        keyword: { type: 'string' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'get_related_test_cases',
    description: 'Lists test cases in the same feature for regression scope',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number' },
        excludeId: { type: 'number' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'create_defect',
    description: 'Saves the triaged defect to the Defects table',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        severity: { type: 'string' },
        priority: { type: 'string' },
        testExecutionId: { type: 'number' },
        testCaseId: { type: 'number' },
        featureId: { type: 'number' },
        stepsToReproduce: { type: 'array' },
        expectedBehavior: { type: 'string' },
        actualBehavior: { type: 'string' },
        suggestedAssigneeTeam: { type: 'string' },
        possibleDuplicateIds: { type: 'array' },
        regressionScope: { type: 'array' },
      },
      required: ['title', 'severity', 'priority'],
    },
  },
];

function buildToolHandlers(testExecutionId, triggeredBy) {
  return {
    get_execution_context: ({ testExecutionId: teId }) => {
      const id = teId || testExecutionId;
      const exec = db.prepare('SELECT * FROM test_executions WHERE id = ?').get(id);
      if (!exec) return { error: 'TestExecution not found' };
      const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(exec.test_case_id);
      const feature = tc ? db.prepare('SELECT * FROM features WHERE id = ?').get(tc.feature_id) : null;
      const rfLog = db.prepare(
        'SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1'
      ).get(exec.test_run_id);
      return {
        execution: exec,
        testCase: tc ? { ...tc, steps: JSON.parse(tc.steps || '[]') } : null,
        feature,
        rfFailureMessage: exec.actual_result,
        rfLog: rfLog ? { total: rfLog.total_tests, passed: rfLog.passed, failed: rfLog.failed } : null,
      };
    },
    search_recent_defects: ({ featureId, keyword }) => {
      const defects = db.prepare(`
        SELECT id, title, severity, priority, status, created_at
        FROM defects
        WHERE feature_id = ? AND (title LIKE ? OR description LIKE ?)
        ORDER BY created_at DESC LIMIT 10
      `).all(featureId, `%${keyword || ''}%`, `%${keyword || ''}%`);
      return { recentDefects: defects };
    },
    get_related_test_cases: ({ featureId, excludeId }) => {
      const cases = db.prepare(`
        SELECT id, title, test_type, priority
        FROM test_cases
        WHERE feature_id = ? AND id != ?
        LIMIT 20
      `).all(featureId, excludeId || 0);
      return { relatedTestCases: cases };
    },
    create_defect: ({
      title, description, severity, priority, testExecutionId: teId, testCaseId,
      featureId, stepsToReproduce, expectedBehavior, actualBehavior,
      suggestedAssigneeTeam, possibleDuplicateIds, regressionScope,
    }) => {
      const result = db.prepare(`
        INSERT INTO defects (
          title, description, severity, priority, status,
          test_execution_id, test_case_id, feature_id,
          steps_to_reproduce, expected_behavior, actual_behavior,
          suggested_assignee_team, possible_duplicate_ids, regression_scope,
          created_by
        ) VALUES (?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title, description || '', severity, priority,
        teId || testExecutionId || null, testCaseId || null, featureId || null,
        JSON.stringify(stepsToReproduce || []),
        expectedBehavior || '', actualBehavior || '',
        suggestedAssigneeTeam || '',
        JSON.stringify(possibleDuplicateIds || []),
        JSON.stringify(regressionScope || []),
        triggeredBy || 1
      );
      return {
        defectId: result.lastInsertRowid,
        created: true,
        _suggestions: [{ type: 'DEFECT', entityId: result.lastInsertRowid, content: { title, severity, priority } }],
      };
    },
  };
}

async function runDefectTriage({ testExecutionId, triggeredBy }) {
  const exec = db.prepare('SELECT * FROM test_executions WHERE id = ?').get(testExecutionId);
  if (!exec) throw new Error(`TestExecution ${testExecutionId} not found`);

  const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(exec.test_case_id);
  const feature = tc ? db.prepare('SELECT * FROM features WHERE id = ?').get(tc.feature_id) : null;

  const userMessage = `Triage this test failure and create a structured defect report:

Test Execution ID: ${testExecutionId}
Status: ${exec.status}
Actual Result / Failure Message: ${exec.actual_result || 'No message captured'}
Notes: ${exec.notes || ''}

Test Case: ${tc?.title || 'Unknown'}
Feature: ${feature?.name || 'Unknown'} (${feature?.feature_type || 'Unknown'})

Steps:
1. Use get_execution_context to get full context
2. Use search_recent_defects to check for duplicates
3. Use get_related_test_cases to identify regression scope
4. Use create_defect to save the triaged defect`;

  return agentService.runAgent({
    agentType: 'DEFECT_TRIAGE',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(testExecutionId, triggeredBy),
    triggerEntityType: 'TestExecution',
    triggerEntityId: testExecutionId,
    triggeredBy,
  });
}

module.exports = { runDefectTriage };
