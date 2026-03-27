const express = require('express');
const db = require('../config/database');
const { index } = require('../services/vectorService');

const router = express.Router();

router.get('/', (req, res) => {
  const { feature_id, status, test_type, priority, search } = req.query;
  let sql = `
    SELECT tc.*, COUNT(rs.id) as script_count
    FROM test_cases tc
    LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
    WHERE 1=1
  `;
  const params = [];
  if (feature_id) { sql += ' AND tc.feature_id = ?'; params.push(feature_id); }
  if (status) { sql += ' AND tc.status = ?'; params.push(status); }
  if (test_type) { sql += ' AND tc.test_type = ?'; params.push(test_type); }
  if (priority) { sql += ' AND tc.priority = ?'; params.push(priority); }
  if (search) { sql += ' AND (tc.title LIKE ? OR tc.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' GROUP BY tc.id ORDER BY tc.created_at DESC';

  const cases = db.prepare(sql).all(...params);
  res.json(cases.map(tc => ({
    ...tc,
    steps: JSON.parse(tc.steps || '[]'),
    tags: JSON.parse(tc.tags || '[]'),
    rf_keywords_hint: JSON.parse(tc.rf_keywords_hint || '[]'),
  })));
});

router.get('/:id', (req, res) => {
  const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
  if (!tc) return res.status(404).json({ error: 'TestCase not found' });

  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(tc.feature_id);
  const scripts = db.prepare('SELECT * FROM robot_scripts WHERE test_case_id = ? ORDER BY version DESC').all(req.params.id);

  res.json({
    ...tc,
    steps: JSON.parse(tc.steps || '[]'),
    tags: JSON.parse(tc.tags || '[]'),
    rf_keywords_hint: JSON.parse(tc.rf_keywords_hint || '[]'),
    feature,
    scripts,
  });
});

router.post('/', (req, res) => {
  const { feature_id, title, description, test_type, priority, steps, expected_result, tags, rf_keywords_hint } = req.body;
  if (!feature_id || !title) return res.status(400).json({ error: 'feature_id and title required' });

  const ttype = test_type || 'Functional';
  const result = db.prepare(`
    INSERT INTO test_cases (feature_id, title, description, test_type, priority, steps, expected_result, tags, rf_keywords_hint, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    feature_id, title, description || '', ttype, priority || 'P2',
    JSON.stringify(steps || []), expected_result || '',
    JSON.stringify(tags || []), JSON.stringify(rf_keywords_hint || []),
    req.user.id
  );

  const created = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(result.lastInsertRowid);
  // Auto-index for RAG
  const feat = db.prepare('SELECT name FROM features WHERE id = ?').get(feature_id);
  index('TestCase', created.id, `${title} ${description || ''} ${ttype} ${priority || 'P2'} ${feat?.name || ''}`,
    { title, type: ttype, priority: priority || 'P2', status: 'Draft', feature: feat?.name }).catch(() => {});
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const { title, description, test_type, priority, status, steps, expected_result, tags, rf_keywords_hint, automation_status } = req.body;
  const tc = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(req.params.id);
  if (!tc) return res.status(404).json({ error: 'TestCase not found' });

  db.prepare(`
    UPDATE test_cases SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      test_type = COALESCE(?, test_type),
      priority = COALESCE(?, priority),
      status = COALESCE(?, status),
      automation_status = COALESCE(?, automation_status),
      steps = COALESCE(?, steps),
      expected_result = COALESCE(?, expected_result),
      tags = COALESCE(?, tags),
      rf_keywords_hint = COALESCE(?, rf_keywords_hint),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, description, test_type, priority, status, automation_status,
    steps ? JSON.stringify(steps) : null,
    expected_result,
    tags ? JSON.stringify(tags) : null,
    rf_keywords_hint ? JSON.stringify(rf_keywords_hint) : null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
