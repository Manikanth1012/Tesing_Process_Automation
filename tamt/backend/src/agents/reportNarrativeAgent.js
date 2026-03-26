/**
 * Report Narrative Agent
 * Trigger: "Generate Report" on Reports screen.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a QA lead writing an executive test summary report for stakeholders
including development leads, product managers, and project sponsors.

Write a professional narrative report that:
1. Opens with a 3-sentence executive summary (status, risk, recommendation)
2. Covers: test execution summary, pass/fail analysis, defect summary,
   automation coverage, and release readiness opinion
3. Uses business language — not test tool jargon
4. Quantifies everything (numbers, percentages, deltas from last cycle)
5. Closes with 3-5 specific, prioritized action items with owners

Format as clean markdown. Use ## headings, bold for key metrics,
and a simple table for the defect summary. Keep under 600 words.`;

const TOOLS = [
  {
    name: 'get_report_data',
    description: 'Returns all metrics for the selected report scope',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['TestPlan', 'TestRun', 'DateRange'] },
        entityId: { type: 'number' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
      required: ['scope'],
    },
  },
  {
    name: 'get_previous_report',
    description: 'Gets the last generated report for comparison',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string' },
        entityId: { type: 'number' },
      },
      required: ['scope'],
    },
  },
];

function buildToolHandlers() {
  return {
    get_report_data: ({ scope, entityId, dateFrom, dateTo }) => {
      if (scope === 'TestPlan' && entityId) {
        const plan = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(entityId);
        const runs = db.prepare('SELECT * FROM test_runs WHERE test_plan_id = ?').all(entityId);
        const runIds = runs.map(r => r.id);
        let executions = [];
        if (runIds.length > 0) {
          executions = db.prepare(
            `SELECT te.status, COUNT(*) as count FROM test_executions te
             WHERE te.test_run_id IN (${runIds.join(',')}) GROUP BY te.status`
          ).all();
        }
        const defects = db.prepare(`
          SELECT severity, priority, status, COUNT(*) as count
          FROM defects WHERE feature_id IN (
            SELECT feature_id FROM test_plan_features WHERE test_plan_id = ?
          ) GROUP BY severity, status
        `).all(entityId);
        const scripts = db.prepare(`
          SELECT status, COUNT(*) as count FROM robot_scripts
          WHERE test_case_id IN (
            SELECT tc.id FROM test_cases tc
            JOIN test_plan_features tpf ON tpf.feature_id = tc.feature_id
            WHERE tpf.test_plan_id = ?
          ) GROUP BY status
        `).all(entityId);
        return { plan, runs: runs.length, executionStats: executions, defects, scriptStats: scripts };
      }

      if (scope === 'TestRun' && entityId) {
        const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(entityId);
        const executions = db.prepare(`
          SELECT te.status, COUNT(*) as count FROM test_executions te WHERE te.test_run_id = ? GROUP BY te.status
        `).all(entityId);
        const rfLog = db.prepare('SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(entityId);
        return { run, executionStats: executions, rfLog };
      }

      // DateRange fallback
      const runs = db.prepare(
        "SELECT * FROM test_runs WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 20"
      ).all(dateFrom || '2020-01-01', dateTo || new Date().toISOString());
      const defects = db.prepare(
        "SELECT severity, status, COUNT(*) as count FROM defects WHERE created_at BETWEEN ? AND ? GROUP BY severity, status"
      ).all(dateFrom || '2020-01-01', dateTo || new Date().toISOString());
      return { runs, defects };
    },
    get_previous_report: ({ scope, entityId }) => {
      const prev = db.prepare(`
        SELECT output_summary, created_at FROM agent_runs
        WHERE agent_type = 'REPORT_NARRATIVE' AND trigger_entity_type = ? AND trigger_entity_id = ?
        AND status = 'Completed' ORDER BY created_at DESC LIMIT 1
      `).get(scope, entityId || 0);
      return prev || { message: 'No previous report found' };
    },
  };
}

async function runReportNarrative({ scope, entityId, dateFrom, dateTo, triggeredBy }) {
  const userMessage = `Generate an executive test summary report for:
Scope: ${scope}
Entity ID: ${entityId || 'N/A'}
Date Range: ${dateFrom || 'N/A'} to ${dateTo || 'N/A'}

Steps:
1. Use get_report_data to fetch all metrics
2. Use get_previous_report to get comparison baseline
3. Write a professional markdown narrative report`;

  return agentService.runAgent({
    agentType: 'REPORT_NARRATIVE',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(),
    triggerEntityType: scope,
    triggerEntityId: entityId,
    triggeredBy,
  });
}

module.exports = { runReportNarrative };
