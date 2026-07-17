const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { slotsForBooking, timeToMinutes, toLockConflict } = require('../lib/bookingLocks');

describe('timeToMinutes', () => {
  test('converts midnight to 0', () => {
    assert.equal(timeToMinutes('00:00'), 0);
  });

  test('converts a mid-day time', () => {
    assert.equal(timeToMinutes('11:00'), 660);
  });

  test('converts a time with non-zero minutes', () => {
    assert.equal(timeToMinutes('12:17'), 737);
  });

  test('converts the last minute of the day', () => {
    assert.equal(timeToMinutes('23:59'), 1439);
  });

  test('rejects an invalid time string', () => {
    assert.throws(() => timeToMinutes('25:00'), (err) => err.status === 400);
    assert.throws(() => timeToMinutes('bad'), (err) => err.status === 400);
  });
});

describe('slotsForBooking', () => {
  test('returns 60 one-minute slots', () => {
    const slots = slotsForBooking('11:00');
    assert.equal(slots.length, 60);
  });

  test('starts at the given time and increments by one minute', () => {
    const slots = slotsForBooking('11:00');
    assert.equal(slots[0], '11:00');
    assert.equal(slots[1], '11:01');
    assert.equal(slots[59], '11:59');
  });

  test('rolls over into the next hour', () => {
    const slots = slotsForBooking('11:30');
    assert.equal(slots[0], '11:30');
    assert.equal(slots[29], '11:59');
    assert.equal(slots[30], '12:00');
    assert.equal(slots[59], '12:29');
  });

  test('rolls over past midnight into the next day\'s hour numbering', () => {
    const slots = slotsForBooking('23:45');
    assert.equal(slots[0], '23:45');
    assert.equal(slots[14], '23:59');
    // minutesToTime does not wrap hours back to 0, so this reflects raw minute math
    assert.equal(slots[15], '24:00');
  });

  test('every slot is zero-padded HH:MM', () => {
    const slots = slotsForBooking('09:05');
    for (const slot of slots) {
      assert.match(slot, /^\d{2}:\d{2}$/);
    }
  });

  test('two bookings 60 minutes apart share no overlapping slots', () => {
    const a = new Set(slotsForBooking('11:00'));
    const b = slotsForBooking('12:00');
    assert.equal(b.some(slot => a.has(slot)), false);
  });

  test('two bookings 59 minutes apart overlap by exactly one slot', () => {
    const a = new Set(slotsForBooking('11:00'));
    const b = slotsForBooking('11:59');
    const overlap = b.filter(slot => a.has(slot));
    assert.equal(overlap.length, 1);
    assert.equal(overlap[0], '11:59');
  });

  test('identical start times fully overlap', () => {
    const a = new Set(slotsForBooking('14:00'));
    const b = slotsForBooking('14:00');
    assert.equal(b.every(slot => a.has(slot)), true);
  });
});

describe('toLockConflict', () => {
  test('converts a booking_slot_locks constraint error to a 409 conflict', () => {
    const original = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: booking_slot_locks.slot');
    const converted = toLockConflict(original);
    assert.equal(converted.status, 409);
    assert.equal(converted.code, 'CONFLICT');
    assert.match(converted.message, /Conflicts with an existing booking/);
  });

  test('converts a generic UNIQUE constraint error', () => {
    const original = new Error('UNIQUE constraint failed: x.y');
    const converted = toLockConflict(original);
    assert.equal(converted.status, 409);
  });

  test('converts a SQLITE_CONSTRAINT_UNIQUE error', () => {
    const original = new Error('SQLITE_CONSTRAINT_UNIQUE: some detail');
    const converted = toLockConflict(original);
    assert.equal(converted.status, 409);
  });

  test('passes through unrelated errors unchanged', () => {
    const original = new Error('some other failure');
    const converted = toLockConflict(original);
    assert.equal(converted, original);
  });

  test('passes through errors with no message unchanged', () => {
    const original = new Error();
    const converted = toLockConflict(original);
    assert.equal(converted, original);
  });

  test('handles null/undefined gracefully by returning the input', () => {
    assert.equal(toLockConflict(null), null);
    assert.equal(toLockConflict(undefined), undefined);
  });

  test('handles an error-like object without a message property', () => {
    const original = { code: 'X' };
    const converted = toLockConflict(original);
    assert.equal(converted, original);
  });
});
