import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import BookingCard from '../components/BookingCard'
import { apiUrl } from '../lib/api'

export default function ActiveCases() {
  const { location } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'Active',
    period: 'all',
    intakeStatus: 'all',
    search: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('location', location)

    if (filters.status) params.set('status', filters.status)
    if (filters.period === 'today') params.set('today', '1')
    else if (filters.period === 'week') params.set('this_week', '1')
    if (filters.intakeStatus !== 'all') params.set('intake_status', filters.intakeStatus)
    if (filters.search.trim()) params.set('search', filters.search.trim())

    fetch(apiUrl(`/api/bookings?${params}`), { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [location, filters])

  useEffect(() => { load() }, [load])

  const setFilter = (key, value) => setFilters(f => ({
    ...f,
    [key]: value,
    ...(key === 'status' ? { search: '' } : {}),
  }))

  return (
    <Layout title="Active Cases">
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="card p-4 flex flex-col md:flex-row md:gap-6 md:items-center md:flex-wrap gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-600">Status:</span>
            {['Active', 'Closed', ''].map(s => (
              <button
                key={s}
                onClick={() => setFilter('status', s)}
                className={`btn-sm rounded-lg border-2 font-semibold transition-all ${
                  filters.status === s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-600">Period:</span>
            {[['all', 'All time'], ['today', 'Today'], ['week', 'This week']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter('period', v)}
                className={`btn-sm rounded-lg border-2 font-semibold transition-all ${
                  filters.period === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {filters.status !== 'Active' && (
            <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 min-w-[200px]">
              <input
                className="input py-2 min-h-[40px] text-sm"
                placeholder="Search name or phone…"
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
              {filters.search && (
                <button onClick={() => setFilter('search', '')} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-600">Intake:</span>
            {[['all', 'All'], ['missing', 'Missing'], ['complete', 'Complete']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter('intakeStatus', v)}
                className={`btn-sm rounded-lg border-2 font-semibold transition-all ${
                  filters.intakeStatus === v
                    ? (v === 'missing' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-blue-600 border-blue-600 text-white')
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="card text-center py-10">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-gray-500 text-lg">No bookings found</div>
            <Link to="/bookings/new" className="btn-primary mt-4 inline-flex">
              Create New Booking
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 font-medium">{bookings.length} record{bookings.length !== 1 ? 's' : ''}</div>
            {bookings.map(b => (
              <BookingCard key={b.id} booking={b} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
