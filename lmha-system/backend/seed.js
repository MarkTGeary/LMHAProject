// Run with: node --no-warnings seed.js
// Seeds the database with realistic sample data

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'lmha.db'));
db.exec('PRAGMA foreign_keys = ON');

// Clear existing data
db.exec(`
  DELETE FROM intake_forms;
  DELETE FROM bookings;
  DELETE FROM service_users;
`);

const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);

// Helpers to get dates relative to today
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };
const daysAhead = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

// Find next occurrence of a weekday (0=Sun, 1=Mon ... 6=Sat)
function nextWeekday(dayNum, offsetWeeks = 0) {
  const d = new Date(today);
  const diff = (dayNum - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return fmt(d);
}
function prevWeekday(dayNum, offsetWeeks = 0) {
  const d = new Date(today);
  const diff = (d.getDay() - dayNum + 7) % 7 || 7;
  d.setDate(d.getDate() - diff - offsetWeeks * 7);
  return fmt(d);
}

// ─── SERVICE USERS ─────────────────────────────────────────────────────────

const users = db.prepare(`
  INSERT INTO service_users (full_name, phone, email, age_group, gender, living_alone,
    english_speaking, translator_required, address,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
    gp_name, gp_phone, repeat_user, first_visit_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const u1 = users.run('Mary Connolly', '0871234567', 'mary.c@email.com', '35-44', 'Female', 'No', 'Yes', 'No', '14 Parnell St, Limerick', 'John Connolly', 'Husband', '0871234568', 'Dr. O\'Brien', '061-123456', 0, daysAgo(0)).lastInsertRowid;
const u2 = users.run('Seán Murphy', '0852345678', '', '25-34', 'Male', 'Yes', 'Yes', 'No', '7 O\'Connell Ave, Limerick', 'Patricia Murphy', 'Mother', '0852345679', 'Dr. Walsh', '061-234567', 1, daysAgo(45)).lastInsertRowid;
const u3 = users.run('Aoife Kelly', '0863456789', '', '18-24', 'Female', 'Yes', 'Yes', 'No', 'Student Accommodation, UL', 'Tom Kelly', 'Father', '0863456780', 'Dr. Ryan', '061-345678', 0, daysAgo(0)).lastInsertRowid;
const u4 = users.run('Declan O\'Brien', '0874567890', '', '45-54', 'Male', 'No', 'Yes', 'No', '3 Ballinacurra Rd, Limerick', 'Helen O\'Brien', 'Wife', '0874567891', 'Dr. Fitzgerald', '061-456789', 1, daysAgo(90)).lastInsertRowid;
const u5 = users.run('Patricia Walsh', '0885678901', '', '55-64', 'Female', 'Yes', 'Yes', 'No', '22 Rosbrien Rd, Limerick', 'Michael Walsh', 'Son', '0885678902', 'Dr. Burke', '061-567890', 0, daysAgo(0)).lastInsertRowid;
const u6 = users.run('James Byrne', '0896789012', '', '65+', 'Male', 'Yes', 'Yes', 'No', '5 Dooradoyle, Limerick', 'Anne Byrne', 'Daughter', '0896789013', 'Dr. Collins', '061-678901', 0, daysAgo(14)).lastInsertRowid;
const u7 = users.run('Sinead Flanagan', '0857890123', '', '25-34', 'Female', 'No', 'Yes', 'No', '11 Castletroy, Limerick', 'Paul Flanagan', 'Brother', '0857890124', 'Dr. Hennessy', '061-789012', 1, daysAgo(60)).lastInsertRowid;
const u8 = users.run('Tomás Ó Briain', '0878901234', '', '35-44', 'Male', 'No', 'Yes', 'No', '8 Mayorstone, Limerick', 'Ciara Ó Briain', 'Wife', '0878901235', 'Dr. Quigley', '061-890123', 0, daysAgo(7)).lastInsertRowid;
const u9 = users.run('Louise Brennan', '0839012345', '', '18-24', 'Female', 'Yes', 'Yes', 'No', 'Mary I Student Accommodation', 'Claire Brennan', 'Mother', '0839012346', 'Dr. McCarthy', '061-901234', 0, daysAgo(0)).lastInsertRowid;
const u10 = users.run('Frank Daly', '0870123456', '', '45-54', 'Male', 'Yes', 'Yes', 'No', '17 Caherdavin, Limerick', 'Susan Daly', 'Sister', '0870123457', 'Dr. Nolan', '061-012345', 1, daysAgo(30)).lastInsertRowid;

// ─── LMHA BOOKINGS ──────────────────────────────────────────────────────────

// Find Mon–Fri dates around today for LMHA
// Today's schedule entries
const todayLMHA = (() => {
  const d = today.getDay();
  // If today is Mon–Fri use today, otherwise use last Friday
  if (d >= 1 && d <= 5) return fmt(today);
  return prevWeekday(5);
})();

const bk = db.prepare(`
  INSERT INTO bookings (service_user_id, location, date, time_booked, time_in, time_out,
    interaction_type, new_or_repeat, referred_from, type_of_support, carer_attended,
    peer_support_worker, limitations, ed_diversion, outcome, status, notes, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dev@lmha.ie')
`);

// Today's LMHA bookings
const b1 = bk.run(u1, 'LMHA', todayLMHA, '11:00', '11:03', null, 'Walk-In', 'New', 'Self-referral', '["SS"]', 0, null, null, 0, 'Attended', 'Active', 'Walk-in, seemed anxious').lastInsertRowid;
const b2 = bk.run(u2, 'LMHA', todayLMHA, '12:00', '12:05', null, 'Peer Support Booking', 'Repeat', 'GP', '["PS"]', 0, 'Sean O\'Sullivan', null, 0, 'Pending', 'Active', null).lastInsertRowid;
const b3 = bk.run(u3, 'LMHA', todayLMHA, '13:00', null, null, 'Phone Call', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', 'Called this morning, first contact').lastInsertRowid;
const b4 = bk.run(u4, 'LMHA', todayLMHA, '14:00', null, null, 'Scheduled', 'Repeat', 'HSE', '["PS","SS"]', 1, 'Sean O\'Sullivan', null, 1, 'Pending', 'Active', 'Wife accompanying').lastInsertRowid;
const b5 = bk.run(u5, 'LMHA', todayLMHA, '15:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null).lastInsertRowid;

// Past LMHA bookings (closed)
const lastMon = prevWeekday(1);
const lastWed = prevWeekday(3);
const lastFri = prevWeekday(5);

const b6 = bk.run(u6, 'LMHA', lastMon, '11:00', '11:02', '12:00', 'Walk-In', 'New', 'Self-referral', '["SS","SP"]', 0, null, null, 0, 'Attended', 'Closed', null).lastInsertRowid;
const b7 = bk.run(u7, 'LMHA', lastMon, '13:00', '13:10', '14:05', 'Peer Support Booking', 'Repeat', 'GP', '["PS"]', 0, 'Sean O\'Sullivan', 'Some difficulty engaging initially', 0, 'Attended', 'Closed', null).lastInsertRowid;
const b8 = bk.run(u8, 'LMHA', lastWed, '11:00', null, null, 'Phone Call', 'New', 'NGO', null, 0, null, null, null, 'Did Not Attend', 'Closed', 'No show, no contact').lastInsertRowid;
const b9 = bk.run(u10, 'LMHA', lastFri, '14:00', '14:15', '15:10', 'Crisis', 'Repeat', 'HSE', '["C","PS"]', 0, null, 'Arrived in significant distress', 1, 'Attended', 'Closed', null).lastInsertRowid;

// Future LMHA bookings
const nextMon = nextWeekday(1);
const nextTue = nextWeekday(2);
const nextWed = nextWeekday(3);
const nextThu = nextWeekday(4);

const b10 = bk.run(u2, 'LMHA', nextMon, '11:00', null, null, 'Peer Support Booking', 'Repeat', 'GP', null, 0, 'Sean O\'Sullivan', null, null, 'Pending', 'Active', null).lastInsertRowid;
const b11 = bk.run(u9, 'LMHA', nextMon, '13:00', null, null, 'Phone Call', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', 'Rang Monday morning, sounded distressed').lastInsertRowid;
const b12 = bk.run(u3, 'LMHA', nextTue, '11:00', null, null, 'Scheduled', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', null).lastInsertRowid;
const b13 = bk.run(u5, 'LMHA', nextWed, '14:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null).lastInsertRowid;
const b14 = bk.run(u4, 'LMHA', nextThu, '12:00', null, null, 'Scheduled', 'Repeat', 'HSE', null, 0, 'Sean O\'Sullivan', null, null, 'Pending', 'Active', null).lastInsertRowid;

// ─── SOLACE CAFÉ BOOKINGS ────────────────────────────────────────────────────

// Solace is Thu–Sun 18:00–00:00
const todayThu = (() => {
  const d = today.getDay();
  if (d === 4 || d === 5 || d === 6 || d === 0) return fmt(today);
  return nextWeekday(4);
})();

const lastThu = prevWeekday(4);
const lastSat = prevWeekday(6);
const nextFri = nextWeekday(5);
const nextSat = nextWeekday(6);
const nextSun = nextWeekday(0);

// Today Solace bookings (if today is Thu–Sun)
const dayOfWeek = today.getDay();
if ([4, 5, 6, 0].includes(dayOfWeek)) {
  bk.run(u1, 'Solace Café', fmt(today), '18:00', '18:05', null, 'Walk-In', 'New', 'Self-referral', '["SS"]', 0, null, null, 0, 'Attended', 'Active', null);
  bk.run(u7, 'Solace Café', fmt(today), '19:00', null, null, 'Peer Support Booking', 'Repeat', null, null, 0, 'Sean O\'Sullivan', null, 0, 'Pending', 'Active', null);
  bk.run(u9, 'Solace Café', fmt(today), '20:00', null, null, 'Walk-In', 'New', null, null, 1, null, null, null, 'Pending', 'Active', 'Friend accompanying').lastInsertRowid;
}

// Past Solace bookings
bk.run(u6, 'Solace Café', lastThu, '18:00', '18:10', '19:15', 'Walk-In', 'New', 'Self-referral', '["SS","SP"]', 0, null, null, 0, 'Attended', 'Closed', null);
bk.run(u2, 'Solace Café', lastThu, '20:00', '20:05', '21:00', 'Peer Support Booking', 'Repeat', null, '["PS"]', 0, 'Sean O\'Sullivan', null, 0, 'Attended', 'Closed', null);
bk.run(u8, 'Solace Café', lastSat, '18:00', null, null, 'Crisis', 'New', 'Self-referral', '["C"]', 0, null, 'Arrived in crisis, required de-escalation', 1, 'Attended', 'Closed', null);
bk.run(u10, 'Solace Café', lastSat, '20:00', '20:20', '21:30', 'Walk-In', 'Repeat', null, '["SS","PS"]', 0, null, null, 0, 'Attended', 'Closed', null);

// Future Solace bookings
bk.run(u3, 'Solace Café', nextFri, '18:00', null, null, 'Peer Support Booking', 'New', 'NGO', null, 0, 'Sean O\'Sullivan', null, null, 'Pending', 'Active', null);
bk.run(u5, 'Solace Café', nextFri, '20:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null);
bk.run(u7, 'Solace Café', nextSat, '19:00', null, null, 'Scheduled', 'Repeat', null, null, 0, null, null, null, 'Pending', 'Active', null);
bk.run(u4, 'Solace Café', nextSun, '18:00', null, null, 'Phone Call', 'Repeat', 'GP', null, 0, null, null, null, 'Pending', 'Active', null);

// ─── INTAKE FORMS ───────────────────────────────────────────────────────────

const intake = db.prepare(`
  INSERT INTO intake_forms (booking_id, service_user_id, referral_source,
    referred_by_name, referred_by_role, referred_by_phone,
    reasons_for_attending, privacy_acknowledged, safety_agreement_acknowledged,
    confidentiality_limits_explained, staff_member, staff_signature, signed_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'Dev User', 'Dev User', ?)
`);

// Add intakes for closed bookings and some active ones
intake.run(b6, u6, 'Self-referral', null, null, null, '["Feeling unable to cope or in crisis","Looking for Social Support"]', lastMon);
intake.run(b7, u7, 'Primary Care Provider', 'Dr. Walsh', 'GP', '061-234567', '["Looking for Peer support","Information seeking"]', lastMon);
intake.run(b9, u10, 'Community Mental Health Team', 'Dr. Brennan', 'Psychiatrist', '061-456789', '["Feeling unable to cope or in crisis"]', lastFri);

// Some active bookings also have intake
intake.run(b1, u1, 'Self-referral', null, null, null, '["Looking for Social Support","Information seeking"]', todayLMHA);
intake.run(b2, u2, 'Primary Care Provider', 'Dr. Walsh', 'GP', '061-234567', '["Looking for Peer support"]', todayLMHA);

// Update ed_diversion on bookings that have it in intake
db.prepare('UPDATE bookings SET ed_diversion = 0 WHERE id = ?').run(b6);
db.prepare('UPDATE bookings SET ed_diversion = 0 WHERE id = ?').run(b7);
db.prepare('UPDATE bookings SET ed_diversion = 1 WHERE id = ?').run(b9);

// ─── SUMMARY ────────────────────────────────────────────────────────────────

const counts = {
  users: db.prepare('SELECT COUNT(*) as n FROM service_users').get().n,
  bookings: db.prepare('SELECT COUNT(*) as n FROM bookings').get().n,
  intakes: db.prepare('SELECT COUNT(*) as n FROM intake_forms').get().n,
  active: db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'Active'").get().n,
  closed: db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'Closed'").get().n,
  lmha: db.prepare("SELECT COUNT(*) as n FROM bookings WHERE location = 'LMHA'").get().n,
  solace: db.prepare("SELECT COUNT(*) as n FROM bookings WHERE location = 'Solace Café'").get().n,
};

console.log('\n✅ Seed complete!\n');
console.log(`  Service users : ${counts.users}`);
console.log(`  Bookings      : ${counts.bookings} (${counts.lmha} LMHA, ${counts.solace} Solace)`);
console.log(`  Active        : ${counts.active}`);
console.log(`  Closed        : ${counts.closed}`);
console.log(`  Intake forms  : ${counts.intakes}`);
console.log(`\n  Today's date  : ${fmt(today)} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()]})`);
console.log(`  Today LMHA    : ${todayLMHA}`);
