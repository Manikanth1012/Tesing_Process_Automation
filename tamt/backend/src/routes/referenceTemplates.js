/**
 * Reference Templates Routes
 * Manages base/reference documents:
 *   FUNCTIONAL_TC  – Functional test case template
 *   GUI_TC         – GUI test case template
 *   API_SPEC       – API Specification document
 *   SWAGGER        – Swagger / OpenAPI contract
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/ref-templates');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

// GET /ref-templates?feature_id=&template_type=&is_global=
router.get('/', (req, res) => {
  const { feature_id, template_type, is_global } = req.query;
  let sql = `
    SELECT rt.*, u.name as uploaded_by_name
    FROM reference_templates rt
    LEFT JOIN users u ON u.id = rt.uploaded_by
    WHERE 1=1
  `;
  const params = [];

  if (feature_id) {
    // Return templates for the feature OR global templates
    sql += ' AND (rt.feature_id = ? OR rt.is_global = 1)';
    params.push(feature_id);
  } else if (is_global !== undefined) {
    sql += ' AND rt.is_global = ?';
    params.push(is_global === 'true' ? 1 : 0);
  }

  if (template_type) {
    sql += ' AND rt.template_type = ?';
    params.push(template_type);
  }

  sql += ' ORDER BY rt.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /ref-templates/:id
router.get('/:id', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM reference_templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Reference template not found' });
  res.json(tmpl);
});

// POST /ref-templates — upload a new reference template
router.post('/', upload.single('file'), (req, res) => {
  const { name, template_type, feature_id, description, is_global } = req.body;

  if (!name || !template_type) {
    return res.status(400).json({ error: 'name and template_type are required' });
  }

  const VALID_TYPES = ['FUNCTIONAL_TC', 'GUI_TC', 'API_SPEC', 'SWAGGER'];
  if (!VALID_TYPES.includes(template_type)) {
    return res.status(400).json({ error: `template_type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  let filePath = null;
  let fileName = null;
  let content = null;

  if (req.file) {
    filePath = req.file.path;
    fileName = req.file.originalname;
    // Try to read as text for text-based formats (Swagger JSON/YAML, Markdown, etc.)
    const ext = path.extname(fileName).toLowerCase();
    const textExts = ['.json', '.yaml', '.yml', '.md', '.txt', '.robot', '.csv'];
    if (textExts.includes(ext)) {
      try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) {}
    }
  } else if (req.body.content) {
    // Allow inline content (paste Swagger JSON / markdown directly)
    content = req.body.content;
    fileName = req.body.file_name || `${template_type.toLowerCase()}_${Date.now()}.txt`;
    filePath = path.join(uploadDir, `${Date.now()}_${fileName}`);
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    return res.status(400).json({ error: 'Provide a file upload or inline content' });
  }

  const result = db.prepare(`
    INSERT INTO reference_templates
      (name, template_type, feature_id, file_name, file_path, content, description, is_global, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, template_type,
    feature_id ? parseInt(feature_id) : null,
    fileName, filePath, content,
    description || null,
    is_global === 'true' || is_global === true ? 1 : 0,
    req.user.id
  );

  res.status(201).json(db.prepare('SELECT * FROM reference_templates WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /ref-templates/:id — update metadata only (not file)
router.put('/:id', (req, res) => {
  const { name, description, is_global, template_type } = req.body;
  const tmpl = db.prepare('SELECT id FROM reference_templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Reference template not found' });

  db.prepare(`
    UPDATE reference_templates SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      is_global = COALESCE(?, is_global),
      template_type = COALESCE(?, template_type)
    WHERE id = ?
  `).run(name, description, is_global !== undefined ? (is_global ? 1 : 0) : null, template_type, req.params.id);

  res.json(db.prepare('SELECT * FROM reference_templates WHERE id = ?').get(req.params.id));
});

// DELETE /ref-templates/:id
router.delete('/:id', (req, res) => {
  const tmpl = db.prepare('SELECT file_path FROM reference_templates WHERE id = ?').get(req.params.id);
  if (tmpl?.file_path) {
    try { fs.unlinkSync(tmpl.file_path); } catch (_) {}
  }
  db.prepare('DELETE FROM reference_templates WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// GET /ref-templates/:id/download
router.get('/:id/download', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM reference_templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Not found' });

  if (tmpl.file_path && fs.existsSync(tmpl.file_path)) {
    return res.download(tmpl.file_path, tmpl.file_name);
  }
  if (tmpl.content) {
    res.setHeader('Content-Disposition', `attachment; filename="${tmpl.file_name}"`);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(tmpl.content);
  }
  res.status(404).json({ error: 'File not available' });
});

// GET /ref-templates/:id/content — inline content view
router.get('/:id/content', (req, res) => {
  const tmpl = db.prepare('SELECT content, file_name, template_type FROM reference_templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Not found' });
  res.json({ content: tmpl.content, fileName: tmpl.file_name, templateType: tmpl.template_type });
});

module.exports = router;
