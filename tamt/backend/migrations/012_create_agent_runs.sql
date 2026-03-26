CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,
  trigger_entity_type TEXT,
  trigger_entity_id INTEGER,
  status TEXT DEFAULT 'Running',
  input_context TEXT DEFAULT '{}',
  output_summary TEXT,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
