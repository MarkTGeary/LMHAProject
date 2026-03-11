import { useState, useEffect, useRef } from 'react'

export default function RepeatUserSearch({ onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/service-users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        const data = await r.json()
        setResults(data)
      } catch {}
      setLoading(false)
    }, 300)
  }, [query])

  const choose = (user) => {
    setSelected(user)
    setResults([])
    setQuery('')
    onSelect(user)
  }

  const clear = () => {
    setSelected(null)
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
