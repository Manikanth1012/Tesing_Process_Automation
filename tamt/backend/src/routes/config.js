/**
 * Platform Configuration API — LLM keys, vector DB settings
 * Admin-only for writes; non-secret values readable by all authenticated users.
 */
const express = require('express');
const db = require('../config/database');
const router = express.Router();

// GET /config/public — non-secret config readable by all users
router.get('/public', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM platform_config WHERE is_secret = 0").all();
  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });
  res.json(config);
});

// GET /config — full config (admin only, secrets masked)
router.get('/', (req, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  const rows = db.prepare("SELECT key, value, description, is_secret, updated_at FROM platform_config").all();
  // Mask secret values that are set
  const result = rows.map(r => ({
    ...r,
    value: r.is_secret && r.value ? '••••••••' : r.value,
    has_value: r.is_secret ? !!r.value : undefined,
  }));
  res.json(result);
});

// PUT /config — update one or more config values (admin only)
router.put('/', (req, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  const updates = req.body; // { key: value, ... }
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Body must be a key-value object' });

  const stmt = db.prepare("UPDATE platform_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?");
  const validKeys = db.prepare("SELECT key FROM platform_config").all().map(r => r.key);

  const updated = [];
  Object.entries(updates).forEach(([key, value]) => {
    // Don't overwrite secrets with the masked placeholder
    if (typeof value === 'string' && value === '••••••••') return;
    if (!validKeys.includes(key)) return;
    stmt.run(String(value), key);
    updated.push(key);
  });

  // Reload env-level overrides into process.env for the running server
  const fresh = db.prepare("SELECT key, value FROM platform_config").all();
  fresh.forEach(r => {
    if (r.key === 'llm_api_key' && r.value) process.env.ANTHROPIC_API_KEY = r.value;
    if (r.key === 'voyage_api_key' && r.value) process.env.VOYAGE_API_KEY = r.value;
    if (r.key === 'llm_model' && r.value) process.env.CLAUDE_MODEL = r.value;
  });

  res.json({ updated, count: updated.length });
});

module.exports = router;
