import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import RepeatUserSearch from '../components/RepeatUserSearch'

const REFERRAL_SOURCES = [
  'Self-referral',
  'Local NGO and Community Partner Agency',
  'Primary Care Provider',
  'NGO Stakeholder',
  'Community Mental Health Team',
  'Liaison Psychiatry Team',
  'Crisis Resolution Team',
  'Other',
]

const REASONS = [
  'Feeling unable to cope or in crisis',
  'Information seeking',
  'To attend support or training event',
  'Looking for Peer support',
  'Looking for Social Support',
  'Other',
  'Prefer not to say',
]

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']

function RadioGroup({ label, options, value, onChange, required }) {
  return (
    <div className="field">
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`min-h-[44px] px-4 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95 ${
              value === opt
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckGroup({ label, options, values, onChange }) {
  const toggle = (opt) => {
    const arr = values || []
    onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt])
  }
  return (
    <div className="field">
      <label className="label">{label}</label>
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`w-full min-h-[48px] text-left px-4 rounded-xl border-2 font-semibold text-base transition-all flex items-center gap-3 ${
              (values || []).includes(opt)
                ? 'bg-blue-50 border-blue-500 text-blue-800'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
              (values || []).includes(opt) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'
            }`}>
              {(values || []).includes(opt) && '✓'}
            </span>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function IntakeForm() {
  const { id: bookingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [booking, setBooking] = useState(null)
  const [existingIntake, setExistingIntake] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Repeat user state
  const [isRepeat, setIsRepeat] = useState(false)
  const [existingUser, setExistingUser] = useState(null)

  // Page 1 — Service User Info
  const [su, setSu] = useState({
    full_name: '', phone: '', email: '',
    age_group: '', gender: '', living_alone: '',
    english_speaking: '', translator_required: '', translator_language: '',
    address: '', emergency_contact_name: '', emergency_contact_relationship: '',
    emergency_contact_phone: '', gp_name: '', gp_phone: '',
    ed_diversion: null,
  })

  // Page 2 — Referral & Reasons
  const [p2, setP2] = useState({
    referral_source: '',
    referred_by_name: '', referred_by_role: '', referred_by_phone: '', referred_by_email: '',
    reasons_for_attending: [],
    privacy_acknowledged: false,
    safety_agreement_acknowledged: false,
    confidentiality_limits_explained: false,
    staff_member: user?.name || '',
    signed_date: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/bookings/${bookingId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/intake-forms/booking/${bookingId}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([b, intake]) => {
      setBooking(b)
      if (b.full_name) setSu(prev => ({ ...prev, full_name: b.full_name, phone: b.phone || '' }))
      if (b.new_or_repeat === 'Repeat') setIsRepeat(true)
      if (intake) {
        setExistingIntake(intake)
        setP2({
          referral_source: intake.referral_source || '',
          referred_by_name: intake.referred_by_name || '',
          referred_by_role: intake.referred_by_role || '',
          referred_by_phone: intake.referred_by_phone || '',
          referred_by_email: intake.referred_by_email || '',
          reasons_for_attending: intake.reasons_for_attending || [],
          privacy_acknowledged: !!intake.privacy_acknowledged,
          safety_agreement_acknowledged: !!intake.safety_agreement_acknowledged,
          confidentiality_limits_explained: !!intake.confidentiality_limits_explained,
          staff_member: intake.staff_member || user?.name || '',
          signed_date: intake.signed_date || new Date().toISOString().slice(0, 10),
        })
      }
    }).finally(() => setLoading(false))
  }, [bookingId, user])

  // Load service user data if booking has one
  useEffect(() => {
    if (booking?.service_user_id) {
      fetch(`/api/service-users/${booking.service_user_id}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setSu(prev => ({
            full_name: data.full_name || prev.full_name,
            phone: data.phone || prev.phone,
            email: data.email || prev.email,
            age_group: data.age_group || prev.age_group,
            gender: data.gender || prev.gender,
            living_alone: data.living_alone || prev.living_alone,
            english_speaking: data.english_speaking || prev.english_speaking,
            translator_required: data.translator_required || prev.translator_required,
            translator_language: data.translator_language || prev.translator_language,
            address: data.address || prev.address,
            emergency_contact_name: data.emergency_contact_name || prev.emergency_contact_name,
            emergency_contact_relationship: data.emergency_contact_relationship || prev.emergency_contact_relationship,
            emergency_contact_phone: data.emergency_contact_phone || prev.emergency_contact_phone,
            gp_name: data.gp_name || prev.gp_name,
            gp_phone: data.gp_phone || prev.gp_phone,
            ed_diversion: booking.ed_diversion ?? null,
          }))
        }).catch(() => {})
    }
  }, [booking])

  const setSuField = (field, value) => setSu(prev => ({ ...prev, [field]: value }))
  const setP2Field = (field, value) => setP2(prev => ({ ...prev, [field]: value }))

  const validatePage1 = () => {
    if (!isRepeat) {
      if (!su.full_name) return 'Full name is required'
    }
    return null
  }

  const validatePage2 = () => {
    if (!p2.privacy_acknowledged) return 'Privacy policy must be acknowledged'
    if (!p2.safety_agreement_acknowledged) return 'Safety agreement must be acknowledged'
    if (!p2.confidentiality_limits_explained) return 'Limits to confidentiality must be acknowledged'
    return null
  }

  const goToPage2 = () => {
    const err = validatePage1()
    if (err) { setError(err); return }
    setError('')
    setPage(2)
    window.scrollTo(0, 0)
  }

  const submit = async () => {
    const err = validatePage2()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    const payload = {
      booking_id: parseInt(bookingId),
      service_user_id: booking?.service_user_id || null,
      is_repeat: isRepeat,
      existing_user_id: existingUser?.id || booking?.service_user_id || null,
      ...su,
      ...p2,
    }

    try {
      const res = await fetch('/api/intake-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return }
      navigate(`/bookings/${bookingId}/outcome`)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (loading) return <Layout title="Intake Form"><div className="py-20 text-center text-gray-500">Loading...</div></Layout>

  return (
    <Layout title="Intake Form" back="/cases">
      {/* Progress indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`flex-1 h-2 rounded-full ${page >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${page >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <span className="text-sm text-gray-500 font-medium">Page {page} of 2</span>
      </div>

      {booking && (
        <div className="card mb-4 bg-blue-50 border-blue-200">
          <div className="font-bold">{booking.full_name || 'Unnamed'}</div>
          <div className="text-sm text-blue-700">{booking.date} at {booking.time_booked} • {booking.location}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 font-semibold mb-4">
          {error}
        </div>
      )}

      {existingIntake && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-4 text-amber-800 text-sm font-medium">
          ✏️ Editing existing intake form
        </div>
      )}

      {/* ===== PAGE 1 ===== */}
      {page === 1 && (
        <div className="space-y-5 pb-10">
          {/* Repeat user search */}
          <div className="card">
            <h2 className="text-xl font-bold mb-1">Service User</h2>
            <p className="text-sm text-gray-500 mb-4">Search for an existing record first</p>

            <div className="field">
              <label className="label">Search existing records</label>
              <RepeatUserSearch
                onSelect={(u) => {
                  setExistingUser(u)
                  setIsRepeat(true)
                  setSu(prev => ({ ...prev, full_name: u.full_name, phone: u.phone || '' }))
                }}
                onClear={() => { setExistingUser(null); setIsRepeat(false) }}
              />
            </div>

            {existingUser && (
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setIsRepeat(true)}
                  className={`flex-1 min-h-[48px] rounded-xl border-2 font-semibold ${isRepeat ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  ✓ Same person (Repeat)
                </button>
                <button
                  onClick={() => { setIsRepeat(false); setExistingUser(null) }}
                  className="flex-1 min-h-[48px] rounded-xl border-2 border-gray-300 font-semibold text-gray-700"
                >
                  Different person
                </button>
              </div>
            )}
          </div>

          {/* Only show full form if not repeat (or if editing) */}
          {(!isRepeat || existingIntake) && (
            <>
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Personal Information</h2>

                <div className="field">
                  <label className="label">Full Name <span className="text-red-500">*</span></label>
                  <input className="input" value={su.full_name} onChange={e => setSuField('full_name', e.target.value)} />
                </div>

                <RadioGroup label="Age Group" options={AGE_GROUPS} value={su.age_group}
                  onChange={v => setSuField('age_group', v)} />

                <RadioGroup label="Gender" options={['Male', 'Female', 'Prefer not to say']}
                  value={su.gender} onChange={v => setSuField('gender', v)} />

                <RadioGroup label="Living Alone?" options={['Yes', 'No']}
                  value={su.living_alone} onChange={v => setSuField('living_alone', v)} />

                <RadioGroup label="English Speaking?" options={['Yes', 'No']}
                  value={su.english_speaking} onChange={v => setSuField('english_speaking', v)} />

                {su.english_speaking === 'No' && (
                  <>
                    <RadioGroup label="Translator Required?" options={['Yes', 'No']}
                      value={su.translator_required} onChange={v => setSuField('translator_required', v)} />
                    {su.translator_required === 'Yes' && (
                      <div className="field">
                        <label className="label">Language</label>
                        <input className="input" value={su.translator_language || ''}
                          onChange={e => setSuField('translator_language', e.target.value)}
                          placeholder="What language is needed?" />
                      </div>
                    )}
                  </>
                )}

                <div className="field">
                  <label className="label">Address</label>
                  <input className="input" value={su.address} onChange={e => setSuField('address', e.target.value)}
                    placeholder="Home address" />
                </div>

                <div className="field">
                  <label className="label">Phone (for emergencies)</label>
                  <input className="input" type="tel" value={su.phone} onChange={e => setSuField('phone', e.target.value)} />
                </div>

                <div className="field">
                  <label className="label">Email (optional, for updates)</label>
                  <input className="input" type="email" value={su.email} onChange={e => setSuField('email', e.target.value)} />
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-bold mb-4">Emergency Contact</h2>
                <div className="field">
                  <label className="label">Contact Name</label>
                  <input className="input" value={su.emergency_contact_name}
                    onChange={e => setSuField('emergency_contact_name', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Relationship</label>
                  <input className="input" value={su.emergency_contact_relationship}
                    onChange={e => setSuField('emergency_contact_relationship', e.target.value)}
                    placeholder="e.g. Parent, Partner, Friend" />
                </div>
                <div className="field">
                  <label className="label">Contact Phone</label>
                  <input className="input" type="tel" value={su.emergency_contact_phone}
                    onChange={e => setSuField('emergency_contact_phone', e.target.value)} />
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-bold mb-4">GP Details</h2>
                <div className="field">
                  <label className="label">GP Name</label>
                  <input className="input" value={su.gp_name} onChange={e => setSuField('gp_name', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">GP Phone</label>
                  <input className="input" type="tel" value={su.gp_phone} onChange={e => setSuField('gp_phone', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ED Diversion — always shown */}
          <div className="card border-2 border-amber-300 bg-amber-50">
            <h2 className="text-xl font-bold mb-2 text-amber-900">A&E Diversion</h2>
            <p className="text-amber-800 mb-4">
              Would you have attended the Accident & Emergency Department or another clinical service
              if Limerick Mental Health Association was not available?
            </p>
            <div className="flex gap-3">
              {['Yes', 'No'].map(v => (
                <button
                  key={v}
                  onClick={() => setSuField('ed_diversion', v === 'Yes' ? 1 : 0)}
                  className={`flex-1 min-h-[56px] rounded-xl border-2 text-xl font-bold transition-all ${
                    su.ed_diversion === (v === 'Yes' ? 1 : 0)
                      ? v === 'Yes' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-gray-500 border-gray-500 text-white'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={goToPage2} className="btn-primary btn-lg w-full">
            Continue to Page 2 →
          </button>
        </div>
      )}

      {/* ===== PAGE 2 ===== */}
      {page === 2 && (
        <div className="space-y-5 pb-10">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Referral Information</h2>

            <CheckGroup
              label="How were you referred?"
              options={REFERRAL_SOURCES}
              values={p2.referral_source ? [p2.referral_source] : []}
              onChange={vals => setP2Field('referral_source', vals[vals.length - 1] || '')}
            />

            <div className="field">
              <label className="label">Referred by — Name</label>
              <input className="input" value={p2.referred_by_name}
                onChange={e => setP2Field('referred_by_name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Role</label>
              <input className="input" value={p2.referred_by_role}
                onChange={e => setP2Field('referred_by_role', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">Phone</label>
                <input className="input" type="tel" value={p2.referred_by_phone}
                  onChange={e => setP2Field('referred_by_phone', e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Email</label>
                <input className="input" type="email" value={p2.referred_by_email}
                  onChange={e => setP2Field('referred_by_email', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <CheckGroup
              label="Reason for attending today"
              options={REASONS}
              values={p2.reasons_for_attending}
              onChange={vals => setP2Field('reasons_for_attending', vals)}
            />
          </div>

          {/* Acknowledgements — CRITICAL */}
          <div className="card border-2 border-blue-300 bg-blue-50">
            <h2 className="text-xl font-bold mb-4 text-blue-900">Acknowledgements</h2>
            <p className="text-blue-700 text-sm mb-4">All three must be confirmed before submitting.</p>

            {[
              { key: 'privacy_acknowledged', label: 'Privacy policy acknowledged', desc: 'The service user has been informed about how their data is stored and used.' },
              { key: 'safety_agreement_acknowledged', label: 'Safety agreement acknowledged', desc: 'The service user has confirmed no intent to self-harm and is aware of our duty of care.' },
              { key: 'confidentiality_limits_explained', label: 'Limits to confidentiality explained', desc: 'The service user has been informed about our mandated reporting obligations to the HSE.' },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => setP2Field(key, !p2[key])}
                className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-all ${
                  p2[key] ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    p2[key] ? 'bg-green-600 border-green-600 text-white' : 'border-gray-400'
                  }`}>
                    {p2[key] && <span className="text-base">✓</span>}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{label}</div>
                    <div className="text-sm text-gray-600 mt-0.5">{desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Staff Sign-off</h2>
            <div className="field">
              <label className="label">Staff Member</label>
              <input className="input" value={p2.staff_member}
                onChange={e => setP2Field('staff_member', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Date</label>
              <input type="date" className="input" value={p2.signed_date}
                onChange={e => setP2Field('signed_date', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setPage(1); window.scrollTo(0, 0) }}
              className="btn-secondary btn-lg flex-1">
              ← Back
            </button>
            <button onClick={submit} disabled={saving} className="btn-success btn-lg flex-1">
              {saving ? 'Saving...' : 'Submit Intake Form'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
