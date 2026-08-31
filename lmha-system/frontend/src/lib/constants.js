export const LOCATION_RULES = {
  'LMHA':        { days: [1, 2, 3, 4, 5], label: 'Mon–Fri', startHour: 11, endHour: 17, standardSlots: ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] },
  'Solace Café': {
    days: [4, 5, 6, 0], label: 'Thu–Sun', startHour: 18, endHour: 24,
    standardSlots: ['18:00', '19:00', '20:30', '21:30', '23:00'],
    maxSessionsPerNight: 5,
    breakPeriods: [
      { start: '20:00', end: '20:30' },
      { start: '22:30', end: '23:00' },
    ],
  },
}

export const LOCK_DAYS = 21

export function formatLocation(location) {
  return location === 'Solace Café' ? 'Solace Cafe' : location
}

// A booking is locked for editing once it is more than a week old — unless the
// current user is an admin. Workers get a 7-day grace window so outcomes/intake
// can be written up after the fact (e.g. late-night Solace sessions). Admins can
// edit any booking.
export function isBookingLocked(dateStr, isAdmin) {
  if (isAdmin) return false
  if (!dateStr) return false
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 7)
  return new Date(dateStr + 'T12:00:00') < cutoff
}

export const LOCK_MESSAGE = 'This booking is more than a week old. Only an admin can edit it now.'
