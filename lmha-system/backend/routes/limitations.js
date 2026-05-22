const express = require('express');
const router = express.Router();
const db = require('../db');
const { assertRequestLocation, parseDateString, parseId } = require('../lib/validation');
const { badRequest } = require('../lib/errors');

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
    const { limitations_detail, notes } = req.body;

    if (!Array.isArray(limitations_detail) || limitations_detail.length === 0) {
      throw badRequest('At least one limitation must be selected');
    }

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
