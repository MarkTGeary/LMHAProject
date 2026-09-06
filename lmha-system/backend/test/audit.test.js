const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lmha-audit-test-${Date.now()}.db`)}`;

const { auditStatement, cleanFields } = require('../services/audit');

test('cleanFields only retains safe field names and removes duplicates', () => {
  assert.deepEqual(
    cleanFields(['phone', 'notes', 'phone', 'client name', 'x'.repeat(70), null]),
    ['notes', 'phone']
  );
});

test('auditStatement derives actor identity from the authenticated request', () => {
  const statement = auditStatement(
    { user: { email: 'Staff@Example.com', role: 'worker' }, location: 'LMHA', requestId: 'request-1' },
    { action: 'UPDATE', entityType: 'booking', entityId: 42, serviceUserId: 7, changedFields: ['notes'] }
  );
  assert.equal(statement.args[0], 'staff@example.com');
  assert.equal(statement.args[2], 'UPDATE');
  assert.equal(statement.args[3], 'SUCCESS');
  assert.equal(statement.args[4], 'booking');
  assert.equal(statement.args[5], 42);
  assert.equal(statement.args[6], 7);
  assert.equal(statement.args[7], 'LMHA');
  assert.equal(statement.args[8], '["notes"]');
  assert.equal(statement.args[9], 'request-1');
});

test('auditStatement never serialises request bodies or changed values', () => {
  const req = {
    user: { email: 'staff@example.com', role: 'worker' },
    body: { notes: 'highly sensitive content', phone: '0870000000' },
  };
  const statement = auditStatement(req, {
    action: 'VIEW', entityType: 'service_user', entityId: 2, changedFields: ['notes', 'phone'],
  });
  const serialisedArgs = JSON.stringify(statement.args);
  assert.equal(serialisedArgs.includes('highly sensitive content'), false);
  assert.equal(serialisedArgs.includes('0870000000'), false);
});

test('auditStatement rejects unsupported actions and entities', () => {
  const req = { user: { email: 'staff@example.com', role: 'worker' } };
  assert.throws(() => auditStatement(req, { action: 'DELETE', entityType: 'booking' }));
  assert.throws(() => auditStatement(req, { action: 'VIEW', entityType: 'secret_dump' }));
});
