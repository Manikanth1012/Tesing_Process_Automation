/**
 * Test Case Generator Agent
 * Trigger: "Generate Test Cases" on Feature Detail (readiness >= 70% required).
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a senior QA engineer expert in Robot Framework test design for
enterprise BSS/CRM software. Given a software Feature and its inputs,
generate a comprehensive set of test cases.

Follow this approach:
1. Identify all functional flows: happy path, alternate paths, negative paths
2. For API features: cover each endpoint × method × key variations
3. For GUI features: cover user journeys end-to-end with configuration steps
4. For Performance: define SLA thresholds and load profiles
5. Apply equivalence partitioning and boundary value analysis
6. Ensure each test case is atomic (tests exactly one thing)
7. Check existing test cases provided — do not duplicate

Output format — one JSON array of test case objects:
[{
  "title": "string — exact name to use as Robot Framework Test Case name",
  "description": "what this test validates",
  "test_type": "API|Functional|GUI|Performance",
  "priority": "P1|P2|P3",
  "steps": [
    { "step": 1, "action": "...", "expected_result": "..." }
  ],
  "expected_result": "overall pass criteria",
  "tags": ["smoke", "regression", "sanity"],
  "rf_keywords_hint": ["suggested Robot Framework keywords to use"]
}]

Generate at minimum:
  - API: 3 test cases per endpoint (success, validation error, auth failure)
  - Functional: 5-8 cases covering all user story acceptance criteria
  - GUI: 4-6 cases per user journey
  - Performance: 3 cases (baseline, peak load, stress)`;

const TOOLS = [
  {
    name: 'get_feature_with_context',
    description: 'Returns full feature details with prereqs, API contract, and existing test cases',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'create_test_case',
    description: 'Saves a generated test case to the database',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number' },
        title: { type: 'string' },
        description: { type: 'string' },
        testType: { type: 'string' },
        priority: { type: 'string' },
        steps: { type: 'array' },
        expectedResult: { type: 'string' },
        tags: { type: 'array' },
        rfKeywordsHint: { type: 'array' },
        agentRunId: { type: 'number' },
      },
      required: ['featureId', 'title'],
    },
  },
  {
    name: 'get_similar_test_patterns',
    description: 'Retrieves test cases from similar past features as reference patterns',
    input_schema: {
      type: 'object',
      properties: {
        featureType: { type: 'string' },
        keyword: { type: 'string' },
      },
      required: ['featureType'],
    },
  },
];

function buildToolHandlers(featureId, agentRunId) {
  return {
    get_feature_with_context: ({ featureId: fid }) => {
      const id = fid || featureId;
      const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(id);
      if (!feature) return { error: 'Feature not found' };
      const prereqs = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(id);
      const contract = db.prepare('SELECT file_name, content FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(id);
      const existingCases = db.prepare('SELECT id, title, test_type, priority FROM test_cases WHERE feature_id = ?').all(id);
      return { feature, prerequisites: prereqs, apiContract: contract, existingTestCases: existingCases };
    },
    create_test_case: ({ featureId: fid, title, description, testType, priority, steps, expectedResult, tags, rfKeywordsHint }) => {
      const id = fid || featureId;
      // Check for duplicate title
      const existing = db.prepare('SELECT id FROM test_cases WHERE feature_id = ? AND title = ?').get(id, title);
      if (existing) return { skipped: true, reason: 'Duplicate title', title };

      const result = db.prepare(`
        INSERT INTO test_cases (feature_id, title, description, test_type, priority, steps, expected_result, tags, rf_keywords_hint, generated_by, agent_run_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Agent', ?, 'Draft')
      `).run(
        id, title, description || '', testType || 'Functional', priority || 'P2',
        JSON.stringify(steps || []), expectedResult || '',
        JSON.stringify(tags || []), JSON.stringify(rfKeywordsHint || []),
        agentRunId
      );
      return {
        created: true,
        testCaseId: result.lastInsertRowid,
        title,
        _suggestions: [{ type: 'TEST_CASE', entityId: result.lastInsertRowid, content: { title, description, testType, priority } }],
      };
    },
    get_similar_test_patterns: ({ featureType, keyword }) => {
      const cases = db.prepare(`
        SELECT tc.title, tc.description, tc.test_type, tc.priority, tc.steps, tc.expected_result, tc.tags
        FROM test_cases tc
        JOIN features f ON f.id = tc.feature_id
        WHERE f.feature_type = ? AND (tc.title LIKE ? OR tc.description LIKE ?)
        LIMIT 10
      `).all(featureType, `%${keyword || ''}%`, `%${keyword || ''}%`);
      return { patterns: cases };
    },
  };
}

async function runTestCaseGenerator({ featureId, triggeredBy }) {
  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(featureId);
  if (!feature) throw new Error(`Feature ${featureId} not found`);

  if (feature.prereq_readiness < 70) {
    throw new Error(`Feature readiness is ${feature.prereq_readiness}%. Minimum 70% required to generate test cases.`);
  }

  const prereqs = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(featureId);
  const existing = db.prepare('SELECT title FROM test_cases WHERE feature_id = ?').all(featureId);
  const contract = db.prepare('SELECT file_name, content FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(featureId);
  const template = db.prepare('SELECT template_content FROM script_templates WHERE feature_type = ? AND is_default = 1 LIMIT 1').get(feature.feature_type);

  // Create a placeholder agent run id for linking
  const tempRun = db.prepare(`
    INSERT INTO agent_runs (agent_type, trigger_entity_type, trigger_entity_id, status) VALUES ('TESTCASE_GENERATOR', 'Feature', ?, 'Running')
  `).run(featureId);
  const agentRunId = tempRun.lastInsertRowid;

  const userMessage = `Generate comprehensive test cases for this feature:

Feature: ${JSON.stringify(feature, null, 2)}
Feature Type: ${feature.feature_type}
Priority: ${feature.priority}

Prerequisites (readiness: ${feature.prereq_readiness}%):
${JSON.stringify(prereqs, null, 2)}

${contract ? `API Contract: ${contract.file_name}\n${contract.content?.substring(0, 3000) || 'Content available'}` : 'No API contract.'}

Existing test cases (do NOT duplicate these):
${JSON.stringify(existing.map(e => e.title), null, 2)}

Script template structure for reference:
${template?.template_content?.substring(0, 500) || 'Standard template'}

Use the create_test_case tool to save each test case as you generate it.`;

  const result = await agentService.runAgent({
    agentType: 'TESTCASE_GENERATOR',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(featureId, agentRunId),
    triggerEntityType: 'Feature',
    triggerEntityId: featureId,
    triggeredBy,
  });

  // Update the pre-created agent run record with the actual one
  db.prepare('UPDATE agent_runs SET status = ? WHERE id = ?').run('Completed', agentRunId);

  return result;
}

module.exports = { runTestCaseGenerator };
