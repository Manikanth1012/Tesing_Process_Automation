const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const plans = db.prepare(`
    SELECT tp.*,
      COUNT(DISTINCT tpf.feature_id) as feature_count,
      COUNT(DISTINCT tr.id) as run_count
    FROM test_plans tp
    LEFT JOIN test_plan_features tpf ON tpf.test_plan_id = tp.id
    LEFT JOIN test_runs tr ON tr.test_plan_id = tp.id
    GROUP BY tp.id
    ORDER BY tp.created_at DESC
  `).all();
  res.json(plans);
});

router.get('/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'TestPlan not found' });

  const features = db.prepare(`
    SELECT f.*, COUNT(tc.id) as test_case_count
    FROM features f
    JOIN test_plan_features tpf ON tpf.feature_id = f.id
    LEFT JOIN test_cases tc ON tc.feature_id = f.id
    WHERE tpf.test_plan_id = ?
    GROUP BY f.id
  `).all(req.params.id);

  const testRuns = db.prepare('SELECT * FROM test_runs WHERE test_plan_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({ ...plan, features, testRuns });
});

router.post('/', (req, res) => {
  const { name, description, target_release, start_date, end_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO test_plans (name, description, target_release, start_date, end_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description || '', target_release || '', start_date || null, end_date || null, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM test_plans WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, description, target_release, status, start_date, end_date } = req.body;
  db.prepare(`
    UPDATE test_plans SET
      name = COALESCE(?, name), description = COALESCE(?, description),
      target_release = COALESCE(?, target_release), status = COALESCE(?, status),
      start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description, target_release, status, start_date, end_date, req.params.id);

  res.json(db.prepare('SELECT * FROM test_plans WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM test_plans WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// POST /test-plans/:id/features — add feature to plan
router.post('/:id/features', (req, res) => {
  const { feature_id } = req.body;
  if (!feature_id) return res.status(400).json({ error: 'feature_id required' });

  try {
    db.prepare('INSERT INTO test_plan_features (test_plan_id, feature_id) VALUES (?, ?)').run(req.params.id, feature_id);
    res.status(201).json({ added: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Feature already in plan' });
    throw e;
  }
});

// DELETE /test-plans/:id/features/:featureId
router.delete('/:id/features/:featureId', (req, res) => {
  db.prepare('DELETE FROM test_plan_features WHERE test_plan_id = ? AND feature_id = ?').run(req.params.id, req.params.featureId);
  res.json({ removed: true });
});

module.exports = router;
