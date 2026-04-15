const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

// Search service users by name or phone
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
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

// GET /api/service-users/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT su.*,
                   (SELECT COUNT(*) FROM bookings WHERE service_user_id = su.id) as visit_count
            FROM service_users su
            WHERE su.id = ?`,
      args: [req.params.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/service-users — create
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      full_name, phone, email, age_group, gender, living_alone,
      english_speaking, translator_required, translator_language,
      address, emergency_contact_name, emergency_contact_relationship,
      emergency_contact_phone, gp_name, gp_phone, first_visit_date
    } = req.body;

    if (!full_name) return res.status(400).json({ error: 'full_name is required' });

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
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM service_users WHERE id = ?',
      args: [req.params.id],
    });
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Not found' });

    const fields = [
      'full_name', 'phone', 'email', 'age_group', 'gender', 'living_alone',
      'english_speaking', 'translator_required', 'translator_language',
      'address', 'emergency_contact_name', 'emergency_contact_relationship',
      'emergency_contact_phone', 'gp_name', 'gp_phone', 'repeat_user', 'first_visit_date'
    ];

    const sets = [];
    const args = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        args.push(req.body[f]);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    args.push(req.params.id);
    await db.execute({ sql: `UPDATE service_users SET ${sets.join(', ')} WHERE id = ?`, args });

    const updated = await db.execute({
      sql: 'SELECT * FROM service_users WHERE id = ?',
      args: [req.params.id],
    });
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
