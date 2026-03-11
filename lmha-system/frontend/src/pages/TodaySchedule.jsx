import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'

const LOCATION_HOURS = {
  'LMHA': { start: 11, end: 17 },
  'Solace Café': { start: 18, end: 24 },
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function TodaySchedule() {
  const { location } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/bookings/schedule?date=${selectedDate}&location=${encodeURIComponent(location)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedDate, location])

  const hours = LOCATION_HOURS[location] || { start: 9, end: 18 }
  const totalMins = (hours.end - hours.start) * 60
  const startMins = hours.start * 60

  const BOOKING_COLORS = {
    Active: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
    Closed: { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-500' },
    Cancelled: { bg: 'bg-red-300', text: 'text-white', border: 'border-red-400' },
  }

  const getColor = (b) => {
    if (!b.intake_complete && b.status === 'Active') return { bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' }
    return BOOKING_COLORS[b.status] || BOOKING_COLORS.Active
  }

  return (
    <Layout title="Today's Schedule">
      <div className="space-y-5">
        {/* Date picker */}
        <div className="card p-4 flex gap-3 items-center">
          <label className="label mb-0">Date:</label>
          <input
            type="date"
            className="input flex-1"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="btn-secondary btn-sm"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> No Intake</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Closed</span>
        </div>

        {/* Timeline */}
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="relative" style={{ minHeight: `${(hours.end - hours.start) * 60}px` }}>
              {/* Hour gridlines */}
              {Array.from({ length: hours.end - hours.start + 1 }, (_, i) => i + hours.start).map(h => {
                const top = ((h - hours.start) / (hours.end - hours.start)) * 100
                return (
                  <div
                    key={h}
                    className="absolute w-full flex items-center"
                    style={{ top: `${((h * 60 - startMins) / totalMins) * 100}%` }}
                  >
                    <span className="text-xs text-gray-400 w-12 shrink-0 pr-2 text-right">
                      {h === 24 ? '00:00' : `${h.toString().padStart(2, '0')}:00`}
                    </span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                )
              })}

              {/* Current time indicator */}
              {selectedDate === new Date().toISOString().slice(0, 10) && (() => {
                const now = new Date()
                const nowMins = now.getHours() * 60 + now.getMinutes()
                if (nowMins >= startMins && nowMins <= startMins + totalMins) {
                  const pct = ((nowMins - startMins) / totalMins) * 100
                  return (
                    <div className="absolute w-full flex items-center z-20 pointer-events-none"
                      style={{ top: `${pct}%` }}>
                      <span className="w-12 text-right pr-2 text-xs text-red-500 font-bold">NOW</span>
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  )
                }
              })()}

              {/* Booking blocks */}
              <div className="ml-12 relative">
                {bookings.map(b => {
                  const bMins = timeToMins(b.time_booked)
                  const topPct = ((bMins - startMins) / totalMins) * 100
                  const heightPct = (60 / totalMins) * 100 // 1-hour slots
                  const c = getColor(b)
                  return (
                    <Link
                      key={b.id}
                      to={`/bookings/${b.id}/outcome`}
                      className={`absolute left-0 right-2 rounded-xl border-2 p-2 ${c.bg} ${c.text} ${c.border} overflow-hidden hover:opacity-90 transition-opacity`}
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        minHeight: '40px',
                      }}
                    >
                      <div className="font-bold text-sm truncate">{b.full_name || '—'}</div>
                      <div className="text-xs opacity-90">{b.time_booked} • {b.interaction_type}</div>
                      {!b.intake_complete && <div className="text-xs font-bold">⚠ No intake</div>}
                    </Link>
                  )
                })}

                {bookings.length === 0 && (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                    <div className="text-center">
                      <div className="text-3xl mb-2">📭</div>
                      <div>No bookings for this day</div>
                      <Link to="/bookings/new" className="btn-primary btn-sm mt-3 inline-flex">
                        New Booking
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Booking list below timeline */}
        {bookings.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-gray-700">All bookings ({bookings.length})</h3>
            {bookings.map(b => (
              <div key={b.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{b.full_name || '—'}</div>
                  <div className="text-sm text-gray-500">{b.time_booked} • {b.interaction_type}</div>
                </div>
                <div className="flex gap-2">
                  {!b.intake_complete && (
                    <Link to={`/bookings/${b.id}/intake`} className="btn-warning btn-sm">Intake</Link>
                  )}
                  <Link to={`/bookings/${b.id}/outcome`} className="btn-success btn-sm">Outcome</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
