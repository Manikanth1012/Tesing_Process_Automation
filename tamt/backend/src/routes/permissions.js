/**
 * Role Permissions API
 */
const express = require('express');
const db = require('../config/database');
const router = express.Router();

const ALL_PERMISSIONS = [
  { key: 'manage_users',      label: 'Manage Users',          description: 'Create, edit, deactivate users' },
  { key: 'manage_projects',   label: 'Manage Projects',       description: 'Create and edit projects' },
  { key: 'manage_settings',   label: 'Manage Settings',       description: 'Change platform settings and API keys' },
  { key: 'run_agents',        label: 'Run AI Agents',         description: 'Trigger AI agent runs' },
  { key: 'create_features',   label: 'Create Features',       description: 'Create and edit features' },
  { key: 'import_features',   label: 'Import Features (bulk)','description': 'Bulk import features via Excel' },
  { key: 'create_test_cases', label: 'Create Test Cases',     description: 'Create and edit test cases' },
  { key: 'execute_runs',      label: 'Execute Test Runs',     description: 'Start test executions' },
  { key: 'view_reports',      label: 'View Reports',          description: 'Access reports and exports' },
];

const ROLES = ['ADMIN', 'QA_LEAD', 'QA_ENGINEER', 'DEVELOPER', 'MANAGER'];

// GET /permissions — get permission matrix
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT role, permission, allowed FROM role_permissions').all();
  const matrix = {};
  ROLES.forEach(role => {
    matrix[role] = {};
    ALL_PERMISSIONS.forEach(p => { matrix[role][p.key] = 0; });
  });
  rows.forEach(r => {
    if (matrix[r.role]) matrix[r.role][r.permission] = r.allowed;
  });
  res.json({ matrix, permissions: ALL_PERMISSIONS, roles: ROLES });
});

// PUT /permissions — update role permissions (admin only)
router.put('/', (req, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  const { role, permission, allowed } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!ALL_PERMISSIONS.find(p => p.key === permission)) return res.status(400).json({ error: 'Invalid permission' });
  // ADMIN always keeps manage_settings
  if (role === 'ADMIN' && permission === 'manage_settings') return res.status(400).json({ error: 'Cannot revoke admin settings permission' });

  db.prepare(`
    INSERT INTO role_permissions (role, permission, allowed) VALUES (?, ?, ?)
    ON CONFLICT(role, permission) DO UPDATE SET allowed = excluded.allowed
  `).run(role, permission, allowed ? 1 : 0);

  res.json({ role, permission, allowed: !!allowed });
});

module.exports = router;
