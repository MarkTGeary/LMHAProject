const express = require('express');
const router = express.Router();
const db = require('../db');

const PROTECTED_EMAIL = (process.env.ALLOWED_EMAILS || '').split(',')[0]?.trim().toLowerCase() || '';

// GET /api/admin/emails
router.get('/emails', (req, res) => {
  const rows = db.prepare('SELECT email, added_by, added_at FROM allowed_emails ORDER BY added_at ASC').all();
  res.json({ emails: rows, protected: PROTECTED_EMAIL });
});

// POST /api/admin/emails  { email }
router.post('/emails', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  try {
    db.prepare('INSERT INTO allowed_emails (email, added_by) VALUES (?, ?)').run(email, req.user?.email || 'unknown');
    res.json({ ok: true, email });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email already on list' });
    throw e;
  }
});

// DELETE /api/admin/emails/:email
router.delete('/emails/:email', (req, res) => {
  const email = req.params.email.toLowerCase();
  if (email === PROTECTED_EMAIL) {
    return res.status(403).json({ error: 'This email is protected and cannot be removed' });
  }
  const result = db.prepare('DELETE FROM allowed_emails WHERE email = ?').run(email);
  if (result.changes === 0) return res.status(404).json({ error: 'Email not found' });
  res.json({ ok: true });
});

module.exports = router;
