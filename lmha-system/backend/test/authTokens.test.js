const { before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-jwt-signing';

const { AUTH_COOKIE_NAME } = require('../lib/config');
const {
  clearAuthCookie,
  createAuthToken,
  hasValidCsrf,
  parseCookies,
  publicUserFromPayload,
  readAuthPayload,
  setAuthCookie,
  verifyAuthToken,
} = require('../lib/authTokens');

function fakeRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) { headers[name] = value; },
  };
}

describe('parseCookies', () => {
  test('parses a single cookie', () => {
    const req = { headers: { cookie: 'foo=bar' } };
    assert.deepEqual(parseCookies(req), { foo: 'bar' });
  });

  test('parses multiple cookies separated by "; "', () => {
    const req = { headers: { cookie: 'foo=bar; baz=qux' } };
    assert.deepEqual(parseCookies(req), { foo: 'bar', baz: 'qux' });
  });

  test('returns {} when no cookie header is present', () => {
    assert.deepEqual(parseCookies({ headers: {} }), {});
  });

  test('URL-decodes cookie values', () => {
    const req = { headers: { cookie: `x=${encodeURIComponent('a b/c')}` } };
    assert.deepEqual(parseCookies(req), { x: 'a b/c' });
  });

  test('preserves "=" characters within the value (e.g. base64url padding)', () => {
    const value = encodeURIComponent('abc==def');
    const req = { headers: { cookie: `token=${value}` } };
    assert.deepEqual(parseCookies(req), { token: 'abc==def' });
  });

  test('ignores malformed segments without a key', () => {
    const req = { headers: { cookie: '=bad; good=1' } };
    const cookies = parseCookies(req);
    assert.equal(cookies.good, '1');
  });
});

describe('createAuthToken / verifyAuthToken', () => {
  test('creates a token that verifies and round-trips claims', () => {
    const { token, csrfToken } = createAuthToken({ id: 7, email: 'Staff@Example.com', name: 'Staff Person' });
    const payload = verifyAuthToken(token);
    assert.equal(payload.sub, '7');
    assert.equal(payload.id, '7');
    assert.equal(payload.email, 'staff@example.com');
    assert.equal(payload.name, 'Staff Person');
    assert.equal(payload.picture, null);
    assert.equal(payload.csrf, csrfToken);
  });

  test('normalises email casing/whitespace', () => {
    const { token } = createAuthToken({ id: 1, email: '  Weird@EXAMPLE.com  ' });
    const payload = verifyAuthToken(token);
    assert.equal(payload.email, 'weird@example.com');
  });

  test('defaults name to email when name is missing', () => {
    const { token } = createAuthToken({ id: 1, email: 'noname@example.com' });
    const payload = verifyAuthToken(token);
    assert.equal(payload.name, 'noname@example.com');
  });

  test('carries picture through when provided', () => {
    const { token } = createAuthToken({ id: 1, email: 'pic@example.com', picture: 'https://x/y.png' });
    const payload = verifyAuthToken(token);
    assert.equal(payload.picture, 'https://x/y.png');
  });

  test('generates a fresh csrf token per call', () => {
    const a = createAuthToken({ id: 1, email: 'a@example.com' });
    const b = createAuthToken({ id: 1, email: 'a@example.com' });
    assert.notEqual(a.csrfToken, b.csrfToken);
  });

  test('csrf token is a non-empty base64url string', () => {
    const { csrfToken } = createAuthToken({ id: 1, email: 'a@example.com' });
    assert.match(csrfToken, /^[A-Za-z0-9_-]+$/);
    assert.ok(csrfToken.length > 0);
  });

  test('rejects a tampered token', () => {
    const { token } = createAuthToken({ id: 1, email: 'a@example.com' });
    const tampered = token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
    assert.throws(() => verifyAuthToken(tampered));
  });

  test('rejects a token signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ sub: '1', email: 'a@example.com' }, 'wrong-secret', {
      expiresIn: '1h',
      issuer: 'lmha-system',
      audience: 'lmha-staff',
    });
    assert.throws(() => verifyAuthToken(bad));
  });

  test('rejects a token with the wrong audience', () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ sub: '1', email: 'a@example.com' }, process.env.SESSION_SECRET, {
      expiresIn: '1h',
      issuer: 'lmha-system',
      audience: 'someone-else',
    });
    assert.throws(() => verifyAuthToken(bad));
  });

  test('rejects a garbage string', () => {
    assert.throws(() => verifyAuthToken('not.a.jwt'));
  });
});

describe('readAuthPayload', () => {
  test('returns the payload for a valid cookie', () => {
    const { token } = createAuthToken({ id: 1, email: 'a@example.com' });
    const req = { headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` } };
    const payload = readAuthPayload(req);
    assert.equal(payload.email, 'a@example.com');
  });

  test('returns null when the cookie is missing', () => {
    assert.equal(readAuthPayload({ headers: {} }), null);
  });

  test('returns null when the cookie value is invalid', () => {
    const req = { headers: { cookie: `${AUTH_COOKIE_NAME}=garbage` } };
    assert.equal(readAuthPayload(req), null);
  });

  test('returns null for a well-formed but wrongly-signed token', () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ sub: '1' }, 'wrong-secret');
    const req = { headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(bad)}` } };
    assert.equal(readAuthPayload(req), null);
  });
});

describe('publicUserFromPayload', () => {
  test('maps payload fields to the public user shape', () => {
    const payload = { id: '5', email: 'A@Example.com', name: 'A', picture: null, csrf: 'csrf-token' };
    const user = publicUserFromPayload(payload);
    assert.deepEqual(user, {
      id: '5',
      email: 'a@example.com',
      name: 'A',
      picture: null,
      role: 'worker',
      isAdmin: false,
      csrfToken: 'csrf-token',
    });
  });

  test('falls back from id to sub when id is absent', () => {
    const user = publicUserFromPayload({ sub: '9', email: 'x@example.com', csrf: 'c' });
    assert.equal(user.id, '9');
  });

  test('defaults picture to null when absent', () => {
    const user = publicUserFromPayload({ id: '1', email: 'x@example.com', csrf: 'c' });
    assert.equal(user.picture, null);
  });
});

describe('setAuthCookie / clearAuthCookie', () => {
  test('setAuthCookie writes a Set-Cookie header containing the token', () => {
    const res = fakeRes();
    setAuthCookie(res, 'abc.def.ghi');
    assert.match(res.headers['Set-Cookie'], new RegExp(`^${AUTH_COOKIE_NAME}=abc.def.ghi;`));
    assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  });

  test('clearAuthCookie writes an empty-value, Max-Age=0 header', () => {
    const res = fakeRes();
    clearAuthCookie(res);
    assert.match(res.headers['Set-Cookie'], new RegExp(`^${AUTH_COOKIE_NAME}=;`));
    assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
  });
});

describe('hasValidCsrf', () => {
  test('always true for GET/HEAD/OPTIONS regardless of tokens', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const req = { method, headers: {} };
      assert.equal(hasValidCsrf(req, { csrfToken: 'x' }), true);
    }
  });

  test('true when supplied header matches the user csrf token', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': 'match-me' } };
    assert.equal(hasValidCsrf(req, { csrfToken: 'match-me' }), true);
  });

  test('supports payload shape using "csrf" instead of "csrfToken"', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': 'match-me' } };
    assert.equal(hasValidCsrf(req, { csrf: 'match-me' }), true);
  });

  test('false when tokens differ (same length)', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': 'aaaaaaaa' } };
    assert.equal(hasValidCsrf(req, { csrfToken: 'bbbbbbbb' }), false);
  });

  test('false when tokens differ in length', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': 'short' } };
    assert.equal(hasValidCsrf(req, { csrfToken: 'a-much-longer-token' }), false);
  });

  test('false when no user/expected token is present', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': 'anything' } };
    assert.equal(hasValidCsrf(req, null), false);
    assert.equal(hasValidCsrf(req, {}), false);
  });

  test('false when no header is supplied', () => {
    const req = { method: 'POST', headers: {} };
    assert.equal(hasValidCsrf(req, { csrfToken: 'expected' }), false);
  });

  test('false when supplied header is not a string (e.g. array from repeated headers)', () => {
    const req = { method: 'POST', headers: { 'x-csrf-token': ['a', 'b'] } };
    assert.equal(hasValidCsrf(req, { csrfToken: 'a' }), false);
  });

  test('is case-sensitive for method checks (lowercase "post" is treated as unsafe)', () => {
    const req = { method: 'post', headers: {} };
    assert.equal(hasValidCsrf(req, { csrfToken: 'expected' }), false);
  });
});
