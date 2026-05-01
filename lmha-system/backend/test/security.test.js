const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lmha-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`)}`;
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-jwt-signing';
process.env.ALLOWED_EMAILS = 'admin@example.com,staff@example.com';
process.env.ADMIN_EMAILS = 'admin@example.com';
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
const staff = authFor('staff@example.com');

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
      time_booked: '11:15',
      interaction_type: 'Walk-In',
      full_name: 'Invalid Time',
    })
    .expect(400);
});

test('booking slot locks reject overlapping bookings', async () => {
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
      interaction_type: 'Walk-In',
      full_name: 'First Booking',
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
      interaction_type: 'Walk-In',
      full_name: 'Overlap Booking',
    })
    .expect(409);

  await request(app)
    .patch(`/api/bookings/${first.body.id}`)
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrfToken)
    .set('X-Location', 'LMHA')
    .send({ status: 'Cancelled' })
    .expect(200);

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
      full_name: 'Post Cancel Booking',
    })
    .expect(201);
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
