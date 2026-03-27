const express = require('express');
const db = require('../config/database');
const router = express.Router();

// GET /projects
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      u.name as created_by_name,
      COUNT(DISTINCT tp.id) as plan_count,
      COUNT(DISTINCT pm.user_id) as member_count,
      COUNT(DISTINCT f.id) as feature_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN test_plans tp ON tp.project_id = p.id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    LEFT JOIN test_plan_features tpf ON tpf.test_plan_id = tp.id
    LEFT JOIN features f ON f.id = tpf.feature_id
    WHERE p.status != 'Archived'
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

// GET /projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as created_by_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const testPlans = db.prepare(`
    SELECT tp.*,
      COUNT(DISTINCT tpf.feature_id) as feature_count,
      COUNT(DISTINCT tr.id) as run_count
    FROM test_plans tp
    LEFT JOIN test_plan_features tpf ON tpf.test_plan_id = tp.id
    LEFT JOIN test_runs tr ON tr.test_plan_id = tp.id
    WHERE tp.project_id = ?
    GROUP BY tp.id
    ORDER BY tp.created_at DESC
  `).all(req.params.id);

  const members = db.prepare(`
    SELECT pm.*, u.name, u.email, u.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.added_at
  `).all(req.params.id);

  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT tc.id) as total_test_cases,
      COUNT(DISTINCT CASE WHEN tc.automation_status = 'Automated' THEN tc.id END) as automated_cases,
      COUNT(DISTINCT d.id) as total_defects,
      COUNT(DISTINCT CASE WHEN d.status = 'Open' THEN d.id END) as open_defects
    FROM test_plans tp
    LEFT JOIN test_plan_features tpf ON tpf.test_plan_id = tp.id
    LEFT JOIN features f ON f.id = tpf.feature_id
    LEFT JOIN test_cases tc ON tc.feature_id = f.id
    LEFT JOIN defects d ON d.test_plan_id = tp.id
    WHERE tp.project_id = ?
  `).get(req.params.id);

  res.json({ ...project, testPlans, members, stats });
});

// POST /projects
router.post('/', (req, res) => {
  const { name, key, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!key) return res.status(400).json({ error: 'Key is required' });

  try {
    const result = db.prepare(`
      INSERT INTO projects (name, key, description, created_by)
      VALUES (?, ?, ?, ?)
    `).run(name, key.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10), description || '', req.user.id);

    db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, role)
      VALUES (?, ?, 'Admin')
    `).run(result.lastInsertRowid, req.user.id);

    res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Project key already exists. Choose a unique key.' });
    throw err;
  }
});

// PUT /projects/:id
router.put('/:id', (req, res) => {
  const { name, description, status } = req.body;
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description, status, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// DELETE /projects/:id (soft delete → Archived)
router.delete('/:id', (req, res) => {
  db.prepare("UPDATE projects SET status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ message: 'Project archived' });
});

// POST /projects/:id/members  – add or update member role
router.post('/:id/members', (req, res) => {
  const { user_id, role = 'Tester' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
  `).run(req.params.id, user_id, role);

  const member = db.prepare(`
    SELECT pm.*, u.name, u.email FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `).get(req.params.id, user_id);
  res.json(member);
});

// DELETE /projects/:id/members/:userId
router.delete('/:id/members/:userId', (req, res) => {
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
