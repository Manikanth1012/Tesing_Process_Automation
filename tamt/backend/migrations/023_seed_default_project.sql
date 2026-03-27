INSERT OR IGNORE INTO projects (id, name, key, description, status, created_by)
VALUES (1, 'Default Project', 'DFLT', 'Default project. Rename or create new projects to organise your test plans.', 'Active', 1);

UPDATE test_plans SET project_id = 1 WHERE project_id IS NULL;

INSERT OR IGNORE INTO project_members (project_id, user_id, role)
VALUES (1, 1, 'Admin');
