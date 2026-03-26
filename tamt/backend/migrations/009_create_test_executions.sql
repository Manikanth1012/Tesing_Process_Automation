CREATE TABLE IF NOT EXISTS test_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  status TEXT DEFAULT 'Pending',
  actual_result TEXT,
  notes TEXT,
  executed_at DATETIME,
  duration_ms INTEGER,
  executed_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
