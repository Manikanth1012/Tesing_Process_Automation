CREATE TABLE IF NOT EXISTS test_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  target_release TEXT,
  status TEXT DEFAULT 'Draft',
  start_date DATE,
  end_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_plan_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_plan_id INTEGER NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  UNIQUE(test_plan_id, feature_id)
);
