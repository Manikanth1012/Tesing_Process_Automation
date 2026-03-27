/**
 * User Skills API — GET/POST/DELETE for current user's skill profile
 * Used by the AI assistant to personalise responses.
 */
const express = require('express');
const db = require('../config/database');

const router = express.Router();

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Expert'];

// GET /skills/me — current user's skills
router.get('/me', (req, res) => {
  const skills = db.prepare(
    'SELECT id, skill_name, skill_level, created_at FROM user_skills WHERE user_id = ? ORDER BY skill_name ASC'
  ).all(req.user.id);
  res.json(skills);
});

// POST /skills/me — add a skill
router.post('/me', (req, res) => {
  const { skill_name, skill_level = 'Intermediate' } = req.body;
  if (!skill_name?.trim()) return res.status(400).json({ error: 'skill_name is required' });
  if (!SKILL_LEVELS.includes(skill_level)) return res.status(400).json({ error: `skill_level must be one of: ${SKILL_LEVELS.join(', ')}` });

  try {
    const result = db.prepare(
      'INSERT INTO user_skills (user_id, skill_name, skill_level) VALUES (?, ?, ?)'
    ).run(req.user.id, skill_name.trim(), skill_level);
    res.status(201).json({ id: result.lastInsertRowid, skill_name: skill_name.trim(), skill_level });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: `Skill "${skill_name}" already added` });
    throw err;
  }
});

// PUT /skills/me/:id — update skill level
router.put('/me/:id', (req, res) => {
  const { skill_level } = req.body;
  if (!SKILL_LEVELS.includes(skill_level)) return res.status(400).json({ error: `skill_level must be one of: ${SKILL_LEVELS.join(', ')}` });

  const skill = db.prepare('SELECT * FROM user_skills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  db.prepare('UPDATE user_skills SET skill_level = ? WHERE id = ?').run(skill_level, req.params.id);
  res.json({ ...skill, skill_level });
});

// DELETE /skills/me/:id — remove a skill
router.delete('/me/:id', (req, res) => {
  const skill = db.prepare('SELECT * FROM user_skills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  db.prepare('DELETE FROM user_skills WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// GET /skills/catalog — available skill suggestions
router.get('/catalog', (req, res) => {
  res.json([
    { category: 'Test Automation',  skills: ['Robot Framework', 'Selenium', 'Playwright', 'Cypress', 'Appium', 'WebdriverIO'] },
    { category: 'API Testing',      skills: ['Postman', 'REST Assured', 'Newman', 'Karate', 'SoapUI'] },
    { category: 'Performance',      skills: ['JMeter', 'k6', 'Gatling', 'Locust', 'Artillery'] },
    { category: 'Security Testing', skills: ['OWASP ZAP', 'Burp Suite', 'DAST', 'Penetration Testing'] },
    { category: 'Programming',      skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'Groovy'] },
    { category: 'CI/CD & DevOps',   skills: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'Azure DevOps', 'Docker'] },
    { category: 'Methodologies',    skills: ['BDD / Gherkin', 'TDD', 'ATDD', 'Agile', 'Scrum', 'SAFe'] },
    { category: 'Tools & Management', skills: ['JIRA', 'TestRail', 'Zephyr', 'Xray', 'Confluence', 'Git'] },
  ]);
});

module.exports = router;
