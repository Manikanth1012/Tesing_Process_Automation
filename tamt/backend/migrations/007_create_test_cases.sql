CREATE TABLE IF NOT EXISTS test_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  test_type TEXT DEFAULT 'Functional',
  priority TEXT DEFAULT 'P2',
  status TEXT DEFAULT 'Draft',
  automation_status TEXT DEFAULT 'Manual',
  steps TEXT DEFAULT '[]',
  expected_result TEXT,
  tags TEXT DEFAULT '[]',
  rf_keywords_hint TEXT DEFAULT '[]',
  generated_by TEXT DEFAULT 'Manual',
  agent_run_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
