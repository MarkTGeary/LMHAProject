const express = require('express');
const router = express.Router();
const db = require('../db');
const { getRootAdminEmail, isRootAdminEmail, normaliseEmail } = require('../lib/config');
const { badRequest, conflict, forbidden, notFound } = require('../lib/errors');
const { parseId } = require('../lib/validation');
const { recordAudit } = require('../services/audit');

const ROLES = ['admin', 'worker'];

function normaliseRole(value) {
  const role = (value || 'worker').trim().toLowerCase();
  if (!ROLES.includes(role)) throw badRequest('Invalid role');
  return role;
}

// POST /api/admin/service-users/:id/erase
// Admin-only GDPR erasure: remove identifying fields while preserving anonymous
// operational records needed for aggregate reporting.
router.post('/service-users/:id/erase', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'service_user_id');
    const existing = await db.execute({
      sql: 'SELECT id FROM service_users WHERE id = ?',
      args: [id],
    });
    if (!existing.rows.length) throw notFound('Service user not found');

    const erasedName = `Erased service user #${id}`;
    await db.batch([
      {
        sql: `UPDATE service_users SET
                full_name = ?,
                phone = NULL,
                email = NULL,
                age_group = NULL,
                gender = NULL,
                living_alone = NULL,
                english_speaking = NULL,
                translator_required = NULL,
                translator_language = NULL,
                address = NULL,
                emergency_contact_name = NULL,
                emergency_contact_relationship = NULL,
                emergency_contact_phone = NULL,
                gp_name = NULL,
                gp_phone = NULL
              WHERE id = ?`,
        args: [erasedName, id],
      },
      {
        sql: `UPDATE bookings SET
                notes = NULL,
                limitations = NULL,
                peer_support_worker = NULL
              WHERE service_user_id = ?`,
        args: [id],
      },
      {
        sql: `UPDATE intake_forms SET
                referred_by_name = NULL,
                referred_by_role = NULL,
                referred_by_phone = NULL,
                referred_by_email = NULL,
                staff_signature = NULL,
                reasons_for_attending = NULL,
                support_needs = NULL,
                onward_referrals = NULL
              WHERE service_user_id = ?`,
        args: [id],
      },
    ], 'write');

    await recordAudit(req, {
      action: 'ANONYMISE', entityType: 'service_user', entityId: id, serviceUserId: id,
      changedFields: ['identifying_fields', 'case_notes', 'intake_details'],
    });

    res.json({ ok: true, id, full_name: erasedName });
  } catch (err) { next(err); }
});

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

// GET /api/admin/audit-events - append-only audit history
router.get('/audit-events', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
    const filters = [];
    const args = [];
    for (const [column, value] of [
      ['actor_email', req.query.actor],
      ['action', req.query.action],
      ['entity_type', req.query.entity_type],
      ['location', req.query.location],
    ]) {
      if (value) { filters.push(`${column} = ?`); args.push(String(value)); }
    }
    if (req.query.from) { filters.push('occurred_at >= ?'); args.push(String(req.query.from)); }
    if (req.query.to) { filters.push('occurred_at < datetime(?, \'+1 day\')'); args.push(String(req.query.to)); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const count = await db.execute({ sql: `SELECT COUNT(*) AS total FROM audit_events ${where}`, args });
    const result = await db.execute({
      sql: `SELECT id, occurred_at, actor_email, actor_role, action, outcome, entity_type,
                   entity_id, service_user_id, location, changed_fields, request_id
            FROM audit_events ${where}
            ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`,
      args: [...args, limit, (page - 1) * limit],
    });
    await recordAudit(req, { action: 'VIEW', entityType: 'audit_log' });
    res.json({
      events: result.rows.map(row => ({ ...row, changed_fields: JSON.parse(row.changed_fields || '[]') })),
      page, limit, total: Number(count.rows[0]?.total || 0),
    });
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
      await recordAudit(req, { action: 'ACCESS_CHANGE', entityType: 'staff_account', changedFields: ['email', 'role'] });
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
    await recordAudit(req, { action: 'ACCESS_CHANGE', entityType: 'staff_account', changedFields: ['role'] });
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
    await recordAudit(req, { action: 'ACCESS_CHANGE', entityType: 'staff_account', changedFields: ['access_removed'] });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
