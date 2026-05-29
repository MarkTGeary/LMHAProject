const express = require('express');
const router = express.Router();
const db = require('../db');
const { LOCK_DAYS } = require('../lib/constants');
const { badRequest, forbidden, notFound } = require('../lib/errors');
const {
  assertRequestLocation,
  booleanInt,
  enumArray,
  enumValue,
  hasOwn,
  normaliseString,
  parseDateString,
  parseId,
  parseJsonArray,
} = require('../lib/validation');

const REFERRAL_SOURCES = [
  'Self-referral',
  'Local NGO and Community Partner Agency',
  'HSE Health Services',
  'GP',
  'Community Mental Health Team',
  'Liaison Psychiatry Team',
  'Crisis Resolution Team',
  'CAST',
  'LSW',
  'LTSP',
  'Probation',
  'Other',
];
const REASONS = [
  'Feeling unable to cope or in crisis',
  'Information seeking',
  'To attend support or training event',
  'Looking for Peer support',
  'Looking for Social Support',
  'Other',
  'Prefer not to say',
];
const SUPPORT_NEEDS = [
  'info_statutory_mh',
  'info_non_statutory_mh',
  'info_wider_community',
  'peer_coping',
  'peer_recovery',
  'crisis_deescalation',
  'crisis_ae',
  'crisis_guards',
  'social',
];
const ONWARD_REFERRALS = [
  'cv_counselling',
  'cv_housing',
  'cv_finance',
  'cv_mh_groups',
  'cv_addiction_groups',
  'cv_family',
  'hse_mh',
  'hse_primary_care',
  'hse_disability',
  'hse_older_persons',
  'hse_crt',
  'tusla',
  'mabs',
  'dept_social_protection',
  'citizens_information',
  'ags',
];
const LIMITATIONS = [
  'monday',
  'tuesday',
  'wednesday',
  'saturday',
  'sunday',
  'before_6pm',
  'after_midnight',
  'before_11am',
  'after_5pm',
  'calls_out_of_hours',
  'text_out_of_hours',
];
const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const YES_NO = ['Yes', 'No'];

function localTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function assertUnlocked(booking) {
  const cutoff = localTodayStart();
  cutoff.setDate(cutoff.getDate() - LOCK_DAYS);
  if (new Date(booking.date + 'T12:00:00') < cutoff) {
    throw forbidden('This record is locked - bookings older than 3 weeks cannot be edited');
  }
}

function parseStoredJson(row) {
  if (row.reasons_for_attending) row.reasons_for_attending = parseJsonArray(row.reasons_for_attending);
  if (row.support_needs) row.support_needs = parseJsonArray(row.support_needs);
  if (row.onward_referrals) row.onward_referrals = parseJsonArray(row.onward_referrals);
  if (row.limitations_detail) row.limitations_detail = parseJsonArray(row.limitations_detail);
  return row;
}

function nullableJson(values) {
  return values.length ? JSON.stringify(values) : null;
}

function serviceUserSelect(prefix = 'su') {
  return `
    ${prefix}.full_name,
    ${prefix}.phone,
    ${prefix}.email,
    ${prefix}.age_group,
    ${prefix}.gender,
    ${prefix}.living_alone,
    ${prefix}.english_speaking,
    ${prefix}.translator_required,
    ${prefix}.translator_language,
    ${prefix}.address,
    ${prefix}.emergency_contact_name,
    ${prefix}.emergency_contact_relationship,
    ${prefix}.emergency_contact_phone,
    ${prefix}.gp_name,
    ${prefix}.gp_phone
  `;
}

function normaliseServiceUserFields(body) {
  return {
    full_name: hasOwn(body, 'full_name') ? normaliseString(body.full_name, 'full_name', { max: 200 }) : undefined,
    phone: hasOwn(body, 'phone') ? normaliseString(body.phone, 'phone', { max: 100 }) : undefined,
    email: hasOwn(body, 'email') ? normaliseString(body.email, 'email', { max: 320 }) : undefined,
    age_group: hasOwn(body, 'age_group') ? enumValue(body.age_group, AGE_GROUPS, 'age_group', { required: false }) : undefined,
    gender: hasOwn(body, 'gender') ? enumValue(body.gender, GENDERS, 'gender', { required: false }) : undefined,
    living_alone: hasOwn(body, 'living_alone') ? enumValue(body.living_alone, YES_NO, 'living_alone', { required: false }) : undefined,
    english_speaking: hasOwn(body, 'english_speaking') ? enumValue(body.english_speaking, YES_NO, 'english_speaking', { required: false }) : undefined,
    translator_required: hasOwn(body, 'translator_required') ? enumValue(body.translator_required, YES_NO, 'translator_required', { required: false }) : undefined,
    translator_language: hasOwn(body, 'translator_language') ? normaliseString(body.translator_language, 'translator_language', { max: 100 }) : undefined,
    address: hasOwn(body, 'address') ? normaliseString(body.address, 'address', { max: 500 }) : undefined,
    emergency_contact_name: hasOwn(body, 'emergency_contact_name') ? normaliseString(body.emergency_contact_name, 'emergency_contact_name', { max: 200 }) : undefined,
    emergency_contact_relationship: hasOwn(body, 'emergency_contact_relationship') ? normaliseString(body.emergency_contact_relationship, 'emergency_contact_relationship', { max: 100 }) : undefined,
    emergency_contact_phone: hasOwn(body, 'emergency_contact_phone') ? normaliseString(body.emergency_contact_phone, 'emergency_contact_phone', { max: 100 }) : undefined,
    gp_name: hasOwn(body, 'gp_name') ? normaliseString(body.gp_name, 'gp_name', { max: 200 }) : undefined,
    gp_phone: hasOwn(body, 'gp_phone') ? normaliseString(body.gp_phone, 'gp_phone', { max: 100 }) : undefined,
  };
}

// GET /api/intake-forms/booking/:bookingId
router.get('/booking/:bookingId', async (req, res, next) => {
  try {
    const bookingId = parseId(req.params.bookingId, 'bookingId');
    const bookingResult = await db.execute({
      sql: 'SELECT id, location FROM bookings WHERE id = ?',
      args: [bookingId],
    });
    if (!bookingResult.rows.length) throw notFound('Booking not found');
    if (bookingResult.rows[0].location !== req.location) {
      throw forbidden('Location does not match your current session');
    }

    const result = await db.execute({
      sql: `SELECT i.*, ${serviceUserSelect('su')}
            FROM intake_forms i
            LEFT JOIN service_users su ON su.id = i.service_user_id
            WHERE i.booking_id = ?`,
      args: [bookingId],
    });
    if (!result.rows.length) throw notFound('No intake form for this booking');
    res.json(parseStoredJson({ ...result.rows[0] }));
  } catch (err) { next(err); }
});

// POST /api/intake-forms — create or update (upsert by booking_id)
router.post('/', async (req, res, next) => {
  try {
    const {
      booking_id,
      ed_diversion,
      privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
      is_repeat, existing_user_id,
    } = req.body;

    const bookingId = parseId(booking_id, 'booking_id');
    const serviceUserFields = normaliseServiceUserFields(req.body);
    const requestedServiceUserId = parseId(req.body.service_user_id, 'service_user_id', { required: false });
    const existingUserId = parseId(existing_user_id, 'existing_user_id', { required: false });
    const referralSource = enumValue(req.body.referral_source, REFERRAL_SOURCES, 'referral_source', { required: false });
    const referredByName = normaliseString(req.body.referred_by_name, 'referred_by_name', { max: 200 });
    const referredByRole = normaliseString(req.body.referred_by_role, 'referred_by_role', { max: 100 });
    const referredByPhone = normaliseString(req.body.referred_by_phone, 'referred_by_phone', { max: 100 });
    const referredByEmail = normaliseString(req.body.referred_by_email, 'referred_by_email', { max: 320 });
    const reasons = enumArray(req.body.reasons_for_attending, REASONS, 'reasons_for_attending');
    const supportNeeds = enumArray(req.body.support_needs, SUPPORT_NEEDS, 'support_needs');
    const onwardReferrals = enumArray(req.body.onward_referrals, ONWARD_REFERRALS, 'onward_referrals');
    const limitationsDetail = enumArray(req.body.limitations_detail, LIMITATIONS, 'limitations_detail');
    const staffMember = normaliseString(req.body.staff_member, 'staff_member', { max: 200 });
    const staffSignature = normaliseString(req.body.staff_signature, 'staff_signature', { max: 200 });
    const signedDate = req.body.signed_date ? parseDateString(req.body.signed_date, 'signed_date') : null;

    if (!privacy_acknowledged || !safety_agreement_acknowledged || !confidentiality_limits_explained) {
      throw badRequest('All three acknowledgements must be checked before submitting');
    }

    const bookingResult = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [bookingId],
    });
    if (!bookingResult.rows.length) throw notFound('Booking not found');
    const booking = bookingResult.rows[0];
    assertRequestLocation(req, booking.location);
    if (booking.location !== req.location) throw forbidden('Location does not match your current session');

    assertUnlocked(booking);

    let userId = requestedServiceUserId || existingUserId;

    if (is_repeat && existingUserId) {
      userId = existingUserId;
      await db.execute({ sql: 'UPDATE service_users SET repeat_user = 1 WHERE id = ?', args: [existingUserId] });
      await db.execute({
        sql: 'UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?',
        args: [existingUserId, 'Repeat', bookingId],
      });
    } else if (!userId) {
      const fullName = serviceUserFields.full_name;
      if (!fullName) throw badRequest('full_name required for new service user');

      const suResult = await db.execute({
        sql: `INSERT INTO service_users (
                full_name, phone, email, age_group, gender, living_alone,
                english_speaking, translator_required, translator_language,
                address, emergency_contact_name, emergency_contact_relationship,
                emergency_contact_phone, gp_name, gp_phone, repeat_user, first_visit_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [
          fullName, serviceUserFields.phone ?? null, serviceUserFields.email ?? null,
          serviceUserFields.age_group ?? null, serviceUserFields.gender ?? null,
          serviceUserFields.living_alone ?? null, serviceUserFields.english_speaking ?? null,
          serviceUserFields.translator_required ?? null, serviceUserFields.translator_language ?? null,
          serviceUserFields.address ?? null, serviceUserFields.emergency_contact_name ?? null,
          serviceUserFields.emergency_contact_relationship ?? null, serviceUserFields.emergency_contact_phone ?? null,
          serviceUserFields.gp_name ?? null, serviceUserFields.gp_phone ?? null, booking.date,
        ],
      });
      userId = Number(suResult.lastInsertRowid);

      await db.execute({
        sql: 'UPDATE bookings SET service_user_id = ?, new_or_repeat = ? WHERE id = ?',
        args: [userId, 'New', bookingId],
      });
    } else {
      const sets = [];
      const args = [];
      for (const [field, value] of Object.entries(serviceUserFields)) {
        if (value !== undefined) {
          sets.push(`${field} = ?`);
          args.push(value);
        }
      }
      if (sets.length) {
        args.push(userId);
        await db.execute({
          sql: `UPDATE service_users SET ${sets.join(', ')} WHERE id = ?`,
          args,
        });
      }
    }

    if (ed_diversion !== undefined) {
      await db.execute({
        sql: 'UPDATE bookings SET ed_diversion = ? WHERE id = ?',
        args: [booleanInt(ed_diversion, 'ed_diversion', { nullable: true }), bookingId],
      });
    }

    const existingForm = await db.execute({
      sql: 'SELECT id FROM intake_forms WHERE booking_id = ?',
      args: [bookingId],
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
                support_needs                  = ?,
                onward_referrals               = ?,
                limitations_detail             = ?,
                completed_at                   = datetime('now')
              WHERE booking_id = ?`,
        args: [
          userId, referralSource,
          referredByName, referredByRole, referredByPhone, referredByEmail,
          nullableJson(reasons),
          privacy_acknowledged ? 1 : 0,
          safety_agreement_acknowledged ? 1 : 0,
          confidentiality_limits_explained ? 1 : 0,
          staffMember, staffSignature, signedDate,
          nullableJson(supportNeeds),
          nullableJson(onwardReferrals),
          nullableJson(limitationsDetail),
          bookingId,
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
          bookingId, userId,
          referralSource, referredByName, referredByRole, referredByPhone, referredByEmail,
          nullableJson(reasons),
          privacy_acknowledged ? 1 : 0,
          safety_agreement_acknowledged ? 1 : 0,
          confidentiality_limits_explained ? 1 : 0,
          staffMember, staffSignature, signedDate,
          nullableJson(supportNeeds),
          nullableJson(onwardReferrals),
          nullableJson(limitationsDetail),
        ],
      });
    }

    const formResult = await db.execute({
      sql: 'SELECT * FROM intake_forms WHERE booking_id = ?',
      args: [bookingId],
    });
    const form = parseStoredJson({ ...formResult.rows[0] });
    res.status(201).json({ intake: form, service_user_id: userId });
  } catch (err) { next(err); }
});

module.exports = router;
