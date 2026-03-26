/**
 * Gap Analyst Agent
 * Trigger: "Run Coverage Gap Analysis" on TestPlan Detail page.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a QA architect performing test coverage gap analysis for a software release.
Identify coverage gaps that pose risk to the release.

Analyze:
1. Feature coverage: are all P1 features adequately tested? (min 3 test cases each)
2. Automation gaps: what % of P1 test cases have approved scripts?
3. Untested paths: negative/error path coverage vs happy-path coverage
4. Pre-req blockers: features that cannot be scripted due to incomplete pre-reqs
5. Type coverage: are API, Functional, GUI and Performance all represented?
6. Release risk score: overall release readiness on a 0-100 scale

Output as JSON:
{
  "release_readiness_score": 0-100,
  "release_recommendation": "Go|Conditional Go|No Go",
  "summary": "string",
  "coverage_gaps": [
    {
      "feature_id": ...,
      "feature_name": "...",
      "gap_type": "MISSING_CASES|MISSING_SCRIPTS|PREREQ_BLOCKER|NO_NEGATIVE_TESTS|NO_PERFORMANCE_TESTS",
      "severity": "High|Medium|Low",
      "description": "...",
      "recommended_action": "..."
    }
  ],
  "automation_coverage": {
    "total_cases": ...,
    "scripted": ...,
    "approved": ...,
    "percentage": ...
  },
  "p1_coverage": { "total_p1_features": ..., "adequately_covered": ... },
  "high_risk_areas": ["..."],
  "pre_req_blockers": [{ "feature_id": ..., "missing_items": [...] }]
}`;

const TOOLS = [
  {
    name: 'get_test_plan_full',
    description: 'Returns complete test plan with all features and test cases',
    input_schema: {
      type: 'object',
      properties: { testPlanId: { type: 'number' } },
      required: ['testPlanId'],
    },
  },
  {
    name: 'get_automation_stats',
    description: 'Returns scripting completion metrics for a test plan',
    input_schema: {
      type: 'object',
      properties: { testPlanId: { type: 'number' } },
      required: ['testPlanId'],
    },
  },
  {
    name: 'get_prereq_gaps',
    description: 'Returns all features with incomplete pre-reqs',
    input_schema: {
      type: 'object',
      properties: { testPlanId: { type: 'number' } },
      required: ['testPlanId'],
    },
  },
  {
    name: 'create_gap_suggestions',
    description: 'Saves gap findings to AgentSuggestions table',
    input_schema: {
      type: 'object',
      properties: {
        gaps: { type: 'array' },
        agentRunId: { type: 'number' },
      },
      required: ['gaps'],
    },
  },
];

function buildToolHandlers(testPlanId, agentRunId) {
  return {
    get_test_plan_full: ({ testPlanId: tpId }) => {
      const id = tpId || testPlanId;
      const plan = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(id);
      if (!plan) return { error: 'TestPlan not found' };
      const features = db.prepare(`
        SELECT f.*, COUNT(tc.id) as test_case_count,
          SUM(CASE WHEN tc.status = 'Approved' THEN 1 ELSE 0 END) as approved_cases
        FROM features f
        JOIN test_plan_features tpf ON tpf.feature_id = f.id
        LEFT JOIN test_cases tc ON tc.feature_id = f.id
        WHERE tpf.test_plan_id = ?
        GROUP BY f.id
      `).all(id);
      return { testPlan: plan, features };
    },
    get_automation_stats: ({ testPlanId: tpId }) => {
      const id = tpId || testPlanId;
      const stats = db.prepare(`
        SELECT
          COUNT(DISTINCT tc.id) as total_cases,
          COUNT(DISTINCT rs.test_case_id) as scripted_cases,
          COUNT(DISTINCT CASE WHEN rs.status = 'Approved' THEN rs.test_case_id END) as approved_scripts
        FROM test_cases tc
        JOIN test_plan_features tpf ON tpf.feature_id = tc.feature_id
        LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
        WHERE tpf.test_plan_id = ?
      `).get(id);
      const pct = stats.total_cases > 0
        ? Math.round((stats.approved_scripts / stats.total_cases) * 100)
        : 0;
      return { ...stats, automation_percentage: pct };
    },
    get_prereq_gaps: ({ testPlanId: tpId }) => {
      const id = tpId || testPlanId;
      const gaps = db.prepare(`
        SELECT f.id, f.name, f.prereq_readiness,
          GROUP_CONCAT(p.description, ' | ') as missing_items
        FROM features f
        JOIN test_plan_features tpf ON tpf.feature_id = f.id
        JOIN prerequisites p ON p.feature_id = f.id AND p.is_ready = 0
        WHERE tpf.test_plan_id = ?
        GROUP BY f.id
      `).all(id);
      return { prereqGaps: gaps };
    },
    create_gap_suggestions: ({ gaps, agentRunId: arId }) => {
      const runId = arId || agentRunId;
      const stmt = db.prepare(`
        INSERT INTO agent_suggestions (agent_run_id, suggestion_type, entity_id, content, status)
        VALUES (?, 'GAP', ?, ?, 'Pending')
      `);
      for (const gap of gaps) {
        stmt.run(runId, gap.feature_id || null, JSON.stringify(gap));
      }
      return { saved: gaps.length };
    },
  };
}

async function runGapAnalyst({ testPlanId, triggeredBy }) {
  const plan = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(testPlanId);
  if (!plan) throw new Error(`TestPlan ${testPlanId} not found`);

  const agentRunRow = db.prepare(
    "INSERT INTO agent_runs (agent_type, trigger_entity_type, trigger_entity_id, status) VALUES ('GAP_ANALYST', 'TestPlan', ?, 'Running')"
  ).run(testPlanId);
  const agentRunId = agentRunRow.lastInsertRowid;

  const userMessage = `Perform a comprehensive test coverage gap analysis for:

TestPlan: ${JSON.stringify(plan, null, 2)}

Steps:
1. Use get_test_plan_full to understand all features and their coverage
2. Use get_automation_stats to check scripting coverage
3. Use get_prereq_gaps to identify features blocked by missing prerequisites
4. Identify all coverage gaps (missing cases, missing scripts, type gaps, etc.)
5. Use create_gap_suggestions to save your findings
6. Output the full gap analysis JSON`;

  const result = await agentService.runAgent({
    agentType: 'GAP_ANALYST',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(testPlanId, agentRunId),
    triggerEntityType: 'TestPlan',
    triggerEntityId: testPlanId,
    triggeredBy,
  });

  db.prepare('UPDATE agent_runs SET status = ? WHERE id = ?').run('Completed', agentRunId);
  return result;
}

module.exports = { runGapAnalyst };
