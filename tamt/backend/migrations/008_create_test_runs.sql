CREATE TABLE IF NOT EXISTS test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_plan_id INTEGER REFERENCES test_plans(id),
  name TEXT NOT NULL,
  environment_id INTEGER REFERENCES environments(id),
  run_type TEXT DEFAULT 'Full',
  status TEXT DEFAULT 'Pending',
  started_at DATETIME,
  completed_at DATETIME,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
