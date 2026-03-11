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
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...

  if (!rules.days.includes(dayOfWeek)) {
    return { valid: false, error: `${location} is not open on this day` };
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + minutes;
  const openMins = rules.startHour * 60;
  // Last appointment must end before close — so latest start is endHour-1hr
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

function checkDoubleBooking(location, dateStr, timeStr, excludeId = null) {
  // Find bookings within ±60 mins at same location/date
  const [hours, minutes] = timeStr.split(':').map(Number);
  const newMins = hours * 60 + minutes;

  const existing = db.prepare(
    `SELECT id, time_booked, service_user_id,
            (SELECT full_name FROM service_users WHERE id = bookings.service_user_id) as name
     FROM bookings
     WHERE location = ? AND date = ? AND status != 'Cancelled'
     ${excludeId ? 'AND id != ?' : ''}`
  ).all(excludeId ? [location, dateStr, excludeId] : [location, dateStr]);

  for (const b of existing) {
    const [bh, bm] = b.time_booked.split(':').map(Number);
    const bMins = bh * 60 + bm;
    // Two 1-hour appointments conflict if they start within 60 mins of each other
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
router.get('/', requireAuth, (req, res) => {
  const { status, location, date, today, this_week, intake_status, start_date, end_date } = req.query;

  let query = `
    SELECT b.*,
           su.full_name,
           su.phone,
           CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
    FROM bookings b
    LEFT JOIN service_users su ON b.service_user_id = su.id
    LEFT JOIN intake_forms i ON i.booking_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += ' AND b.status = ?'; params.push(status); }
  if (location) { query += ' AND b.location = ?'; params.push(location); }
  if (date) { query += ' AND b.date = ?'; params.push(date); }
  if (today) {
    const todayStr = new Date().toISOString().slice(0, 10);
    query += ' AND b.date = ?'; params.push(todayStr);
  }
  if (this_week) {
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    query += ' AND b.date BETWEEN ? AND ?';
    params.push(mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10));
  }
  if (start_date && end_date) {
    query += ' AND b.date BETWEEN ? AND ?'; params.push(start_date, end_date);
  }
  if (intake_status === 'missing') {
    query += ' AND i.id IS NULL';
  } else if (intake_status === 'complete') {
    query += ' AND i.id IS NOT NULL';
  }

  query += ' ORDER BY b.date ASC, b.time_booked ASC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// GET /api/bookings/schedule?date=&location= — daily schedule
router.get('/schedule', requireAuth, (req, res) => {
  const { date, location } = req.query;
  if (!date || !location) return res.status(400).json({ error: 'date and location required' });

  const rows = db.prepare(`
    SELECT b.*,
           su.full_name, su.phone,
           CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
    FROM bookings b
    LEFT JOIN service_users su ON b.service_user_id = su.id
    LEFT JOIN intake_forms i ON i.booking_id = b.id
    WHERE b.date = ? AND b.location = ? AND b.status != 'Cancelled'
    ORDER BY b.time_booked ASC
  `).all(date, location);
  res.json(rows);
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT b.*,
           su.full_name, su.phone, su.email, su.age_group, su.gender,
           CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
    FROM bookings b
    LEFT JOIN service_users su ON b.service_user_id = su.id
    LEFT JOIN intake_forms i ON i.booking_id = b.id
    WHERE b.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/bookings — create
router.post('/', requireAuth, (req, res) => {
  const {
    service_user_id, location, date, time_booked, interaction_type,
    new_or_repeat, referred_from, type_of_support, carer_attended,
    peer_support_worker, limitations, notes,
    // service user creation fields (if new user on walk-in)
    full_name, phone,
  } = req.body;

  if (!location || !date || !time_booked || !interaction_type) {
    return res.status(400).json({ error: 'location, date, time_booked, and interaction_type are required' });
  }

  // Validate location hours
  const timeValid = validateBookingTime(location, date, time_booked);
  if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });

  // Check double booking
  const conflict = checkDoubleBooking(location, date, time_booked);
  if (conflict.conflict) return res.status(409).json({ error: conflict.message });

  let userId = service_user_id;

  // If no service_user_id but name provided, create minimal user
  if (!userId && full_name) {
    const result = db.prepare(
      `INSERT INTO service_users (full_name, phone, repeat_user, first_visit_date)
       VALUES (?, ?, 0, ?)`
    ).run(full_name, phone || null, date);
    userId = result.lastInsertRowid;
  }

  const result = db.prepare(`
    INSERT INTO bookings (
      service_user_id, location, date, time_booked, interaction_type,
      new_or_repeat, referred_from, type_of_support, carer_attended,
      peer_support_worker, limitations, notes, outcome, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Active', ?)
  `).run(
    userId || null, location, date, time_booked, interaction_type,
    new_or_repeat || null, referred_from || null,
    type_of_support ? JSON.stringify(type_of_support) : null,
    carer_attended ? 1 : 0,
    peer_support_worker || null, limitations || null, notes || null,
    req.user.email
  );

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(booking);
});

// PATCH /api/bookings/:id — update
router.patch('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    date, time_booked, location, interaction_type, new_or_repeat, referred_from,
    type_of_support, carer_attended, peer_support_worker, limitations, notes,
    time_in, time_out, outcome, status, ed_diversion, service_user_id
  } = req.body;

  const newDate = date || existing.date;
  const newTime = time_booked || existing.time_booked;
  const newLocation = location || existing.location;

  // Re-validate if time/date/location changed
  if (date || time_booked || location) {
    const timeValid = validateBookingTime(newLocation, newDate, newTime);
    if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });

    const conflict = checkDoubleBooking(newLocation, newDate, newTime, parseInt(req.params.id));
    if (conflict.conflict) return res.status(409).json({ error: conflict.message });
  }

  // Validate close requirements
  if (status === 'Closed') {
    const intake = db.prepare('SELECT id FROM intake_forms WHERE booking_id = ?').get(req.params.id);
    if (!intake) return res.status(400).json({ error: 'Cannot close: intake form not completed' });

    const targetOutcome = outcome || existing.outcome;
    if (!targetOutcome || targetOutcome === 'Pending') {
      return res.status(400).json({ error: 'Cannot close: outcome must be set (Attended or Did Not Attend)' });
    }
    const targetSupport = type_of_support || existing.type_of_support;
    if (!targetSupport) {
      return res.status(400).json({ error: 'Cannot close: type of support must be selected' });
    }
  }

  db.prepare(`
    UPDATE bookings SET
      date = COALESCE(?, date),
      time_booked = COALESCE(?, time_booked),
      location = COALESCE(?, location),
      interaction_type = COALESCE(?, interaction_type),
      new_or_repeat = COALESCE(?, new_or_repeat),
      referred_from = COALESCE(?, referred_from),
      type_of_support = COALESCE(?, type_of_support),
      carer_attended = COALESCE(?, carer_attended),
      peer_support_worker = COALESCE(?, peer_support_worker),
      limitations = COALESCE(?, limitations),
      notes = COALESCE(?, notes),
      time_in = COALESCE(?, time_in),
      time_out = COALESCE(?, time_out),
      outcome = COALESCE(?, outcome),
      status = COALESCE(?, status),
      ed_diversion = COALESCE(?, ed_diversion),
      service_user_id = COALESCE(?, service_user_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    date || null, time_booked || null, location || null, interaction_type || null,
    new_or_repeat || null, referred_from || null,
    type_of_support !== undefined ? JSON.stringify(type_of_support) : null,
    carer_attended !== undefined ? (carer_attended ? 1 : 0) : null,
    peer_support_worker || null, limitations || null, notes || null,
    time_in || null, time_out || null, outcome || null, status || null,
    ed_diversion !== undefined ? ed_diversion : null,
    service_user_id || null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /api/bookings/slots?date=&location= — available time slots
router.get('/available-slots', requireAuth, (req, res) => {
  const { date, location } = req.query;
  if (!date || !location) return res.status(400).json({ error: 'date and location required' });

  const rules = LOCATION_RULES[location];
  if (!rules) return res.status(400).json({ error: 'Unknown location' });

  const d = new Date(date);
  const dayOfWeek = d.getDay();

  if (!rules.days.includes(dayOfWeek)) {
    return res.json({ available: false, reason: `${location} is closed on this day`, slots: [] });
  }

  const existing = db.prepare(
    `SELECT time_booked FROM bookings WHERE location = ? AND date = ? AND status != 'Cancelled'`
  ).all(location, date);

  const bookedMins = existing.map(b => {
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
});

module.exports = router;
