import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import { apiFetch } from './lib/api'
import Login from './pages/Login'
import LocationSelect from './pages/LocationSelect'
import Dashboard from './pages/Dashboard'
import NewBooking from './pages/NewBooking'
import ActiveCases from './pages/ActiveCases'
import TodaySchedule from './pages/TodaySchedule'
import IntakeForm from './pages/IntakeForm'
import OutcomeForm from './pages/OutcomeForm'
import MetricsDashboard from './pages/MetricsDashboard'
import Settings from './pages/Settings'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireLocation({ children }) {
  const { user, location, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!location) return <Navigate to="/location" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Capture token from URL after OAuth redirect
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem('lmha_token', urlToken)
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Restore location from localStorage
    const storedLocation = localStorage.getItem('lmha_location')
    if (storedLocation) setLocation(storedLocation)

    apiFetch('/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.email) setUser(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    localStorage.removeItem('lmha_token')
    localStorage.removeItem('lmha_location')
    setUser(null)
    setLocation(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, location, setLocation, loading, logout }}>
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
          <Route path="/settings" element={
            <RequireAuth><Settings /></RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}