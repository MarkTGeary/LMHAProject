const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../lib/validation');

function assertBadRequest(fn, messageIncludes) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'BAD_REQUEST');
    if (messageIncludes) assert.match(err.message, messageIncludes);
    return true;
  });
}

function assertForbidden(fn, messageIncludes) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, 403);
    assert.equal(err.code, 'FORBIDDEN');
    if (messageIncludes) assert.match(err.message, messageIncludes);
    return true;
  });
}

describe('hasOwn', () => {
  test('true for own enumerable property', () => {
    assert.equal(hasOwn({ a: 1 }, 'a'), true);
  });

  test('false for missing property', () => {
    assert.equal(hasOwn({ a: 1 }, 'b'), false);
  });

  test('false for inherited prototype property', () => {
    assert.equal(hasOwn({ a: 1 }, 'toString'), false);
  });

  test('handles null/undefined object without throwing', () => {
    assert.equal(hasOwn(null, 'a'), false);
    assert.equal(hasOwn(undefined, 'a'), false);
  });

  test('handles falsy but present value', () => {
    assert.equal(hasOwn({ a: 0 }, 'a'), true);
    assert.equal(hasOwn({ a: null }, 'a'), true);
  });
});

describe('assertLocation', () => {
  test('accepts LMHA', () => {
    assert.equal(assertLocation('LMHA'), 'LMHA');
  });

  test('accepts Solace Café', () => {
    assert.equal(assertLocation('Solace Café'), 'Solace Café');
  });

  test('rejects unknown location', () => {
    assertBadRequest(() => assertLocation('Nowhere'), /Invalid location/);
  });

  test('rejects empty string', () => {
    assertBadRequest(() => assertLocation(''));
  });

  test('rejects undefined', () => {
    assertBadRequest(() => assertLocation(undefined));
  });

  test('is case sensitive', () => {
    assertBadRequest(() => assertLocation('lmha'));
  });

  test('uses custom label in error message', () => {
    assertBadRequest(() => assertLocation('bad', 'target location'), /Invalid target location/);
  });
});

describe('assertRequestLocation', () => {
  test('returns current location when supplied is undefined', () => {
    assert.equal(assertRequestLocation({ location: 'LMHA' }, undefined), 'LMHA');
  });

  test('returns current location when supplied is null', () => {
    assert.equal(assertRequestLocation({ location: 'LMHA' }, null), 'LMHA');
  });

  test('returns current location when supplied is empty string', () => {
    assert.equal(assertRequestLocation({ location: 'LMHA' }, ''), 'LMHA');
  });

  test('returns current location when supplied matches', () => {
    assert.equal(assertRequestLocation({ location: 'Solace Café' }, 'Solace Café'), 'Solace Café');
  });

  test('throws forbidden when supplied does not match current', () => {
    assertForbidden(() => assertRequestLocation({ location: 'LMHA' }, 'Solace Café'));
  });

  test('throws bad request when req.location itself is invalid', () => {
    assertBadRequest(() => assertRequestLocation({ location: 'Nowhere' }, undefined), /current location/);
  });

  test('throws bad request when req.location is missing entirely', () => {
    assertBadRequest(() => assertRequestLocation({}, undefined));
  });
});

describe('parseId', () => {
  test('parses a positive integer string', () => {
    assert.equal(parseId('42'), 42);
  });

  test('parses a positive integer number', () => {
    assert.equal(parseId(42), 42);
  });

  test('throws when required and missing (undefined)', () => {
    assertBadRequest(() => parseId(undefined), /id is required/);
  });

  test('throws when required and missing (null)', () => {
    assertBadRequest(() => parseId(null));
  });

  test('throws when required and missing (empty string)', () => {
    assertBadRequest(() => parseId(''));
  });

  test('returns null when not required and missing', () => {
    assert.equal(parseId(undefined, 'id', { required: false }), null);
    assert.equal(parseId(null, 'id', { required: false }), null);
    assert.equal(parseId('', 'id', { required: false }), null);
  });

  test('rejects zero', () => {
    assertBadRequest(() => parseId(0));
    assertBadRequest(() => parseId('0'));
  });

  test('rejects negative numbers', () => {
    assertBadRequest(() => parseId(-5));
  });

  test('rejects decimals', () => {
    assertBadRequest(() => parseId(1.5));
    assertBadRequest(() => parseId('1.5'));
  });

  test('rejects non-numeric strings', () => {
    assertBadRequest(() => parseId('abc'));
  });

  test('rejects NaN/Infinity', () => {
    assertBadRequest(() => parseId(NaN));
    assertBadRequest(() => parseId(Infinity));
  });

  test('uses custom label in error message', () => {
    assertBadRequest(() => parseId('bad', 'booking_id'), /Invalid booking_id/);
    assertBadRequest(() => parseId(undefined, 'booking_id'), /booking_id is required/);
  });
});

describe('normaliseString', () => {
  test('returns null for undefined when not required', () => {
    assert.equal(normaliseString(undefined, 'name'), null);
  });

  test('returns null for null when not required', () => {
    assert.equal(normaliseString(null, 'name'), null);
  });

  test('throws when required and undefined', () => {
    assertBadRequest(() => normaliseString(undefined, 'name', { required: true }), /name is required/);
  });

  test('throws when required and null', () => {
    assertBadRequest(() => normaliseString(null, 'name', { required: true }));
  });

  test('throws when value is not a string', () => {
    assertBadRequest(() => normaliseString(42, 'name'), /must be text/);
    assertBadRequest(() => normaliseString({}, 'name'));
    assertBadRequest(() => normaliseString(['a'], 'name'));
  });

  test('trims whitespace by default', () => {
    assert.equal(normaliseString('  hello  ', 'name'), 'hello');
  });

  test('does not trim when trim: false', () => {
    assert.equal(normaliseString('  hello  ', 'name', { trim: false }), '  hello  ');
  });

  test('throws when required and value is only whitespace (trimmed to empty)', () => {
    assertBadRequest(() => normaliseString('   ', 'name', { required: true }));
  });

  test('returns null when optional and value is only whitespace', () => {
    assert.equal(normaliseString('   ', 'name'), null);
  });

  test('returns null for empty string input when not required', () => {
    assert.equal(normaliseString('', 'name'), null);
  });

  test('throws when value exceeds max length', () => {
    assertBadRequest(() => normaliseString('a'.repeat(10), 'name', { max: 5 }), /too long/);
  });

  test('accepts value exactly at max length', () => {
    assert.equal(normaliseString('a'.repeat(5), 'name', { max: 5 }), 'a'.repeat(5));
  });

  test('default max is 5000', () => {
    assert.equal(normaliseString('a'.repeat(5000), 'name'), 'a'.repeat(5000));
    assertBadRequest(() => normaliseString('a'.repeat(5001), 'name'));
  });
});

describe('parseDateString', () => {
  test('accepts a valid date', () => {
    assert.equal(parseDateString('2026-07-17'), '2026-07-17');
  });

  test('accepts a valid leap-year Feb 29', () => {
    assert.equal(parseDateString('2024-02-29'), '2024-02-29');
  });

  test('rejects Feb 29 on a non-leap year', () => {
    assertBadRequest(() => parseDateString('2025-02-29'));
  });

  test('rejects wrong format (slashes)', () => {
    assertBadRequest(() => parseDateString('2026/07/17'));
  });

  test('rejects missing leading zeros', () => {
    assertBadRequest(() => parseDateString('2026-7-17'));
  });

  test('rejects non-string input', () => {
    assertBadRequest(() => parseDateString(20260717));
    assertBadRequest(() => parseDateString(null));
    assertBadRequest(() => parseDateString(undefined));
  });

  test('rejects out-of-range month', () => {
    assertBadRequest(() => parseDateString('2026-13-01'));
    assertBadRequest(() => parseDateString('2026-00-01'));
  });

  test('rejects out-of-range day', () => {
    assertBadRequest(() => parseDateString('2026-04-31'));
    assertBadRequest(() => parseDateString('2026-01-32'));
    assertBadRequest(() => parseDateString('2026-01-00'));
  });

  test('uses custom label in error message', () => {
    assertBadRequest(() => parseDateString('bad', 'signed_date'), /Invalid signed_date/);
  });
});

describe('parseTimeString', () => {
  test('accepts a valid time', () => {
    assert.equal(parseTimeString('14:30'), '14:30');
  });

  test('accepts midnight and end-of-day boundary', () => {
    assert.equal(parseTimeString('00:00'), '00:00');
    assert.equal(parseTimeString('23:59'), '23:59');
  });

  test('rejects wrong format', () => {
    assertBadRequest(() => parseTimeString('2:30'));
    assertBadRequest(() => parseTimeString('14-30'));
    assertBadRequest(() => parseTimeString('14:3'));
  });

  test('rejects non-string input', () => {
    assertBadRequest(() => parseTimeString(1430));
    assertBadRequest(() => parseTimeString(null));
  });

  test('rejects hour out of range', () => {
    assertBadRequest(() => parseTimeString('24:00'));
    assertBadRequest(() => parseTimeString('25:00'));
  });

  test('rejects minute out of range', () => {
    assertBadRequest(() => parseTimeString('12:60'));
  });

  test('default stepMinutes is 1 (any minute allowed)', () => {
    assert.equal(parseTimeString('12:17'), '12:17');
  });

  test('enforces stepMinutes when provided', () => {
    assert.equal(parseTimeString('12:30', 'time', { stepMinutes: 30 }), '12:30');
    assertBadRequest(() => parseTimeString('12:15', 'time', { stepMinutes: 30 }));
  });

  test('stepMinutes: 0 disables the step check', () => {
    assert.equal(parseTimeString('12:17', 'time', { stepMinutes: 0 }), '12:17');
  });

  test('uses custom label in error message', () => {
    assertBadRequest(() => parseTimeString('bad', 'time_in'), /Invalid time_in/);
  });
});

describe('enumValue', () => {
  const allowed = ['New', 'Repeat'];

  test('accepts an allowed value', () => {
    assert.equal(enumValue('New', allowed, 'new_or_repeat'), 'New');
  });

  test('throws for a disallowed value', () => {
    assertBadRequest(() => enumValue('Other', allowed, 'new_or_repeat'), /Invalid new_or_repeat/);
  });

  test('throws when required and missing', () => {
    assertBadRequest(() => enumValue(undefined, allowed, 'new_or_repeat'), /is required/);
    assertBadRequest(() => enumValue(null, allowed, 'new_or_repeat'));
    assertBadRequest(() => enumValue('', allowed, 'new_or_repeat'));
  });

  test('returns null when not required and missing', () => {
    assert.equal(enumValue(undefined, allowed, 'new_or_repeat', { required: false }), null);
    assert.equal(enumValue(null, allowed, 'new_or_repeat', { required: false }), null);
    assert.equal(enumValue('', allowed, 'new_or_repeat', { required: false }), null);
  });

  test('is case sensitive', () => {
    assertBadRequest(() => enumValue('new', allowed, 'new_or_repeat'));
  });
});

describe('enumArray', () => {
  const allowed = ['SS', 'SP', 'PS', 'C', 'O'];

  test('accepts an array of allowed values', () => {
    assert.deepEqual(enumArray(['SS', 'PS'], allowed, 'type_of_support'), ['SS', 'PS']);
  });

  test('dedupes repeated values while preserving first-seen order', () => {
    assert.deepEqual(enumArray(['SS', 'PS', 'SS'], allowed, 'type_of_support'), ['SS', 'PS']);
  });

  test('returns empty array when not required and missing', () => {
    assert.deepEqual(enumArray(undefined, allowed, 'type_of_support'), []);
    assert.deepEqual(enumArray(null, allowed, 'type_of_support'), []);
    assert.deepEqual(enumArray('', allowed, 'type_of_support'), []);
  });

  test('throws when required and missing', () => {
    assertBadRequest(() => enumArray(undefined, allowed, 'type_of_support', { required: true }), /is required/);
  });

  test('an empty array does not count as "missing" even when required', () => {
    assert.deepEqual(enumArray([], allowed, 'type_of_support', { required: true }), []);
  });

  test('throws when value is not an array', () => {
    assertBadRequest(() => enumArray('SS', allowed, 'type_of_support'), /must be an array/);
    assertBadRequest(() => enumArray({ 0: 'SS' }, allowed, 'type_of_support'));
  });

  test('throws when array contains a disallowed value', () => {
    assertBadRequest(() => enumArray(['SS', 'ZZ'], allowed, 'type_of_support'), /Invalid type_of_support value/);
  });

  test('accepts an empty array when not required', () => {
    assert.deepEqual(enumArray([], allowed, 'type_of_support'), []);
  });
});

describe('booleanInt', () => {
  test('returns undefined for undefined input', () => {
    assert.equal(booleanInt(undefined, 'carer_attended'), undefined);
  });

  test('returns null for null input when nullable', () => {
    assert.equal(booleanInt(null, 'carer_attended', { nullable: true }), null);
  });

  test('throws for null input when not nullable', () => {
    assertBadRequest(() => booleanInt(null, 'carer_attended'));
  });

  test('maps truthy representations to 1', () => {
    assert.equal(booleanInt(true, 'x'), 1);
    assert.equal(booleanInt(1, 'x'), 1);
    assert.equal(booleanInt('1', 'x'), 1);
  });

  test('maps falsy representations to 0', () => {
    assert.equal(booleanInt(false, 'x'), 0);
    assert.equal(booleanInt(0, 'x'), 0);
    assert.equal(booleanInt('0', 'x'), 0);
  });

  test('throws for other values', () => {
    assertBadRequest(() => booleanInt('yes', 'carer_attended'), /must be yes or no/);
    assertBadRequest(() => booleanInt(2, 'carer_attended'));
    assertBadRequest(() => booleanInt('true', 'carer_attended'));
  });
});

describe('countInt', () => {
  test('returns 0 for undefined/null/empty string', () => {
    assert.equal(countInt(undefined, 'count'), 0);
    assert.equal(countInt(null, 'count'), 0);
    assert.equal(countInt('', 'count'), 0);
  });

  test('parses a valid positive integer', () => {
    assert.equal(countInt(5, 'count'), 5);
    assert.equal(countInt('5', 'count'), 5);
  });

  test('accepts zero', () => {
    assert.equal(countInt(0, 'count'), 0);
  });

  test('accepts the upper boundary of 100000', () => {
    assert.equal(countInt(100000, 'count'), 100000);
  });

  test('rejects values above 100000', () => {
    assertBadRequest(() => countInt(100001, 'count'), /Invalid count/);
  });

  test('rejects negative numbers', () => {
    assertBadRequest(() => countInt(-1, 'count'));
  });

  test('rejects decimals', () => {
    assertBadRequest(() => countInt(1.5, 'count'));
  });

  test('rejects non-numeric strings', () => {
    assertBadRequest(() => countInt('abc', 'count'));
  });
});

describe('parseJsonArray', () => {
  test('returns [] for falsy values', () => {
    assert.deepEqual(parseJsonArray(null), []);
    assert.deepEqual(parseJsonArray(undefined), []);
    assert.deepEqual(parseJsonArray(''), []);
    assert.deepEqual(parseJsonArray(0), []);
  });

  test('returns the array unchanged when already an array', () => {
    const arr = ['a', 'b'];
    assert.equal(parseJsonArray(arr), arr);
  });

  test('parses a JSON array string', () => {
    assert.deepEqual(parseJsonArray('["a","b"]'), ['a', 'b']);
  });

  test('returns [] when parsed JSON is not an array', () => {
    assert.deepEqual(parseJsonArray('{"a":1}'), []);
    assert.deepEqual(parseJsonArray('"just a string"'), []);
    assert.deepEqual(parseJsonArray('42'), []);
  });

  test('returns [] for invalid JSON rather than throwing', () => {
    assert.deepEqual(parseJsonArray('not json'), []);
    assert.deepEqual(parseJsonArray('[1,2,'), []);
  });
});
