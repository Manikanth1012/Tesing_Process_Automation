CREATE TABLE IF NOT EXISTS agent_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_run_id INTEGER NOT NULL REFERENCES agent_runs(id),
  suggestion_type TEXT NOT NULL,
  entity_id INTEGER,
  content TEXT DEFAULT '{}',
  status TEXT DEFAULT 'Pending',
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
