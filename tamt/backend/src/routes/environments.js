const express = require('express');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM environments WHERE is_active = 1 ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, base_url, env_type, variables } = req.body;
  if (!name || !base_url) return res.status(400).json({ error: 'name and base_url required' });

  const result = db.prepare(
    'INSERT INTO environments (name, base_url, env_type, variables) VALUES (?, ?, ?, ?)'
  ).run(name, base_url, env_type || 'SIT', JSON.stringify(variables || {}));

  res.status(201).json(db.prepare('SELECT * FROM environments WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, base_url, env_type, variables, is_active } = req.body;
  db.prepare(`
    UPDATE environments SET
      name = COALESCE(?, name), base_url = COALESCE(?, base_url),
      env_type = COALESCE(?, env_type),
      variables = COALESCE(?, variables),
      is_active = COALESCE(?, is_active),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, base_url, env_type, variables ? JSON.stringify(variables) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);

  res.json(db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE environments SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
