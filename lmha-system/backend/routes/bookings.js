const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

// Booking hours validation
const LOCATION_RULES = {
  'LMHA': {
    days: [1, 2, 3, 4, 5], // Mon-Fri
    startHour: 11,
    endHour: 17,
  },
  'Solace Café': {
    days: [4, 5, 6, 0], // Thu-Sun
    startHour: 18,
    endHour: 24,
  },
};

function validateBookingTime(location, dateStr, timeStr) {
  const rules = LOCATION_RULES[location];
  if (!rules) return { valid: false, error: 'Unknown location' };

  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  if (!rules.days.includes(dayOfWeek)) {
    return { valid: false, error: `${location} is not open on this day` };
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + minutes;
  const openMins = rules.startHour * 60;
  const latestStartMins = (rules.endHour - 1) * 60;

  if (totalMins < openMins || totalMins > latestStartMins) {
    const endDisplay = rules.endHour === 24 ? '23:00' : `${rules.endHour - 1}:00`;
    return {
      valid: false,
      error: `${location} hours: ${rules.startHour}:00–${endDisplay} (last booking start)`,
    };
  }

  return { valid: true };
}

async function checkDoubleBooking(location, dateStr, timeStr, excludeId = null) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const newMins = hours * 60 + minutes;

  const result = await db.execute({
    sql: `SELECT b.id, b.time_booked, b.service_user_id,
                 su.full_name as name
          FROM bookings b
          LEFT JOIN service_users su ON su.id = b.service_user_id
          WHERE b.location = ? AND b.date = ? AND b.status != 'Cancelled'
          ${excludeId ? 'AND b.id != ?' : ''}`,
    args: excludeId ? [location, dateStr, excludeId] : [location, dateStr],
  });

  for (const b of result.rows) {
    const [bh, bm] = b.time_booked.split(':').map(Number);
    const bMins = bh * 60 + bm;
    if (Math.abs(newMins - bMins) < 60) {
      return {
        conflict: true,
        message: `Conflicts with existing booking at ${b.time_booked}${b.name ? ' for ' + b.name : ''}`,
        conflictingId: b.id,
      };
    }
  }
  return { conflict: false };
}

// GET /api/bookings — list with filters
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, location, date, today, this_week, intake_status, start_date, end_date, service_user_id, search } = req.query;

    let sql = `
      SELECT b.*,
             su.full_name,
             su.phone,
             CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
      FROM bookings b
      LEFT JOIN service_users su ON b.service_user_id = su.id
      LEFT JOIN intake_forms i ON i.booking_id = b.id
      WHERE 1=1
    `;
    const args = [];

    if (status)   { sql += ' AND b.status = ?';   args.push(status); }
    if (location) { sql += ' AND b.location = ?'; args.push(location); }
    if (date)     { sql += ' AND b.date = ?';     args.push(date); }
    if (today) {
      const todayStr = new Date().toISOString().slice(0, 10);
      sql += ' AND b.date = ?'; args.push(todayStr);
    }
    if (this_week) {
      const now = new Date();
      const mon = new Date(now);
      mon.setDate(now.getDate() - now.getDay() + 1);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sql += ' AND b.date BETWEEN ? AND ?';
      args.push(mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10));
    }
    if (start_date && end_date) {
      sql += ' AND b.date BETWEEN ? AND ?'; args.push(start_date, end_date);
    }
    if (intake_status === 'missing') {
      sql += ' AND i.id IS NULL';
    } else if (intake_status === 'complete') {
      sql += ' AND i.id IS NOT NULL';
    }
    if (service_user_id) { sql += ' AND b.service_user_id = ?'; args.push(service_user_id); }
    if (search) {
      const like = '%' + search.trim() + '%';
      sql += ' AND (su.full_name LIKE ? OR su.phone LIKE ?)';
      args.push(like, like);
    }

    const order = service_user_id ? 'DESC' : 'ASC';
    sql += ` ORDER BY b.date ${order}, b.time_booked ${order}`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/bookings/schedule?date=&location=
router.get('/schedule', requireAuth, async (req, res, next) => {
  try {
    const { date, location } = req.query;
    if (!date || !location) return res.status(400).json({ error: 'date and location required' });

    const result = await db.execute({
      sql: `SELECT b.*,
                   su.full_name, su.phone,
                   CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
            FROM bookings b
            LEFT JOIN service_users su ON b.service_user_id = su.id
            LEFT JOIN intake_forms i ON i.booking_id = b.id
            WHERE b.date = ? AND b.location = ? AND b.status != 'Cancelled'
            ORDER BY b.time_booked ASC`,
      args: [date, location],
    });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/bookings/available-slots?date=&location=
router.get('/available-slots', requireAuth, async (req, res, next) => {
  try {
    const { date, location } = req.query;
    if (!date || !location) return res.status(400).json({ error: 'date and location required' });

    const rules = LOCATION_RULES[location];
    if (!rules) return res.status(400).json({ error: 'Unknown location' });

    const d = new Date(date);
    const dayOfWeek = d.getDay();

    if (!rules.days.includes(dayOfWeek)) {
      return res.json({ available: false, reason: `${location} is closed on this day`, slots: [] });
    }

    const result = await db.execute({
      sql: `SELECT time_booked FROM bookings WHERE location = ? AND date = ? AND status != 'Cancelled'`,
      args: [location, date],
    });

    const bookedMins = result.rows.map(b => {
      const [h, m] = b.time_booked.split(':').map(Number);
      return h * 60 + m;
    });

    const slots = [];
    for (let mins = rules.startHour * 60; mins <= (rules.endHour - 1) * 60; mins += 30) {
      const isBooked = bookedMins.some(bm => Math.abs(bm - mins) < 60);
      const h = Math.floor(mins / 60).toString().padStart(2, '0');
      const m = (mins % 60).toString().padStart(2, '0');
      slots.push({ time: `${h}:${m}`, available: !isBooked });
    }

    res.json({ available: true, slots });
  } catch (err) { next(err); }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT b.*,
                   su.full_name, su.phone, su.email, su.age_group, su.gender,
                   CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
            FROM bookings b
            LEFT JOIN service_users su ON b.service_user_id = su.id
            LEFT JOIN intake_forms i ON i.booking_id = b.id
            WHERE b.id = ?`,
      args: [req.params.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/bookings — create
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      service_user_id, location, date, time_booked, interaction_type,
      new_or_repeat, referred_from, type_of_support, carer_attended,
      peer_support_worker, limitations, notes,
      full_name, phone,
    } = req.body;

    if (!location || !date || !time_booked || !interaction_type) {
      return res.status(400).json({ error: 'location, date, time_booked, and interaction_type are required' });
    }

    if (location !== req.session.location) {
      return res.status(403).json({ error: 'Location does not match your current session' });
    }

    if (!/^\d{2}:\d{2}$/.test(time_booked)) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    const VALID_SUPPORT_TYPES = ['SS', 'PS', 'C', 'O', 'SP'];
    if (type_of_support !== undefined && type_of_support !== null) {
      if (!Array.isArray(type_of_support) || !type_of_support.every(t => VALID_SUPPORT_TYPES.includes(t))) {
        return res.status(400).json({ error: 'Invalid type_of_support values' });
      }
    }

    const timeValid = validateBookingTime(location, date, time_booked);
    if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });

    const conflict = await checkDoubleBooking(location, date, time_booked);
    if (conflict.conflict) return res.status(409).json({ error: conflict.message });

    let userId = service_user_id;

    if (!userId && full_name) {
      const suResult = await db.execute({
        sql: `INSERT INTO service_users (full_name, phone, repeat_user, first_visit_date) VALUES (?, ?, 0, ?)`,
        args: [full_name, phone || null, date],
      });
      userId = Number(suResult.lastInsertRowid);
    }

    const bResult = await db.execute({
      sql: `INSERT INTO bookings (
              service_user_id, location, date, time_booked, interaction_type,
              new_or_repeat, referred_from, type_of_support, carer_attended,
              peer_support_worker, limitations, notes, outcome, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Active', ?)`,
      args: [
        userId || null, location, date, time_booked, interaction_type,
        new_or_repeat || null, referred_from || null,
        type_of_support ? JSON.stringify(type_of_support) : null,
        carer_attended ? 1 : 0,
        peer_support_worker || null, limitations || null, notes || null,
        req.user.email,
      ],
    });

    const booking = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [Number(bResult.lastInsertRowid)],
    });
    res.status(201).json(booking.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/bookings/:id — update
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [req.params.id],
    });
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Not found' });
    const existing = existingResult.rows[0];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 21);
    cutoff.setHours(0, 0, 0, 0);
    if (new Date(existing.date) < cutoff) {
      return res.status(403).json({ error: 'This record is locked — bookings older than 3 weeks cannot be edited' });
    }

    const {
      date, time_booked, location, interaction_type, new_or_repeat, referred_from,
      type_of_support, carer_attended, peer_support_worker, limitations, notes,
      time_in, time_out, outcome, status, ed_diversion, service_user_id
    } = req.body;

    const newDate     = date     || existing.date;
    const newTime     = time_booked || existing.time_booked;
    const newLocation = location || existing.location;

    if (date || time_booked || location) {
      const timeValid = validateBookingTime(newLocation, newDate, newTime);
      if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });

      const conflict = await checkDoubleBooking(newLocation, newDate, newTime, parseInt(req.params.id));
      if (conflict.conflict) return res.status(409).json({ error: conflict.message });
    }

    if (status === 'Closed') {
      const intakeResult = await db.execute({
        sql: 'SELECT id FROM intake_forms WHERE booking_id = ?',
        args: [req.params.id],
      });
      if (!intakeResult.rows.length) return res.status(400).json({ error: 'Cannot close: intake form not completed' });

      const targetOutcome = outcome || existing.outcome;
      if (!targetOutcome || targetOutcome === 'Pending') {
        return res.status(400).json({ error: 'Cannot close: outcome must be set (Attended or Did Not Attend)' });
      }
      const targetSupport = type_of_support || existing.type_of_support;
      if (!targetSupport) {
        return res.status(400).json({ error: 'Cannot close: type of support must be selected' });
      }
    }

    await db.execute({
      sql: `UPDATE bookings SET
              date              = COALESCE(?, date),
              time_booked       = COALESCE(?, time_booked),
              location          = COALESCE(?, location),
              interaction_type  = COALESCE(?, interaction_type),
              new_or_repeat     = COALESCE(?, new_or_repeat),
              referred_from     = COALESCE(?, referred_from),
              type_of_support   = COALESCE(?, type_of_support),
              carer_attended    = COALESCE(?, carer_attended),
              peer_support_worker = COALESCE(?, peer_support_worker),
              limitations       = COALESCE(?, limitations),
              notes             = COALESCE(?, notes),
              time_in           = COALESCE(?, time_in),
              time_out          = COALESCE(?, time_out),
              outcome           = COALESCE(?, outcome),
              status            = COALESCE(?, status),
              ed_diversion      = COALESCE(?, ed_diversion),
              service_user_id   = COALESCE(?, service_user_id),
              updated_at        = datetime('now')
            WHERE id = ?`,
      args: [
        date || null, time_booked || null, location || null, interaction_type || null,
        new_or_repeat || null, referred_from || null,
        type_of_support !== undefined ? JSON.stringify(type_of_support) : null,
        carer_attended !== undefined ? (carer_attended ? 1 : 0) : null,
        peer_support_worker || null, limitations || null, notes || null,
        time_in || null, time_out || null, outcome || null, status || null,
        ed_diversion !== undefined ? ed_diversion : null,
        service_user_id || null,
        req.params.id,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [req.params.id],
    });
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
