import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import { apiFetch, setCsrfToken } from './lib/api'
import Login from './pages/Login'
import LocationSelect from './pages/LocationSelect'
import Dashboard from './pages/Dashboard'
import NewBooking from './pages/NewBooking'
import ActiveCases from './pages/ActiveCases'
import TodaySchedule from './pages/TodaySchedule'
import IntakeForm from './pages/IntakeForm'
import OutcomeForm from './pages/OutcomeForm'
import MetricsDashboard from './pages/MetricsDashboard'
import Limitations from './pages/Limitations'
import Settings from './pages/Settings'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function RequireAuth({ children }) {
  const { user, loading, authError } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-500">Loading...</div>
  if (authError) return <AuthIssue message={authError} />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireLocation({ children }) {
  const { user, location, loading, authError } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-500">Loading...</div>
  if (authError) return <AuthIssue message={authError} />
  if (!user) return <Navigate to="/login" replace />
  if (!location) return <Navigate to="/location" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user, loading, authError } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-500">Loading...</div>
  if (authError) return <AuthIssue message={authError} />
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/" replace />
  return children
}

function AuthIssue({ message }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign-in did not finish</h1>
        <p className="text-gray-600 text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary flex-1">Try Again</button>
          <a href="/login" className="btn-secondary flex-1 text-center">Back to Login</a>
        </div>
      </div>
    </div>
  )
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function errorMessage(value, fallback = 'Request failed') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message || fallback
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message
    if (typeof value.error === 'string') return value.error
    if (value.error) return errorMessage(value.error, fallback)
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }
  return String(value)
}

async function fetchCurrentUser() {
  const res = await apiFetch('/auth/me', { headers: { Accept: 'application/json' } })
  let data = null
  try {
    data = await res.json()
  } catch {
    const err = new Error('The API did not return JSON. Check VITE_API_URL or the Vercel proxy rewrite.')
    err.status = res.status
    err.transient = true
    throw err
  }
  if (!res.ok) {
    const err = new Error(errorMessage(data?.error || data, 'Not authenticated'))
    err.status = res.status
    throw err
  }
  return data
}

export default function App() {
  const [user, setUser] = useState(null)
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('lmha_theme') === 'dark' ? 'dark' : 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('lmha_theme', theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const fromOAuth = params.get('auth') === '1'
    if (fromOAuth) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Restore location from localStorage
    const storedLocation = localStorage.getItem('lmha_location')
    if (['LMHA', 'Solace Café'].includes(storedLocation)) setLocation(storedLocation)

    async function bootstrapAuth() {
      const delays = fromOAuth ? [0, 350, 900, 1800, 3200] : [0, 500, 1500]
      let lastError = null
      for (let i = 0; i < delays.length; i += 1) {
        if (delays[i]) await delay(delays[i])
        try {
          const data = await fetchCurrentUser()
          if (cancelled) return
          if (data.email) {
            setUser(data)
            setCsrfToken(data.csrfToken)
            setAuthError('')
          }
          setLoading(false)
          return
        } catch (err) {
          lastError = err
          const unauthorised = err.status === 401 || err.status === 403
          if (unauthorised && !fromOAuth && i > 0) break
        }
      }

      if (cancelled) return
      setUser(null)
      setCsrfToken(null)
      const unauthorised = lastError?.status === 401 || lastError?.status === 403
      if (fromOAuth && unauthorised) {
        setAuthError('The login succeeded, but the browser did not send the session cookie back to the API. Use the same-origin Vercel proxy or same-site custom domains for Vercel and Render.')
      } else if (!unauthorised) {
        setAuthError(errorMessage(lastError, 'Could not reach the authentication service. Please retry.'))
      } else {
        setAuthError('')
      }
      setLoading(false)
    }

    bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user?.csrfToken) {
      setCsrfToken(user.csrfToken)
    }
  }, [user])

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout should still happen if the network is down.
    }
    localStorage.removeItem('lmha_location')
    setCsrfToken(null)
    setUser(null)
    setLocation(null)
    setAuthError('')
  }

  return (
    <AuthContext.Provider value={{ user, setUser, location, setLocation, loading, authError, logout, theme, setTheme }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/location" element={
            <RequireAuth><LocationSelect /></RequireAuth>
          } />
          <Route path="/" element={
            <RequireLocation><Dashboard /></RequireLocation>
          } />
          <Route path="/bookings/new" element={
            <RequireLocation><NewBooking /></RequireLocation>
          } />
          <Route path="/bookings/:id/edit" element={
            <RequireLocation><NewBooking editMode /></RequireLocation>
          } />
          <Route path="/cases" element={
            <RequireLocation><ActiveCases /></RequireLocation>
          } />
          <Route path="/schedule" element={
            <RequireLocation><TodaySchedule /></RequireLocation>
          } />
          <Route path="/bookings/:id/intake" element={
            <RequireLocation><IntakeForm /></RequireLocation>
          } />
          <Route path="/bookings/:id/outcome" element={
            <RequireLocation><OutcomeForm /></RequireLocation>
          } />
          <Route path="/metrics" element={
            <RequireLocation><MetricsDashboard /></RequireLocation>
          } />
          <Route path="/limitations" element={
            <RequireLocation><Limitations /></RequireLocation>
          } />
          <Route path="/settings" element={
            <RequireAdmin><Settings /></RequireAdmin>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
