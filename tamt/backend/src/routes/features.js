const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/contracts');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

// GET /features
router.get('/', (req, res) => {
  const { status, feature_type, api_sub_type, priority, search } = req.query;
  let sql = `
    SELECT f.*,
      COUNT(DISTINCT tc.id) as test_case_count,
      COUNT(DISTINCT rs.id) as script_count,
      COUNT(DISTINCT d.id) as defect_count
    FROM features f
    LEFT JOIN test_cases tc ON tc.feature_id = f.id
    LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
    LEFT JOIN defects d ON d.feature_id = f.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND f.status = ?'; params.push(status); }
  if (feature_type) { sql += ' AND f.feature_type = ?'; params.push(feature_type); }
  if (api_sub_type) { sql += ' AND f.api_sub_type = ?'; params.push(api_sub_type); }
  if (priority) { sql += ' AND f.priority = ?'; params.push(priority); }
  if (search) { sql += ' AND (f.name LIKE ? OR f.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' GROUP BY f.id ORDER BY f.created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /features/:id
router.get('/:id', (req, res) => {
  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(req.params.id);
  if (!feature) return res.status(404).json({ error: 'Feature not found' });

  const prerequisites = db.prepare('SELECT * FROM prerequisites WHERE feature_id = ?').all(req.params.id);
  const apiContracts = db.prepare('SELECT id, file_name, contract_type, created_at FROM api_contracts WHERE feature_id = ?').all(req.params.id);
  const referenceTemplates = db.prepare('SELECT id, name, template_type, file_name, description, is_global, created_at FROM reference_templates WHERE feature_id = ?').all(req.params.id);
  const testCases = db.prepare(`
    SELECT tc.*, COUNT(rs.id) as script_count
    FROM test_cases tc
    LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
    WHERE tc.feature_id = ?
    GROUP BY tc.id
    ORDER BY tc.created_at DESC
  `).all(req.params.id);

  res.json({ ...feature, prerequisites, apiContracts, referenceTemplates, testCases });
});

// POST /features
router.post('/', (req, res) => {
  const { name, description, feature_type, api_sub_type, priority } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO features (name, description, feature_type, api_sub_type, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'Draft', ?)
  `).run(name, description || '', feature_type || 'Functional', api_sub_type || 'Both', priority || 'P2', req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM features WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /features/:id
router.put('/:id', (req, res) => {
  const { name, description, feature_type, api_sub_type, priority, status } = req.body;
  const f = db.prepare('SELECT id FROM features WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Feature not found' });

  db.prepare(`
    UPDATE features SET name = COALESCE(?, name), description = COALESCE(?, description),
    feature_type = COALESCE(?, feature_type), api_sub_type = COALESCE(?, api_sub_type),
    priority = COALESCE(?, priority), status = COALESCE(?, status),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description, feature_type, api_sub_type, priority, status, req.params.id);

  res.json(db.prepare('SELECT * FROM features WHERE id = ?').get(req.params.id));
});

// DELETE /features/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM features WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// POST /features/:id/contracts — upload API contract
router.post('/:id/contracts', upload.single('contract'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const content = fs.readFileSync(req.file.path, 'utf8');

  const result = db.prepare(`
    INSERT INTO api_contracts (feature_id, file_name, file_path, content, contract_type, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.file.originalname, req.file.path, content, req.body.contract_type || 'SWAGGER', req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, fileName: req.file.originalname });
});

// POST /features/:id/recalculate-readiness
router.post('/:id/recalculate-readiness', (req, res) => {
  const stats = db.prepare(
    'SELECT COUNT(*) as total, SUM(is_ready) as ready FROM prerequisites WHERE feature_id = ?'
  ).get(req.params.id);
  const readiness = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
  db.prepare('UPDATE features SET prereq_readiness = ? WHERE id = ?').run(readiness, req.params.id);
  res.json({ prereq_readiness: readiness });
});

module.exports = router;
