const { LOCATION_VALUES } = require('./config');
const { badRequest, forbidden } = require('./errors');

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function assertLocation(value, label = 'location') {
  if (!LOCATION_VALUES.includes(value)) throw badRequest(`Invalid ${label}`);
  return value;
}

function assertRequestLocation(req, supplied) {
  const current = assertLocation(req.location, 'current location');
  if (supplied !== undefined && supplied !== null && supplied !== '' && supplied !== current) {
    throw forbidden('Location does not match your current session');
  }
  return current;
}

function parseId(value, label = 'id', { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw badRequest(`${label} is required`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${label}`);
  return n;
}

function normaliseString(value, label, { required = false, max = 5000, trim = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${label} is required`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${label} must be text`);
  const out = trim ? value.trim() : value;
  if (required && !out) throw badRequest(`${label} is required`);
  if (out.length > max) throw badRequest(`${label} is too long`);
  return out || null;
}

function parseDateString(value, label = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`Invalid ${label}`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw badRequest(`Invalid ${label}`);
  }
  return value;
}

function parseTimeString(value, label = 'time', { stepMinutes = 30 } = {}) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    throw badRequest(`Invalid ${label}`);
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    (stepMinutes && minutes % stepMinutes !== 0)
  ) {
    throw badRequest(`Invalid ${label}`);
  }
  return value;
}

function enumValue(value, allowed, label, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${label} is required`);
    return null;
  }
  if (!allowed.includes(value)) throw badRequest(`Invalid ${label}`);
  return value;
}

function enumArray(value, allowed, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${label} is required`);
    return [];
  }
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array`);
  const seen = new Set();
  for (const item of value) {
    if (!allowed.includes(item)) throw badRequest(`Invalid ${label} value`);
    seen.add(item);
  }
  return [...seen];
}

function booleanInt(value, label, { nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  throw badRequest(`${label} must be yes or no`);
}

function countInt(value, label) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw badRequest(`Invalid ${label}`);
  return n;
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  assertLocation,
  assertRequestLocation,
  booleanInt,
  countInt,
  enumArray,
  enumValue,
  hasOwn,
  normaliseString,
  parseDateString,
  parseId,
  parseJsonArray,
  parseTimeString,
};
