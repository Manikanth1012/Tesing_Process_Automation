/**
 * Script Generator Agent
 * Trigger: "Generate RF Script" on TestCase detail or bulk on Feature page.
 * Requirements: test case status = 'Approved' AND feature prereq readiness = 100%.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');
const rfService = require('../services/rfService');

const SYSTEM_PROMPT = `You are a Robot Framework expert generating production-ready .robot test scripts
for enterprise telecom BSS software. You write clean, maintainable, and reusable
Robot Framework code.

Rules you MUST follow:
1. Use ONLY libraries from the provided template (no new imports without reason)
2. Test Case name in the script MUST match exactly the title provided
3. All variable references must use RF syntax: \${VARIABLE_NAME}
4. Environment values come from % syntax: %{ENV_VAR_NAME}
5. Write descriptive keyword names (BDD-style preferred: Verify That ... Returns ...)
6. Extract reusable steps into Named Keywords section — never inline everything
7. Use robot's built-in retry mechanisms for flaky network calls
8. For API tests: validate both status code AND response body schema
9. For GUI tests: add explicit waits — never use Sleep; use Wait Until keywords
10. For Performance: use meaningful thresholds from the test case's SLA definition
11. Add [Documentation] tags on both Keywords and Test Cases
12. Add [Tags] using the test case's tags array

Output ONLY the complete .robot file content as a code block.
No explanations before or after the script.`;

const TOOLS = [
  {
    name: 'get_test_case_full',
    description: 'Returns full test case details with feature, prereqs, and API contract',
    input_schema: {
      type: 'object',
      properties: {
        testCaseId: { type: 'number' },
      },
      required: ['testCaseId'],
    },
  },
  {
    name: 'get_script_template',
    description: 'Fetches the base .robot template for a given feature type',
    input_schema: {
      type: 'object',
      properties: {
        featureType: { type: 'string' },
      },
      required: ['featureType'],
    },
  },
  {
    name: 'get_similar_scripts',
    description: 'Fetches top-3 existing approved scripts as reference',
    input_schema: {
      type: 'object',
      properties: {
        featureType: { type: 'string' },
        keyword: { type: 'string' },
      },
      required: ['featureType'],
    },
  },
  {
    name: 'save_draft_script',
    description: 'Saves the generated script as Draft in RobotScripts and writes to /scripts/',
    input_schema: {
      type: 'object',
      properties: {
        testCaseId: { type: 'number' },
        scriptContent: { type: 'string' },
        fileName: { type: 'string' },
        featureType: { type: 'string' },
      },
      required: ['testCaseId', 'scriptContent'],
    },
  },
  {
    name: 'validate_script',
    description: 'Runs robot --dryrun on the script and returns validation errors',
    input_schema: {
      type: 'object',
      properties: {
        scriptContent: { type: 'string' },
        testCaseId: { type: 'number' },
      },
      required: ['scriptContent'],
    },
  },
];

function buildToolHandlers(testCaseId) {
  return {
    get_test_case_full: ({ testCaseId: tcId }) => {
      const id = tcId || testCaseId;
      const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
      if (!tc) return { error: 'TestCase not found' };
      const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(tc.feature_id);
      const prereqs = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(tc.feature_id);
      const contract = db.prepare('SELECT file_name, content FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(tc.feature_id);
      return {
        testCase: { ...tc, steps: JSON.parse(tc.steps || '[]'), tags: JSON.parse(tc.tags || '[]') },
        feature,
        prerequisites: prereqs,
        apiContract: contract,
      };
    },
    get_script_template: ({ featureType }) => {
      const tmpl = db.prepare('SELECT * FROM script_templates WHERE feature_type = ? AND is_default = 1 LIMIT 1').get(featureType);
      return tmpl || { error: `No template found for ${featureType}` };
    },
    get_similar_scripts: ({ featureType, keyword }) => {
      const scripts = db.prepare(`
        SELECT rs.script_name, rs.script_content, rs.status, tc.title
        FROM robot_scripts rs
        JOIN test_cases tc ON tc.id = rs.test_case_id
        JOIN features f ON f.id = tc.feature_id
        WHERE rs.status = 'Approved' AND f.feature_type = ? AND (tc.title LIKE ? OR rs.script_name LIKE ?)
        ORDER BY rs.id DESC LIMIT 3
      `).all(featureType, `%${keyword || ''}%`, `%${keyword || ''}%`);
      return { scripts };
    },
    save_draft_script: async ({ testCaseId: tcId, scriptContent, featureType }) => {
      const id = tcId || testCaseId;
      const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
      if (!tc) return { error: 'TestCase not found' };
      const ft = featureType || tc.test_type || 'Functional';
      const saved = rfService.generateScript(id, scriptContent, ft);
      return {
        ...saved,
        _suggestions: [{ type: 'SCRIPT_CONTENT', entityId: saved.id, content: { testCaseId: id, scriptName: saved.fileName, version: saved.version } }],
      };
    },
    validate_script: async ({ scriptContent, testCaseId: tcId }) => {
      return rfService.validateScript(scriptContent, tcId || testCaseId);
    },
  };
}

async function runScriptGenerator({ testCaseId, triggeredBy }) {
  const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(testCaseId);
  if (!tc) throw new Error(`TestCase ${testCaseId} not found`);

  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(tc.feature_id);
  if (!feature) throw new Error('Parent feature not found');

  if (feature.prereq_readiness < 100) {
    throw new Error(`Feature pre-req readiness is ${feature.prereq_readiness}%. Must be 100% to generate scripts.`);
  }

  const template = db.prepare('SELECT template_content FROM script_templates WHERE feature_type = ? AND is_default = 1 LIMIT 1').get(feature.feature_type);
  const contract = db.prepare('SELECT file_name, content FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(feature.id);

  const userMessage = `Generate a production-ready Robot Framework script for this test case:

Test Case Title (MUST match exactly in script): "${tc.title}"
Test Type: ${tc.test_type}
Tags: ${tc.tags}
Description: ${tc.description}
Steps: ${tc.steps}
Expected Result: ${tc.expected_result}

Feature: ${feature.name} (Type: ${feature.feature_type})

Base Template:
\`\`\`
${template?.template_content || '# No template — use standard RF structure'}
\`\`\`

${contract ? `API Contract: ${contract.file_name}\n${contract.content?.substring(0, 2000) || ''}` : ''}

Steps:
1. Use get_test_case_full to get complete context
2. Use get_similar_scripts to find reference implementations
3. Generate the complete .robot script content
4. Use save_draft_script to save it
5. Use validate_script to check for errors
6. If validation errors exist, fix them and save again`;

  return agentService.runAgent({
    agentType: 'SCRIPT_GENERATOR',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(testCaseId),
    triggerEntityType: 'TestCase',
    triggerEntityId: testCaseId,
    triggeredBy,
  });
}

module.exports = { runScriptGenerator };
