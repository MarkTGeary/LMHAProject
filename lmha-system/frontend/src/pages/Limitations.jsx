import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'

const LIMITATIONS_LMHA = [
  { key: 'saturday',               label: 'Looked for appointment on Saturday' },
  { key: 'sunday',                 label: 'Looked for appointment on Sunday' },
  { key: 'before_11am',            label: 'Looked for appointment before 11am' },
  { key: 'after_5pm',              label: 'Looked for appointment after 5pm' },
  { key: 'no_appointment_in_week', label: 'Could not offer an appointment within the week' },
  { key: 'closed_short_staff',     label: 'Forced to close due to short staff' },
  { key: 'calls_out_of_hours',     label: 'Calls out of hours' },
  { key: 'text_out_of_hours',      label: 'Text out of hours' },
]

const LIMITATIONS_SOLACE = [
  { key: 'monday',                 label: 'Looked for appointment on Monday' },
  { key: 'tuesday',                label: 'Looked for appointment on Tuesday' },
  { key: 'wednesday',              label: 'Looked for appointment on Wednesday' },
  { key: 'before_6pm',             label: 'Looked for appointment before 6pm' },
  { key: 'after_midnight',         label: 'Looked for appointment after midnight' },
  { key: 'no_appointment_in_week', label: 'Could not offer an appointment within the week' },
  { key: 'closed_short_staff',     label: 'Forced to close due to short staff' },
  { key: 'calls_out_of_hours',     label: 'Calls out of hours' },
  { key: 'text_out_of_hours',      label: 'Text out of hours' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Limitations() {
  const { location } = useAuth()
  const options = location === 'LMHA' ? LIMITATIONS_LMHA : LIMITATIONS_SOLACE

  const [date, setDate] = useState(todayStr())
  const [selected, setSelected] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  async function loadRecords() {
    setLoadingRecords(true)
    try {
      const res = await apiFetch(`/api/limitations?location=${encodeURIComponent(location)}`)
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      // silently fail — list is non-critical
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => { loadRecords() }, [location])

  function toggle(key) {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selected.length === 0) { setError('Select at least one limitation'); return }
    setSaving(true); setError('')
    try {
      const res = await apiFetch('/api/limitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, date, limitations_detail: selected, notes: notes.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      setSelected([])
      setNotes('')
      setDate(todayStr())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadRecords()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function labelFor(key) {
    return options.find(o => o.key === key)?.label || key
  }

  function parseDetail(val) {
    try { return JSON.parse(val) } catch { return [] }
  }

  return (
    <Layout title="Limitations">
      <div className="space-y-6 max-w-2xl mx-auto">

        {/* Log form */}
        <div className="card">
          <h2 className="text-xl font-bold mb-1">Log a Limitation</h2>
          <p className="text-sm text-gray-500 mb-4">
            Use this when someone tried to reach us but we couldn't help, and no booking exists for them.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Limitation(s)</label>
              <div className="space-y-2">
                {options.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`w-full min-h-[48px] text-left px-4 rounded-xl border-2 font-semibold text-sm transition-all flex items-center gap-3 ${
                      selected.includes(key)
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                      selected.includes(key) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'
                    }`}>
                      {selected.includes(key) && '✓'}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Unknown caller, left no message"
                rows={2}
                className="input w-full resize-none"
              />
            </div>

            {error && (
              <p className="text-red-600 font-semibold text-sm">{error}</p>
            )}
            {success && (
              <p className="text-green-600 font-semibold text-sm">✓ Limitation logged</p>
            )}

            <button
              type="submit"
              disabled={saving || selected.length === 0}
              className="btn-primary w-full"
            >
              {saving ? 'Saving…' : 'Log Limitation'}
            </button>
          </form>
        </div>

        {/* Recent records */}
        <div className="card">
          <h2 className="text-xl font-bold mb-3">Recent Limitations</h2>
          {loadingRecords ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : records.length === 0 ? (
            <p className="text-gray-400 text-sm">No standalone limitations logged yet.</p>
          ) : (
            <div className="space-y-3">
              {records.map(r => (
                <div key={r.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">{r.date}</span>
                    <span className="text-xs text-gray-400">{r.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parseDetail(r.limitations_detail).map(key => (
                      <span key={key} className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-2 py-0.5 text-xs font-medium">
                        {labelFor(key)}
                      </span>
                    ))}
                  </div>
                  {r.notes && (
                    <p className="text-sm text-gray-500 mt-2">{r.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
