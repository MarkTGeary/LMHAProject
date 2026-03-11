import { Link } from 'react-router-dom'

const OUTCOME_BADGE = {
  'Attended': 'badge-attended',
  'Did Not Attend': 'badge-dna',
  'Pending': 'badge-pending',
}

const INTERACTION_ICONS = {
  'Phone Call': '📞',
  'Walk-In': '🚶',
  'Crisis': '🚨',
  'Peer Support Booking': '🤝',
  'Email': '✉️',
  'Text': '💬',
  'Scheduled': '📅',
  'Off-the-cuff': '💬',
}

export default function BookingCard({ booking, onRefresh }) {
  const outcomeClass = OUTCOME_BADGE[booking.outcome] || 'badge-pending'

  const cancel = async () => {
    if (!confirm('Mark this booking as Cancelled? It will remain in the database.')) return
    await fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'Cancelled' }),
    })
    if (onRefresh) onRefresh()
  }

  return (
    <div className={`card ${booking.status === 'Closed' ? 'opacity-75' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{booking.full_name || '— No name —'}</div>
          {booking.phone && <div className="text-gray-500 text-sm">{booking.phone}</div>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={booking.location === 'LMHA' ? 'badge-lmha' : 'badge-solace'}>
            {booking.location}
          </span>
          <span className={`badge ${booking.status === 'Active' ? 'badge-active' : booking.status === 'Closed' ? 'badge-closed' : 'badge-dna'}`}>
            {booking.status}
          </span>
        </div>
      </div>

      {/* Date / time / type */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-sm bg-gray-100 rounded-lg px-3 py-1 font-medium">
          📅 {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
        <span className="text-sm bg-gray-100 rounded-lg px-3 py-1 font-medium">
          🕐 {booking.time_booked}
        </span>
        {booking.interaction_type && (
          <span className="text-sm bg-gray-100 rounded-lg px-3 py-1 font-medium">
            {INTERACTION_ICONS[booking.interaction_type] || '•'} {booking.interaction_type}
          </span>
        )}
        {booking.new_or_repeat && (
          <span className={`text-sm rounded-lg px-3 py-1 font-medium ${booking.new_or_repeat === 'New' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {booking.new_or_repeat}
          </span>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={outcomeClass}>
          {booking.outcome || 'Pending'}
        </span>
        {booking.intake_complete
          ? <span className="badge-intake-done">✓ Intake done</span>
          : <span className="badge-intake-missing">⚠ Intake missing</span>
        }
        {booking.carer_attended ? <span className="badge bg-indigo-100 text-indigo-700">Carer present</span> : null}
        {booking.time_in && <span className="badge bg-gray-100 text-gray-600">In: {booking.time_in}</span>}
        {booking.time_out && <span className="badge bg-gray-100 text-gray-600">Out: {booking.time_out}</span>}
      </div>

      {/* Action buttons */}
      {booking.status !== 'Cancelled' && (
        <div className="flex flex-wrap gap-2">
          <Link to={`/bookings/${booking.id}/edit`} className="btn-secondary btn-sm">
            ✏️ Edit
          </Link>
          {!booking.intake_complete && (
            <Link to={`/bookings/${booking.id}/intake`} className="btn-warning btn-sm">
              📝 Intake
            </Link>
          )}
          {booking.intake_complete && (
            <Link to={`/bookings/${booking.id}/intake`} className="btn-outline btn-sm">
              📝 View Intake
            </Link>
          )}
          {booking.status === 'Active' && (
            <Link to={`/bookings/${booking.id}/outcome`} className="btn-success btn-sm">
              ✅ Outcome
            </Link>
          )}
          {booking.status === 'Active' && (
            <button onClick={cancel} className="btn-outline btn-sm text-gray-500">
              ✕ Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
