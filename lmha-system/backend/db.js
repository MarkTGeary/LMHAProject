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

init();

module.exports = db;
