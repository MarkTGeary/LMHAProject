require('dotenv').config();
const { createClient } = require('@libsql/client');
const { getAdminEmails, getAllowedEmailSeeds, getRootAdminEmail } = require('./lib/config');
const { slotsForBooking } = require('./lib/bookingLocks');

const _client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Thin wrapper so we can safely attach .ready without mutating the libsql client
const db = {
  execute:         (...args) => _client.execute(...args),
  executeMultiple: (...args) => _client.executeMultiple(...args),
  batch:           (...args) => _client.batch(...args),
};

async function initAndMigrate() {
  await _client.execute('PRAGMA foreign_keys = ON');

  // ── Core tables ──────────────────────────────────────────────────
  await _client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS service_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      age_group TEXT CHECK(age_group IN ('18-24','25-34','35-44','45-54','55-64','65+')),
      gender TEXT CHECK(gender IN ('Male','Female','Prefer not to say')),
      living_alone TEXT CHECK(living_alone IN ('Yes','No')),
      english_speaking TEXT CHECK(english_speaking IN ('Yes','No')),
      translator_required TEXT CHECK(translator_required IN ('Yes','No')),
      translator_language TEXT,
      address TEXT,
      emergency_contact_name TEXT,
      emergency_contact_relationship TEXT,
      emergency_contact_phone TEXT,
      gp_name TEXT,
      gp_phone TEXT,
      repeat_user INTEGER DEFAULT 0,
      first_visit_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_user_id INTEGER REFERENCES service_users(id),
      location TEXT NOT NULL CHECK(location IN ('LMHA','Solace Café')),
      date TEXT NOT NULL,
      time_booked TEXT NOT NULL,
      time_in TEXT,
      time_out TEXT,
      interaction_type TEXT NOT NULL CHECK(interaction_type IN (
        'Phone Call','Walk-In','Crisis','Peer Support Booking','Email','Text'
      )),
      new_or_repeat TEXT CHECK(new_or_repeat IN ('New','Repeat')),
      referred_from TEXT,
      type_of_support TEXT,
      carer_attended INTEGER DEFAULT 0,
      peer_support_worker TEXT,
      limitations TEXT,
      ed_diversion INTEGER,
      outcome TEXT CHECK(outcome IN ('Attended','Did Not Attend','Pending')) DEFAULT 'Pending',
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Closed','Cancelled')),
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intake_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER UNIQUE REFERENCES bookings(id),
      service_user_id INTEGER REFERENCES service_users(id),
      referral_source TEXT CHECK(referral_source IN (
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
        'Other'
      )),
      referred_by_name TEXT,
      referred_by_role TEXT,
      referred_by_phone TEXT,
      referred_by_email TEXT,
      reasons_for_attending TEXT,
      privacy_acknowledged INTEGER DEFAULT 0,
      safety_agreement_acknowledged INTEGER DEFAULT 0,
      confidentiality_limits_explained INTEGER DEFAULT 0,
      staff_member TEXT,
      staff_signature TEXT,
      signed_date TEXT,
      completed_at TEXT DEFAULT (datetime('now')),
      support_needs TEXT,
      onward_referrals TEXT,
      limitations_detail TEXT
    );

    CREATE TABLE IF NOT EXISTS booking_slot_locks (
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      slot_time TEXT NOT NULL,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      PRIMARY KEY (location, date, slot_time)
    ) WITHOUT ROWID;

    CREATE INDEX IF NOT EXISTS idx_bookings_location_status_date
      ON bookings(location, status, date, time_booked);
    CREATE INDEX IF NOT EXISTS idx_bookings_location_date
      ON bookings(location, date, time_booked);
    CREATE INDEX IF NOT EXISTS idx_bookings_service_user_date
      ON bookings(service_user_id, date DESC, time_booked DESC);
    CREATE INDEX IF NOT EXISTS idx_intake_forms_booking
      ON intake_forms(booking_id);
    CREATE INDEX IF NOT EXISTS idx_service_users_name
      ON service_users(full_name);
  `);

  console.log('[DB] Core tables ready.');

  // ── Migration: feedback_logs ──────────────────────────────────────
  const tablesResult = await _client.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tables = tablesResult.rows.map(r => r.name);

  if (!tables.includes('feedback_logs')) {
    console.log('[DB] Running migration: creating feedback_logs...');
    await _client.executeMultiple(`
      CREATE TABLE feedback_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL,
        week_start TEXT NOT NULL,
        thankyou_letters INTEGER DEFAULT 0,
        verbal_feedback INTEGER DEFAULT 0,
        testimonials INTEGER DEFAULT 0,
        vox_pop INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(location, week_start)
      )
    `);
    console.log('[DB] Migration complete: feedback_logs created.');
  }

  await _client.execute(`
    CREATE INDEX IF NOT EXISTS idx_feedback_logs_location_week
      ON feedback_logs(location, week_start)
  `);

  // ── Migration: allowed_emails ─────────────────────────────────────
  if (!tables.includes('allowed_emails')) {
    console.log('[DB] Running migration: creating allowed_emails...');
    await _client.executeMultiple(`
      CREATE TABLE allowed_emails (
        email TEXT PRIMARY KEY,
        role TEXT DEFAULT 'worker' CHECK(role IN ('admin','worker')),
        added_by TEXT,
        added_at TEXT DEFAULT (datetime('now'))
      )
    `);
    const adminEmails = getAdminEmails();
    const seedEmails = [...new Set([...getAllowedEmailSeeds(), ...adminEmails, getRootAdminEmail()].filter(Boolean))];
    for (const e of seedEmails) {
      await _client.execute({
        sql: 'INSERT OR IGNORE INTO allowed_emails (email, role, added_by) VALUES (?, ?, ?)',
        args: [e, adminEmails.includes(e) ? 'admin' : 'worker', 'system'],
      });
    }
    console.log(`[DB] Migration complete: allowed_emails seeded with ${seedEmails.length} email(s).`);
  }

  await migrateAllowedEmailRoles();

  // ── Migration: bookings columns ───────────────────────────────────
  const bookingColsResult = await _client.execute('PRAGMA table_info(bookings)');
  const bookingCols = bookingColsResult.rows.map(r => r.name);
  if (!bookingCols.includes('assigned_to')) {
    console.log('[DB] Running migration: adding bookings.assigned_to...');
    await _client.execute('ALTER TABLE bookings ADD COLUMN assigned_to TEXT');
    console.log('[DB] Migration complete: bookings.assigned_to added.');
  }
  if (!bookingCols.includes('limitations_detail')) {
    console.log('[DB] Running migration: adding bookings.limitations_detail...');
    await _client.execute('ALTER TABLE bookings ADD COLUMN limitations_detail TEXT');
    console.log('[DB] Migration complete: bookings.limitations_detail added.');
  }

  // ── Migration: booking_slot_locks → per-worker PK ────────────────
  const slotLockColsResult = await _client.execute('PRAGMA table_info(booking_slot_locks)');
  const slotLockCols = slotLockColsResult.rows.map(r => r.name);
  if (!slotLockCols.includes('assigned_to')) {
    console.log('[DB] Running migration: recreating booking_slot_locks with per-worker PK...');
    await _client.executeMultiple(`
      DROP TABLE IF EXISTS booking_slot_locks;
      CREATE TABLE booking_slot_locks (
        location TEXT NOT NULL,
        date TEXT NOT NULL,
        slot_time TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT '',
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        PRIMARY KEY (location, date, slot_time, assigned_to)
      ) WITHOUT ROWID
    `);
    console.log('[DB] Migration complete: booking_slot_locks per-worker PK.');
  }

  await auditAndBackfillBookingLocks();

  console.log('[DB] Init and migrations complete.');
}

async function migrateAllowedEmailRoles() {
  const columnsResult = await _client.execute('PRAGMA table_info(allowed_emails)');
  const columns = columnsResult.rows.map(row => row.name);
  if (!columns.includes('role')) {
    console.log('[DB] Running migration: adding allowed_emails.role...');
    await _client.execute("ALTER TABLE allowed_emails ADD COLUMN role TEXT DEFAULT 'worker'");
  }

  const adminEmails = getAdminEmails();
  const rootAdmin = getRootAdminEmail();

  for (const email of [...new Set([...getAllowedEmailSeeds(), ...adminEmails, rootAdmin].filter(Boolean))]) {
    await _client.execute({
      sql: `INSERT OR IGNORE INTO allowed_emails (email, role, added_by)
            VALUES (?, ?, ?)`,
      args: [email, adminEmails.includes(email) ? 'admin' : 'worker', 'system'],
    });
  }

  for (const email of adminEmails) {
    await _client.execute({
      sql: `INSERT INTO allowed_emails (email, role, added_by)
            VALUES (?, 'admin', 'system')
            ON CONFLICT(email) DO UPDATE SET role = 'admin'`,
      args: [email],
    });
  }

  if (rootAdmin) {
    await _client.execute({
      sql: `INSERT INTO allowed_emails (email, role, added_by)
            VALUES (?, 'admin', 'system')
            ON CONFLICT(email) DO UPDATE SET role = 'admin'`,
      args: [rootAdmin],
    });
  }
}

async function auditAndBackfillBookingLocks() {
  // Conflicts are only meaningful within the same assigned worker
  const conflicts = await _client.execute(`
    SELECT a.id AS id1, b.id AS id2, a.location, a.date, a.time_booked AS time1, b.time_booked AS time2, a.assigned_to
    FROM bookings a
    JOIN bookings b
      ON b.id > a.id
     AND b.location = a.location
     AND b.date = a.date
     AND b.status != 'Cancelled'
     AND a.status != 'Cancelled'
     AND a.assigned_to IS NOT NULL
     AND b.assigned_to IS NOT NULL
     AND a.assigned_to = b.assigned_to
    WHERE ABS(
      (CAST(substr(a.time_booked, 1, 2) AS INTEGER) * 60 + CAST(substr(a.time_booked, 4, 2) AS INTEGER)) -
      (CAST(substr(b.time_booked, 1, 2) AS INTEGER) * 60 + CAST(substr(b.time_booked, 4, 2) AS INTEGER))
    ) < 60
  `);

  if (conflicts.rows.length) {
    console.warn(`[DB] Booking slot audit found ${conflicts.rows.length} per-worker conflict(s). Review legacy records manually.`);
    for (const row of conflicts.rows.slice(0, 10)) {
      console.warn(`[DB] Conflict: booking ${row.id1} (${row.time1}) and ${row.id2} (${row.time2}) on ${row.date} at ${row.location} for ${row.assigned_to}`);
    }
  }

  const activeBookings = await _client.execute(`
    SELECT id, location, date, time_booked, assigned_to
    FROM bookings
    WHERE status != 'Cancelled'
  `);

  for (const booking of activeBookings.rows) {
    const assignedTo = booking.assigned_to || '';
    for (const slot of slotsForBooking(booking.time_booked)) {
      await _client.execute({
        sql: `INSERT OR IGNORE INTO booking_slot_locks (location, date, slot_time, assigned_to, booking_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [booking.location, booking.date, slot, assignedTo, booking.id],
      });
    }
  }
}

db.ready = initAndMigrate();

module.exports = db;
