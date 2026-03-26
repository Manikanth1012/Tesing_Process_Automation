const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../tamt.db');

function initializeDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create migrations tracking table first
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const migrationsDir = path.join(__dirname, '../../migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  migrationFiles.forEach(file => {
    const alreadyApplied = db.prepare('SELECT filename FROM _migrations WHERE filename = ?').get(file);
    if (alreadyApplied) return;

    try {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
      console.log(`[DB] Migration applied: ${file}`);
    } catch (err) {
      console.error(`[DB] Migration failed: ${file}`, err.message);
    }
  });

  console.log(`[DB] Database initialized at ${DB_PATH}`);
  return db;
}

const db = initializeDatabase();
module.exports = db;
