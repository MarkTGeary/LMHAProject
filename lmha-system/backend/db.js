const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lmha.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function init() {
  db.exec(`
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
        'Primary Care Provider',
        'NGO Stakeholder',
        'Community Mental Health Team',
        'Liaison Psychiatry Team',
        'Crisis Resolution Team',
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

      completed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('Database initialised at', DB_PATH);
}

/**
 * Migrations — run after init() so tables always exist first.
 * Each migration checks whether it's already been applied before running.
 */
function migrate() {
  // Migration 0: feedback_logs table for manually-entered miscellaneous feedback counts.
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  if (!tables.includes('feedback_logs')) {
    console.log('[DB] Running migration: creating feedback_logs...');
    db.exec(`
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

  // Migration 1: Expand intake_forms with new referral sources + 3 new JSON columns.
  // Recreates the table to update the referral_source CHECK constraint.
  const cols = db.prepare("PRAGMA table_info(intake_forms)").all().map(c => c.name);
  if (!cols.includes('onward_referrals')) {
    console.log('[DB] Running migration: expanding intake_forms...');
    db.exec(`
      CREATE TABLE intake_forms_v2 (
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

        -- Section 3: granular support needs (JSON array of string keys)
        support_needs TEXT,
        -- Section 5: onward referrals made by staff (JSON array of string keys)
        onward_referrals TEXT,
        -- Limitations: out-of-hours contact attempts recorded (JSON array of string keys)
        limitations_detail TEXT
      )
    `);

    // Copy existing rows; remap old referral_source values that no longer exist
    db.exec(`
      INSERT INTO intake_forms_v2 (
        id, booking_id, service_user_id,
        referral_source,
        referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
        reasons_for_attending,
        privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
        staff_member, staff_signature, signed_date, completed_at,
        support_needs, onward_referrals, limitations_detail
      )
      SELECT
        id, booking_id, service_user_id,
        CASE referral_source
          WHEN 'Primary Care Provider' THEN 'HSE Health Services'
          WHEN 'NGO Stakeholder'       THEN 'Local NGO and Community Partner Agency'
          ELSE referral_source
        END,
        referred_by_name, referred_by_role, referred_by_phone, referred_by_email,
        reasons_for_attending,
        privacy_acknowledged, safety_agreement_acknowledged, confidentiality_limits_explained,
        staff_member, staff_signature, signed_date, completed_at,
        NULL, NULL, NULL
      FROM intake_forms
    `);

    db.exec('DROP TABLE intake_forms');
    db.exec('ALTER TABLE intake_forms_v2 RENAME TO intake_forms');
    console.log('[DB] Migration complete: intake_forms expanded.');
  }
}

init();
migrate();

module.exports = db;
