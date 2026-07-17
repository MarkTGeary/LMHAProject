const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lmha-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`)}`;
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-jwt-signing';
process.env.ALLOWED_EMAILS = 'admin@example.com,staff@example.com';
process.env.ADMIN_EMAILS = 'admin@example.com,configadmin@example.com';
process.env.ROOT_ADMIN_EMAIL = 'admin@example.com';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.BACKEND_URL = 'http://localhost:3000';
process.env.APP_TIME_ZONE = 'Europe/Dublin';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

const app = require('../server');
const db = require('../db');
const { AUTH_COOKIE_NAME } = require('../lib/config');
const { createAuthToken } = require('../lib/authTokens');
const { slotsForBooking } = require('../lib/bookingLocks');
const { aggregateMetrics } = require('../services/metricsAggregator');

function localDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function nextWeekday(dayNumber) {
  const d = new Date();
  const diff = (dayNumber - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return localDate(d);
}

function authFor(email) {
  const { token, csrfToken } = createAuthToken({ id: email, email, name: email });
  return {
    csrfToken,
    cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
  };
}

const admin = authFor('admin@example.com');
const configAdmin = authFor('configadmin@example.com');
const staff = authFor('staff@example.com');
const SOLACE_LOCATION_HEADER = encodeURIComponent('Solace Café');

before(async () => {
  await db.ready;
});

test('auth/me returns public user, admin flag, and csrf token', async () => {
  const res = await request(app)
    .get('/auth/me')
    .set('Cookie', admin.cookie)
    .expect(200);

  assert.equal(res.body.email, 'admin@example.com');
  assert.equal(res.body.isAdmin, true);
  assert.equal(res.body.role, 'admin');
  assert.equal(typeof res.body.csrfToken, 'string');
});

test('configured admin emails are seeded as admins even when not in allowed emails', async () => {
  const res = await request(app)
    .get('/auth/me')
    .set('Cookie', configAdmin.cookie)
    .expect(200);

  assert.equal(res.body.email, 'configadmin@example.com');
  assert.equal(res.body.isAdmin, true);
  assert.equal(res.body.role, 'admin');
});

test('unsafe requests require csrf', async () => {
  await request(app)
    .post('/api/admin/emails')
    .set('Cookie', admin.cookie)
    .send({ email: 'new-admin-target@example.com' })
    .expect(403);
});

test('admin routes reject non-admin users', async () => {
  await request(app)
    .get('/api/admin/emails')
    .set('Cookie', staff.cookie)
    .expect(403);
});

test('admins can manage worker/admin tiers but not the root admin', async () => {
  const list = await request(app)
    .get('/api/admin/emails')
    .set('Cookie', admin.cookie)
    .expect(200);

  const root = list.body.emails.find(row => row.email === 'admin@example.com');
  assert.equal(root.role, 'admin');
  assert.equal(root.protected, true);
  assert.deepEqual(list.body.roles, ['admin', 'worker']);

  const added = await request(app)
    .post('/api/admin/emails')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .send({ email: 'ordinary@example.com', role: 'worker' })
    .expect(200);
  assert.equal(added.body.role, 'worker');

  const promoted = await request(app)
    .patch('/api/admin/emails/ordinary%40example.com')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .send({ role: 'admin' })
    .expect(200);
  assert.equal(promoted.body.role, 'admin');

  await request(app)
    .patch('/api/admin/emails/admin%40example.com')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .send({ role: 'worker' })
    .expect(403);

  await request(app)
    .delete('/api/admin/emails/admin%40example.com')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .expect(403);
});

test('booking creation rejects location mismatches and invalid input', async () => {
  const date = nextWeekday(1);

  await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'Solace Café',
      date,
      time_booked: '11:00',
      interaction_type: 'Walk-In',
      full_name: 'Location Mismatch',
    })
    .expect(403);

  await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '25:00',
      interaction_type: 'Walk-In',
      full_name: 'Invalid Time',
    })
    .expect(400);
});

test('bookings accept retrospective custom times', async () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);

  const res = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date: localDate(d),
      time_booked: '18:17',
      interaction_type: 'Phone Call',
      full_name: 'Retrospective Phone Call',
    })
    .expect(201);

  assert.equal(res.body.time_booked, '18:17');
});

test('assigned scheduled bookings lock slots but walk-ins can overlap', async () => {
  const date = nextWeekday(1);
  const first = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '11:00',
      interaction_type: 'Phone Call',
      assigned_to: 'staff@example.com',
      full_name: 'First Scheduled Booking',
    })
    .expect(201);

  assert.equal(first.body.time_booked, '11:00');

  await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '11:30',
      interaction_type: 'Phone Call',
      assigned_to: 'staff@example.com',
      full_name: 'Overlap Scheduled Booking',
    })
    .expect(409);

  await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '11:30',
      interaction_type: 'Phone Call',
      assigned_to: 'admin@example.com',
      full_name: 'Different Worker Booking',
    })
    .expect(201);

  await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '11:30',
      interaction_type: 'Walk-In',
      assigned_to: 'staff@example.com',
      full_name: 'Overlapping Walk In',
    })
    .expect(201);
});

test('custom-time booking locks overlap at minute granularity', () => {
  const first = new Set(slotsForBooking('11:15'));
  assert.equal(slotsForBooking('12:10').some(slot => first.has(slot)), true);
  assert.equal(slotsForBooking('12:15').some(slot => first.has(slot)), false);
});

test('outcome session times accept non-slot minutes', async () => {
  const date = nextWeekday(2);
  const booking = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '14:00',
      interaction_type: 'Walk-In',
      full_name: 'Outcome Time Test',
    })
    .expect(201);

  const updated = await request(app)
    .patch(`/api/bookings/${booking.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      outcome: 'Attended',
      time_in: '12:40',
      time_out: '13:40',
      type_of_support: ['SS'],
    })
    .expect(200);

  assert.equal(updated.body.time_in, '12:40');
  assert.equal(updated.body.time_out, '13:40');
});

test('solace intake view returns saved person details and intake edits update age metrics', async () => {
  const date = '2035-03-04';
  const booking = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({
      location: 'Solace Café',
      date,
      time_booked: '19:00',
      interaction_type: 'Peer Support Booking',
      full_name: 'Benjamin Solace',
      new_or_repeat: 'New',
    })
    .expect(201);

  await request(app)
    .patch(`/api/bookings/${booking.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({ outcome: 'Attended', service_event_type: 'Attended through booking' })
    .expect(200);

  const intakePayload = (ageGroup) => ({
    booking_id: booking.body.id,
    service_user_id: booking.body.service_user_id,
    is_repeat: false,
    full_name: 'Benjamin Solace',
    phone: '061-000000',
    age_group: ageGroup,
    gender: 'Male',
    living_alone: 'No',
    english_speaking: 'Yes',
    emergency_contact_name: 'N/A',
    emergency_contact_relationship: 'N/A',
    emergency_contact_phone: 'N/A',
    gp_name: 'N/A',
    gp_phone: 'N/A',
    privacy_acknowledged: true,
    safety_agreement_acknowledged: true,
    confidentiality_limits_explained: true,
    signed_date: date,
    reasons_for_attending: ['Looking for Peer support'],
    support_needs: ['peer_coping'],
  });

  await request(app)
    .post('/api/intake-forms')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send(intakePayload('18-24'))
    .expect(201);

  const intake = await request(app)
    .get(`/api/intake-forms/booking/${booking.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .expect(200);

  assert.equal(intake.body.full_name, 'Benjamin Solace');
  assert.equal(intake.body.phone, '061-000000');
  assert.equal(intake.body.age_group, '18-24');
  assert.equal(intake.body.living_alone, 'No');

  let metrics = await aggregateMetrics('Solace Café', date, date);
  assert.equal(metrics.section1.total_bookings_received, 1);
  assert.equal(metrics.section1.total_people, 1);
  assert.equal(metrics.section1.age_18_24, 1);
  assert.equal(metrics.section1.age_25_34, 0);

  await request(app)
    .post('/api/intake-forms')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send(intakePayload('25-34'))
    .expect(201);

  metrics = await aggregateMetrics('Solace Café', date, date);
  assert.equal(metrics.section1.age_18_24, 0);
  assert.equal(metrics.section1.age_25_34, 1);
});

test('repeat intake updates existing service user demographics for review and metrics', async () => {
  const date = '2035-03-06';
  const originalUser = await request(app)
    .post('/api/service-users')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({
      full_name: 'Tony Repeat',
      first_visit_date: '2034-12-01',
    })
    .expect(201);

  const booking = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({
      location: 'Solace Café',
      date,
      time_booked: '21:00',
      interaction_type: 'Peer Support Booking',
      service_user_id: originalUser.body.id,
      new_or_repeat: 'Repeat',
    })
    .expect(201);

  await request(app)
    .post('/api/intake-forms')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({
      booking_id: booking.body.id,
      service_user_id: originalUser.body.id,
      existing_user_id: originalUser.body.id,
      is_repeat: true,
      full_name: 'Tony Repeat',
      age_group: '35-44',
      gender: 'Male',
      living_alone: 'No',
      english_speaking: 'Yes',
      privacy_acknowledged: true,
      safety_agreement_acknowledged: true,
      confidentiality_limits_explained: true,
      signed_date: date,
      reasons_for_attending: ['Looking for Peer support'],
      support_needs: ['peer_recovery'],
    })
    .expect(201);

  const user = await request(app)
    .get(`/api/service-users/${originalUser.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .expect(200);

  assert.equal(user.body.age_group, '35-44');
  assert.equal(user.body.gender, 'Male');

  const intake = await request(app)
    .get(`/api/intake-forms/booking/${booking.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .expect(200);

  assert.equal(intake.body.age_group, '35-44');
  assert.equal(intake.body.gender, 'Male');

  await request(app)
    .patch(`/api/bookings/${booking.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', SOLACE_LOCATION_HEADER)
    .send({ outcome: 'Attended', service_event_type: 'Attended through booking' })
    .expect(200);

  const metrics = await aggregateMetrics('Solace Café', date, date);
  assert.equal(metrics.section1.total_repeat, 1);
  assert.equal(metrics.section1.total_people, 1);
  assert.equal(metrics.section1.total_male, 1);
  assert.equal(metrics.section1.age_35_44, 1);
});

test('metrics feedback is scoped to current location', async () => {
  await request(app)
    .post('/api/metrics/feedback')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'Solace Café',
      week_start: nextWeekday(1),
      thankyou_letters: 1,
    })
    .expect(403);
});

test('admins can erase service user personal data', async () => {
  const date = nextWeekday(3);
  const booking = await request(app)
    .post('/api/bookings')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({
      location: 'LMHA',
      date,
      time_booked: '12:17',
      interaction_type: 'Phone Call',
      full_name: 'Erase Me',
      phone: '12345',
      notes: 'Identifying note',
    })
    .expect(201);

  await request(app)
    .post(`/api/admin/service-users/${booking.body.service_user_id}/erase`)
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .expect(403);

  await request(app)
    .post(`/api/admin/service-users/${booking.body.service_user_id}/erase`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .expect(200);

  const erased = await db.execute({
    sql: 'SELECT full_name, phone FROM service_users WHERE id = ?',
    args: [booking.body.service_user_id],
  });
  assert.equal(erased.rows[0].full_name, `Erased service user #${booking.body.service_user_id}`);
  assert.equal(erased.rows[0].phone, null);

  const record = await db.execute({
    sql: 'SELECT notes FROM bookings WHERE id = ?',
    args: [booking.body.id],
  });
  assert.equal(record.rows[0].notes, null);
});

test('revoked allowlist users are rejected on subsequent requests', async () => {
  await db.execute({
    sql: 'DELETE FROM allowed_emails WHERE email = ?',
    args: ['staff@example.com'],
  });

  await request(app)
    .get('/auth/me')
    .set('Cookie', staff.cookie)
    .expect(401);
});
