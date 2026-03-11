import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Layout({ children, title, back }) {
  const { user, location, logout, setLocation } = useAuth()
  const nav = useNavigate()
  const path = useLocation().pathname

  const switchLocation = () => {
    setLocation(null)
    fetch('/auth/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ location: '' }),
    }).catch(() => {})
    nav('/location')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          {back ? (
            <button
              onClick={() => nav(back)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">LMHA</span>
            </Link>
          )}

          <div className="flex-1">
            {title && <h1 className="text-lg font-bold text-gray-800 truncate">{title}</h1>}
          </div>

          <button
            onClick={switchLocation}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold text-white transition-colors ${
              location === 'LMHA' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {location}
          </button>

          <div className="relative group">
            <button className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-gray-100">
              {user?.picture
                ? <img src={user.picture} className="w-8 h-8 rounded-full" alt="" />
                : <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                    {user?.name?.[0] || '?'}
                  </div>
              }
            </button>
            <div className="hidden group-hover:flex absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] flex-col z-50">
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">{user?.email}</div>
              <button onClick={logout} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Bottom nav for tablet */}
      <nav className="bg-white border-t border-gray-200 sticky bottom-0 z-40 no-print">
        <div className="max-w-4xl mx-auto flex">
          {[
            { to: '/', icon: '🏠', label: 'Home' },
            { to: '/bookings/new', icon: '➕', label: 'New Booking' },
            { to: '/cases', icon: '📋', label: 'Cases' },
            { to: '/schedule', icon: '📅', label: 'Schedule' },
            { to: '/metrics', icon: '📊', label: 'Metrics' },
          ].map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors min-h-[56px] ${
                path === to
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
