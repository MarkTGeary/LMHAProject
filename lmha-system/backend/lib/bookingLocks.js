const { conflict } = require('./errors');
const { parseTimeString } = require('./validation');

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  parseTimeString(time, 'time', { stepMinutes: 1 });
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function slotsForBooking(time) {
  const start = timeToMinutes(time);
  return Array.from({ length: 60 }, (_, i) => minutesToTime(start + i));
}

function isLockConflict(err) {
  const message = err?.message || '';
  return message.includes('booking_slot_locks') ||
    message.includes('UNIQUE') ||
    message.includes('SQLITE_CONSTRAINT_UNIQUE') ||
    message.includes('SQLITE_CONSTRAINT');
}

function toLockConflict(err) {
  if (!isLockConflict(err)) return err;
  return conflict('Conflicts with an existing booking within 60 minutes');
}

module.exports = {
  slotsForBooking,
  timeToMinutes,
  toLockConflict,
};
