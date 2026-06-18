const LOCATION_RULES = {
  'LMHA': {
    days: [1, 2, 3, 4, 5],
    startHour: 11,
    endHour: 17,
    // On the hour, 11:00–16:00, no daytime break
    standardSlots: ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  },
  'Solace Café': {
    days: [4, 5, 6, 0],
    startHour: 18,
    endHour: 24,
    // 50-min slots; 20:00–20:30 and 22:30–23:00 are staff breaks, so slots
    // resume on the half hour after the first break (20:30, 21:30) then 23:00.
    standardSlots: ['18:00', '19:00', '20:30', '21:30', '23:00'],
    breakPeriods: [
      { start: '20:00', end: '20:30' },
      { start: '22:30', end: '23:00' },
    ],
    maxSessionsPerNight: 5,
  },
};

const LOCK_DAYS = 21;

module.exports = { LOCATION_RULES, LOCK_DAYS };
