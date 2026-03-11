import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { location } = useAuth()
  const [stats, setStats] = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    // Load today's quick stats
    Promise.all([
      fetch(`/api/bookings?status=Active&location=${encodeURIComponent(location)}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/bookings?today=1&location=${encodeURIComponent(location)}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([active, todayBookings]) => {
      setStats({
        active: active.length,
        todayTotal: todayBookings.length,
        todayAttended: todayBookings.filter(b => b.outcome === 'Attended').length,
        intakeMissing: active.filter(b => !b.intake_complete).length,
      })
    }).catch(() => {})
  }, [location])

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className={`rounded-3xl p-6 text-white ${location === 'LMHA' ? 'bg-blue-600' : 'bg-purple-600'}`}>
          <div className="text-sm font-medium opacity-80 mb-1">
            {new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h2 className="text-3xl font-bold">{location}</h2>
          <p className="opacity-80 mt-1">Case Management System</p>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card text-center">
              <div className="text-4xl font-bold text-blue-600">{stats.active}</div>
              <div className="text-sm text-gray-500 mt-1">Active Cases</div>
            </div>
            <div className="card text-center">
              <div className="text-4xl font-bold text-green-600">{stats.todayTotal}</div>
              <div className="text-sm text-gray-500 mt-1">Today's Bookings</div>
            </div>
            <div className="card text-center">
              <div className={`text-4xl font-bold ${stats.intakeMissing > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {stats.intakeMissing}
              </div>
              <div className="text-sm text-gray-500 mt-1">Intake Missing</div>
            </div>
            <div className="card text-center">
              <div className="text-4xl font-bold text-purple-600">{stats.todayAttended}</div>
              <div className="text-sm text-gray-500 mt-1">Attended Today</div>
            </div>
          </div>
        )}

        {/* Main action buttons */}
        <div className="space-y-3">
          <Link to="/bookings/new" className="btn btn-primary btn-lg w-full text-xl">
            <span className="mr-3 text-2xl">➕</span>
            New Booking
          </Link>
          <Link to="/cases" className="btn btn-secondary btn-lg w-full text-xl">
            <span className="mr-3 text-2xl">📋</span>
            Active Cases
            {stats?.intakeMissing > 0 && (
              <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">
                {stats.intakeMissing} missing intake
              </span>
            )}
          </Link>
          <Link to="/schedule" className="btn btn-secondary btn-lg w-full text-xl">
            <span className="mr-3 text-2xl">📅</span>
            Today's Schedule
          </Link>
          <Link to="/metrics" className="btn btn-secondary btn-lg w-full text-xl">
            <span className="mr-3 text-2xl">📊</span>
            Submit Metrics
          </Link>
        </div>
      </div>
    </Layout>
  )
}
