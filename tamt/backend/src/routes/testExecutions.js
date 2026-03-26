const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { test_run_id, status } = req.query;
  let sql = `
    SELECT te.*, tc.title, tc.test_type, tc.priority
    FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    WHERE 1=1
  `;
  const params = [];
  if (test_run_id) { sql += ' AND te.test_run_id = ?'; params.push(test_run_id); }
  if (status) { sql += ' AND te.status = ?'; params.push(status); }
  sql += ' ORDER BY te.created_at ASC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const exec = db.prepare(`
    SELECT te.*, tc.title, tc.description, tc.steps, tc.expected_result, tc.test_type
    FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    WHERE te.id = ?
  `).get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'TestExecution not found' });

  const defects = db.prepare('SELECT * FROM defects WHERE test_execution_id = ?').all(req.params.id);
  res.json({ ...exec, defects });
});

router.post('/', (req, res) => {
  const { test_run_id, test_case_id } = req.body;
  if (!test_run_id || !test_case_id) return res.status(400).json({ error: 'test_run_id and test_case_id required' });

  const result = db.prepare(
    'INSERT INTO test_executions (test_run_id, test_case_id) VALUES (?, ?)'
  ).run(test_run_id, test_case_id);

  res.status(201).json(db.prepare('SELECT * FROM test_executions WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { status, actual_result, notes } = req.body;
  const now = status && status !== 'Pending' ? 'CURRENT_TIMESTAMP' : null;

  db.prepare(`
    UPDATE test_executions SET
      status = COALESCE(?, status),
      actual_result = COALESCE(?, actual_result),
      notes = COALESCE(?, notes),
      executed_at = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE executed_at END,
      executed_by = CASE WHEN ? IS NOT NULL THEN ? ELSE executed_by END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, actual_result, notes, status, status, req.user.id, req.params.id);

  res.json(db.prepare('SELECT * FROM test_executions WHERE id = ?').get(req.params.id));
});

module.exports = router;
