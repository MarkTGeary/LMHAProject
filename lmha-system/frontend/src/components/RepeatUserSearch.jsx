import { useState, useEffect, useRef } from 'react'
import { apiUrl } from '../lib/api'

export default function RepeatUserSearch({ onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(apiUrl(`/api/service-users/search?q=${encodeURIComponent(query)}`), { credentials: 'include' })
        const data = await r.json()
        setResults(data)
      } catch {}
      setLoading(false)
    }, 300)
  }, [query])

  const choose = async (user) => {
    setSelected(user)
    setResults([])
    setQuery('')
    onSelect(user)
    try {
      const r = await fetch(apiUrl(`/api/bookings?service_user_id=${user.id}`), { credentials: 'include' })
      const data = await r.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      setHistory([])
    }
  }

  const clear = () => {
    setSelected(null)
    setHistory([])
    setHistoryOpen(false)
    onClear()
  }

  if (selected) {
    return (
      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-bold text-lg text-blue-900">{selected.full_name}</div>
            {selected.phone && <div className="text-blue-700 text-sm">{selected.phone}</div>}
            <div className="text-blue-600 text-sm mt-1">
              {selected.visit_count} previous visit{selected.visit_count !== 1 ? 's' : ''} •{' '}
              {selected.repeat_user ? 'Repeat user' : 'New user'} •{' '}
              First visit: {selected.first_visit_date || 'unknown'}
            </div>
          </div>
          <button onClick={clear} className="btn-outline btn-sm ml-2">Change</button>
        </div>
        {history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <button
              type="button"
              onClick={() => setHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2"
            >
              <span>Visit History ({history.length})</span>
              <span>{historyOpen ? '▲' : '▼'}</span>
            </button>
            {historyOpen && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {history.map(b => {
                  const outcomeColor =
                    b.outcome === 'Attended'       ? 'text-green-700 bg-green-100' :
                    b.outcome === 'Did Not Attend' ? 'text-red-700 bg-red-100' :
                                                     'text-yellow-700 bg-yellow-100'
                  return (
                    <div key={b.id} className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-sm text-gray-800">
                            {new Date(b.date + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">{b.interaction_type}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${outcomeColor}`}>
                          {b.outcome || 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{b.location}{b.time_booked ? ` · ${b.time_booked}` : ''}</div>
                      {b.notes && <div className="text-xs text-gray-400 italic mt-1">{b.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Search by name or phone number..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {loading && (
        <div className="absolute right-3 top-3 text-gray-400 text-sm">Searching...</div>
      )}
      {results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border-2 border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden">
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => choose(u)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 border-b border-gray-100 last:border-0"
            >
              <div className="font-semibold">{u.full_name}</div>
              <div className="text-sm text-gray-500">{u.phone} • {u.visit_count} visit{u.visit_count !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full bg-white border-2 border-gray-200 rounded-xl shadow-xl mt-1 px-4 py-3 text-gray-500 text-sm">
          No existing records found — will create new service user
        </div>
      )}
    </div>
  )
}
