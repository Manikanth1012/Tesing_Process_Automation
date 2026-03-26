CREATE TABLE IF NOT EXISTS rf_execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_run_id INTEGER NOT NULL REFERENCES test_runs(id),
  raw_output_xml TEXT,
  parsed_at DATETIME,
  total_tests INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  execution_time_secs REAL DEFAULT 0,
  rf_version TEXT,
  environment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
