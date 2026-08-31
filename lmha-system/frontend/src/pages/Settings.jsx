import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAuth } from '../App'
import RepeatUserSearch from '../components/RepeatUserSearch'

export default function Settings() {
  const { user, theme, setTheme } = useAuth()
  const [emails, setEmails] = useState([])
  const [protectedEmail, setProtectedEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('worker')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState('')
  const [eraseUser, setEraseUser] = useState(null)
  const [erasing, setErasing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    setLoading(true)
    apiFetch('/api/admin/emails')
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
    const res = await apiFetch('/api/admin/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: newRole }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setError(data.error || 'Failed to add'); return }
    setNewEmail('')
    setSuccess(`${email} added as ${newRole === 'admin' ? 'admin' : 'worker'}`)
    load()
  }

  const changeRole = async (email, role) => {
    setError('')
    setSuccess('')
    setUpdating(email)
    const res = await apiFetch(`/api/admin/emails/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    setUpdating('')
    if (!res.ok) { setError(data.error || 'Failed to update role'); return }
    setSuccess(`${email} is now ${role === 'admin' ? 'an admin' : 'a worker'}`)
    load()
  }

  const removeEmail = async (email) => {
    setError('')
    setSuccess('')
    if (!window.confirm(`Remove ${email} from the allowlist? They will no longer be able to log in.`)) return
    const res = await apiFetch(`/api/admin/emails/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to remove'); return }
    setSuccess(`${email} removed`)
    load()
  }

  const eraseServiceUser = async () => {
    setError('')
    setSuccess('')
    if (!eraseUser) { setError('Search for and select a service user first'); return }
    const id = eraseUser.id
    const name = eraseUser.full_name
    if (!window.confirm(`Erase personal data for ${name}? This keeps anonymous case records for reporting but removes identifying details.`)) return
    setErasing(true)
    const res = await apiFetch(`/api/admin/service-users/${encodeURIComponent(id)}/erase`, {
      method: 'POST',
    })
    const data = await res.json()
    setErasing(false)
    if (!res.ok) { setError(data.error || 'Failed to erase personal data'); return }
    setEraseUser(null)
    setSuccess(`Personal data erased for ${name}`)
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6 pb-10 max-w-xl">

        <div className="card">
          <h2 className="text-xl font-bold mb-1">Appearance</h2>
          <p className="text-sm text-gray-500 mb-5">
            Choose how LMHA looks on this device.
          </p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-gray-800">Dark mode</div>
              <div className="text-sm text-gray-500">Use darker colours in low-light environments.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Dark mode"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`theme-toggle-thumb inline-block h-6 w-6 rounded-full shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-1">Account Access</h2>
          <p className="text-sm text-gray-500 mb-5">
            Admins can manage access. Workers can use the service but cannot change accounts.
          </p>
          {protectedEmail && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
              <div className="text-xs font-bold uppercase text-blue-600 tracking-wide">Protected Root Admin</div>
              <div className="text-blue-900 font-semibold truncate mt-0.5">{protectedEmail}</div>
            </div>
          )}

          {/* Add form */}
          <div className="space-y-3 mb-5">
            <input
              className="input"
              type="email"
              placeholder="name@example.com"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError(''); setSuccess('') }}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
            />
            <div className="flex gap-2">
              {[
                ['worker', 'Worker'],
                ['admin', 'Admin'],
              ].map(([role, label]) => (
                <button
                  key={role}
                  onClick={() => setNewRole(role)}
                  className={`btn-sm flex-1 border-2 font-semibold ${
                    newRole === role ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={addEmail}
                disabled={adding || !newEmail.trim()}
                className="btn-primary px-5"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
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
              {emails.map(({ email, role, added_by, added_at, protected: isProtected }) => {
                const currentRole = isProtected ? 'admin' : (role || 'worker')
                const isSelf = email === user?.email
                return (
                  <li key={email} className="py-3">
                    <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">
                        {email}
                        {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        Added {new Date(added_at).toLocaleDateString('en-IE')}
                        {added_by && added_by !== 'system' ? ` by ${added_by}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold border rounded-lg px-2 py-1 ${
                        currentRole === 'admin'
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-gray-600 bg-gray-50 border-gray-200'
                      }`}>
                        {currentRole === 'admin' ? 'Admin' : 'Worker'}
                      </span>
                      {isProtected && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                          Protected
                        </span>
                      )}
                    </div>
                    </div>
                    {!isProtected && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => changeRole(email, currentRole === 'admin' ? 'worker' : 'admin')}
                          disabled={updating === email || isSelf}
                          title={isSelf ? 'You cannot change your own role' : undefined}
                          className="btn-secondary btn-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {updating === email
                            ? 'Updating...'
                            : currentRole === 'admin'
                              ? 'Make Worker'
                              : 'Make Admin'
                          }
                        </button>
                        <button
                          onClick={() => removeEmail(email)}
                          disabled={isSelf}
                          title={isSelf ? 'You cannot remove yourself' : undefined}
                          className="btn-danger btn-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-1">GDPR Erasure</h2>
          <p className="text-sm text-gray-500 mb-5">
            Remove identifying details for a service user while keeping anonymous case records for metrics.
          </p>
          <div className="mb-3">
            <RepeatUserSearch
              onSelect={u => { setEraseUser(u); setError(''); setSuccess('') }}
              onClear={() => { setEraseUser(null) }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={eraseServiceUser}
              disabled={erasing || !eraseUser}
              className="btn-danger px-5"
            >
              {erasing ? 'Erasing...' : 'Erase'}
            </button>
            {eraseUser && (
              <p className="text-sm text-gray-500">
                Selected: <span className="font-medium text-gray-700">{eraseUser.full_name}</span>
                {eraseUser.phone ? ` · ${eraseUser.phone}` : ''}
              </p>
            )}
          </div>
        </div>

      </div>
    </Layout>
  )
}
