const LOCATION_VALUES = ['LMHA', 'Solace Café'];
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const TOKEN_ISSUER = 'lmha-system';
const TOKEN_AUDIENCE = 'lmha-staff';
const AUTH_COOKIE_NAME = 'lmha_auth';
const SESSION_HOURS = 8;
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Europe/Dublin';

process.env.TZ = APP_TIME_ZONE;

function splitList(value) {
  return (value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function normaliseEmail(value) {
  return (value || '').trim().toLowerCase();
}

function normaliseOrigin(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function getFrontendUrls() {
  const urls = splitList(process.env.FRONTEND_URLS || process.env.FRONTEND_URL)
    .map(normaliseOrigin)
    .filter(Boolean);
  return urls.length ? [...new Set(urls)] : [DEFAULT_FRONTEND_URL];
}

function getPrimaryFrontendUrl() {
  return getFrontendUrls()[0];
}

function getBackendUrl() {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function getAllowedEmailSeeds() {
  return splitList(process.env.ALLOWED_EMAILS).map(normaliseEmail);
}

function getRootAdminEmail() {
  const explicit = normaliseEmail(process.env.ROOT_ADMIN_EMAIL);
  if (explicit) return explicit;
  const [firstAdmin] = splitList(process.env.ADMIN_EMAILS).map(normaliseEmail);
  if (firstAdmin) return firstAdmin;
  const [firstAllowed] = getAllowedEmailSeeds();
  return firstAllowed || '';
}

function getAdminEmails() {
  const admins = new Set(splitList(process.env.ADMIN_EMAILS).map(normaliseEmail));
  const rootAdmin = getRootAdminEmail();
  if (rootAdmin) admins.add(rootAdmin);
  return [...admins];
}

function isAdminEmail(email) {
  return getAdminEmails().includes(normaliseEmail(email));
}

function isRootAdminEmail(email) {
  const rootAdmin = getRootAdminEmail();
  return !!rootAdmin && normaliseEmail(email) === rootAdmin;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'lmha-dev-secret-change-me';
}

function getAuthCookieOptions() {
  return [
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_HOURS * 60 * 60}`,
    `SameSite=${isProduction() ? 'None' : 'Lax'}`,
    ...(isProduction() ? ['Secure'] : []),
  ].join('; ');
}

function getExpiredAuthCookieOptions() {
  return [
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${isProduction() ? 'None' : 'Lax'}`,
    ...(isProduction() ? ['Secure'] : []),
  ].join('; ');
}

function validateProductionEnv() {
  if (!isProduction()) return;

  const missing = [];
  const required = [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'BACKEND_URL',
    'SESSION_SECRET',
    'SPREADSHEET_ID_LMHA',
    'SPREADSHEET_ID_SOLACE',
  ];

  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }
  if (!process.env.FRONTEND_URL && !process.env.FRONTEND_URLS) missing.push('FRONTEND_URL or FRONTEND_URLS');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    missing.push('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH');
  }
  if (!getAllowedEmailSeeds().length && !getRootAdminEmail()) missing.push('ALLOWED_EMAILS or ROOT_ADMIN_EMAIL');
  if ((process.env.SESSION_SECRET || '').length < 32) missing.push('SESSION_SECRET length >= 32');
  if (APP_TIME_ZONE !== 'Europe/Dublin') missing.push('APP_TIME_ZONE=Europe/Dublin');

  if (missing.length) {
    throw new Error(`Missing or invalid production environment: ${missing.join(', ')}`);
  }
}

module.exports = {
  AUTH_COOKIE_NAME,
  DEFAULT_FRONTEND_URL,
  LOCATION_VALUES,
  SESSION_HOURS,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  getAdminEmails,
  getAllowedEmailSeeds,
  getAuthCookieOptions,
  getBackendUrl,
  getExpiredAuthCookieOptions,
  getFrontendUrls,
  getPrimaryFrontendUrl,
  getRootAdminEmail,
  getSessionSecret,
  isAdminEmail,
  isProduction,
  isRootAdminEmail,
  normaliseEmail,
  normaliseOrigin,
  splitList,
  validateProductionEnv,
};
