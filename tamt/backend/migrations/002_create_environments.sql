CREATE TABLE IF NOT EXISTS environments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  env_type TEXT DEFAULT 'SIT',
  variables TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO environments (name, base_url, env_type) VALUES
('SIT', 'http://sit.yourtestenv.internal', 'SIT'),
('UAT', 'http://uat.yourtestenv.internal', 'UAT');
