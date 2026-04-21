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
  },
};

const LOCK_DAYS = 21;

module.exports = { LOCATION_RULES, LOCK_DAYS };
