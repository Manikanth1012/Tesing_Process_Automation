/**
 * TAMT Vector Service — Semantic context indexing & retrieval for RAG
 *
 * Default engine: TF-IDF cosine similarity (zero extra dependencies, in-process)
 * Enhanced engine: Voyage AI embeddings (set VOYAGE_API_KEY env var)
 *
 * Stores index data in SQLite `context_embeddings` table.
 */

const db     = require('../config/database');
const axios  = require('axios');

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_MODEL   = 'voyage-3-lite'; // small, fast, low cost

// ─── Stop words ──────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'it','its','this','that','these','those','i','we','you','he','she','they',
  'what','which','who','when','where','how','not','no','nor','so','yet',
  'both','either','neither','each','few','more','most','other','such',
  'than','too','very','just','because','as','until','while','although',
]);

// ─── Tokenisation ─────────────────────────────────────────────────────────────
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function termFreq(tokens) {
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return freq;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────
function cosineSim(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, magA = 0, magB = 0;
  keys.forEach(k => {
    const a = vecA[k] || 0;
    const b = vecB[k] || 0;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  });
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Compute IDF weights from entire corpus ───────────────────────────────────
function buildIdfWeights(rows) {
  const df = {};  // document frequency
  rows.forEach(row => {
    const terms = JSON.parse(row.term_freq || '{}');
    Object.keys(terms).forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  const N = rows.length;
  const idf = {};
  Object.entries(df).forEach(([t, count]) => {
    idf[t] = Math.log((N + 1) / (count + 1)) + 1; // smoothed
  });
  return idf;
}

// ─── Voyage AI real embeddings (optional) ─────────────────────────────────────
async function voyageEmbed(texts) {
  const res = await axios.post(
    'https://api.voyageai.com/v1/embeddings',
    { model: VOYAGE_MODEL, input: texts },
    { headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  return res.data.data.map(d => d.embedding);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Index (upsert) a document into the vector store.
 * @param {string} entityType  'Feature' | 'TestCase' | 'TestPlan' | 'Project'
 * @param {number} entityId
 * @param {string} text        The text to index (name + description + type + etc.)
 * @param {object} metadata    Extra fields stored alongside (for display in context)
 */
async function index(entityType, entityId, text, metadata = {}) {
  try {
    const tokens  = tokenize(text);
    const freq    = termFreq(tokens);

    if (VOYAGE_API_KEY) {
      // Store real embedding vector alongside TF for hybrid retrieval
      const [vec] = await voyageEmbed([text]);
      db.prepare(`
        INSERT INTO context_embeddings (entity_type, entity_id, text_content, term_freq, doc_length, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET
          text_content = excluded.text_content,
          term_freq    = excluded.term_freq,
          doc_length   = excluded.doc_length,
          metadata     = excluded.metadata,
          updated_at   = CURRENT_TIMESTAMP
      `).run(entityType, entityId, text, JSON.stringify(freq), tokens.length, JSON.stringify({ ...metadata, _vec: vec }));
    } else {
      db.prepare(`
        INSERT INTO context_embeddings (entity_type, entity_id, text_content, term_freq, doc_length, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET
          text_content = excluded.text_content,
          term_freq    = excluded.term_freq,
          doc_length   = excluded.doc_length,
          metadata     = excluded.metadata,
          updated_at   = CURRENT_TIMESTAMP
      `).run(entityType, entityId, text, JSON.stringify(freq), tokens.length, JSON.stringify(metadata));
    }
  } catch (err) {
    console.warn(`[VectorService] index error for ${entityType}#${entityId}:`, err.message);
  }
}

/**
 * Search the vector store for the top-K most relevant documents.
 * @param {string}   queryText
 * @param {number}   topK
 * @param {string[]} [entityTypes]  Filter by entity types (undefined = all)
 * @returns {{ entityType, entityId, score, metadata, snippet }[]}
 */
async function search(queryText, topK = 5, entityTypes) {
  try {
    let rows = entityTypes && entityTypes.length
      ? db.prepare(`SELECT * FROM context_embeddings WHERE entity_type IN (${entityTypes.map(() => '?').join(',')})`)
           .all(...entityTypes)
      : db.prepare('SELECT * FROM context_embeddings').all();

    if (rows.length === 0) return [];

    if (VOYAGE_API_KEY) {
      // Voyage vector similarity
      const [qVec] = await voyageEmbed([queryText]);
      const scored = rows.map(row => {
        const meta = JSON.parse(row.metadata || '{}');
        const docVec = meta._vec;
        if (!Array.isArray(docVec)) return { ...row, score: 0 };
        // Dot product (Voyage embeddings are already normalised)
        const dot = qVec.reduce((s, v, i) => s + v * (docVec[i] || 0), 0);
        return { ...row, score: dot };
      });
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(r => r.score > 0.3)
        .map(r => {
          const meta = JSON.parse(r.metadata || '{}');
          const { _vec, ...cleanMeta } = meta;
          return {
            entityType: r.entity_type, entityId: r.entity_id,
            score: r.score, metadata: cleanMeta,
            snippet: r.text_content.slice(0, 300),
          };
        });
    }

    // TF-IDF cosine similarity
    const idf    = buildIdfWeights(rows);
    const qTokens = tokenize(queryText);
    const qFreq   = termFreq(qTokens);

    // Apply IDF to query
    const qVec = {};
    Object.entries(qFreq).forEach(([t, c]) => { qVec[t] = c * (idf[t] || 1); });

    const scored = rows.map(row => {
      const freq = JSON.parse(row.term_freq || '{}');
      // Apply IDF to doc
      const dVec = {};
      Object.entries(freq).forEach(([t, c]) => { dVec[t] = c * (idf[t] || 1); });
      return { ...row, score: cosineSim(qVec, dVec) };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(r => r.score > 0.05)
      .map(r => ({
        entityType: r.entity_type, entityId: r.entity_id,
        score: r.score, metadata: JSON.parse(r.metadata || '{}'),
        snippet: r.text_content.slice(0, 300),
      }));
  } catch (err) {
    console.warn('[VectorService] search error:', err.message);
    return [];
  }
}

/**
 * Re-index all existing entities (run on startup or demand).
 */
async function reindexAll() {
  console.log('[VectorService] Starting full re-index...');
  let count = 0;

  const features = db.prepare('SELECT * FROM features').all();
  for (const f of features) {
    await index('Feature', f.id,
      `${f.name} ${f.description || ''} ${f.feature_type} ${f.api_sub_type || ''} ${f.priority}`,
      { name: f.name, type: f.feature_type, priority: f.priority, status: f.status }
    );
    count++;
  }

  const testCases = db.prepare(`
    SELECT tc.*, f.name as feature_name FROM test_cases tc
    LEFT JOIN features f ON f.id = tc.feature_id
  `).all();
  for (const tc of testCases) {
    await index('TestCase', tc.id,
      `${tc.title} ${tc.description || ''} ${tc.test_type} ${tc.priority} ${tc.feature_name || ''}`,
      { title: tc.title, type: tc.test_type, priority: tc.priority, status: tc.status, feature: tc.feature_name }
    );
    count++;
  }

  const testPlans = db.prepare(`
    SELECT tp.*, p.name as project_name FROM test_plans tp
    LEFT JOIN projects p ON p.id = tp.project_id
  `).all();
  for (const tp of testPlans) {
    await index('TestPlan', tp.id,
      `${tp.name} ${tp.description || ''} ${tp.target_release || ''} ${tp.project_name || ''}`,
      { name: tp.name, status: tp.status, release: tp.target_release, project: tp.project_name }
    );
    count++;
  }

  const projects = db.prepare('SELECT * FROM projects').all();
  for (const p of projects) {
    await index('Project', p.id,
      `${p.name} ${p.key} ${p.description || ''}`,
      { name: p.name, key: p.key, status: p.status }
    );
    count++;
  }

  console.log(`[VectorService] Re-index complete: ${count} documents indexed.`);
  return count;
}

module.exports = { index, search, reindexAll, tokenize };
