require('dotenv').config();
const { createClient } = require('@libsql/client');

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
        'Phone Call','Walk-In','Crisis','Peer Support Booking','Email','Text','Scheduled','Off-the-cuff'
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

  // ── Migration: allowed_emails ─────────────────────────────────────
  if (!tables.includes('allowed_emails')) {
    console.log('[DB] Running migration: creating allowed_emails...');
    await _client.executeMultiple(`
      CREATE TABLE allowed_emails (
        email TEXT PRIMARY KEY,
        added_by TEXT,
        added_at TEXT DEFAULT (datetime('now'))
      )
    `);
    const envEmails = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    for (const e of envEmails) {
      await _client.execute({
        sql: 'INSERT OR IGNORE INTO allowed_emails (email, added_by) VALUES (?, ?)',
        args: [e, 'system'],
      });
    }
    console.log(`[DB] Migration complete: allowed_emails seeded with ${envEmails.length} email(s).`);
  }

  console.log('[DB] Init and migrations complete.');
}

db.ready = initAndMigrate();

module.exports = db;
