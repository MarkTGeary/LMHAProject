import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import RepeatUserSearch from '../components/RepeatUserSearch'
import { apiFetch } from '../lib/api'
import { LOCATION_RULES, LOCK_DAYS } from '../lib/constants'

const INTERACTION_TYPES = [
  { value: 'Phone Call', icon: '📞', color: 'bg-green-100 border-green-400 text-green-800' },
  { value: 'Walk-In', icon: '🚶', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { value: 'Crisis', icon: '🚨', color: 'bg-red-100 border-red-400 text-red-800' },
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
  const { location, user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [form, setForm] = useState({
    location: location || '',
    date: '',
    time_booked: '',
    interaction_type: '',
    new_or_repeat: 'New',
    referred_from: '',
    carer_attended: false,
    notes: '',
    full_name: '',
    phone: '',
    service_user_id: null,
    assigned_to: null,
  })
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingUser, setExistingUser] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [assignSearch, setAssignSearch] = useState('')
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false)

  // Fetch staff list for assignment autocomplete
  useEffect(() => {
    apiFetch('/api/bookings/staff')
      .then(r => r.json())
      .then(data => setStaffList(Array.isArray(data) ? data.map(s => s.email) : []))
      .catch(() => {})
  }, [])

  // Load booking for edit mode
  useEffect(() => {
    if (editMode && id) {
      apiFetch(`/api/bookings/${id}`)
        .then(r => r.json())
        .then(b => {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - LOCK_DAYS)
          cutoff.setHours(0, 0, 0, 0)
          setIsLocked(new Date(b.date) < cutoff)
          setForm({
            location: b.location,
            date: b.date,
            time_booked: b.time_booked,
            interaction_type: b.interaction_type,
            new_or_repeat: b.new_or_repeat || 'New',
            referred_from: b.referred_from || '',
            carer_attended: !!b.carer_attended,
            notes: b.notes || '',
            full_name: b.full_name || '',
            phone: b.phone || '',
            service_user_id: b.service_user_id,
            assigned_to: b.assigned_to || null,
          })
        })
    }
  }, [editMode, id])

  // Load slots when date/location change
  useEffect(() => {
    if (!form.date || !form.location) { setSlots([]); setSessionInfo(null); return }

    setSlotsLoading(true)
    setEmergencyMode(false)
    const assigneeParam = form.assigned_to ? '&assigned_to=' + encodeURIComponent(form.assigned_to) : ''
    apiFetch(`/api/bookings/available-slots?date=${form.date}&location=${encodeURIComponent(form.location)}${assigneeParam}`)
      .then(r => r.json())
      .then(data => {
        setSlots(data.slots || [])
        setSessionInfo(data.sessionInfo || null)
      })
      .catch(() => { setSlots([]); setSessionInfo(null) })
      .finally(() => setSlotsLoading(false))
  }, [form.date, form.location, form.assigned_to])

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
    if (!form.time_booked) return 'Time is required'
    if (!form.interaction_type) return 'Interaction type is required'
    if (!form.service_user_id && !form.full_name) return 'Name is required'
    if (sessionInfo && sessionInfo.used >= sessionInfo.max) {
      return `Session limit reached (${sessionInfo.used}/${sessionInfo.max} tonight). Contact an admin to add more.`
    }
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    try {
      const path = editMode ? `/api/bookings/${id}` : '/api/bookings'
      const method = editMode ? 'PATCH' : 'POST'
      const res = await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
  const filteredStaff = staffList.filter(e =>
    !assignSearch || e.toLowerCase().includes(assignSearch.toLowerCase())
  )

  return (
    <Layout title={editMode ? 'Edit Booking' : 'New Booking'} back="/cases">
      <div className="space-y-6 pb-10">
        {/* Lock banner */}
        {isLocked && (
          <div className="bg-gray-100 border-2 border-gray-400 rounded-xl p-4 text-gray-700 font-semibold">
            This record is locked. Bookings older than 3 weeks cannot be edited.
          </div>
        )}

        {/* Service User */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Person Details</h2>

          <div className="field">
            <label className="label">Search existing records</label>
            <RepeatUserSearch onSelect={handleUserSelect} onClear={handleUserClear} />
          </div>

          {(!existingUser || editMode) && (
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
              className="input"
              value={form.date}
              onChange={e => { set('date', e.target.value); set('time_booked', '') }}
            />
            {dayInvalid && (
              <p className="text-amber-600 text-sm mt-1">
                Note: {form.location} normally operates {LOCATION_RULES[form.location]?.label} — booking will still be saved.
              </p>
            )}
          </div>

          <div className="field">
            <label className="label">Time <span className="text-red-500">*</span></label>
            {form.date && !dayInvalid ? (
              slotsLoading ? (
                <div className="text-gray-500 text-sm py-3">Loading available slots...</div>
              ) : emergencyMode ? (
                <div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    Emergency booking — enter any time within operating hours.
                  </p>
                  <input type="time" className="input" value={form.time_booked}
                    onChange={e => set('time_booked', e.target.value)} min="18:00" max="23:00" step="300" />
                </div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => set('time_booked', s.time)}
                      className={`min-h-[56px] rounded-xl text-base font-semibold border-2 transition-all ${
                        form.time_booked === s.time
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : s.available
                            ? 'bg-white border-gray-300 text-gray-800 hover:border-blue-400 hover:bg-blue-50'
                            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                      }`}
                    >
                      {s.time}
                      <div className="text-xs font-normal opacity-60">50 min</div>
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

            {sessionInfo && (
              <div className={`mt-2 text-sm rounded-lg px-3 py-2 font-medium ${
                sessionInfo.used >= sessionInfo.max
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : sessionInfo.used >= sessionInfo.max - 1
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-gray-50 border border-gray-200 text-gray-600'
              }`}>
                {sessionInfo.used}/{sessionInfo.max} sessions booked tonight
                {sessionInfo.used >= sessionInfo.max && ' — limit reached'}
              </div>
            )}

            {form.location === 'Solace Café' && form.date && !dayInvalid && !slotsLoading && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => { setEmergencyMode(m => !m); set('time_booked', '') }}
                  className="text-sm text-orange-600 underline hover:text-orange-700"
                >
                  {emergencyMode ? '← Back to standard slots' : 'Emergency / off-hour booking'}
                </button>
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Interaction Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

          <div className="field">
            <label className="label">Assign To</label>
            <div className="relative">
              <input
                className="input"
                value={assignSearch}
                onChange={e => { setAssignSearch(e.target.value); setAssignDropdownOpen(true) }}
                onFocus={() => { setAssignSearch(''); setAssignDropdownOpen(true) }}
                onBlur={() => setTimeout(() => setAssignDropdownOpen(false), 150)}
                placeholder={form.assigned_to ? form.assigned_to : 'Assign Later — type to search'}
              />
              {assignDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-500 border-b border-gray-100"
                    onMouseDown={() => { set('assigned_to', null); setAssignSearch(''); setAssignDropdownOpen(false) }}
                  >
                    — Assign Later
                  </button>
                  {filteredStaff.map(email => (
                    <button
                      key={email}
                      type="button"
                      className={'w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm' + (form.assigned_to === email ? ' bg-blue-50 font-semibold' : '')}
                      onMouseDown={() => { set('assigned_to', email); setAssignSearch(''); setAssignDropdownOpen(false) }}
                    >
                      {email}{email === user?.email ? ' (you)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {form.assigned_to
                ? <>Assigned to <strong className="text-gray-600">{form.assigned_to}</strong> — will appear on their schedule</>
                : 'Not assigned — will not appear on anyone\'s schedule until assigned'}
            </p>
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

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || isLocked}
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
