/**
 * Robot Framework Service — orchestrates script generation, execution, and result parsing.
 */

const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const { PythonShell } = require('python-shell');
const db = require('../config/database');
const sseService = require('./sseService');

const RF_SCRIPTS_DIR = path.resolve(process.env.RF_SCRIPTS_DIR || './scripts');
const RF_RESULTS_DIR = path.resolve(process.env.RF_RESULTS_DIR || './rf-results');
const PYTHON_PATH = process.env.PYTHON_PATH || 'python3';

// Ensure directories exist
[RF_SCRIPTS_DIR, RF_RESULTS_DIR].forEach(dir => {
  ['api', 'functional', 'gui', 'performance'].forEach(sub => {
    fs.mkdirSync(path.join(dir.replace('./scripts', RF_SCRIPTS_DIR).replace('./rf-results', RF_RESULTS_DIR), sub === 'api' ? '' : ''), { recursive: true });
  });
  fs.mkdirSync(dir, { recursive: true });
});

['api', 'functional', 'gui', 'performance'].forEach(sub => {
  fs.mkdirSync(path.join(RF_SCRIPTS_DIR, sub), { recursive: true });
});

/**
 * 1. Save a .robot script file and update/insert RobotScripts record.
 */
function generateScript(testCaseId, scriptContent, featureType = 'Functional') {
  const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(testCaseId);
  if (!tc) throw new Error(`TestCase ${testCaseId} not found`);

  // Determine next version
  const existing = db.prepare(
    'SELECT MAX(version) as max_v FROM robot_scripts WHERE test_case_id = ?'
  ).get(testCaseId);
  const version = (existing?.max_v || 0) + 1;

  const slug = tc.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
  const fileName = `${testCaseId}_${featureType.toLowerCase()}_${slug}.robot`;
  const subDir = featureType.toLowerCase();
  const filePath = path.join(RF_SCRIPTS_DIR, subDir, fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, scriptContent, 'utf8');

  const relPath = path.join('scripts', subDir, fileName);
  const stmt = db.prepare(`
    INSERT INTO robot_scripts (test_case_id, feature_type, script_name, script_content, file_path, generated_by, version, status)
    VALUES (?, ?, ?, ?, ?, 'Agent', ?, 'Draft')
  `);
  const result = stmt.run(testCaseId, featureType, fileName, scriptContent, relPath, version);

  return {
    id: result.lastInsertRowid,
    fileName,
    filePath: relPath,
    version,
  };
}

/**
 * 2. Execute a test run via Robot Framework.
 */
function executeTestRun(testRunId, scriptPaths, environment = 'SIT') {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(RF_RESULTS_DIR, String(testRunId));
    fs.mkdirSync(outputDir, { recursive: true });

    // Update run status to Running
    db.prepare("UPDATE test_runs SET status = 'Running', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(testRunId);

    const channel = `rf-run:${testRunId}`;
    const emit = (msg) => sseService.sendToChannel(channel, 'log', { message: msg });

    // Build variables from environment
    const envRow = db.prepare('SELECT * FROM environments WHERE name = ? OR env_type = ?').get(environment, environment);
    const baseUrl = envRow?.base_url || process.env.DEFAULT_ENV_SIT_URL || 'http://localhost:8080';

    const absolutePaths = scriptPaths.map(p =>
      path.isAbsolute(p) ? p : path.join(process.cwd(), p)
    );

    // Validate scripts exist
    const missing = absolutePaths.filter(p => !fs.existsSync(p));
    if (missing.length > 0) {
      db.prepare("UPDATE test_runs SET status = 'Failed' WHERE id = ?").run(testRunId);
      return reject(new Error(`Script files not found: ${missing.join(', ')}`));
    }

    const runnerScript = path.join(__dirname, '../../python/run_suite.py');
    const args = JSON.stringify({
      outputDir,
      scriptPaths: absolutePaths,
      variables: { ENV: environment, BASE_URL: baseUrl },
    });

    emit(`Starting Robot Framework execution for run ${testRunId}`);
    emit(`Output directory: ${outputDir}`);
    emit(`Scripts: ${absolutePaths.map(p => path.basename(p)).join(', ')}`);

    const pyshell = new PythonShell(runnerScript, {
      pythonPath: PYTHON_PATH,
      args: [args],
      mode: 'text',
    });

    pyshell.on('message', (msg) => {
      emit(msg);
    });

    pyshell.end((err, code) => {
      const outputXmlPath = path.join(outputDir, 'output.xml');

      if (err || code !== 0) {
        db.prepare("UPDATE test_runs SET status = 'Failed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(testRunId);
        sseService.sendToChannel(channel, 'run-failed', { testRunId, error: err?.message || 'Non-zero exit code' });
        sseService.closeChannel(channel);
        return reject(new Error(err?.message || 'Robot Framework execution failed'));
      }

      // Parse results
      if (fs.existsSync(outputXmlPath)) {
        parseRFResults(testRunId, outputXmlPath, environment)
          .then(parsed => {
            sseService.sendToChannel(channel, `run-complete:${testRunId}`, { testRunId, ...parsed });
            sseService.closeChannel(channel);
            resolve(parsed);
          })
          .catch(parseErr => {
            sseService.closeChannel(channel);
            reject(parseErr);
          });
      } else {
        db.prepare("UPDATE test_runs SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(testRunId);
        sseService.sendToChannel(channel, `run-complete:${testRunId}`, { testRunId, warning: 'No output.xml found' });
        sseService.closeChannel(channel);
        resolve({ warning: 'No output.xml produced' });
      }
    });
  });
}

/**
 * 3. Parse output.xml and update TestExecutions + RFExecutionLog.
 */
async function parseRFResults(testRunId, outputXmlPath, environment) {
  const xmlContent = fs.readFileSync(outputXmlPath, 'utf8');
  const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

  const robot = parsed.robot;
  const rfVersion = robot?.$?.generator || 'unknown';

  let totalTests = 0, passed = 0, failed = 0, skipped = 0;
  let executionTimeSecs = 0;

  const tests = [];

  // Extract tests from suite (handles nested suites)
  function extractTests(suite) {
    if (!suite) return;
    const testList = suite.test ? (Array.isArray(suite.test) ? suite.test : [suite.test]) : [];
    for (const t of testList) {
      const status = t.status?.$?.status || 'FAIL';
      const elapsed = parseFloat(t.status?.$?.elapsed || '0');
      tests.push({
        name: t.$?.name || 'Unknown',
        status,
        message: t.status?.$?.message || '',
        elapsed,
      });
      totalTests++;
      if (status === 'PASS') passed++;
      else if (status === 'SKIP') skipped++;
      else failed++;
      executionTimeSecs += elapsed / 1000;
    }

    // Recurse into nested suites
    const suites = suite.suite ? (Array.isArray(suite.suite) ? suite.suite : [suite.suite]) : [];
    for (const s of suites) extractTests(s);
  }

  extractTests(robot?.suite);

  // Save RF execution log
  db.prepare(`
    INSERT INTO rf_execution_logs (test_run_id, raw_output_xml, parsed_at, total_tests, passed, failed, skipped, execution_time_secs, rf_version, environment)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
  `).run(testRunId, xmlContent, totalTests, passed, failed, skipped, executionTimeSecs, rfVersion, environment);

  // Match tests to test_executions by test case title
  for (const t of tests) {
    const tc = db.prepare(
      'SELECT tc.id FROM test_cases tc WHERE tc.title = ?'
    ).get(t.name);

    if (tc) {
      const execRow = db.prepare(
        'SELECT id FROM test_executions WHERE test_run_id = ? AND test_case_id = ?'
      ).get(testRunId, tc.id);

      if (execRow) {
        db.prepare(`
          UPDATE test_executions
          SET status = ?, actual_result = ?, duration_ms = ?, executed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          t.status === 'PASS' ? 'Pass' : t.status === 'SKIP' ? 'Skipped' : 'Fail',
          t.message,
          Math.round(t.elapsed),
          execRow.id
        );
      } else {
        db.prepare(`
          INSERT INTO test_executions (test_run_id, test_case_id, status, actual_result, duration_ms, executed_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          testRunId,
          tc.id,
          t.status === 'PASS' ? 'Pass' : t.status === 'SKIP' ? 'Skipped' : 'Fail',
          t.message,
          Math.round(t.elapsed)
        );
      }
    }
  }

  // Update test run
  const runStatus = failed > 0 ? 'Failed' : 'Completed';
  db.prepare("UPDATE test_runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(runStatus, testRunId);

  return { totalTests, passed, failed, skipped, executionTimeSecs, rfVersion };
}

/**
 * 4. Validate a script via robot --dryrun.
 */
function validateScript(scriptContent, testCaseId) {
  return new Promise((resolve) => {
    const tmpFile = path.join('/tmp', `tamt_validate_${Date.now()}.robot`);
    const tmpOut = path.join('/tmp', `tamt_validate_out_${Date.now()}`);
    fs.writeFileSync(tmpFile, scriptContent, 'utf8');
    fs.mkdirSync(tmpOut, { recursive: true });

    const pyshell = new PythonShell('-c', {
      pythonPath: PYTHON_PATH,
      args: [],
      pythonOptions: ['-m', 'robot', '--dryrun', '--outputdir', tmpOut, tmpFile],
      mode: 'text',
    });

    const errors = [];
    pyshell.on('message', msg => {
      if (msg.includes('ERROR') || msg.includes('Error')) errors.push(msg);
    });

    pyshell.end((err) => {
      // Cleanup
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      try { fs.rmSync(tmpOut, { recursive: true }); } catch (_) {}

      if (testCaseId) {
        db.prepare(`
          UPDATE robot_scripts SET last_validated_at = CURRENT_TIMESTAMP, validation_errors = ?
          WHERE test_case_id = ? AND version = (SELECT MAX(version) FROM robot_scripts WHERE test_case_id = ?)
        `).run(JSON.stringify(errors), testCaseId, testCaseId);
      }

      resolve({ valid: !err && errors.length === 0, errors });
    });
  });
}

module.exports = { generateScript, executeTestRun, parseRFResults, validateScript };
