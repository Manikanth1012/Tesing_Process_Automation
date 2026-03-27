const express = require('express');
const XLSX = require('xlsx');
const db = require('../config/database');

const router = express.Router();

// ─── Shared XLSX helper ───────────────────────────────────────────────────────
function sendXlsx(res, sheets, fileName) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-fit column widths
    const colWidths = Object.keys(rows[0] || {}).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

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

// ─── XLSX Exports ─────────────────────────────────────────────────────────────

// GET /reports/export/test-cases — all test cases with status
router.get('/export/test-cases', (req, res) => {
  const { feature_id, test_plan_id, status } = req.query;
  let sql = `
    SELECT
      tc.id            AS "ID",
      f.name           AS "Feature",
      f.feature_type   AS "Feature Type",
      CASE WHEN f.feature_type='API' THEN COALESCE(f.api_sub_type,'Both') ELSE '' END AS "API Sub-Type",
      tc.title         AS "Test Case Title",
      tc.test_type     AS "Test Type",
      tc.priority      AS "Priority",
      tc.status        AS "Status",
      tc.automation_status AS "Automation Status",
      COALESCE(rs_agg.scripts, 0) AS "Scripts",
      COALESCE(rs_agg.approved, 0) AS "Approved Scripts",
      tc.expected_result AS "Expected Result",
      tc.created_at    AS "Created At"
    FROM test_cases tc
    JOIN features f ON f.id = tc.feature_id
    LEFT JOIN (
      SELECT test_case_id,
        COUNT(*) as scripts,
        SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END) as approved
      FROM robot_scripts GROUP BY test_case_id
    ) rs_agg ON rs_agg.test_case_id = tc.id
  `;
  const joins = [];
  const params = [];
  if (test_plan_id) {
    sql += ' JOIN test_plan_features tpf ON tpf.feature_id = tc.feature_id AND tpf.test_plan_id = ?';
    params.push(test_plan_id);
  }
  sql += ' WHERE 1=1';
  if (feature_id) { sql += ' AND tc.feature_id = ?'; params.push(feature_id); }
  if (status)     { sql += ' AND tc.status = ?';     params.push(status); }
  sql += ' ORDER BY f.name, tc.priority, tc.title';

  const rows = db.prepare(sql).all(...params);
  sendXlsx(res, [{ name: 'Test Cases', rows }], `test_cases_${Date.now()}.xlsx`);
});

// GET /reports/export/execution-summary
router.get('/export/execution-summary', (req, res) => {
  const { test_plan_id, test_run_id } = req.query;

  // Run-level summary
  let runSql = `
    SELECT
      tr.id           AS "Run ID",
      tr.name         AS "Run Name",
      tr.status       AS "Status",
      e.name          AS "Environment",
      tr.run_type     AS "Run Type",
      rfl.total_tests AS "Total Tests",
      rfl.passed      AS "Passed",
      rfl.failed      AS "Failed",
      rfl.skipped     AS "Skipped",
      CASE WHEN rfl.total_tests > 0
        THEN ROUND(rfl.passed * 100.0 / rfl.total_tests, 1) || '%'
        ELSE 'N/A' END AS "Pass Rate",
      rfl.execution_time_secs AS "Duration (s)",
      tr.started_at   AS "Started At",
      tr.completed_at AS "Completed At"
    FROM test_runs tr
    LEFT JOIN rf_execution_logs rfl ON rfl.test_run_id = tr.id
    LEFT JOIN environments e ON e.id = tr.environment_id
    WHERE 1=1
  `;
  const rParams = [];
  if (test_plan_id) { runSql += ' AND tr.test_plan_id = ?'; rParams.push(test_plan_id); }
  if (test_run_id)  { runSql += ' AND tr.id = ?';           rParams.push(test_run_id); }
  runSql += ' ORDER BY tr.created_at DESC';
  const runRows = db.prepare(runSql).all(...rParams);

  // Execution-level detail
  let execSql = `
    SELECT
      tr.name         AS "Run Name",
      f.name          AS "Feature",
      tc.title        AS "Test Case",
      tc.test_type    AS "Type",
      tc.priority     AS "Priority",
      te.status       AS "Result",
      te.actual_result AS "Actual Result / Error",
      te.duration_ms  AS "Duration (ms)",
      te.executed_at  AS "Executed At"
    FROM test_executions te
    JOIN test_runs tr ON tr.id = te.test_run_id
    JOIN test_cases tc ON tc.id = te.test_case_id
    JOIN features f ON f.id = tc.feature_id
    WHERE 1=1
  `;
  const eParams = [];
  if (test_plan_id) { execSql += ' AND tr.test_plan_id = ?'; eParams.push(test_plan_id); }
  if (test_run_id)  { execSql += ' AND tr.id = ?';           eParams.push(test_run_id); }
  execSql += ' ORDER BY tr.name, te.status, tc.title';
  const execRows = db.prepare(execSql).all(...eParams);

  sendXlsx(res, [
    { name: 'Run Summary', rows: runRows.length ? runRows : [{ Note: 'No data' }] },
    { name: 'Execution Detail', rows: execRows.length ? execRows : [{ Note: 'No data' }] },
  ], `execution_summary_${Date.now()}.xlsx`);
});

// GET /reports/export/defects
router.get('/export/defects', (req, res) => {
  const { feature_id, status, severity } = req.query;
  let sql = `
    SELECT
      d.id              AS "ID",
      d.title           AS "Title",
      d.severity        AS "Severity",
      d.priority        AS "Priority",
      d.status          AS "Status",
      f.name            AS "Feature",
      tc.title          AS "Test Case",
      d.expected_behavior AS "Expected",
      d.actual_behavior   AS "Actual",
      d.suggested_assignee_team AS "Suggested Team",
      d.created_at      AS "Created At"
    FROM defects d
    LEFT JOIN features f  ON f.id  = d.feature_id
    LEFT JOIN test_cases tc ON tc.id = d.test_case_id
    WHERE 1=1
  `;
  const params = [];
  if (feature_id) { sql += ' AND d.feature_id = ?'; params.push(feature_id); }
  if (status)     { sql += ' AND d.status = ?';     params.push(status); }
  if (severity)   { sql += ' AND d.severity = ?';   params.push(severity); }
  sql += ' ORDER BY d.severity, d.priority, d.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  sendXlsx(res, [{ name: 'Defects', rows: rows.length ? rows : [{ Note: 'No defects found' }] }],
    `defects_${Date.now()}.xlsx`);
});

// GET /reports/export/coverage
router.get('/export/coverage', (req, res) => {
  const { test_plan_id } = req.query;
  const params = [];
  let planJoin = '';
  if (test_plan_id) {
    planJoin = 'JOIN test_plan_features tpf ON tpf.feature_id = f.id AND tpf.test_plan_id = ?';
    params.push(test_plan_id);
  }

  const rows = db.prepare(`
    SELECT
      f.name            AS "Feature",
      f.feature_type    AS "Feature Type",
      CASE WHEN f.feature_type='API' THEN COALESCE(f.api_sub_type,'Both') ELSE '' END AS "API Sub-Type",
      f.priority        AS "Priority",
      f.prereq_readiness || '%' AS "Prereq Readiness",
      COUNT(DISTINCT tc.id) AS "Total Test Cases",
      SUM(CASE WHEN tc.status='Approved' THEN 1 ELSE 0 END) AS "Approved Cases",
      COUNT(DISTINCT rs.id) AS "Total Scripts",
      SUM(CASE WHEN rs.status='Approved' THEN 1 ELSE 0 END) AS "Approved Scripts",
      CASE WHEN COUNT(DISTINCT tc.id) > 0
        THEN ROUND(SUM(CASE WHEN rs.status='Approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT tc.id), 1) || '%'
        ELSE '0%' END AS "Automation Coverage"
    FROM features f
    ${planJoin}
    LEFT JOIN test_cases tc ON tc.feature_id = f.id
    LEFT JOIN robot_scripts rs ON rs.test_case_id = tc.id
    GROUP BY f.id
    ORDER BY f.priority, f.name
  `).all(...params);

  sendXlsx(res, [{ name: 'Coverage', rows: rows.length ? rows : [{ Note: 'No data' }] }],
    `coverage_report_${Date.now()}.xlsx`);
});

module.exports = router;
