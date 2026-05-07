const LOCATION_RULES = {
  'LMHA': {
    days: [1, 2, 3, 4, 5],
    startHour: 11,
    endHour: 17,
  },
  'Solace Café': {
    days: [4, 5, 6, 0],
    startHour: 18,
    endHour: 24,
    // 50-min slots on the hour; 20:00–20:30 and 22:30–23:00 are staff breaks
    standardSlots: ['18:00', '19:00', '21:00', '23:00'],
    breakPeriods: [
      { start: '20:00', end: '20:30' },
      { start: '22:30', end: '23:00' },
    ],
    maxSessionsPerNight: 5,
  },
};

const LOCK_DAYS = 21;

module.exports = { LOCATION_RULES, LOCK_DAYS };
