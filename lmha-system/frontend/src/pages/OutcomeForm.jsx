import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'

const SUPPORT_TYPES = [
  { code: 'SS', label: 'Social Support' },
  { code: 'PS', label: 'Peer Support' },
  { code: 'C', label: 'Crisis' },
  { code: 'O', label: 'Other' },
  { code: 'SP', label: 'Signposted' },
]

export default function OutcomeForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [hasIntake, setHasIntake] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    outcome: '',
    time_in: '',
    time_out: '',
    type_of_support: [],
    limitations: '',
    ed_diversion: null,
  })

  useEffect(() => {
    fetch(`/api/bookings/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(b => {
        setBooking(b)
        setForm({
          outcome: b.outcome !== 'Pending' ? b.outcome : '',
          time_in: b.time_in || '',
          time_out: b.time_out || '',
          type_of_support: (() => {
            try { return b.type_of_support ? JSON.parse(b.type_of_support) : [] }
            catch { return [] }
          })(),
          limitations: b.limitations || '',
          ed_diversion: b.ed_diversion ?? null,
        })
        setHasIntake(!!b.intake_complete)
      })
      .finally(() => setLoading(false))
  }, [id])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleSupport = (code) => {
    setForm(f => ({
      ...f,
      type_of_support: f.type_of_support.includes(code)
        ? f.type_of_support.filter(c => c !== code)
        : [...f.type_of_support, code],
    }))
  }

  const saveOutcome = async () => {
    if (!form.outcome) { setError('Please select an outcome'); return }
    setError(''); setSaving(true)

    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          outcome: form.outcome,
          time_in: form.time_in || null,
          time_out: form.time_out || null,
          type_of_support: form.type_of_support,
          limitations: form.limitations || null,
          ed_diversion: form.ed_diversion,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
      setSuccess(true)
    } catch {
      setError('Network error.')
    }
    setSaving(false)
  }

  const closeCase = async () => {
    if (!form.outcome || form.outcome === 'Pending') {
      setError('Set the outcome before closing'); return
    }
    if (!hasIntake) {
      setError('Cannot close: intake form must be completed first'); return
    }
    if (form.type_of_support.length === 0) {
      setError('Cannot close: at least one type of support must be selected'); return
    }
    setError(''); setSaving(true)

    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          outcome: form.outcome,
          time_in: form.time_in || null,
          time_out: form.time_out || null,
          type_of_support: form.type_of_support,
          limitations: form.limitations || null,
          ed_diversion: form.ed_diversion,
          status: 'Closed',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to close'); setSaving(false); return }
      navigate('/cases')
    } catch {
      setError('Network error.')
    }
    setSaving(false)
  }

  if (loading) return <Layout title="Record Outcome"><div className="py-20 text-center text-gray-500">Loading...</div></Layout>

  return (
    <Layout title="Record Outcome" back="/cases">
      <div className="space-y-5 pb-10">
        {/* Booking summary */}
        {booking && (
          <div className="card bg-gray-50">
            <div className="font-bold text-lg">{booking.full_name || '—'}</div>
            <div className="text-sm text-gray-600 mt-1">
              {booking.date} at {booking.time_booked} • {booking.location} • {booking.interaction_type}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className={`badge ${booking.status === 'Active' ? 'badge-active' : 'badge-closed'}`}>{booking.status}</span>
              {hasIntake
                ? <span className="badge-intake-done">✓ Intake done</span>
                : <span className="badge-intake-missing">⚠ Intake missing</span>
              }
            </div>
          </div>
        )}

        {!hasIntake && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 text-orange-800">
            <p className="font-bold">Intake form not completed</p>
            <p className="text-sm mt-1">You can record an outcome now, but the case cannot be closed until the intake form is done.</p>
            <Link to={`/bookings/${id}/intake`} className="btn-warning btn-sm mt-2 inline-flex">
              Complete Intake →
            </Link>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-green-700 font-semibold">
            ✓ Outcome saved. You can continue editing or close the case below.
          </div>
        )}

        {/* Outcome */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Outcome <span className="text-red-500">*</span></h2>
          <div className="grid grid-cols-2 gap-3">
            {['Attended', 'Did Not Attend'].map(v => (
              <button
                key={v}
                onClick={() => set('outcome', v)}
                className={`min-h-[56px] rounded-xl border-2 font-bold text-lg transition-all active:scale-95 ${
                  form.outcome === v
                    ? v === 'Attended'
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-red-500 border-red-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {v === 'Attended' ? '✓ Attended' : '✗ Did Not Attend'}
              </button>
            ))}
          </div>
        </div>

        {/* Times */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Session Times</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="field mb-0">
              <label className="label">Time In</label>
              <input type="time" className="input" value={form.time_in} onChange={e => set('time_in', e.target.value)} />
            </div>
            <div className="field mb-0">
              <label className="label">Time Out</label>
              <input type="time" className="input" value={form.time_out} onChange={e => set('time_out', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Type of Support */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Type of Support Provided</h2>
          <div className="grid grid-cols-2 gap-3">
            {SUPPORT_TYPES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => toggleSupport(code)}
                className={`min-h-[56px] rounded-xl border-2 font-bold text-base transition-all active:scale-95 ${
                  form.type_of_support.includes(code)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl">{code}</div>
                <div className="text-xs font-normal">{label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* A&E Diversion */}
        <div className="card border-2 border-amber-200 bg-amber-50">
          <h2 className="text-xl font-bold mb-2 text-amber-900">A&E Diversion Confirmed?</h2>
          <p className="text-amber-800 text-sm mb-3">
            Would this person have attended A&E if LMHA wasn't available?
          </p>
          <div className="flex gap-3">
            {[['Yes', 1], ['No', 0], ['Unknown', null]].map(([label, val]) => (
              <button
                key={label}
                onClick={() => set('ed_diversion', val)}
                className={`flex-1 min-h-[48px] rounded-xl border-2 font-semibold transition-all ${
                  form.ed_diversion === val
                    ? label === 'Yes' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-gray-500 border-gray-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Limitations */}
        <div className="card">
          <h2 className="text-xl font-bold mb-3">Limitations / Notes</h2>
          <textarea
            className="input min-h-[100px] resize-none"
            placeholder="Any limitations, notes about the session..."
            value={form.limitations}
            onChange={e => set('limitations', e.target.value)}
          />
        </div>

        {/* Actions */}
        <button onClick={saveOutcome} disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? 'Saving...' : 'Save Outcome'}
        </button>

        {booking?.status === 'Active' && (
          <button
            onClick={closeCase}
            disabled={saving || !hasIntake || !form.outcome || form.outcome === 'Pending' || form.type_of_support.length === 0}
            className={`btn-lg w-full font-bold ${
              hasIntake && form.outcome && form.outcome !== 'Pending' && form.type_of_support.length > 0
                ? 'btn-success'
                : 'btn-secondary opacity-50 cursor-not-allowed'
            }`}
          >
            Close Case
          </button>
        )}

        {/* Close requirements checklist */}
        <div className="card bg-gray-50 text-sm">
          <div className="font-semibold text-gray-700 mb-2">Requirements to close:</div>
          {[
            { label: 'Intake form completed', met: hasIntake },
            { label: 'Outcome selected', met: !!form.outcome && form.outcome !== 'Pending' },
            { label: 'Type of support selected', met: form.type_of_support.length > 0 },
          ].map(({ label, met }) => (
            <div key={label} className={`flex items-center gap-2 py-1 ${met ? 'text-green-700' : 'text-red-600'}`}>
              <span>{met ? '✓' : '✗'}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
