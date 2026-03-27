const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const router = express.Router();

const SAFE_COLS = 'id, name, email, role, system_role, is_active, created_at, last_login';

// GET /users
router.get('/', (req, res) => {
  const users = db.prepare(`SELECT ${SAFE_COLS} FROM users ORDER BY created_at`).all();
  res.json(users);
});

// GET /users/:id
router.get('/:id', (req, res) => {
  const user = db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const projects = db.prepare(`
    SELECT p.id, p.name, p.key, pm.role
    FROM project_members pm JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = ?
  `).all(req.params.id);
  res.json({ ...user, projects });
});

// POST /users  – create user (admin only in production)
router.post('/', async (req, res) => {
  const { name, email, password, role = 'QA_ENGINEER', system_role = 'User' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password are required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, system_role) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hash, role, system_role);

    const user = db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already in use' });
    throw err;
  }
});

// PUT /users/:id
router.put('/:id', async (req, res) => {
  const { name, email, password, role, system_role, is_active } = req.body;
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      password_hash = COALESCE(?, password_hash),
      role = COALESCE(?, role),
      system_role = COALESCE(?, system_role),
      is_active = COALESCE(?, is_active),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, email, passwordHash, role, system_role, is_active != null ? is_active : null, req.params.id);

  res.json(db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).get(req.params.id));
});

// DELETE /users/:id (deactivate)
router.delete('/:id', (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deactivated' });
});

module.exports = router;
