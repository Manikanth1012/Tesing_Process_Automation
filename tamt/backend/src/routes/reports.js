const express = require('express');
const db = require('../config/database');

const router = express.Router();

// GET /reports/dashboard — summary metrics
router.get('/dashboard', (req, res) => {
  const features = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) as active FROM features").get();
  const testCases = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END) as approved FROM test_cases").get();
  const testRuns = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed FROM test_runs").get();
  const defects = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='Open' THEN 1 ELSE 0 END) as open, SUM(CASE WHEN severity='Critical' THEN 1 ELSE 0 END) as critical FROM defects").get();
  const execStats = db.prepare("SELECT status, COUNT(*) as count FROM test_executions GROUP BY status").all();
  const scripts = db.prepare("SELECT status, COUNT(*) as count FROM robot_scripts GROUP BY status").all();

  const recentRuns = db.prepare(`
    SELECT tr.*, rfl.passed, rfl.failed, rfl.total_tests
    FROM test_runs tr
    LEFT JOIN rf_execution_logs rfl ON rfl.test_run_id = tr.id
    ORDER BY tr.created_at DESC LIMIT 5
  `).all();

  res.json({ features, testCases, testRuns, defects, execStats, scripts, recentRuns });
});

// GET /reports/execution-summary
router.get('/execution-summary', (req, res) => {
  const { test_plan_id, date_from, date_to } = req.query;
  let sql = `
    SELECT tr.id, tr.name, tr.status, tr.started_at, tr.completed_at,
      rfl.total_tests, rfl.passed, rfl.failed, rfl.skipped, rfl.execution_time_secs,
      COUNT(DISTINCT te.id) as execution_count,
      e.name as environment_name
    FROM test_runs tr
    LEFT JOIN rf_execution_logs rfl ON rfl.test_run_id = tr.id
    LEFT JOIN test_executions te ON te.test_run_id = tr.id
    LEFT JOIN environments e ON e.id = tr.environment_id
    WHERE 1=1
  `;
  const params = [];
  if (test_plan_id) { sql += ' AND tr.test_plan_id = ?'; params.push(test_plan_id); }
  if (date_from) { sql += ' AND tr.created_at >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND tr.created_at <= ?'; params.push(date_to); }
  sql += ' GROUP BY tr.id ORDER BY tr.created_at DESC LIMIT 50';

  res.json(db.prepare(sql).all(...params));
});

// GET /reports/defect-analysis
router.get('/defect-analysis', (req, res) => {
  const bySeverity = db.prepare("SELECT severity, COUNT(*) as count FROM defects GROUP BY severity").all();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM defects GROUP BY status").all();
  const byFeature = db.prepare(`
    SELECT f.name as feature_name, COUNT(d.id) as defect_count,
      SUM(CASE WHEN d.severity='Critical' THEN 1 ELSE 0 END) as critical
    FROM defects d JOIN features f ON f.id = d.feature_id
    GROUP BY f.id ORDER BY defect_count DESC LIMIT 10
  `).all();

  res.json({ bySeverity, byStatus, byFeature });
});

// GET /reports/coverage
router.get('/coverage', (req, res) => {
  const { test_plan_id } = req.query;
  let baseFilter = '';
  const params = [];
  if (test_plan_id) {
    baseFilter = 'AND tpf.test_plan_id = ?';
    params.push(test_plan_id);
  }

  const coverage = db.prepare(`
    SELECT f.id, f.name, f.feature_type, f.priority, f.prereq_readiness,
      COUNT(DISTINCT tc.id) as total_cases,
      SUM(CASE WHEN tc.status='Approved' THEN 1 ELSE 0 END) as approved_cases,
      COUNT(DISTINCT rs.id) as scripts,
      SUM(CASE WHEN rs.status='Approved' THEN 1 ELSE 0 END) as approved_scripts
    FROM features f
    ${test_plan_id ? 'JOIN test_plan_features tpf ON tpf.feature_id = f.id' : ''}
    LEFT JOIN test_cases tc ON tc.feature_id = f.id
    LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
    WHERE 1=1 ${baseFilter}
    GROUP BY f.id
    ORDER BY f.priority ASC, total_cases DESC
  `).all(...params);

  res.json(coverage);
});

module.exports = router;
