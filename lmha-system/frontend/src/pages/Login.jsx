import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'

export default function Login() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const error = params.get('error')

  const devLogin = async () => {
    await fetch('/auth/dev-login', { method: 'POST', credentials: 'include' })
    setUser({ id: 'dev', email: 'dev@lmha.ie', name: 'Dev User', picture: null })
    navigate('/location')
  }

  useEffect(() => {
    if (user) navigate('/location')
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <span className="text-4xl">🏥</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">LMHA</h1>
          <p className="text-gray-500 mt-1 text-lg">Case Management System</p>
          <p className="text-sm text-gray-400 mt-1">Limerick Mental Health Association</p>
        </div>

        {error === 'unauthorized' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 text-red-700 font-semibold">
            Your email is not authorised to access this system.
            <br /><span className="text-sm font-normal">Contact your supervisor to be added to the allowlist.</span>
          </div>
        )}

        <button
          onClick={devLogin}
          className="btn-primary btn-lg w-full flex items-center justify-center gap-3"
        >
          Enter System
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Staff access only.
        </p>
      </div>
    </div>
  )
}
