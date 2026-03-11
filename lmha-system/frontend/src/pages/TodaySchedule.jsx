import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'

const LOCATION_HOURS = {
  'LMHA':        { start: 11, end: 17, days: [1, 2, 3, 4, 5] },
  'Solace Café': { start: 18, end: 24, days: [4, 5, 6, 0] },
}
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function getMondayOf(d) {
  const c = new Date(d)
  const day = c.getDay()
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1))
  c.setHours(0, 0, 0, 0)
  return c
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getColor(b) {
  if (b.status === 'Cancelled') return 'bg-red-200 border-red-300 text-red-800'
  if (b.status === 'Closed')    return 'bg-gray-300 border-gray-400 text-gray-700'
  if (!b.intake_complete)       return 'bg-orange-400 border-orange-500 text-white'
  return 'bg-blue-500 border-blue-600 text-white'
}

export default function WeeklySchedule() {
  const { location } = useAuth()
  const hours = LOCATION_HOURS[location] || LOCATION_HOURS['LMHA']
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
  const [bookings, setBookings]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)

  const visibleDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  }).filter(d => hours.days.includes(d.getDay()))

  useEffect(() => {
    setLoading(true)
    const start = fmt(weekStart)
    const end   = fmt(new Date(weekStart.getTime() + 6 * 86400000))
    fetch(
      '/api/bookings?location=' + encodeURIComponent(location) + '&start_date=' + start + '&end_date=' + end,
      { credentials: 'include' }
    )
      .then(r => r.json())
      .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [weekStart, location])

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(getMondayOf(d)) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(getMondayOf(d)) }
  const goToday  = () => { setWeekStart(getMondayOf(new Date())); setSelected(null) }
  const todayStr = fmt(new Date())

  const byDate = {}
  bookings.forEach(b => {
    if (!byDate[b.date]) byDate[b.date] = []
    byDate[b.date].push(b)
  })

  const ROW_PX    = 68
  const hourCount = hours.end - hours.start
  const GRID_H    = hourCount * ROW_PX
  const startMins = hours.start * 60
  const totalMins = hourCount * 60

  const hourLabels = Array.from({ length: hourCount + 1 }, (_, i) => {
    const h = hours.start + i
    return h >= 24 ? '00:00' : String(h).padStart(2, '0') + ':00'
  })

  const nowPct = (() => {
    const now = new Date()
    if (fmt(now) !== todayStr) return null
    const nm = now.getHours() * 60 + now.getMinutes()
    if (nm < startMins || nm > startMins + totalMins) return null
    return ((nm - startMins) / totalMins) * 100
  })()

  const weekLabel = visibleDays.length > 0 ? (() => {
    const s = visibleDays[0]
    const e = visibleDays[visibleDays.length - 1]
    return s.getDate() + ' ' + s.toLocaleString('en-IE', { month: 'short' }) +
      ' to ' + e.getDate() + ' ' + e.toLocaleString('en-IE', { month: 'short', year: 'numeric' })
  })() : ''

  return (
    <Layout title="Weekly Schedule">
      <div className="space-y-4 pb-10">

        <div className="card p-3 flex items-center gap-3">
          <button onClick={prevWeek} className="btn-secondary btn-sm px-4">Prev</button>
          <div className="flex-1 text-center font-bold">{weekLabel}</div>
          <button onClick={nextWeek} className="btn-secondary btn-sm px-4">Next</button>
          <button onClick={goToday} className="btn-primary btn-sm">Today</button>
        </div>

        <div className="flex flex-wrap gap-3 text-sm px-1">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> No intake</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Closed</span>
        </div>

        {loading ? (
          <div className="card py-16 text-center text-gray-500 text-lg">Loading...</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: (visibleDays.length * 130 + 52) + 'px' }}>

                <div className="flex border-b-2 border-gray-200 bg-gray-50">
                  <div className="shrink-0 border-r border-gray-200" style={{ width: 52 }} />
                  {visibleDays.map(d => {
                    const ds = fmt(d)
                    const isToday = ds === todayStr
                    const count = (byDate[ds] || []).length
                    return (
                      <div key={ds} className={'flex-1 text-center py-2 px-1 border-l border-gray-200' + (isToday ? ' bg-blue-50' : '')}>
                        <div className={'text-xs font-bold uppercase tracking-widest ' + (isToday ? 'text-blue-600' : 'text-gray-400')}>
                          {DAY_NAMES[d.getDay()]}
                        </div>
                        <div className={'text-2xl font-bold ' + (isToday ? 'text-blue-700' : 'text-gray-800')}>
                          {d.getDate()}
                        </div>
                        <div className={'text-xs mt-0.5 ' + (count > 0 ? 'text-blue-600 font-semibold' : 'text-gray-300')}>
                          {count > 0 ? count + ' booked' : 'free'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex" style={{ height: GRID_H }}>
                  <div className="shrink-0 relative border-r border-gray-200" style={{ width: 52 }}>
                    {hourLabels.map((label, i) => (
                      <div key={label} className="absolute w-full" style={{ top: i * ROW_PX - 9 }}>
                        <span className="block text-right pr-2 text-xs text-gray-400">{label}</span>
                      </div>
                    ))}
                  </div>

                  {visibleDays.map(d => {
                    const ds = fmt(d)
                    const isToday = ds === todayStr
                    const dayBookings = byDate[ds] || []
                    return (
                      <div key={ds}
                        className={'flex-1 relative border-l border-gray-200' + (isToday ? ' bg-blue-50/30' : '')}
                        style={{ height: GRID_H }}
                      >
                        {hourLabels.map((_, i) => (
                          <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: i * ROW_PX }} />
                        ))}

                        {isToday && nowPct !== null && (
                          <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowPct + '%' }}>
                            <div className="border-t-2 border-red-500 relative">
                              <span className="absolute -top-2 left-0 text-xs text-red-500 font-bold bg-white px-1 rounded shadow">NOW</span>
                            </div>
                          </div>
                        )}

                        {dayBookings.map(b => {
                          const topPx = ((timeToMins(b.time_booked) - startMins) / 60) * ROW_PX + 2
                          const isSel = selected && selected.id === b.id
                          return (
                            <button key={b.id}
                              onClick={() => setSelected(isSel ? null : b)}
                              className={'absolute inset-x-1 rounded-lg border text-left px-2 py-1 overflow-hidden hover:brightness-90 z-10 ' + getColor(b) + (isSel ? ' ring-2 ring-yellow-300 ring-offset-1' : '')}
                              style={{ top: topPx, height: ROW_PX - 4 }}
                            >
                              <div className="font-bold text-xs leading-tight truncate">{b.full_name || 'Unknown'}</div>
                              <div className="text-xs opacity-80">{b.time_booked}</div>
                              {!b.intake_complete && b.status === 'Active' && (
                                <div className="text-xs font-bold">no intake</div>
                              )}
                            </button>
                          )
                        })}

                        {dayBookings.length === 0 && (
                          <Link to="/bookings/new"
                            className="absolute inset-0 flex items-center justify-center text-gray-200 hover:text-blue-300 hover:bg-blue-50 transition-colors text-3xl">
                            +
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="card border-2 border-blue-300 bg-blue-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-bold text-xl">{selected.full_name || 'Unknown'}</div>
                <div className="text-gray-600 mt-0.5">
                  {DAY_FULL[new Date(selected.date + 'T12:00:00').getDay()]}{' '}
                  {new Date(selected.date + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}
                  {' at '}<strong>{selected.time_booked}</strong>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{selected.interaction_type} · {selected.new_or_repeat}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-3xl text-gray-400 hover:text-gray-700">x</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={'badge ' + (selected.status === 'Active' ? 'badge-active' : 'badge-closed')}>{selected.status}</span>
              <span className={'badge ' + (selected.outcome === 'Attended' ? 'badge-attended' : selected.outcome === 'Did Not Attend' ? 'badge-dna' : 'badge-pending')}>
                {selected.outcome || 'Pending'}
              </span>
              {selected.intake_complete
                ? <span className="badge-intake-done">Intake done</span>
                : <span className="badge-intake-missing">Intake missing</span>
              }
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={'/bookings/' + selected.id + '/edit'} className="btn-secondary btn-sm">Edit</Link>
              {!selected.intake_complete
                ? <Link to={'/bookings/' + selected.id + '/intake'} className="btn-warning btn-sm">Complete Intake</Link>
                : <Link to={'/bookings/' + selected.id + '/intake'} className="btn-outline btn-sm">View Intake</Link>
              }
              {selected.status === 'Active' && (
                <Link to={'/bookings/' + selected.id + '/outcome'} className="btn-success btn-sm">Record Outcome</Link>
              )}
            </div>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-lg">Week summary ({bookings.length} bookings)</h3>
            {visibleDays.map(d => {
              const ds = fmt(d)
              const dayBookings = byDate[ds] || []
              if (!dayBookings.length) return null
              return (
                <div key={ds}>
                  <div className={'text-sm font-bold mb-1.5 ' + (ds === todayStr ? 'text-blue-600' : 'text-gray-600')}>
                    {DAY_FULL[d.getDay()]} {d.getDate()}{ds === todayStr ? ' - Today' : ''}
                  </div>
                  <div className="space-y-2">
                    {dayBookings.map(b => (
                      <div key={b.id} className="card p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{b.full_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{b.time_booked} · {b.interaction_type}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {!b.intake_complete && b.status === 'Active' && (
                            <Link to={'/bookings/' + b.id + '/intake'} className="btn-warning btn-sm">Intake</Link>
                          )}
                          <Link to={'/bookings/' + b.id + '/outcome'} className="btn-success btn-sm">Outcome</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="card text-center py-10">
            <div className="text-gray-500 text-lg">No bookings this week</div>
            <Link to="/bookings/new" className="btn-primary mt-4 inline-flex">New Booking</Link>
          </div>
        )}

      </div>
    </Layout>
  )
}
