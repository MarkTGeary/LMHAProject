import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import RepeatUserSearch from '../components/RepeatUserSearch'

const LOCATION_RULES = {
  'LMHA': { days: [1, 2, 3, 4, 5], label: 'Mon–Fri', startHour: 11, endHour: 17 },
  'Solace Café': { days: [4, 5, 6, 0], label: 'Thu–Sun', startHour: 18, endHour: 24 },
}

const INTERACTION_TYPES = [
  { value: 'Phone Call', icon: '📞', color: 'bg-green-100 border-green-400 text-green-800' },
  { value: 'Walk-In', icon: '🚶', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { value: 'Crisis', icon: '🚨', color: 'bg-red-100 border-red-400 text-red-800' },
  { value: 'Peer Support Booking', icon: '🤝', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { value: 'Email', icon: '✉️', color: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
  { value: 'Text', icon: '💬', color: 'bg-indigo-100 border-indigo-400 text-indigo-800' },
]

const REFERRED_FROM = ['Self-referral', 'NGO', 'HSE', 'GP', 'Other']

function isDayValid(dateStr, location) {
  if (!dateStr || !location) return true
  const d = new Date(dateStr)
  const day = d.getDay()
  return LOCATION_RULES[location]?.days.includes(day)
}

export default function NewBooking({ editMode }) {
  const { location } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [form, setForm] = useState({
    location: location || '',
    date: '',
    time_booked: '',
    interaction_type: '',
    new_or_repeat: 'New',
    referred_from: '',
    peer_support_worker: '',
    carer_attended: false,
    notes: '',
    full_name: '',
    phone: '',
    service_user_id: null,
  })
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingUser, setExistingUser] = useState(null)

  // Load booking for edit mode
  useEffect(() => {
    if (editMode && id) {
      fetch(`/api/bookings/${id}`, { credentials: 'include' })
        .then(r => r.json())
        .then(b => {
          setForm({
            location: b.location,
            date: b.date,
            time_booked: b.time_booked,
            interaction_type: b.interaction_type,
            new_or_repeat: b.new_or_repeat || 'New',
            referred_from: b.referred_from || '',
            peer_support_worker: b.peer_support_worker || '',
            carer_attended: !!b.carer_attended,
            notes: b.notes || '',
            full_name: b.full_name || '',
            phone: b.phone || '',
            service_user_id: b.service_user_id,
          })
        })
    }
  }, [editMode, id])

  // Load slots when date/location change
  useEffect(() => {
    if (!form.date || !form.location) { setSlots([]); return }
    if (!isDayValid(form.date, form.location)) { setSlots([]); return }

    setSlotsLoading(true)
    fetch(`/api/bookings/available-slots?date=${form.date}&location=${encodeURIComponent(form.location)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSlots(data.slots || [])
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [form.date, form.location])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleUserSelect = (user) => {
    setExistingUser(user)
    set('service_user_id', user.id)
    set('full_name', user.full_name)
    set('phone', user.phone || '')
    set('new_or_repeat', 'Repeat')
  }

  const handleUserClear = () => {
    setExistingUser(null)
    set('service_user_id', null)
    set('full_name', '')
    set('phone', '')
    set('new_or_repeat', 'New')
  }

  const validate = () => {
    if (!form.location) return 'Location is required'
    if (!form.date) return 'Date is required'
    if (!isDayValid(form.date, form.location)) {
      return `${form.location} is not open on this day (${LOCATION_RULES[form.location]?.label})`
    }
    if (!form.time_booked) return 'Time is required'
    if (!form.interaction_type) return 'Interaction type is required'
    if (!form.service_user_id && !form.full_name) return 'Name is required'
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    try {
      const url = editMode ? `/api/bookings/${id}` : '/api/bookings'
      const method = editMode ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
      navigate('/cases')
    } catch (e) {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  const dayInvalid = form.date && !isDayValid(form.date, form.location)

  return (
    <Layout title={editMode ? 'Edit Booking' : 'New Booking'} back="/cases">
      <div className="space-y-6 pb-10">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        {/* Service User */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Person Details</h2>

          {!existingUser && (
            <div className="field">
              <label className="label">Search existing records</label>
              <RepeatUserSearch onSelect={handleUserSelect} onClear={handleUserClear} />
            </div>
          )}

          {existingUser ? (
            <div className="field">
              <label className="label">Linked to existing record</label>
              <RepeatUserSearch onSelect={handleUserSelect} onClear={handleUserClear} />
            </div>
          ) : (
            <>
              <div className="field">
                <label className="label">Full Name <span className="text-red-500">*</span></label>
                <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  placeholder="First name at minimum" />
              </div>
              <div className="field">
                <label className="label">Phone Number</label>
                <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="For callback / contact" />
              </div>
            </>
          )}
        </div>

        {/* Booking Details */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Booking Details</h2>

          <div className="field">
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              className={`input ${dayInvalid ? 'border-red-400 bg-red-50' : ''}`}
              value={form.date}
              onChange={e => { set('date', e.target.value); set('time_booked', '') }}
            />
            {dayInvalid && (
              <p className="text-red-600 text-sm mt-1 font-semibold">
                {form.location} is closed on this day ({LOCATION_RULES[form.location]?.label})
              </p>
            )}
          </div>

          <div className="field">
            <label className="label">Time <span className="text-red-500">*</span></label>
            {form.date && !dayInvalid ? (
              slotsLoading ? (
                <div className="text-gray-500 text-sm py-3">Loading available slots...</div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => set('time_booked', s.time)}
                      className={`min-h-[48px] rounded-xl text-base font-semibold border-2 transition-all ${
                        form.time_booked === s.time
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : s.available
                            ? 'bg-white border-gray-300 text-gray-800 hover:border-blue-400 hover:bg-blue-50'
                            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              ) : (
                <input type="time" className="input" value={form.time_booked}
                  onChange={e => set('time_booked', e.target.value)} />
              )
            ) : (
              <div className="input bg-gray-100 text-gray-400 cursor-not-allowed">
                Select a valid date first
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Interaction Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {INTERACTION_TYPES.map(({ value, icon, color }) => (
                <button
                  key={value}
                  onClick={() => set('interaction_type', value)}
                  className={`min-h-[56px] rounded-xl border-2 font-semibold text-base transition-all active:scale-95 ${
                    form.interaction_type === value
                      ? color + ' border-current scale-[1.02] shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {icon} {value}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">New or Repeat</label>
            <div className="flex gap-3">
              {['New', 'Repeat'].map(v => (
                <button
                  key={v}
                  onClick={() => set('new_or_repeat', v)}
                  className={`flex-1 min-h-[48px] rounded-xl border-2 font-semibold transition-all ${
                    form.new_or_repeat === v
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Optional details */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Additional Details (Optional)</h2>

          <div className="field">
            <label className="label">Referred From</label>
            <select className="input" value={form.referred_from} onChange={e => set('referred_from', e.target.value)}>
              <option value="">— Select if known —</option>
              {REFERRED_FROM.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="label">Peer Support Worker</label>
            <input className="input" value={form.peer_support_worker} onChange={e => set('peer_support_worker', e.target.value)}
              placeholder="Name of PS worker assigned" />
          </div>

          <div className="field">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set('carer_attended', !form.carer_attended)}
                className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${form.carer_attended ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${form.carer_attended ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className="text-base font-semibold text-gray-700">Carer / Family Member Attending</span>
            </label>
          </div>

          <div className="field">
            <label className="label">Notes</label>
            <textarea className="input min-h-[100px] resize-none" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="btn-primary btn-lg w-full"
        >
          {saving ? 'Saving...' : editMode ? 'Update Booking' : 'Create Booking'}
        </button>

        <button onClick={() => navigate('/cases')} className="btn-secondary btn-lg w-full">
          Cancel
        </button>
      </div>
    </Layout>
  )
}
