const express = require('express');
const router = express.Router();
const db = require('../db');
const { assertRequestLocation, enumArray, parseDateString, parseId } = require('../lib/validation');
const { badRequest } = require('../lib/errors');

const VALID_LIMITATIONS = [
  'monday', 'tuesday', 'wednesday',
  'saturday', 'sunday',
  'before_11am', 'after_5pm',
  'before_6pm', 'after_midnight',
  'no_appointment_in_week', 'closed_short_staff',
  'calls_out_of_hours', 'text_out_of_hours',
];

// GET /api/limitations?location=
router.get('/', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.query.location);
    const result = await db.execute({
      sql: `SELECT * FROM standalone_limitations
            WHERE location = ?
            ORDER BY date DESC, created_at DESC`,
      args: [location],
    });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/limitations
router.post('/', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.body.location);
    const date = parseDateString(req.body.date, 'date');
    const limitations_detail = enumArray(req.body.limitations_detail, VALID_LIMITATIONS, 'limitations_detail', { required: true });
    if (limitations_detail.length === 0) throw badRequest('At least one limitation must be selected');
    const { notes } = req.body;

    const cleanNotes = typeof notes === 'string' ? notes.trim() || null : null;

    const result = await db.execute({
      sql: `INSERT INTO standalone_limitations (location, date, limitations_detail, notes)
            VALUES (?, ?, ?, ?)`,
      args: [location, date, JSON.stringify(limitations_detail), cleanNotes],
    });
    res.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (err) { next(err); }
});

module.exports = router;
