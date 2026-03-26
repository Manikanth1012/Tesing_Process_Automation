/**
 * Pre-Requisite Analyst Agent
 * Trigger: "Analyse Pre-Reqs" button on Feature Detail page.
 * Assesses readiness of a feature for test scripting.
 */

const db = require('../config/database');
const agentService = require('../services/agentService');

const SYSTEM_PROMPT = `You are a senior QA analyst specializing in test readiness for telecom BSS software.
Your job is to analyze the provided Feature and its inputs, then produce a structured
Pre-Requisite readiness assessment.

You have access to tools to read API spec files and query the database.
Follow this reasoning process:
1. Read the API spec or user stories provided
2. Identify what is explicitly available vs what is missing
3. For each pre-requisite category relevant to this feature_type, assess readiness
4. Flag specific blockers with actionable guidance on how to resolve them
5. Suggest any additional pre-req items the team may have missed

Return your assessment as structured JSON with this shape:
{
  "readiness_score": 0-100,
  "summary": "2-3 sentence plain English summary",
  "items": [
    {
      "category": "API_SPEC|SWAGGER|INPUTS|TEST_DATA|ENVIRONMENT|CREDENTIALS|USER_STORIES",
      "description": "what specifically is needed",
      "is_ready": true|false,
      "gap": "what is missing (if not ready)",
      "action": "specific action to close the gap"
    }
  ],
  "blockers": ["list of critical blockers that will stop scripting"],
  "risks": ["list of risks if scripting proceeds despite gaps"]
}`;

const TOOLS = [
  {
    name: 'get_feature_details',
    description: 'Returns full feature details including existing prerequisites',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number', description: 'Feature ID' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'read_api_contract',
    description: 'Reads the content of an uploaded API contract/Swagger file for a feature',
    input_schema: {
      type: 'object',
      properties: {
        featureId: { type: 'number', description: 'Feature ID to get contract for' },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'search_similar_features',
    description: 'Finds similar past features and their prereq patterns for comparison',
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
    name: 'update_prerequisite',
    description: 'Updates a prerequisite readiness status',
    input_schema: {
      type: 'object',
      properties: {
        prereqId: { type: 'number' },
        isReady: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['prereqId', 'isReady'],
    },
  },
];

function buildToolHandlers(featureId) {
  return {
    get_feature_details: ({ featureId: fid }) => {
      const id = fid || featureId;
      const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(id);
      if (!feature) return { error: 'Feature not found' };
      const prereqs = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(id);
      return { feature, prerequisites: prereqs };
    },
    read_api_contract: ({ featureId: fid }) => {
      const id = fid || featureId;
      const contract = db.prepare('SELECT * FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(id);
      if (!contract) return { content: null, message: 'No API contract uploaded for this feature' };
      return { contractId: contract.id, fileName: contract.file_name, content: contract.content };
    },
    search_similar_features: ({ featureType, keyword }) => {
      const features = db.prepare(
        `SELECT f.*, COUNT(tc.id) as test_case_count,
          SUM(CASE WHEN p.is_ready = 1 THEN 1 ELSE 0 END) as ready_prereqs,
          COUNT(p.id) as total_prereqs
         FROM features f
         LEFT JOIN test_cases tc ON tc.feature_id = f.id
         LEFT JOIN prerequisites p ON p.feature_id = f.id
         WHERE f.feature_type = ? AND (f.name LIKE ? OR f.description LIKE ?)
         GROUP BY f.id LIMIT 5`
      ).all(featureType, `%${keyword || ''}%`, `%${keyword || ''}%`);
      return { similarFeatures: features };
    },
    update_prerequisite: ({ prereqId, isReady, notes }) => {
      db.prepare('UPDATE prerequisites SET is_ready = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(isReady ? 1 : 0, notes || null, prereqId);
      // Recalculate feature readiness
      const prereq = db.prepare('SELECT feature_id FROM prerequisites WHERE id = ?').get(prereqId);
      if (prereq) {
        const stats = db.prepare(
          'SELECT COUNT(*) as total, SUM(is_ready) as ready FROM prerequisites WHERE feature_id = ?'
        ).get(prereq.feature_id);
        const readiness = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
        db.prepare('UPDATE features SET prereq_readiness = ? WHERE id = ?').run(readiness, prereq.feature_id);
      }
      return { success: true, prereqId, isReady };
    },
  };
}

async function runPrereqAnalyst({ featureId, triggeredBy }) {
  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(featureId);
  if (!feature) throw new Error(`Feature ${featureId} not found`);

  const prereqs = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(featureId);
  const contract = db.prepare('SELECT file_name, content FROM api_contracts WHERE feature_id = ? ORDER BY id DESC LIMIT 1').get(featureId);

  const userMessage = `Analyse the test readiness of this feature:

Feature: ${JSON.stringify(feature, null, 2)}

Existing Prerequisites (${prereqs.length}):
${JSON.stringify(prereqs, null, 2)}

${contract ? `API Contract available: ${contract.file_name}` : 'No API contract uploaded.'}

Please use the tools to gather more context, then provide a comprehensive readiness assessment.
Focus on identifying what is missing and what specific actions are needed before scripting can begin.`;

  return agentService.runAgent({
    agentType: 'PREREQ_ANALYST',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    toolHandlers: buildToolHandlers(featureId),
    triggerEntityType: 'Feature',
    triggerEntityId: featureId,
    triggeredBy,
  });
}

module.exports = { runPrereqAnalyst };
