const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { feature_id } = req.query;
  let sql = 'SELECT * FROM prerequisites WHERE 1=1';
  const params = [];
  if (feature_id) { sql += ' AND feature_id = ?'; params.push(feature_id); }
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { feature_id, category, description } = req.body;
  if (!feature_id || !category || !description) {
    return res.status(400).json({ error: 'feature_id, category, description required' });
  }
  const result = db.prepare(
    'INSERT INTO prerequisites (feature_id, category, description) VALUES (?, ?, ?)'
  ).run(feature_id, category, description);
  res.status(201).json(db.prepare('SELECT * FROM prerequisites WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { is_ready, notes, category, description } = req.body;
  db.prepare(`
    UPDATE prerequisites SET
      is_ready = COALESCE(?, is_ready),
      notes = COALESCE(?, notes),
      category = COALESCE(?, category),
      description = COALESCE(?, description),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    is_ready !== undefined ? (is_ready ? 1 : 0) : null,
    notes, category, description, req.params.id
  );

  const prereq = db.prepare('SELECT * FROM prerequisites WHERE id = ?').get(req.params.id);
  if (prereq) {
    const stats = db.prepare(
      'SELECT COUNT(*) as total, SUM(is_ready) as ready FROM prerequisites WHERE feature_id = ?'
    ).get(prereq.feature_id);
    const readiness = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
    db.prepare('UPDATE features SET prereq_readiness = ? WHERE id = ?').run(readiness, prereq.feature_id);
  }

  res.json(prereq);
});

router.delete('/:id', (req, res) => {
  const prereq = db.prepare('SELECT feature_id FROM prerequisites WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM prerequisites WHERE id = ?').run(req.params.id);

  if (prereq) {
    const stats = db.prepare(
      'SELECT COUNT(*) as total, SUM(is_ready) as ready FROM prerequisites WHERE feature_id = ?'
    ).get(prereq.feature_id);
    const readiness = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
    db.prepare('UPDATE features SET prereq_readiness = ? WHERE id = ?').run(readiness, prereq.feature_id);
  }

  res.json({ deleted: true });
});

module.exports = router;
