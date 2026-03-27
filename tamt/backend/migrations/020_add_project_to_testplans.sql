ALTER TABLE test_plans ADD COLUMN project_id INTEGER REFERENCES projects(id);
