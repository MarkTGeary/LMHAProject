const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

// Search service users by name or phone (for repeat user lookup)
router.get('/search', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const term = `%${q}%`;
  const rows = db.prepare(`
    SELECT id, full_name, phone, email, age_group, gender, repeat_user, first_visit_date,
           (SELECT COUNT(*) FROM bookings WHERE service_user_id = service_users.id) as visit_count
    FROM service_users
    WHERE full_name LIKE ? OR phone LIKE ?
    ORDER BY full_name ASC
    LIMIT 10
  `).all(term, term);
  res.json(rows);
});

// GET /api/service-users/:id
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT su.*,
           (SELECT COUNT(*) FROM bookings WHERE service_user_id = su.id) as visit_count
    FROM service_users su
    WHERE su.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/service-users — create
router.post('/', requireAuth, (req, res) => {
  const {
    full_name, phone, email, age_group, gender, living_alone,
    english_speaking, translator_required, translator_language,
    address, emergency_contact_name, emergency_contact_relationship,
    emergency_contact_phone, gp_name, gp_phone, first_visit_date
  } = req.body;

  if (!full_name) return res.status(400).json({ error: 'full_name is required' });

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
    gp_name || null, gp_phone || null, first_visit_date || null
  );

  const user = db.prepare('SELECT * FROM service_users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PATCH /api/service-users/:id — update
router.patch('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM service_users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = [
    'full_name', 'phone', 'email', 'age_group', 'gender', 'living_alone',
    'english_speaking', 'translator_required', 'translator_language',
    'address', 'emergency_contact_name', 'emergency_contact_relationship',
    'emergency_contact_phone', 'gp_name', 'gp_phone', 'repeat_user', 'first_visit_date'
  ];

  const sets = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE service_users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM service_users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

module.exports = router;
