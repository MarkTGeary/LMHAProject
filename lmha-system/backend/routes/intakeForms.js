const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

// GET /api/intake-forms/booking/:bookingId
router.get('/booking/:bookingId', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM intake_forms WHERE booking_id = ?',
      args: [req.params.bookingId],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'No intake form for this booking' });
    const row = { ...result.rows[0] };
    if (row.reasons_for_attending) row.reasons_for_attending = JSON.parse(row.reasons_for_attending);
    if (row.support_needs)         row.support_needs         = JSON.parse(row.support_needs);
    if (row.onward_referrals)      row.onward_referrals      = JSON.parse(row.onward_referrals);
    if (row.limitations_detail)    row.limitations_detail    = JSON.parse(row.limitations_detail);
    res.json(row);
  } catch (err) { next(err); }
});

// POST /api/intake-forms — create or update (upsert by booking_id)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      booking_id, service_user_id,
      full_name, phone, email, age_group, gender, living_alone,
      english_speaking, translator_required, translator_language,
      address, emergency_contact_name, emergency_contact_relationship,
      emergency_contact_phone, gp_name, gp_phone, ed_diversion,
      referral_source, referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
      reasons_for_attending,
      privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
      staff_member, staff_signature, signed_date,
      support_needs, onward_referrals, limitations_detail,
      is_repeat, existing_user_id,
    } = req.body;

    if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

    if (!privacy_acknowledged || !safety_agreement_acknowledged || !confidentiality_limits_explained) {
      return res.status(400).json({ error: 'All three acknowledgements must be checked before submitting' });
    }

    const bookingResult = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [booking_id],
    });
    if (!bookingResult.rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookingResult.rows[0];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 21);
    cutoff.setHours(0, 0, 0, 0);
    if (new Date(booking.date) < cutoff) {
      return res.status(403).json({ error: 'This record is locked — bookings older than 3 weeks cannot be edited' });
    }

    let userId = service_user_id || existing_user_id;

    if (is_repeat && existing_user_id) {
      userId = existing_user_id;
      await db.execute({ sql: 'UPDATE service_users SET repeat_user = 1 WHERE id = ?', args: [existing_user_id] });
      await db.execute({
        sql: 'UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?',
        args: [existing_user_id, 'Repeat', booking_id],
      });
    } else if (!userId) {
      if (!full_name) return res.status(400).json({ error: 'full_name required for new service user' });

      const suResult = await db.execute({
        sql: `INSERT INTO service_users (
                full_name, phone, email, age_group, gender, living_alone,
                english_speaking, translator_required, translator_language,
                address, emergency_contact_name, emergency_contact_relationship,
                emergency_contact_phone, gp_name, gp_phone, repeat_user, first_visit_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [
          full_name, phone || null, email || null, age_group || null, gender || null,
          living_alone || null, english_speaking || null, translator_required || null,
          translator_language || null, address || null, emergency_contact_name || null,
          emergency_contact_relationship || null, emergency_contact_phone || null,
          gp_name || null, gp_phone || null, booking.date,
        ],
      });
      userId = Number(suResult.lastInsertRowid);

      await db.execute({
        sql: 'UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?',
        args: [userId, 'New', booking_id],
      });
    } else {
      await db.execute({
        sql: `UPDATE service_users SET
                full_name                     = COALESCE(?, full_name),
                phone                         = COALESCE(?, phone),
                email                         = COALESCE(?, email),
                age_group                     = COALESCE(?, age_group),
                gender                        = COALESCE(?, gender),
                living_alone                  = COALESCE(?, living_alone),
                english_speaking              = COALESCE(?, english_speaking),
                translator_required           = COALESCE(?, translator_required),
                translator_language           = COALESCE(?, translator_language),
                address                       = COALESCE(?, address),
                emergency_contact_name        = COALESCE(?, emergency_contact_name),
                emergency_contact_relationship = COALESCE(?, emergency_contact_relationship),
                emergency_contact_phone       = COALESCE(?, emergency_contact_phone),
                gp_name                       = COALESCE(?, gp_name),
                gp_phone                      = COALESCE(?, gp_phone)
              WHERE id = ?`,
        args: [
          full_name || null, phone || null, email || null, age_group || null, gender || null,
          living_alone || null, english_speaking || null, translator_required || null,
          translator_language || null, address || null, emergency_contact_name || null,
          emergency_contact_relationship || null, emergency_contact_phone || null,
          gp_name || null, gp_phone || null, userId,
        ],
      });
    }

    if (ed_diversion !== undefined) {
      await db.execute({
        sql: 'UPDATE bookings SET ed_diversion = ? WHERE id = ?',
        args: [ed_diversion, booking_id],
      });
    }

    const existingForm = await db.execute({
      sql: 'SELECT id FROM intake_forms WHERE booking_id = ?',
      args: [booking_id],
    });

    if (existingForm.rows.length) {
      await db.execute({
        sql: `UPDATE intake_forms SET
                service_user_id                = ?,
                referral_source                = ?,
                referred_by_name               = ?,
                referred_by_role               = ?,
                referred_by_phone              = ?,
                referred_by_email              = ?,
                reasons_for_attending          = ?,
                privacy_acknowledged           = ?,
                safety_agreement_acknowledged  = ?,
                confidentiality_limits_explained = ?,
                staff_member                   = ?,
                staff_signature                = ?,
                signed_date                    = ?,
                support_needs                  = COALESCE(?, support_needs),
                onward_referrals               = COALESCE(?, onward_referrals),
                limitations_detail             = COALESCE(?, limitations_detail),
                completed_at                   = datetime('now')
              WHERE booking_id = ?`,
        args: [
          userId, referral_source || null, referred_by_name || null,
          referred_by_role || null, referred_by_phone || null, referred_by_email || null,
          reasons_for_attending ? JSON.stringify(reasons_for_attending) : null,
          privacy_acknowledged ? 1 : 0, safety_agreement_acknowledged ? 1 : 0,
          confidentiality_limits_explained ? 1 : 0,
          staff_member || null, staff_signature || null, signed_date || null,
          support_needs ? JSON.stringify(support_needs) : null,
          onward_referrals ? JSON.stringify(onward_referrals) : null,
          limitations_detail ? JSON.stringify(limitations_detail) : null,
          booking_id,
        ],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO intake_forms (
                booking_id, service_user_id,
                referral_source, referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
                reasons_for_attending,
                privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
                staff_member, staff_signature, signed_date,
                support_needs, onward_referrals, limitations_detail
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          booking_id, userId,
          referral_source || null, referred_by_name || null,
          referred_by_role || null, referred_by_phone || null, referred_by_email || null,
          reasons_for_attending ? JSON.stringify(reasons_for_attending) : null,
          privacy_acknowledged ? 1 : 0, safety_agreement_acknowledged ? 1 : 0,
          confidentiality_limits_explained ? 1 : 0,
          staff_member || null, staff_signature || null, signed_date || null,
          support_needs ? JSON.stringify(support_needs) : null,
          onward_referrals ? JSON.stringify(onward_referrals) : null,
          limitations_detail ? JSON.stringify(limitations_detail) : null,
        ],
      });
    }

    const formResult = await db.execute({
      sql: 'SELECT * FROM intake_forms WHERE booking_id = ?',
      args: [booking_id],
    });
    const form = { ...formResult.rows[0] };
    if (form.reasons_for_attending) form.reasons_for_attending = JSON.parse(form.reasons_for_attending);
    if (form.support_needs)         form.support_needs         = JSON.parse(form.support_needs);
    if (form.onward_referrals)      form.onward_referrals      = JSON.parse(form.onward_referrals);
    if (form.limitations_detail)    form.limitations_detail    = JSON.parse(form.limitations_detail);
    res.status(201).json({ intake: form, service_user_id: userId });
  } catch (err) { next(err); }
});

module.exports = router;
