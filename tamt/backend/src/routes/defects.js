const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { feature_id, status, severity, priority, search } = req.query;
  let sql = `
    SELECT d.*, f.name as feature_name, tc.title as test_case_title
    FROM defects d
    LEFT JOIN features f ON f.id = d.feature_id
    LEFT JOIN test_cases tc ON tc.id = d.test_case_id
    WHERE 1=1
  `;
  const params = [];
  if (feature_id) { sql += ' AND d.feature_id = ?'; params.push(feature_id); }
  if (status) { sql += ' AND d.status = ?'; params.push(status); }
  if (severity) { sql += ' AND d.severity = ?'; params.push(severity); }
  if (priority) { sql += ' AND d.priority = ?'; params.push(priority); }
  if (search) { sql += ' AND (d.title LIKE ? OR d.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY d.created_at DESC';

  const defects = db.prepare(sql).all(...params);
  res.json(defects.map(d => ({
    ...d,
    steps_to_reproduce: JSON.parse(d.steps_to_reproduce || '[]'),
    possible_duplicate_ids: JSON.parse(d.possible_duplicate_ids || '[]'),
    regression_scope: JSON.parse(d.regression_scope || '[]'),
  })));
});

router.get('/:id', (req, res) => {
  const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id);
  if (!defect) return res.status(404).json({ error: 'Defect not found' });
  res.json({
    ...defect,
    steps_to_reproduce: JSON.parse(defect.steps_to_reproduce || '[]'),
    possible_duplicate_ids: JSON.parse(defect.possible_duplicate_ids || '[]'),
    regression_scope: JSON.parse(defect.regression_scope || '[]'),
  });
});

router.post('/', (req, res) => {
  const { title, description, severity, priority, test_execution_id, test_case_id, feature_id,
    steps_to_reproduce, expected_behavior, actual_behavior, suggested_assignee_team } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(`
    INSERT INTO defects (title, description, severity, priority, status,
      test_execution_id, test_case_id, feature_id,
      steps_to_reproduce, expected_behavior, actual_behavior,
      suggested_assignee_team, created_by)
    VALUES (?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, description || '', severity || 'Minor', priority || 'P3',
    test_execution_id || null, test_case_id || null, feature_id || null,
    JSON.stringify(steps_to_reproduce || []),
    expected_behavior || '', actual_behavior || '',
    suggested_assignee_team || '',
    req.user.id
  );

  res.status(201).json(db.prepare('SELECT * FROM defects WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { title, description, severity, priority, status, suggested_assignee_team } = req.body;
  db.prepare(`
    UPDATE defects SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      severity = COALESCE(?, severity),
      priority = COALESCE(?, priority),
      status = COALESCE(?, status),
      suggested_assignee_team = COALESCE(?, suggested_assignee_team),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, severity, priority, status, suggested_assignee_team, req.params.id);

  res.json(db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM defects WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
