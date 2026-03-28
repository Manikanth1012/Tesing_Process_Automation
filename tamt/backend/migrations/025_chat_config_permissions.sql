-- Persistent chat sessions per user
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT    NOT NULL DEFAULT 'New Conversation',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role       TEXT    NOT NULL CHECK(role IN ('user','assistant')),
  content    TEXT    NOT NULL,
  context_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Platform configuration (LLM keys, vector DB settings)
CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  is_secret   INTEGER NOT NULL DEFAULT 0,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default config entries
INSERT OR IGNORE INTO platform_config (key, value, description, is_secret) VALUES
  ('llm_provider',    'anthropic',   'LLM provider: anthropic', 0),
  ('llm_model',       'claude-sonnet-4-6', 'Claude model to use', 0),
  ('llm_api_key',     '',            'Anthropic API Key', 1),
  ('vector_engine',   'tfidf',       'Vector engine: tfidf | voyage | vectra', 0),
  ('voyage_api_key',  '',            'Voyage AI API Key for neural embeddings', 1),
  ('vector_top_k',    '5',           'Number of context chunks to retrieve', 0),
  ('chat_max_history','10',          'Max message turns kept in context', 0);

-- Role-based permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT    NOT NULL,
  permission TEXT    NOT NULL,
  allowed    INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role, permission)
);

-- Seed default permissions
INSERT OR IGNORE INTO role_permissions (role, permission, allowed) VALUES
  ('ADMIN',       'manage_users',      1),
  ('ADMIN',       'manage_projects',   1),
  ('ADMIN',       'manage_settings',   1),
  ('ADMIN',       'run_agents',        1),
  ('ADMIN',       'create_features',   1),
  ('ADMIN',       'create_test_cases', 1),
  ('ADMIN',       'execute_runs',      1),
  ('ADMIN',       'view_reports',      1),
  ('ADMIN',       'import_features',   1),
  ('QA_LEAD',     'manage_users',      0),
  ('QA_LEAD',     'manage_projects',   1),
  ('QA_LEAD',     'manage_settings',   0),
  ('QA_LEAD',     'run_agents',        1),
  ('QA_LEAD',     'create_features',   1),
  ('QA_LEAD',     'create_test_cases', 1),
  ('QA_LEAD',     'execute_runs',      1),
  ('QA_LEAD',     'view_reports',      1),
  ('QA_LEAD',     'import_features',   1),
  ('QA_ENGINEER', 'manage_users',      0),
  ('QA_ENGINEER', 'manage_projects',   0),
  ('QA_ENGINEER', 'manage_settings',   0),
  ('QA_ENGINEER', 'run_agents',        1),
  ('QA_ENGINEER', 'create_features',   1),
  ('QA_ENGINEER', 'create_test_cases', 1),
  ('QA_ENGINEER', 'execute_runs',      1),
  ('QA_ENGINEER', 'view_reports',      1),
  ('QA_ENGINEER', 'import_features',   0),
  ('DEVELOPER',   'manage_users',      0),
  ('DEVELOPER',   'manage_projects',   0),
  ('DEVELOPER',   'manage_settings',   0),
  ('DEVELOPER',   'run_agents',        0),
  ('DEVELOPER',   'create_features',   0),
  ('DEVELOPER',   'create_test_cases', 0),
  ('DEVELOPER',   'execute_runs',      0),
  ('DEVELOPER',   'view_reports',      1),
  ('DEVELOPER',   'import_features',   0),
  ('MANAGER',     'manage_users',      0),
  ('MANAGER',     'manage_projects',   1),
  ('MANAGER',     'manage_settings',   0),
  ('MANAGER',     'run_agents',        0),
  ('MANAGER',     'create_features',   0),
  ('MANAGER',     'create_test_cases', 0),
  ('MANAGER',     'execute_runs',      0),
  ('MANAGER',     'view_reports',      1),
  ('MANAGER',     'import_features',   0);
