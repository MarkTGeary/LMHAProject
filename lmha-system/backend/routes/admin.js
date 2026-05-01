const express = require('express');
const router = express.Router();
const db = require('../db');
const { getRootAdminEmail, isRootAdminEmail, normaliseEmail } = require('../lib/config');
const { badRequest, conflict, forbidden, notFound } = require('../lib/errors');

const ROLES = ['admin', 'worker'];

function normaliseRole(value) {
  const role = (value || 'worker').trim().toLowerCase();
  if (!ROLES.includes(role)) throw badRequest('Invalid role');
  return role;
}

// GET /api/admin/emails
router.get('/emails', async (req, res, next) => {
  try {
    const rootAdmin = getRootAdminEmail();
    const result = await db.execute('SELECT email, role, added_by, added_at FROM allowed_emails ORDER BY role ASC, added_at ASC');
    const emails = result.rows.map(row => ({
      ...row,
      role: isRootAdminEmail(row.email) ? 'admin' : row.role || 'worker',
      protected: isRootAdminEmail(row.email),
    }));
    res.json({ emails, protected: rootAdmin, roles: ROLES });
  } catch (err) { next(err); }
});

// POST /api/admin/emails  { email, role }
router.post('/emails', async (req, res, next) => {
  try {
    const email = normaliseEmail(req.body.email);
    const role = isRootAdminEmail(email) ? 'admin' : normaliseRole(req.body.role);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw badRequest('Invalid email address');
    }
    try {
      await db.execute({
        sql: 'INSERT INTO allowed_emails (email, role, added_by) VALUES (?, ?, ?)',
        args: [email, role, req.user.email],
      });
      res.json({ ok: true, email, role });
    } catch (e) {
      if (e.message?.includes('UNIQUE') || e.message?.includes('SQLITE_CONSTRAINT')) {
        throw conflict('Email already on list');
      }
      throw e;
    }
  } catch (err) { next(err); }
});

// PATCH /api/admin/emails/:email  { role }
router.patch('/emails/:email', async (req, res, next) => {
  try {
    const email = normaliseEmail(req.params.email);
    if (!email) throw badRequest('Invalid email address');
    if (isRootAdminEmail(email)) {
      throw forbidden('This email is the protected root admin and cannot be demoted');
    }
    if (email === normaliseEmail(req.user.email)) {
      throw forbidden('You cannot change your own role');
    }
    const role = normaliseRole(req.body.role);
    const result = await db.execute({
      sql: 'UPDATE allowed_emails SET role = ? WHERE email = ?',
      args: [role, email],
    });
    if (result.rowsAffected === 0) throw notFound('Email not found');
    res.json({ ok: true, email, role });
  } catch (err) { next(err); }
});

// DELETE /api/admin/emails/:email
router.delete('/emails/:email', async (req, res, next) => {
  try {
    const email = normaliseEmail(req.params.email);
    if (isRootAdminEmail(email)) {
      throw forbidden('This email is the protected root admin and cannot be removed');
    }
    if (email === normaliseEmail(req.user.email)) {
      throw forbidden('You cannot remove yourself from the allowlist');
    }
    const result = await db.execute({
      sql: 'DELETE FROM allowed_emails WHERE email = ?',
      args: [email],
    });
    if (result.rowsAffected === 0) throw notFound('Email not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
