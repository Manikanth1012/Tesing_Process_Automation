CREATE TABLE IF NOT EXISTS features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  feature_type TEXT NOT NULL DEFAULT 'Functional',
  priority TEXT DEFAULT 'P2',
  status TEXT DEFAULT 'Draft',
  prereq_readiness INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
