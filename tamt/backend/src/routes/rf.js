const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const rfService = require('../services/rfService');
const sseService = require('../services/sseService');

const router = express.Router();

const RF_SCRIPTS_DIR = path.resolve(process.env.RF_SCRIPTS_DIR || path.join(__dirname, '../../scripts'));

// ─── SCRIPTS ──────────────────────────────────────────────────────────────────

// POST /rf/scripts — save/create a script
router.post('/scripts', async (req, res, next) => {
  try {
    const { testCaseId, scriptContent, featureType } = req.body;
    if (!testCaseId || !scriptContent) return res.status(400).json({ error: 'testCaseId and scriptContent required' });

    const result = rfService.generateScript(testCaseId, scriptContent, featureType);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /rf/scripts/:testCaseId — list all scripts for a test case
router.get('/scripts/:testCaseId', (req, res) => {
  const scripts = db.prepare(
    'SELECT * FROM robot_scripts WHERE test_case_id = ? ORDER BY version DESC'
  ).all(req.params.testCaseId);
  res.json(scripts);
});

// GET /rf/scripts/:id/versions — version history
router.get('/scripts/:id/versions', (req, res) => {
  const versions = db.prepare(
    'SELECT id, version, status, script_name, created_at, last_validated_at FROM robot_scripts WHERE test_case_id = (SELECT test_case_id FROM robot_scripts WHERE id = ?) ORDER BY version DESC'
  ).all(req.params.id);
  res.json(versions);
});

// PUT /rf/scripts/:id — update script content
router.put('/scripts/:id', (req, res) => {
  const { scriptContent, status } = req.body;
  db.prepare(`
    UPDATE robot_scripts SET
      script_content = COALESCE(?, script_content),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(scriptContent, status, req.params.id);

  res.json(db.prepare('SELECT * FROM robot_scripts WHERE id = ?').get(req.params.id));
});

// POST /rf/scripts/:id/validate — dry-run validation
router.post('/scripts/:id/validate', async (req, res, next) => {
  try {
    const script = db.prepare('SELECT * FROM robot_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    const result = await rfService.validateScript(script.script_content, script.test_case_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /rf/scripts/:id/download — download .robot file
router.get('/scripts/:id/download', (req, res) => {
  const script = db.prepare('SELECT * FROM robot_scripts WHERE id = ?').get(req.params.id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${script.script_name}"`);
  res.send(script.script_content);
});

// ─── EXECUTION ────────────────────────────────────────────────────────────────

// POST /rf/execute — trigger a test run execution
router.post('/execute', async (req, res, next) => {
  try {
    const { testRunId, scriptIds, environment } = req.body;
    if (!testRunId) return res.status(400).json({ error: 'testRunId required' });

    // Resolve script paths from IDs or use all approved scripts for the run's plan
    let scriptPaths = [];
    if (scriptIds && scriptIds.length > 0) {
      const scripts = db.prepare(
        `SELECT file_path FROM robot_scripts WHERE id IN (${scriptIds.map(() => '?').join(',')}) AND status = 'Approved'`
      ).all(...scriptIds);
      scriptPaths = scripts.map(s => path.join(process.cwd(), s.file_path));
    } else {
      // Auto-resolve from test run's test plan
      const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(testRunId);
      if (run?.test_plan_id) {
        const scripts = db.prepare(`
          SELECT rs.file_path FROM robot_scripts rs
          JOIN test_cases tc ON tc.id = rs.test_case_id
          JOIN test_plan_features tpf ON tpf.feature_id = tc.feature_id
          WHERE tpf.test_plan_id = ? AND rs.status = 'Approved'
          ORDER BY rs.version DESC
        `).all(run.test_plan_id);
        scriptPaths = scripts.map(s => path.join(process.cwd(), s.file_path));
      }
    }

    if (scriptPaths.length === 0) {
      return res.status(400).json({ error: 'No approved scripts found to execute' });
    }

    // Start async execution
    rfService.executeTestRun(testRunId, scriptPaths, environment || 'SIT')
      .catch(err => console.error('[RF Execute] Error:', err.message));

    res.json({ started: true, testRunId, scriptCount: scriptPaths.length });
  } catch (err) {
    next(err);
  }
});

// GET /rf/execute/:testRunId/status — SSE stream for live execution status
router.get('/execute/:testRunId/status', (req, res) => {
  sseService.addClient(`rf-run:${req.params.testRunId}`, res);
});

// GET /rf/results/:testRunId — parsed results
router.get('/results/:testRunId', (req, res) => {
  const log = db.prepare('SELECT * FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(req.params.testRunId);
  if (!log) return res.status(404).json({ error: 'No results found for this run' });

  const executions = db.prepare(`
    SELECT te.*, tc.title, tc.test_type
    FROM test_executions te
    JOIN test_cases tc ON tc.id = te.test_case_id
    WHERE te.test_run_id = ?
  `).all(req.params.testRunId);

  res.json({ ...log, executions });
});

// GET /rf/results/:testRunId/raw — raw output.xml
router.get('/results/:testRunId/raw', (req, res) => {
  const log = db.prepare('SELECT raw_output_xml FROM rf_execution_logs WHERE test_run_id = ? ORDER BY id DESC LIMIT 1').get(req.params.testRunId);
  if (!log || !log.raw_output_xml) return res.status(404).json({ error: 'No raw XML available' });

  res.setHeader('Content-Type', 'application/xml');
  res.send(log.raw_output_xml);
});

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

// GET /rf/templates
router.get('/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM script_templates ORDER BY feature_type').all());
});

// GET /rf/templates/:featureType
router.get('/templates/:featureType', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM script_templates WHERE feature_type = ? AND is_default = 1').get(req.params.featureType);
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  res.json(tmpl);
});

// PUT /rf/templates/:id
router.put('/templates/:id', (req, res) => {
  const { template_name, template_content, description, is_default } = req.body;
  db.prepare(`
    UPDATE script_templates SET
      template_name = COALESCE(?, template_name),
      template_content = COALESCE(?, template_content),
      description = COALESCE(?, description),
      is_default = COALESCE(?, is_default)
    WHERE id = ?
  `).run(template_name, template_content, description,
    is_default !== undefined ? (is_default ? 1 : 0) : null,
    req.params.id);

  res.json(db.prepare('SELECT * FROM script_templates WHERE id = ?').get(req.params.id));
});

module.exports = router;
