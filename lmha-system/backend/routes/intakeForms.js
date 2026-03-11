const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

// GET /api/intake-forms/booking/:bookingId
router.get('/booking/:bookingId', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM intake_forms WHERE booking_id = ?').get(req.params.bookingId);
  if (!row) return res.status(404).json({ error: 'No intake form for this booking' });
  // Parse JSON arrays
  if (row.reasons_for_attending) row.reasons_for_attending = JSON.parse(row.reasons_for_attending);
  res.json(row);
});

// POST /api/intake-forms — create or update (upsert by booking_id)
router.post('/', requireAuth, (req, res) => {
  const {
    booking_id, service_user_id,
    // Service user fields (to create/update user record)
    full_name, phone, email, age_group, gender, living_alone,
    english_speaking, translator_required, translator_language,
    address, emergency_contact_name, emergency_contact_relationship,
    emergency_contact_phone, gp_name, gp_phone, ed_diversion,
    // Intake form fields
    referral_source, referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
    reasons_for_attending,
    privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
    staff_member, staff_signature, signed_date,
    // Repeat user
    is_repeat, existing_user_id,
  } = req.body;

  if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

  // Validate acknowledgements
  if (!privacy_acknowledged || !safety_agreement_acknowledged || !confidentiality_limits_explained) {
    return res.status(400).json({ error: 'All three acknowledgements must be checked before submitting' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  let userId = service_user_id || existing_user_id;

  if (is_repeat && existing_user_id) {
    // Link to existing user, mark as repeat
    userId = existing_user_id;
    db.prepare('UPDATE service_users SET repeat_user = 1 WHERE id = ?').run(existing_user_id);
    db.prepare('UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?')
      .run(existing_user_id, 'Repeat', booking_id);
  } else if (!userId) {
    // Create new service user from intake form data
    if (!full_name) return res.status(400).json({ error: 'full_name required for new service user' });

    const result = db.prepare(`
      INSERT INTO service_users (
        full_name, phone, email, age_group, gender, living_alone,
        english_speaking, translator_required, translator_language,
        address, emergency_contact_name, emergency_contact_relationship,
        emergency_contact_phone, gp_name, gp_phone, repeat_user, first_visit_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      full_name, phone || null, email || null, age_group || null, gender || null,
      living_alone || null, english_speaking || null, translator_required || null,
      translator_language || null, address || null, emergency_contact_name || null,
      emergency_contact_relationship || null, emergency_contact_phone || null,
      gp_name || null, gp_phone || null, booking.date
    );
    userId = result.lastInsertRowid;

    // Link booking to new user
    db.prepare('UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?')
      .run(userId, 'New', booking_id);
  } else {
    // Update existing user record
    db.prepare(`
      UPDATE service_users SET
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        age_group = COALESCE(?, age_group),
        gender = COALESCE(?, gender),
        living_alone = COALESCE(?, living_alone),
        english_speaking = COALESCE(?, english_speaking),
        translator_required = COALESCE(?, translator_required),
        translator_language = COALESCE(?, translator_language),
        address = COALESCE(?, address),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_relationship = COALESCE(?, emergency_contact_relationship),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone),
        gp_name = COALESCE(?, gp_name),
        gp_phone = COALESCE(?, gp_phone)
      WHERE id = ?
    `).run(
      full_name || null, phone || null, email || null, age_group || null, gender || null,
      living_alone || null, english_speaking || null, translator_required || null,
      translator_language || null, address || null, emergency_contact_name || null,
      emergency_contact_relationship || null, emergency_contact_phone || null,
      gp_name || null, gp_phone || null, userId
    );
  }

  // Update ed_diversion on booking
  if (ed_diversion !== undefined) {
    db.prepare('UPDATE bookings SET ed_diversion = ? WHERE id = ?').run(ed_diversion, booking_id);
  }

  // Check if intake form already exists
  const existing = db.prepare('SELECT id FROM intake_forms WHERE booking_id = ?').get(booking_id);

  if (existing) {
    db.prepare(`
      UPDATE intake_forms SET
        service_user_id = ?,
        referral_source = ?,
        referred_by_name = ?,
        referred_by_role = ?,
        referred_by_phone = ?,
        referred_by_email = ?,
        reasons_for_attending = ?,
        privacy_acknowledged = ?,
        safety_agreement_acknowledged = ?,
        confidentiality_limits_explained = ?,
        staff_member = ?,
        staff_signature = ?,
        signed_date = ?,
        completed_at = datetime('now')
      WHERE booking_id = ?
    `).run(
      userId, referral_source || null, referred_by_name || null,
      referred_by_role || null, referred_by_phone || null, referred_by_email || null,
      reasons_for_attending ? JSON.stringify(reasons_for_attending) : null,
      privacy_acknowledged ? 1 : 0, safety_agreement_acknowledged ? 1 : 0,
      confidentiality_limits_explained ? 1 : 0,
      staff_member || null, staff_signature || null, signed_date || null,
      booking_id
    );
  } else {
    db.prepare(`
      INSERT INTO intake_forms (
        booking_id, service_user_id,
        referral_source, referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
        reasons_for_attending,
        privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
        staff_member, staff_signature, signed_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      booking_id, userId,
      referral_source || null, referred_by_name || null,
      referred_by_role || null, referred_by_phone || null, referred_by_email || null,
      reasons_for_attending ? JSON.stringify(reasons_for_attending) : null,
      privacy_acknowledged ? 1 : 0, safety_agreement_acknowledged ? 1 : 0,
      confidentiality_limits_explained ? 1 : 0,
      staff_member || null, staff_signature || null, signed_date || null
    );
  }

  const form = db.prepare('SELECT * FROM intake_forms WHERE booking_id = ?').get(booking_id);
  if (form.reasons_for_attending) form.reasons_for_attending = JSON.parse(form.reasons_for_attending);
  res.status(201).json({ intake: form, service_user_id: userId });
});

module.exports = router;
