-- Vector-style context index for RAG (TF-IDF stored as JSON)
CREATE TABLE IF NOT EXISTS context_embeddings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type  TEXT    NOT NULL,   -- 'Feature' | 'TestCase' | 'TestPlan' | 'Project'
  entity_id    INTEGER NOT NULL,
  text_content TEXT    NOT NULL,
  term_freq    TEXT    NOT NULL,   -- JSON: { token: rawCount }
  doc_length   INTEGER NOT NULL DEFAULT 0,
  metadata     TEXT,               -- JSON: { name, type, priority, status, ... }
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);

-- User skills for personalized AI assistance
CREATE TABLE IF NOT EXISTS user_skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  skill_name  TEXT    NOT NULL,
  skill_level TEXT    NOT NULL DEFAULT 'Intermediate', -- Beginner | Intermediate | Expert
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, skill_name)
);
