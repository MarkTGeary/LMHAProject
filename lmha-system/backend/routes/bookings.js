const express = require('express');
const router = express.Router();
const db = require('../db');
const { LOCATION_RULES, LOCK_DAYS } = require('../lib/constants');
const { badRequest, conflict, forbidden, notFound } = require('../lib/errors');
const { slotsForBooking, timeToMinutes, toLockConflict } = require('../lib/bookingLocks');
const {
  assertRequestLocation,
  booleanInt,
  enumArray,
  enumValue,
  hasOwn,
  normaliseString,
  parseDateString,
  parseId,
  parseTimeString,
} = require('../lib/validation');

const INTERACTION_TYPES = [
  'Phone Call',
  'Walk-In',
  'Crisis',
  'Peer Support Booking',
  'Email',
  'Text',
];
const NEW_REPEAT = ['New', 'Repeat'];
const SUPPORT_TYPES = ['SS', 'PS', 'C', 'O', 'SP'];
const OUTCOMES = ['Attended', 'Did Not Attend', 'Pending'];
const STATUSES = ['Active', 'Closed', 'Cancelled'];

function localTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function validateBookingTime(location, dateStr, timeStr, allowPast = false) {
  parseDateString(dateStr, 'booking date');
  parseTimeString(timeStr, 'booking time');

  const rules = LOCATION_RULES[location];
  if (!rules) return { valid: false, error: 'Unknown location' };

  return { valid: true };
}

async function checkDoubleBooking(location, dateStr, timeStr, assignedTo, excludeId = null) {
  if (!assignedTo) return { conflict: false };
  const newMins = timeToMinutes(timeStr);
  const result = await db.execute({
    sql: `SELECT b.id, b.time_booked, b.service_user_id,
                 su.full_name as name
          FROM bookings b
          LEFT JOIN service_users su ON su.id = b.service_user_id
          WHERE b.location = ? AND b.date = ? AND b.status != 'Cancelled'
          AND b.assigned_to = ?
          ${excludeId ? 'AND b.id != ?' : ''}`,
    args: excludeId ? [location, dateStr, assignedTo, excludeId] : [location, dateStr, assignedTo],
  });

  for (const b of result.rows) {
    const bMins = timeToMinutes(b.time_booked);
    if (Math.abs(newMins - bMins) < 60) {
      return {
        conflict: true,
        message: `Conflicts with ${assignedTo}'s existing booking at ${b.time_booked}${b.name ? ' for ' + b.name : ''}`,
      };
    }
  }
  return { conflict: false };
}

function lockInsertStatements(location, date, time, assignedTo, bookingIdSql = 'last_insert_rowid()', bookingIdArgs = []) {
  if (!assignedTo) return [];
  return slotsForBooking(time).map(slot => ({
    sql: `INSERT INTO booking_slot_locks (location, date, slot_time, assigned_to, booking_id)
          VALUES (?, ?, ?, ?, ${bookingIdSql})`,
    args: [location, date, slot, assignedTo, ...bookingIdArgs],
  }));
}

function normalizeSupport(value, { required = false } = {}) {
  const values = enumArray(value, SUPPORT_TYPES, 'type_of_support', { required });
  return values.length ? JSON.stringify(values) : null;
}

function assertBookingIsInCurrentLocation(req, booking) {
  if (booking.location !== req.location) throw forbidden('Location does not match your current session');
}

function assertUnlocked(booking) {
  const cutoff = localTodayStart();
  cutoff.setDate(cutoff.getDate() - LOCK_DAYS);
  if (new Date(booking.date + 'T12:00:00') < cutoff) {
    throw forbidden('This record is locked - bookings older than 3 weeks cannot be edited');
  }
}

// GET /api/bookings - list with filters, always scoped to current location
router.get('/', async (req, res, next) => {
  try {
    const { status, location, date, today, this_week, intake_status, start_date, end_date, service_user_id, search } = req.query;
    const currentLocation = assertRequestLocation(req, location);

    let sql = `
      SELECT b.*,
             su.full_name,
             su.phone,
             CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete,
             (SELECT COUNT(*) FROM bookings b2 WHERE b2.service_user_id = b.service_user_id AND b2.status != 'Cancelled') as visit_count
      FROM bookings b
      LEFT JOIN service_users su ON b.service_user_id = su.id
      LEFT JOIN intake_forms i ON i.booking_id = b.id
      WHERE b.location = ?
    `;
    const args = [currentLocation];

    if (status) {
      sql += ' AND b.status = ?';
      args.push(enumValue(status, STATUSES, 'status'));
    }
    if (date) {
      sql += ' AND b.date = ?';
      args.push(parseDateString(date));
    }
    if (today) {
      sql += ' AND b.date = ?';
      args.push(fmtDate(new Date()));
    }
    if (this_week) {
      const mon = getMondayOf(new Date());
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sql += ' AND b.date BETWEEN ? AND ?';
      args.push(fmtDate(mon), fmtDate(sun));
    }
    if (start_date || end_date) {
      sql += ' AND b.date BETWEEN ? AND ?';
      args.push(parseDateString(start_date, 'start_date'), parseDateString(end_date, 'end_date'));
    }
    if (intake_status === 'missing') {
      sql += ' AND i.id IS NULL';
    } else if (intake_status === 'complete') {
      sql += ' AND i.id IS NOT NULL';
    } else if (intake_status && intake_status !== 'all') {
      throw badRequest('Invalid intake_status');
    }
    if (service_user_id) {
      sql += ' AND b.service_user_id = ?';
      args.push(parseId(service_user_id, 'service_user_id'));
    }
    if (search) {
      const term = normaliseString(search, 'search', { max: 100 });
      const like = '%' + term + '%';
      sql += ' AND (su.full_name LIKE ? OR su.phone LIKE ?)';
      args.push(like, like);
    }

    const order = service_user_id ? 'DESC' : 'ASC';
    sql += ` ORDER BY b.date ${order}, b.time_booked ${order}`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/bookings/available-slots?date=&location=
router.get('/available-slots', async (req, res, next) => {
  try {
    const currentLocation = assertRequestLocation(req, req.query.location);
    const date = parseDateString(req.query.date, 'date');
    const rules = LOCATION_RULES[currentLocation];
    const d = new Date(date + 'T12:00:00');

    if (!rules.days.includes(d.getDay())) {
      return res.json({ available: false, reason: `${currentLocation} is closed on this day`, slots: [] });
    }

    const requestedAssignee = req.query.assigned_to || null;
    let locked;
    if (requestedAssignee) {
      const result = await db.execute({
        sql: `SELECT slot_time FROM booking_slot_locks WHERE location = ? AND date = ? AND assigned_to = ?`,
        args: [currentLocation, date, requestedAssignee],
      });
      locked = new Set(result.rows.map(r => r.slot_time));
    } else {
      locked = new Set();
    }

    let slots = [];
    if (rules.standardSlots) {
      for (const time of rules.standardSlots) {
        const neededLocks = slotsForBooking(time);
        slots.push({ time, available: neededLocks.every(slot => !locked.has(slot)) });
      }
    } else {
      for (let mins = rules.startHour * 60; mins <= (rules.endHour - 1) * 60; mins += 30) {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        const time = `${h}:${m}`;
        const neededLocks = slotsForBooking(time);
        slots.push({ time, available: neededLocks.every(slot => !locked.has(slot)) });
      }
    }

    let sessionInfo = null;
    if (rules.maxSessionsPerNight && !req.user.isAdmin) {
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM bookings WHERE created_by = ? AND date = ? AND location = ? AND status != 'Cancelled'`,
        args: [req.user.email, date, currentLocation],
      });
      sessionInfo = { used: Number(countResult.rows[0].count), max: rules.maxSessionsPerNight };
    }

    res.json({ available: true, slots, sessionInfo });
  } catch (err) { next(err); }
});

// GET /api/bookings/staff - list allowed staff emails for assignment autocomplete
router.get('/staff', async (req, res, next) => {
  try {
    const result = await db.execute('SELECT email, role FROM allowed_emails ORDER BY email');
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/bookings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const result = await db.execute({
      sql: `SELECT b.*,
                   su.full_name, su.phone, su.email, su.age_group, su.gender,
                   CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END as intake_complete
            FROM bookings b
            LEFT JOIN service_users su ON b.service_user_id = su.id
            LEFT JOIN intake_forms i ON i.booking_id = b.id
            WHERE b.id = ?`,
      args: [id],
    });
    if (!result.rows.length) throw notFound();
    assertBookingIsInCurrentLocation(req, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/bookings - create
router.post('/', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.body.location);
    const date = parseDateString(req.body.date, 'date');
    const interaction_type = enumValue(req.body.interaction_type, INTERACTION_TYPES, 'interaction_type');
    const flexibleTimingTypes = ['Walk-In', 'Crisis'];
    const time_booked = parseTimeString(req.body.time_booked, 'time_booked',
      { stepMinutes: flexibleTimingTypes.includes(interaction_type) ? 1 : 30 });
    const serviceUserId = parseId(req.body.service_user_id, 'service_user_id', { required: false });
    const fullName = normaliseString(req.body.full_name, 'full_name', { required: !serviceUserId, max: 200 });
    const phone = normaliseString(req.body.phone, 'phone', { max: 100 });
    const new_or_repeat = enumValue(req.body.new_or_repeat, NEW_REPEAT, 'new_or_repeat', { required: false });
    const referred_from = normaliseString(req.body.referred_from, 'referred_from', { max: 200 });
    const type_of_support = hasOwn(req.body, 'type_of_support') ? normalizeSupport(req.body.type_of_support) : null;
    const carer_attended = booleanInt(req.body.carer_attended ?? false, 'carer_attended');
    const peer_support_worker = normaliseString(req.body.peer_support_worker, 'peer_support_worker', { max: 200 });
    const limitations = normaliseString(req.body.limitations, 'limitations', { max: 5000 });
    const limitations_detail = hasOwn(req.body, 'limitations_detail')
      ? JSON.stringify(Array.isArray(req.body.limitations_detail) ? req.body.limitations_detail.filter(k => typeof k === 'string') : [])
      : null;
    const notes = normaliseString(req.body.notes, 'notes', { max: 5000 });
    const assigned_to = req.body.assigned_to ? normaliseString(req.body.assigned_to, 'assigned_to', { max: 200 }) : null;

    const timeValid = validateBookingTime(location, date, time_booked);
    if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });

    const skipDoubleBookingTypes = ['Crisis', 'Walk-In'];
    if (!skipDoubleBookingTypes.includes(interaction_type)) {
      const existingConflict = await checkDoubleBooking(location, date, time_booked, assigned_to);
      if (existingConflict.conflict) throw conflict(existingConflict.message);
    }

    const locationRules = LOCATION_RULES[location];
    if (locationRules.maxSessionsPerNight && !req.user.isAdmin) {
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM bookings WHERE created_by = ? AND date = ? AND location = ? AND status != 'Cancelled'`,
        args: [req.user.email, date, location],
      });
      if (Number(countResult.rows[0].count) >= locationRules.maxSessionsPerNight) {
        return res.status(400).json({ error: `Maximum ${locationRules.maxSessionsPerNight} sessions per night reached` });
      }
    }

    const statements = [];
    if (!serviceUserId) {
      statements.push({
        sql: `INSERT INTO service_users (full_name, phone, repeat_user, first_visit_date)
              VALUES (?, ?, 0, ?)`,
        args: [fullName, phone, date],
      });
    }

    const bookingArgs = [
      location, date, time_booked, interaction_type,
      new_or_repeat, referred_from, type_of_support, carer_attended,
      peer_support_worker, limitations, limitations_detail, notes, req.user.email, assigned_to,
    ];
    const serviceUserSql = serviceUserId ? '?' : 'last_insert_rowid()';
    if (serviceUserId) bookingArgs.unshift(serviceUserId);

    const bookingIndex = statements.length;
    statements.push({
      sql: `INSERT INTO bookings (
              service_user_id, location, date, time_booked, interaction_type,
              new_or_repeat, referred_from, type_of_support, carer_attended,
              peer_support_worker, limitations, limitations_detail, notes, outcome, status, created_by, assigned_to
            ) VALUES (${serviceUserSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Active', ?, ?)`,
      args: bookingArgs,
    });
    statements.push(...lockInsertStatements(location, date, time_booked, assigned_to));

    const batchResult = await db.batch(statements, 'write').catch(err => { throw toLockConflict(err); });
    const bookingId = Number(batchResult[bookingIndex].lastInsertRowid);
    const booking = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [bookingId],
    });
    res.status(201).json(booking.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/bookings/:id - update
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existingResult = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [id],
    });
    if (!existingResult.rows.length) throw notFound();
    const existing = existingResult.rows[0];
    assertBookingIsInCurrentLocation(req, existing);
    assertUnlocked(existing);

    const nextLocation = hasOwn(req.body, 'location')
      ? assertRequestLocation(req, req.body.location)
      : existing.location;
    if (nextLocation !== existing.location) {
      throw forbidden('Bookings cannot be moved to another location from the current session');
    }

    const values = {};
    if (hasOwn(req.body, 'date')) values.date = parseDateString(req.body.date, 'date');
    if (hasOwn(req.body, 'interaction_type')) values.interaction_type = enumValue(req.body.interaction_type, INTERACTION_TYPES, 'interaction_type');
    if (hasOwn(req.body, 'time_booked')) {
      const resolvedType = values.interaction_type ?? existing.interaction_type;
      const flexibleTimingTypes = ['Walk-In', 'Crisis'];
      values.time_booked = parseTimeString(req.body.time_booked, 'time_booked',
        { stepMinutes: flexibleTimingTypes.includes(resolvedType) ? 1 : 30 });
    }
    if (hasOwn(req.body, 'new_or_repeat')) values.new_or_repeat = enumValue(req.body.new_or_repeat, NEW_REPEAT, 'new_or_repeat', { required: false });
    if (hasOwn(req.body, 'referred_from')) values.referred_from = normaliseString(req.body.referred_from, 'referred_from', { max: 200 });
    if (hasOwn(req.body, 'type_of_support')) values.type_of_support = normalizeSupport(req.body.type_of_support);
    if (hasOwn(req.body, 'carer_attended')) values.carer_attended = booleanInt(req.body.carer_attended, 'carer_attended');
    if (hasOwn(req.body, 'peer_support_worker')) values.peer_support_worker = normaliseString(req.body.peer_support_worker, 'peer_support_worker', { max: 200 });
    if (hasOwn(req.body, 'limitations')) values.limitations = normaliseString(req.body.limitations, 'limitations', { max: 5000 });
    if (hasOwn(req.body, 'limitations_detail')) {
      values.limitations_detail = JSON.stringify(
        Array.isArray(req.body.limitations_detail) ? req.body.limitations_detail.filter(k => typeof k === 'string') : []
      );
    }
    if (hasOwn(req.body, 'notes')) values.notes = normaliseString(req.body.notes, 'notes', { max: 5000 });
    if (hasOwn(req.body, 'time_in')) values.time_in = req.body.time_in ? parseTimeString(req.body.time_in, 'time_in', { stepMinutes: 1 }) : null;
    if (hasOwn(req.body, 'time_out')) values.time_out = req.body.time_out ? parseTimeString(req.body.time_out, 'time_out', { stepMinutes: 1 }) : null;
    if (hasOwn(req.body, 'outcome')) values.outcome = enumValue(req.body.outcome, OUTCOMES, 'outcome', { required: false });
    if (hasOwn(req.body, 'status')) values.status = enumValue(req.body.status, STATUSES, 'status');
    if (hasOwn(req.body, 'ed_diversion')) values.ed_diversion = booleanInt(req.body.ed_diversion, 'ed_diversion', { nullable: true });
    if (hasOwn(req.body, 'service_user_id')) values.service_user_id = parseId(req.body.service_user_id, 'service_user_id', { required: false });
    if (hasOwn(req.body, 'assigned_to')) values.assigned_to = req.body.assigned_to ? normaliseString(req.body.assigned_to, 'assigned_to', { max: 200 }) : null;

    const newDate = values.date ?? existing.date;
    const newTime = values.time_booked ?? existing.time_booked;
    const newStatus = values.status ?? existing.status;
    const newAssignedTo = hasOwn(values, 'assigned_to') ? values.assigned_to : existing.assigned_to;
    const currentInteractionType = hasOwn(values, 'interaction_type') ? values.interaction_type : existing.interaction_type;
    const skipDoubleBookingTypes = ['Crisis', 'Walk-In'];
    if (hasOwn(values, 'date') || hasOwn(values, 'time_booked') || hasOwn(values, 'assigned_to')) {
      const timeValid = validateBookingTime(existing.location, newDate, newTime, true);
      if (!timeValid.valid) return res.status(400).json({ error: timeValid.error });
      if (!skipDoubleBookingTypes.includes(currentInteractionType)) {
        const existingConflict = await checkDoubleBooking(existing.location, newDate, newTime, newAssignedTo, id);
        if (existingConflict.conflict) throw conflict(existingConflict.message);
      }
    }

    if (newStatus === 'Closed') {
      const targetOutcome = values.outcome ?? existing.outcome;
      if (!targetOutcome || targetOutcome === 'Pending') {
        throw conflict('Cannot close: outcome must be set (Attended or Did Not Attend)');
      }
    }

    // Update service user name/phone when edited on a booking
    if (existing.service_user_id) {
      if (hasOwn(req.body, 'full_name')) {
        const newName = normaliseString(req.body.full_name, 'full_name', { required: true, max: 200 });
        await db.execute({ sql: 'UPDATE service_users SET full_name = ? WHERE id = ?', args: [newName, existing.service_user_id] });
      }
      if (hasOwn(req.body, 'phone')) {
        const newPhone = normaliseString(req.body.phone, 'phone', { max: 100 });
        await db.execute({ sql: 'UPDATE service_users SET phone = ? WHERE id = ?', args: [newPhone || null, existing.service_user_id] });
      }
    }

    const fieldNames = Object.keys(values);
    if (!fieldNames.length) {
      const updated = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [id] });
      return res.json(updated.rows[0]);
    }

    const sets = fieldNames.map(field => `${field} = ?`);
    const args = fieldNames.map(field => values[field]);
    sets.push("updated_at = datetime('now')");
    args.push(id);

    const statements = [
      { sql: 'DELETE FROM booking_slot_locks WHERE booking_id = ?', args: [id] },
      { sql: `UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`, args },
    ];
    if (newStatus !== 'Cancelled') {
      statements.push(...lockInsertStatements(existing.location, newDate, newTime, newAssignedTo, '?', [id]));
    }

    await db.batch(statements, 'write').catch(err => { throw toLockConflict(err); });

    const updated = await db.execute({
      sql: 'SELECT * FROM bookings WHERE id = ?',
      args: [id],
    });
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
