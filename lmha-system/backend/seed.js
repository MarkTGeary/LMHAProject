// Run with: node seed.js
// Seeds the database with realistic sample data.
// Uses the same libSQL/Turso client + schema as the app (db.js), so it requires
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (a local `file:` URL works for dev).

require('dotenv').config();
const db = require('./db');

const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);

// Helpers to get dates relative to today
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };

// Find next/previous occurrence of a weekday (0=Sun, 1=Mon ... 6=Sat)
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

async function run(sql, args) {
  const result = await db.execute({ sql, args });
  return Number(result.lastInsertRowid);
}

async function count(sql) {
  const result = await db.execute(sql);
  return Number(result.rows[0].n);
}

async function seed() {
  await db.ready;

  // ─── CLEAR EXISTING DATA ──────────────────────────────────────────────────
  // Respect FK order: dependents before parents.
  await db.executeMultiple(`
    DELETE FROM intake_forms;
    DELETE FROM booking_slot_locks;
    DELETE FROM bookings;
    DELETE FROM service_users;
  `);

  // ─── SERVICE USERS ────────────────────────────────────────────────────────
  const SU = `INSERT INTO service_users (full_name, phone, email, age_group, gender, living_alone,
      english_speaking, translator_required, address,
      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
      gp_name, gp_phone, repeat_user, first_visit_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const u1  = await run(SU, ['Mary Connolly', '0871234567', 'mary.c@email.com', '35-44', 'Female', 'No', 'Yes', '14 Parnell St, Limerick', 'John Connolly', 'Husband', '0871234568', "Dr. O'Brien", '061-123456', 0, daysAgo(0)]);
  const u2  = await run(SU, ['Seán Murphy', '0852345678', null, '25-34', 'Male', 'Yes', 'Yes', "7 O'Connell Ave, Limerick", 'Patricia Murphy', 'Mother', '0852345679', 'Dr. Walsh', '061-234567', 1, daysAgo(45)]);
  const u3  = await run(SU, ['Aoife Kelly', '0863456789', null, '18-24', 'Female', 'Yes', 'Yes', 'Student Accommodation, UL', 'Tom Kelly', 'Father', '0863456780', 'Dr. Ryan', '061-345678', 0, daysAgo(0)]);
  const u4  = await run(SU, ["Declan O'Brien", '0874567890', null, '45-54', 'Male', 'No', 'Yes', '3 Ballinacurra Rd, Limerick', "Helen O'Brien", 'Wife', '0874567891', 'Dr. Fitzgerald', '061-456789', 1, daysAgo(90)]);
  const u5  = await run(SU, ['Patricia Walsh', '0885678901', null, '55-64', 'Female', 'Yes', 'Yes', '22 Rosbrien Rd, Limerick', 'Michael Walsh', 'Son', '0885678902', 'Dr. Burke', '061-567890', 0, daysAgo(0)]);
  const u6  = await run(SU, ['James Byrne', '0896789012', null, '65+', 'Male', 'Yes', 'Yes', '5 Dooradoyle, Limerick', 'Anne Byrne', 'Daughter', '0896789013', 'Dr. Collins', '061-678901', 0, daysAgo(14)]);
  const u7  = await run(SU, ['Sinead Flanagan', '0857890123', null, '25-34', 'Female', 'No', 'Yes', '11 Castletroy, Limerick', 'Paul Flanagan', 'Brother', '0857890124', 'Dr. Hennessy', '061-789012', 1, daysAgo(60)]);
  const u8  = await run(SU, ['Tomás Ó Briain', '0878901234', null, '35-44', 'Male', 'No', 'Yes', '8 Mayorstone, Limerick', 'Ciara Ó Briain', 'Wife', '0878901235', 'Dr. Quigley', '061-890123', 0, daysAgo(7)]);
  const u9  = await run(SU, ['Louise Brennan', '0839012345', null, '18-24', 'Female', 'Yes', 'Yes', 'Mary I Student Accommodation', 'Claire Brennan', 'Mother', '0839012346', 'Dr. McCarthy', '061-901234', 0, daysAgo(0)]);
  const u10 = await run(SU, ['Frank Daly', '0870123456', null, '45-54', 'Male', 'Yes', 'Yes', '17 Caherdavin, Limerick', 'Susan Daly', 'Sister', '0870123457', 'Dr. Nolan', '061-012345', 1, daysAgo(30)]);

  // ─── BOOKINGS ─────────────────────────────────────────────────────────────
  const BK = `INSERT INTO bookings (service_user_id, location, date, time_booked, time_in, time_out,
      interaction_type, new_or_repeat, referred_from, type_of_support, carer_attended,
      peer_support_worker, limitations, ed_diversion, outcome, status, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dev@lmha.ie')`;

  // LMHA — today's schedule (use today if Mon–Fri, else last Friday)
  const todayLMHA = (() => {
    const d = today.getDay();
    if (d >= 1 && d <= 5) return fmt(today);
    return prevWeekday(5);
  })();

  const b1 = await run(BK, [u1, 'LMHA', todayLMHA, '11:00', '11:03', null, 'Walk-In', 'New', 'Self-referral', '["SS"]', 0, null, null, 0, 'Attended', 'Active', 'Walk-in, seemed anxious']);
  const b2 = await run(BK, [u2, 'LMHA', todayLMHA, '12:00', '12:05', null, 'Peer Support Booking', 'Repeat', 'GP', '["PS"]', 0, "Sean O'Sullivan", null, 0, 'Pending', 'Active', null]);
  await run(BK, [u3, 'LMHA', todayLMHA, '13:00', null, null, 'Phone Call', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', 'Called this morning, first contact']);
  await run(BK, [u4, 'LMHA', todayLMHA, '14:00', null, null, 'Phone Call', 'Repeat', 'HSE', '["PS","SS"]', 1, "Sean O'Sullivan", null, 1, 'Pending', 'Active', 'Wife accompanying']);
  await run(BK, [u5, 'LMHA', todayLMHA, '15:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null]);

  // LMHA — past (closed)
  const lastMon = prevWeekday(1);
  const lastWed = prevWeekday(3);
  const lastFri = prevWeekday(5);

  const b6 = await run(BK, [u6, 'LMHA', lastMon, '11:00', '11:02', '12:00', 'Walk-In', 'New', 'Self-referral', '["SS","SP"]', 0, null, null, 0, 'Attended', 'Closed', null]);
  const b7 = await run(BK, [u7, 'LMHA', lastMon, '13:00', '13:10', '14:05', 'Peer Support Booking', 'Repeat', 'GP', '["PS"]', 0, "Sean O'Sullivan", 'Some difficulty engaging initially', 0, 'Attended', 'Closed', null]);
  await run(BK, [u8, 'LMHA', lastWed, '11:00', null, null, 'Phone Call', 'New', 'NGO', null, 0, null, null, null, 'Did Not Attend', 'Closed', 'No show, no contact']);
  const b9 = await run(BK, [u10, 'LMHA', lastFri, '14:00', '14:15', '15:10', 'Crisis', 'Repeat', 'HSE', '["C","PS"]', 0, null, 'Arrived in significant distress', 1, 'Attended', 'Closed', null]);

  // LMHA — future
  const nextMon = nextWeekday(1);
  const nextTue = nextWeekday(2);
  const nextWed = nextWeekday(3);
  const nextThu = nextWeekday(4);

  await run(BK, [u2, 'LMHA', nextMon, '11:00', null, null, 'Peer Support Booking', 'Repeat', 'GP', null, 0, "Sean O'Sullivan", null, null, 'Pending', 'Active', null]);
  await run(BK, [u9, 'LMHA', nextMon, '13:00', null, null, 'Phone Call', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', 'Rang Monday morning, sounded distressed']);
  await run(BK, [u3, 'LMHA', nextTue, '11:00', null, null, 'Phone Call', 'New', 'Self-referral', null, 0, null, null, null, 'Pending', 'Active', null]);
  await run(BK, [u5, 'LMHA', nextWed, '14:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null]);
  await run(BK, [u4, 'LMHA', nextThu, '12:00', null, null, 'Phone Call', 'Repeat', 'HSE', null, 0, "Sean O'Sullivan", null, null, 'Pending', 'Active', null]);

  // ─── SOLACE CAFÉ BOOKINGS (Thu–Sun 18:00–00:00) ───────────────────────────
  const lastThu = prevWeekday(4);
  const lastSat = prevWeekday(6);
  const nextFri = nextWeekday(5);
  const nextSat = nextWeekday(6);
  const nextSun = nextWeekday(0);

  // Today's Solace bookings (if today is Thu–Sun)
  if ([4, 5, 6, 0].includes(today.getDay())) {
    await run(BK, [u1, 'Solace Café', fmt(today), '18:00', '18:05', null, 'Walk-In', 'New', 'Self-referral', '["SS"]', 0, null, null, 0, 'Attended', 'Active', null]);
    await run(BK, [u7, 'Solace Café', fmt(today), '19:00', null, null, 'Peer Support Booking', 'Repeat', null, null, 0, "Sean O'Sullivan", null, 0, 'Pending', 'Active', null]);
    await run(BK, [u9, 'Solace Café', fmt(today), '20:00', null, null, 'Walk-In', 'New', null, null, 1, null, null, null, 'Pending', 'Active', 'Friend accompanying']);
  }

  // Past Solace bookings
  await run(BK, [u6, 'Solace Café', lastThu, '18:00', '18:10', '19:15', 'Walk-In', 'New', 'Self-referral', '["SS","SP"]', 0, null, null, 0, 'Attended', 'Closed', null]);
  await run(BK, [u2, 'Solace Café', lastThu, '20:00', '20:05', '21:00', 'Peer Support Booking', 'Repeat', null, '["PS"]', 0, "Sean O'Sullivan", null, 0, 'Attended', 'Closed', null]);
  await run(BK, [u8, 'Solace Café', lastSat, '18:00', null, null, 'Crisis', 'New', 'Self-referral', '["C"]', 0, null, 'Arrived in crisis, required de-escalation', 1, 'Attended', 'Closed', null]);
  await run(BK, [u10, 'Solace Café', lastSat, '20:00', '20:20', '21:30', 'Walk-In', 'Repeat', null, '["SS","PS"]', 0, null, null, 0, 'Attended', 'Closed', null]);

  // Future Solace bookings
  await run(BK, [u3, 'Solace Café', nextFri, '18:00', null, null, 'Peer Support Booking', 'New', 'NGO', null, 0, "Sean O'Sullivan", null, null, 'Pending', 'Active', null]);
  await run(BK, [u5, 'Solace Café', nextFri, '20:00', null, null, 'Walk-In', 'New', null, null, 0, null, null, null, 'Pending', 'Active', null]);
  await run(BK, [u7, 'Solace Café', nextSat, '19:00', null, null, 'Phone Call', 'Repeat', null, null, 0, null, null, null, 'Pending', 'Active', null]);
  await run(BK, [u4, 'Solace Café', nextSun, '18:00', null, null, 'Phone Call', 'Repeat', 'GP', null, 0, null, null, null, 'Pending', 'Active', null]);

  // ─── INTAKE FORMS ─────────────────────────────────────────────────────────
  const IF = `INSERT INTO intake_forms (booking_id, service_user_id, referral_source,
      referred_by_name, referred_by_role, referred_by_phone,
      reasons_for_attending, privacy_acknowledged, safety_agreement_acknowledged,
      confidentiality_limits_explained, staff_member, staff_signature, signed_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'Dev User', 'Dev User', ?)`;

  await run(IF, [b6, u6, 'Self-referral', null, null, null, '["Feeling unable to cope or in crisis","Looking for Social Support"]', lastMon]);
  await run(IF, [b7, u7, 'GP', 'Dr. Walsh', 'GP', '061-234567', '["Looking for Peer support","Information seeking"]', lastMon]);
  await run(IF, [b9, u10, 'Community Mental Health Team', 'Dr. Brennan', 'Psychiatrist', '061-456789', '["Feeling unable to cope or in crisis"]', lastFri]);
  await run(IF, [b1, u1, 'Self-referral', null, null, null, '["Looking for Social Support","Information seeking"]', todayLMHA]);
  await run(IF, [b2, u2, 'GP', 'Dr. Walsh', 'GP', '061-234567', '["Looking for Peer support"]', todayLMHA]);

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  const counts = {
    users:    await count('SELECT COUNT(*) as n FROM service_users'),
    bookings: await count('SELECT COUNT(*) as n FROM bookings'),
    intakes:  await count('SELECT COUNT(*) as n FROM intake_forms'),
    active:   await count("SELECT COUNT(*) as n FROM bookings WHERE status = 'Active'"),
    closed:   await count("SELECT COUNT(*) as n FROM bookings WHERE status = 'Closed'"),
    lmha:     await count("SELECT COUNT(*) as n FROM bookings WHERE location = 'LMHA'"),
    solace:   await count("SELECT COUNT(*) as n FROM bookings WHERE location = 'Solace Café'"),
  };

  console.log('\n✅ Seed complete!\n');
  console.log(`  Service users : ${counts.users}`);
  console.log(`  Bookings      : ${counts.bookings} (${counts.lmha} LMHA, ${counts.solace} Solace)`);
  console.log(`  Active        : ${counts.active}`);
  console.log(`  Closed        : ${counts.closed}`);
  console.log(`  Intake forms  : ${counts.intakes}`);
  console.log(`\n  Today's date  : ${fmt(today)} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()]})`);
  console.log(`  Today LMHA    : ${todayLMHA}`);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  });
