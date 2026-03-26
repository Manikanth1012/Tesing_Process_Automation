CREATE TABLE IF NOT EXISTS robot_scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  feature_type TEXT DEFAULT 'Functional',
  script_name TEXT NOT NULL,
  script_content TEXT NOT NULL,
  file_path TEXT,
  generated_by TEXT DEFAULT 'Manual',
  agent_run_id INTEGER,
  status TEXT DEFAULT 'Draft',
  version INTEGER DEFAULT 1,
  last_validated_at DATETIME,
  validation_errors TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
