import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function LocationSelect() {
  const { user, setLocation, logout } = useAuth()
  const navigate = useNavigate()

  const select = async (loc) => {
    const res = await fetch('/auth/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ location: loc }),
    })
    if (res.ok) {
      setLocation(loc)
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <p className="text-slate-300 text-lg">Welcome, <span className="text-white font-semibold">{user?.name}</span></p>
          <h1 className="text-4xl font-bold text-white mt-2">Select Location</h1>
          <p className="text-slate-400 mt-2">Which service are you working at today?</p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <button
            onClick={() => select('LMHA')}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-3xl p-8 text-left transition-all duration-150 active:scale-95 shadow-xl"
          >
            <div className="text-5xl mb-3">🏢</div>
            <div className="text-3xl font-bold">LMHA</div>
            <div className="text-blue-200 text-lg mt-1">Limerick Mental Health Association</div>
            <div className="text-blue-300 text-sm mt-2">Mon–Fri • 11:00–17:00</div>
          </button>

          <button
            onClick={() => select('Solace Café')}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-3xl p-8 text-left transition-all duration-150 active:scale-95 shadow-xl"
          >
            <div className="text-5xl mb-3">☕</div>
            <div className="text-3xl font-bold">Solace Café</div>
            <div className="text-purple-200 text-lg mt-1">Evening Peer Support Service</div>
            <div className="text-purple-300 text-sm mt-2">Thu–Sun • 18:00–00:00</div>
          </button>
        </div>

        <div className="text-center mt-8">
          <button onClick={logout} className="text-slate-400 hover:text-white text-sm underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
