const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const XLSX = require('xlsx');
const { index } = require('../services/vectorService');

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

  const ftype = feature_type || 'Functional';
  const result = db.prepare(`
    INSERT INTO features (name, description, feature_type, api_sub_type, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'Draft', ?)
  `).run(name, description || '', ftype, api_sub_type || 'Both', priority || 'P2', req.user.id);

  const created = db.prepare('SELECT * FROM features WHERE id = ?').get(result.lastInsertRowid);
  // Auto-index for RAG (non-blocking)
  index('Feature', created.id, `${name} ${description || ''} ${ftype} ${priority || 'P2'}`,
    { name, type: ftype, priority: priority || 'P2', status: 'Draft' }).catch(() => {});
  res.status(201).json(created);
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

  const updated = db.prepare('SELECT * FROM features WHERE id = ?').get(req.params.id);
  // Re-index after update (non-blocking)
  index('Feature', updated.id, `${updated.name} ${updated.description || ''} ${updated.feature_type} ${updated.priority}`,
    { name: updated.name, type: updated.feature_type, priority: updated.priority, status: updated.status }).catch(() => {});
  res.json(updated);
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

// GET /features/import/template — download blank Excel import template
router.get('/import/template', (req, res) => {
  const headers = [
    { header: 'name*', key: 'name', note: 'Required. Feature name.' },
    { header: 'description', key: 'description', note: 'Optional description.' },
    { header: 'feature_type*', key: 'feature_type', note: 'API | Functional | GUI | Performance' },
    { header: 'api_sub_type', key: 'api_sub_type', note: 'Technical | Functional | Both (only for API type)' },
    { header: 'priority*', key: 'priority', note: 'P1 | P2 | P3' },
    { header: 'test_plan_id', key: 'test_plan_id', note: 'Optional. Numeric ID of the test plan to link to.' },
  ];

  const exampleRow = {
    'name*': 'User Login API',
    'description': 'Authenticate user and return JWT token',
    'feature_type*': 'API',
    'api_sub_type': 'Technical',
    'priority*': 'P1',
    'test_plan_id': '',
  };
  const instructionsRow = {};
  headers.forEach(h => { instructionsRow[h.header] = h.note; });

  const ws = XLSX.utils.json_to_sheet([instructionsRow, exampleRow], { header: headers.map(h => h.header) });
  // Style: widen columns
  ws['!cols'] = headers.map(() => ({ wch: 28 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Features');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="feature_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /features/import — bulk import features from Excel
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/import', importUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws);
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse Excel file: ' + e.message });
  }

  const VALID_TYPES = ['API', 'Functional', 'GUI', 'Performance'];
  const VALID_PRIO = ['P1', 'P2', 'P3'];
  const VALID_SUB = ['Technical', 'Functional', 'Both'];

  const created = [];
  const errors = [];

  const insertFeature = db.prepare(`
    INSERT INTO features (name, description, feature_type, api_sub_type, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'Active', ?)
  `);
  const linkPlan = db.prepare('INSERT OR IGNORE INTO test_plan_features (test_plan_id, feature_id) VALUES (?, ?)');

  const importAll = db.transaction(() => {
    rows.forEach((row, i) => {
      const rowNum = i + 2; // account for header
      // Support both header styles (with or without asterisk)
      const name = (row['name*'] || row['name'] || '').toString().trim();
      const description = (row['description'] || '').toString().trim();
      const feature_type = (row['feature_type*'] || row['feature_type'] || '').toString().trim();
      const api_sub_type = (row['api_sub_type'] || 'Both').toString().trim();
      const priority = (row['priority*'] || row['priority'] || 'P2').toString().trim();
      const test_plan_id = row['test_plan_id'] ? parseInt(row['test_plan_id']) : null;

      if (!name) { errors.push({ row: rowNum, error: 'name is required' }); return; }
      if (!VALID_TYPES.includes(feature_type)) { errors.push({ row: rowNum, error: `feature_type must be one of: ${VALID_TYPES.join(', ')}` }); return; }
      if (!VALID_PRIO.includes(priority)) { errors.push({ row: rowNum, error: `priority must be one of: ${VALID_PRIO.join(', ')}` }); return; }

      try {
        const result = insertFeature.run(name, description, feature_type, VALID_SUB.includes(api_sub_type) ? api_sub_type : 'Both', priority, req.user.id);
        const fid = result.lastInsertRowid;
        if (test_plan_id) linkPlan.run(test_plan_id, fid);
        created.push({ id: fid, name, feature_type, priority });
      } catch (e) {
        errors.push({ row: rowNum, error: e.message });
      }
    });
  });

  try {
    importAll();
    res.json({ created: created.length, errors, features: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
