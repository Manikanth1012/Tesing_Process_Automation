-- Reference / base documents that teams upload for use by agents and testers.
-- template_type:
--   FUNCTIONAL_TC  → Functional test case template (e.g. Excel / Word / .robot)
--   GUI_TC         → GUI test case template
--   API_SPEC       → API Specification document (Word / PDF / Markdown)
--   SWAGGER        → Swagger / OpenAPI contract (JSON / YAML)
CREATE TABLE IF NOT EXISTS reference_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  template_type TEXT NOT NULL,          -- FUNCTIONAL_TC | GUI_TC | API_SPEC | SWAGGER
  feature_id    INTEGER REFERENCES features(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  content       TEXT,                   -- text content for Swagger / Markdown / plain-text specs
  description   TEXT,
  is_global     INTEGER DEFAULT 0,      -- 1 = available to all features
  uploaded_by   INTEGER REFERENCES users(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
