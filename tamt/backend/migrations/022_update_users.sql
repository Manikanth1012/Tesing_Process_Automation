ALTER TABLE users ADD COLUMN system_role TEXT DEFAULT 'User';
ALTER TABLE users ADD COLUMN last_login DATETIME;
UPDATE users SET system_role = 'SuperAdmin' WHERE role = 'ADMIN';
