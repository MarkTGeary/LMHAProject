const express = require('express');
const router = express.Router();
const db = require('../db');

const PROTECTED_EMAIL = (process.env.ALLOWED_EMAILS || '').split(',')[0]?.trim().toLowerCase() || '';

// GET /api/admin/emails
router.get('/emails', async (req, res, next) => {
  try {
    const result = await db.execute('SELECT email, added_by, added_at FROM allowed_emails ORDER BY added_at ASC');
    res.json({ emails: result.rows, protected: PROTECTED_EMAIL });
  } catch (err) { next(err); }
});

// POST /api/admin/emails  { email }
router.post('/emails', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    try {
      await db.execute({
        sql: 'INSERT INTO allowed_emails (email, added_by) VALUES (?, ?)',
        args: [email, req.user?.email || 'unknown'],
      });
      res.json({ ok: true, email });
    } catch (e) {
      if (e.message?.includes('UNIQUE') || e.message?.includes('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Email already on list' });
      }
      throw e;
    }
  } catch (err) { next(err); }
});

// DELETE /api/admin/emails/:email
router.delete('/emails/:email', async (req, res, next) => {
  try {
    const email = req.params.email.toLowerCase();
    if (email === PROTECTED_EMAIL) {
      return res.status(403).json({ error: 'This email is protected and cannot be removed' });
    }
    const result = await db.execute({
      sql: 'DELETE FROM allowed_emails WHERE email = ?',
      args: [email],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
