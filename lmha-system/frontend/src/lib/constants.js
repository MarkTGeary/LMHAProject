export const LOCATION_RULES = {
  'LMHA':        { days: [1, 2, 3, 4, 5], label: 'Mon–Fri', startHour: 11, endHour: 17, standardSlots: ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] },
  'Solace Café': {
    days: [4, 5, 6, 0], label: 'Thu–Sun', startHour: 18, endHour: 24,
    standardSlots: ['18:00', '19:00', '21:00', '23:00'],
    maxSessionsPerNight: 5,
    breakPeriods: [
      { start: '20:00', end: '20:30' },
      { start: '22:30', end: '23:00' },
    ],
  },
}

export const LOCK_DAYS = 21

// A booking is locked for editing when it is in the past — unless the current
// user is an admin. Admins can edit any booking (past or beyond 3 weeks).
export function isBookingLocked(dateStr, isAdmin) {
  if (isAdmin) return false
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + 'T12:00:00') < today
}

export const LOCK_MESSAGE = 'This booking is in the past. Only an admin can edit past bookings.'
