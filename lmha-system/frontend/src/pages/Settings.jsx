import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function Settings() {
  const [emails, setEmails] = useState([])
  const [protectedEmail, setProtectedEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/emails', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setEmails(data.emails || [])
        setProtectedEmail(data.protected || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const addEmail = async () => {
    setError('')
    setSuccess('')
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAdding(true)
    const res = await fetch('/api/admin/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setError(data.error || 'Failed to add'); return }
    setNewEmail('')
    setSuccess(`${email} added`)
    load()
  }

  const removeEmail = async (email) => {
    setError('')
    setSuccess('')
    const res = await fetch(`/api/admin/emails/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to remove'); return }
    setSuccess(`${email} removed`)
    load()
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6 pb-10 max-w-xl">

        <div className="card">
          <h2 className="text-xl font-bold mb-1">Allowed Emails</h2>
          <p className="text-sm text-gray-500 mb-5">
            Only these email addresses can log in to the system via Google.
          </p>

          {/* Add form */}
          <div className="flex gap-2 mb-5">
            <input
              className="input flex-1"
              type="email"
              placeholder="name@example.com"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError(''); setSuccess('') }}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
            />
            <button
              onClick={addEmail}
              disabled={adding || !newEmail.trim()}
              className="btn-primary px-5"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-2 text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-300 text-green-700 rounded-xl px-4 py-2 text-sm mb-4">
              {success}
            </div>
          )}

          {/* Email list */}
          {loading ? (
            <div className="text-gray-400 text-sm py-4 text-center">Loading…</div>
          ) : emails.length === 0 ? (
            <div className="text-gray-400 text-sm py-4 text-center">No emails configured</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {emails.map(({ email, added_by, added_at }) => {
                const isProtected = email === protectedEmail
                return (
                  <li key={email} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{email}</div>
                      <div className="text-xs text-gray-400">
                        Added {new Date(added_at).toLocaleDateString('en-IE')}
                        {added_by && added_by !== 'system' ? ` by ${added_by}` : ''}
                      </div>
                    </div>
                    {isProtected ? (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 shrink-0">
                        Protected
                      </span>
                    ) : (
                      <button
                        onClick={() => removeEmail(email)}
                        className="btn-danger btn-sm shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>
    </Layout>
  )
}
