const express = require('express');
const router = express.Router();
const db = require('../db');
const { badRequest, notFound } = require('../lib/errors');
const {
  booleanInt,
  enumValue,
  hasOwn,
  normaliseString,
  parseId,
} = require('../lib/validation');

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const YES_NO = ['Yes', 'No'];

// Search service users by name or phone
router.get('/search', async (req, res, next) => {
  try {
    const q = normaliseString(req.query.q || '', 'q', { max: 100 });
    if (!q || q.length < 2) return res.json([]);

    const term = `%${q}%`;
    const result = await db.execute({
      sql: `SELECT id, full_name, phone, email, age_group, gender, repeat_user, first_visit_date,
                   (SELECT COUNT(*) FROM bookings WHERE service_user_id = service_users.id) as visit_count
            FROM service_users
            WHERE full_name LIKE ? OR phone LIKE ?
            ORDER BY full_name ASC
            LIMIT 10`,
      args: [term, term],
    });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/service-users/:id/bookings - read-only cross-location history
router.get('/:id/bookings', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const result = await db.execute({
      sql: `SELECT b.*,
                   su.full_name,
                   su.phone,
                   CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
            FROM bookings b
            LEFT JOIN service_users su ON b.service_user_id = su.id
            LEFT JOIN intake_forms i ON i.booking_id = b.id
            WHERE b.service_user_id = ?
            ORDER BY b.date DESC, b.time_booked DESC`,
      args: [id],
    });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/service-users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const result = await db.execute({
      sql: `SELECT su.*,
                   (SELECT COUNT(*) FROM bookings WHERE service_user_id = su.id) as visit_count
            FROM service_users su
            WHERE su.id = ?`,
      args: [id],
    });
    if (!result.rows.length) throw notFound();
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/service-users — create
router.post('/', async (req, res, next) => {
  try {
    const full_name = normaliseString(req.body.full_name, 'full_name', { required: true, max: 200 });
    const phone = normaliseString(req.body.phone, 'phone', { max: 100 });
    const email = normaliseString(req.body.email, 'email', { max: 320 });
    const age_group = enumValue(req.body.age_group, AGE_GROUPS, 'age_group', { required: false });
    const gender = enumValue(req.body.gender, GENDERS, 'gender', { required: false });
    const living_alone = enumValue(req.body.living_alone, YES_NO, 'living_alone', { required: false });
    const english_speaking = enumValue(req.body.english_speaking, YES_NO, 'english_speaking', { required: false });
    const translator_required = enumValue(req.body.translator_required, YES_NO, 'translator_required', { required: false });
    const translator_language = normaliseString(req.body.translator_language, 'translator_language', { max: 100 });
    const address = normaliseString(req.body.address, 'address', { max: 500 });
    const emergency_contact_name = normaliseString(req.body.emergency_contact_name, 'emergency_contact_name', { max: 200 });
    const emergency_contact_relationship = normaliseString(req.body.emergency_contact_relationship, 'emergency_contact_relationship', { max: 100 });
    const emergency_contact_phone = normaliseString(req.body.emergency_contact_phone, 'emergency_contact_phone', { max: 100 });
    const gp_name = normaliseString(req.body.gp_name, 'gp_name', { max: 200 });
    const gp_phone = normaliseString(req.body.gp_phone, 'gp_phone', { max: 100 });
    const first_visit_date = normaliseString(req.body.first_visit_date, 'first_visit_date', { max: 20 });

    const insertResult = await db.execute({
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
        gp_name || null, gp_phone || null, first_visit_date || null,
      ],
    });

    const user = await db.execute({
      sql: 'SELECT * FROM service_users WHERE id = ?',
      args: [Number(insertResult.lastInsertRowid)],
    });
    res.status(201).json(user.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/service-users/:id — update
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existingResult = await db.execute({
      sql: 'SELECT * FROM service_users WHERE id = ?',
      args: [id],
    });
    if (!existingResult.rows.length) throw notFound();

    const validators = {
      full_name: v => normaliseString(v, 'full_name', { required: true, max: 200 }),
      phone: v => normaliseString(v, 'phone', { max: 100 }),
      email: v => normaliseString(v, 'email', { max: 320 }),
      age_group: v => enumValue(v, AGE_GROUPS, 'age_group', { required: false }),
      gender: v => enumValue(v, GENDERS, 'gender', { required: false }),
      living_alone: v => enumValue(v, YES_NO, 'living_alone', { required: false }),
      english_speaking: v => enumValue(v, YES_NO, 'english_speaking', { required: false }),
      translator_required: v => enumValue(v, YES_NO, 'translator_required', { required: false }),
      translator_language: v => normaliseString(v, 'translator_language', { max: 100 }),
      address: v => normaliseString(v, 'address', { max: 500 }),
      emergency_contact_name: v => normaliseString(v, 'emergency_contact_name', { max: 200 }),
      emergency_contact_relationship: v => normaliseString(v, 'emergency_contact_relationship', { max: 100 }),
      emergency_contact_phone: v => normaliseString(v, 'emergency_contact_phone', { max: 100 }),
      gp_name: v => normaliseString(v, 'gp_name', { max: 200 }),
      gp_phone: v => normaliseString(v, 'gp_phone', { max: 100 }),
      repeat_user: v => booleanInt(v, 'repeat_user'),
      first_visit_date: v => normaliseString(v, 'first_visit_date', { max: 20 }),
    };

    const sets = [];
    const args = [];
    for (const [f, validator] of Object.entries(validators)) {
      if (hasOwn(req.body, f)) {
        sets.push(`${f} = ?`);
        args.push(validator(req.body[f]));
      }
    }

    if (sets.length === 0) throw badRequest('No fields to update');

    args.push(id);
    await db.execute({ sql: `UPDATE service_users SET ${sets.join(', ')} WHERE id = ?`, args });

    const updated = await db.execute({
      sql: 'SELECT * FROM service_users WHERE id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
