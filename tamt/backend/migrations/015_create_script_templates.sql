CREATE TABLE IF NOT EXISTS script_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_type TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
