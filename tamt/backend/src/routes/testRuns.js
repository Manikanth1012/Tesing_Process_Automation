const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { test_plan_id, status } = req.query;
  let sql = `
    SELECT tr.*,
      COUNT(te.id) as execution_count,
      SUM(CASE WHEN te.status = 'Pass' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN te.status = 'Fail' THEN 1 ELSE 0 END) as failed,
      e.name as environment_name
    FROM test_runs tr
    LEFT JOIN test_executions te ON te.test_run_id = tr.id
    LEFT JOIN environments e ON e.id = tr.environment_id
    WHERE 1=1
  `;
  const params = [];
  if (test_plan_id) { sql += ' AND tr.test_plan_id = ?'; params.push(test_plan_id); }
  if (status) { sql += ' AND tr.status = ?'; params.push(status); }
  sql += ' GROUP BY tr.id ORDER BY tr.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'TestRun not found' });

  const executions = db.prepare(`
    SELECT te.*, tc.title, tc.test_type, tc.priority
    FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    WHERE te.test_run_id = ?
    ORDER BY te.created_at ASC
  `).all(req.params.id);

  const rfLog = db.prepare('SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
  const agentRuns = db.prepare(
    "SELECT * FROM agent_runs WHERE trigger_entity_type = 'TestRun' AND trigger_entity_id = ? ORDER BY created_at DESC LIMIT 5"
  ).all(req.params.id);

  res.json({ ...run, executions, rfLog, agentRuns });
});

router.post('/', (req, res) => {
  const { test_plan_id, name, environment_id, run_type } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO test_runs (test_plan_id, name, environment_id, run_type, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(test_plan_id || null, name, environment_id || null, run_type || 'Full', req.user.id);

  const runId = result.lastInsertRowid;

  // If test_plan_id provided, auto-create test_executions for all test cases in plan
  if (test_plan_id) {
    const cases = db.prepare(`
      SELECT tc.id FROM test_cases tc
      JOIN test_plan_features tpf ON tpf.feature_id = tc.feature_id
      WHERE tpf.test_plan_id = ? AND tc.status IN ('Approved', 'Active')
    `).all(test_plan_id);

    const stmt = db.prepare('INSERT INTO test_executions (test_run_id, test_case_id) VALUES (?, ?)');
    for (const tc of cases) stmt.run(runId, tc.id);
  }

  res.status(201).json(db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId));
});

router.put('/:id', (req, res) => {
  const { name, status, environment_id, run_type } = req.body;
  db.prepare(`
    UPDATE test_runs SET
      name = COALESCE(?, name), status = COALESCE(?, status),
      environment_id = COALESCE(?, environment_id), run_type = COALESCE(?, run_type),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, status, environment_id, run_type, req.params.id);

  res.json(db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM test_runs WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
