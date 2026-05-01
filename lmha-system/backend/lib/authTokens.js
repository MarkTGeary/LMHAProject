const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  AUTH_COOKIE_NAME,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  getAuthCookieOptions,
  getExpiredAuthCookieOptions,
  getSessionSecret,
  normaliseEmail,
} = require('./config');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
  }
  return cookies;
}

function createAuthToken(user) {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const email = normaliseEmail(user.email);
  const token = jwt.sign(
    {
      sub: String(user.id),
      id: String(user.id),
      email,
      name: user.name || email,
      picture: user.picture || null,
      csrf: csrfToken,
    },
    getSessionSecret(),
    {
      expiresIn: '8h',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    }
  );
  return { token, csrfToken };
}

function verifyAuthToken(token) {
  return jwt.verify(token, getSessionSecret(), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

function readAuthPayload(req) {
  const token = parseCookies(req)[AUTH_COOKIE_NAME];
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

function publicUserFromPayload(payload) {
  return {
    id: payload.id || payload.sub,
    email: normaliseEmail(payload.email),
    name: payload.name,
    picture: payload.picture || null,
    role: 'worker',
    isAdmin: false,
    csrfToken: payload.csrf,
  };
}

function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${getAuthCookieOptions()}`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; ${getExpiredAuthCookieOptions()}`);
}

function hasValidCsrf(req, user) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const expected = user?.csrfToken || user?.csrf;
  const supplied = req.headers['x-csrf-token'];
  if (!expected || typeof supplied !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  createAuthToken,
  clearAuthCookie,
  hasValidCsrf,
  parseCookies,
  publicUserFromPayload,
  readAuthPayload,
  setAuthCookie,
  verifyAuthToken,
};
