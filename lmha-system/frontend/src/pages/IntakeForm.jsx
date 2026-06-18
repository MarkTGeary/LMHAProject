import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import RepeatUserSearch from '../components/RepeatUserSearch'
import { apiFetch } from '../lib/api'
import { isBookingLocked, LOCK_MESSAGE } from '../lib/constants'

const REFERRAL_SOURCES = [
  'Self-referral',
  'Local NGO and Community Partner Agency',
  'HSE Health Services',
  'GP',
  'Community Mental Health Team',
  'Liaison Psychiatry Team',
  'Crisis Resolution Team',
  'CAST',
  'LSW',
  'LTSP',
  'Probation',
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

const SUPPORT_NEEDS_OPTIONS = [
  { key: 'info_statutory_mh',    label: 'Information on statutory MH services (HSE Mental Health Services)' },
  { key: 'info_non_statutory_mh', label: 'Information on non-statutory MH supports (counselling, group supports etc)' },
  { key: 'info_wider_community', label: 'Information on wider community supports (MABS, Family Resource etc)' },
  { key: 'peer_coping',          label: 'Peer support to enhance coping skills' },
  { key: 'peer_recovery',        label: 'Peer support to support recovery' },
  { key: 'crisis_deescalation',  label: 'Crisis support — de-escalation' },
  { key: 'crisis_ae',            label: 'Crisis support — onward referral to A&E' },
  { key: 'crisis_guards',        label: 'Crisis support — Gardaí or other community support' },
  { key: 'social',               label: 'Social support' },
]

const ONWARD_REFERRAL_OPTIONS = [
  { group: 'Community & Voluntary Services', items: [
    { key: 'cv_counselling',      label: 'C&V Counselling Services (MyMind, Turn2Me etc)' },
    { key: 'cv_housing',          label: 'C&V Housing Support Services (Focus Ireland, Simon etc)' },
    { key: 'cv_finance',          label: 'C&V Finance Support Services' },
    { key: 'cv_mh_groups',        label: 'C&V MH Support Groups (GROW, Aware, Shine, Adapt etc)' },
    { key: 'cv_addiction_groups', label: 'C&V Addiction/Substance Misuse Groups (AlAnon, AA etc)' },
    { key: 'cv_family',           label: 'C&V Family Support Services (One Family, Family Resource Centres etc)' },
  ]},
  { group: 'Statutory Services', items: [
    { key: 'hse_mh',               label: 'HSE Mental Health Services' },
    { key: 'hse_primary_care',     label: 'HSE Primary Care Services' },
    { key: 'hse_disability',       label: 'HSE Disability Services' },
    { key: 'hse_older_persons',    label: 'HSE Older Persons' },
    { key: 'hse_crt',              label: 'HSE CRT' },
    { key: 'tusla',                label: 'Tusla' },
    { key: 'mabs',                 label: 'MABS' },
    { key: 'dept_social_protection', label: 'Dept of Social Protection' },
    { key: 'citizens_information', label: 'Citizens Information' },
    { key: 'ags',                  label: 'AGS (Gardaí)' },
  ]},
]

// Solace Café: Thu–Sun 18:00–00:00 — closed Mon/Tue/Wed, before 6pm, after midnight
const LIMITATIONS_SOLACE = [
  { key: 'monday',             label: 'Looked for appointment on Monday' },
  { key: 'tuesday',            label: 'Looked for appointment on Tuesday' },
  { key: 'wednesday',          label: 'Looked for appointment on Wednesday' },
  { key: 'before_6pm',         label: 'Looked for appointment before 6pm' },
  { key: 'after_midnight',     label: 'Looked for appointment after midnight' },
  { key: 'no_appointment_in_week', label: 'Could not offer an appointment within the week' },
  { key: 'closed_short_staff',     label: 'Forced to close due to short staff' },
  { key: 'calls_out_of_hours', label: 'Calls out of hours' },
  { key: 'text_out_of_hours',  label: 'Text out of hours' },
]

// LMHA: Mon–Fri 11:00–17:00 — closed weekends, before 11am, after 5pm
const LIMITATIONS_LMHA = [
  { key: 'saturday',           label: 'Looked for appointment on Saturday' },
  { key: 'sunday',             label: 'Looked for appointment on Sunday' },
  { key: 'before_11am',        label: 'Looked for appointment before 11am' },
  { key: 'after_5pm',          label: 'Looked for appointment after 5pm' },
  { key: 'no_appointment_in_week', label: 'Could not offer an appointment within the week' },
  { key: 'closed_short_staff',     label: 'Forced to close due to short staff' },
  { key: 'calls_out_of_hours', label: 'Calls out of hours' },
  { key: 'text_out_of_hours',  label: 'Text out of hours' },
]

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Unknown']

function RadioGroup({ label, options, value, onChange, required }) {
  return (
    <div className="field">
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? '' : opt)}
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

// Checkbox group for { key, label } option objects — stores keys, displays labels
function KeyCheckGroup({ label, options, values, onChange }) {
  const toggle = (key) => {
    const arr = values || []
    onChange(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key])
  }
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      <div className="space-y-2">
        {options.map(({ key, label: optLabel }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`w-full min-h-[48px] text-left px-4 rounded-xl border-2 font-semibold text-sm transition-all flex items-center gap-3 ${
              (values || []).includes(key)
                ? 'bg-blue-50 border-blue-500 text-blue-800'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
              (values || []).includes(key) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'
            }`}>
              {(values || []).includes(key) && '✓'}
            </span>
            {optLabel}
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
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Repeat user state
  const [isRepeat, setIsRepeat] = useState(false)
  const [existingUser, setExistingUser] = useState(null)

  // Whether this conversation happened over the phone rather than in person
  const [heldOverPhone, setHeldOverPhone] = useState(false)

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
    // Optional — can be left blank
    support_needs: [],
    onward_referrals: [],
  })

  const applyServiceUserFields = (data) => {
    if (!data) return
    setSu(prev => ({
      ...prev,
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
      ed_diversion: data.ed_diversion ?? prev.ed_diversion,
    }))
  }

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/bookings/${bookingId}`).then(r => r.json()),
      apiFetch(`/api/intake-forms/booking/${bookingId}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([b, intake]) => {
      setBooking(b)
      setIsLocked(isBookingLocked(b.date, user?.isAdmin))
      setHeldOverPhone(!!b.held_over_phone)
      if (b.full_name) setSu(prev => ({ ...prev, full_name: b.full_name, phone: b.phone || '' }))
      if (b.new_or_repeat === 'Repeat') setIsRepeat(true)
      if (intake) {
        setExistingIntake(intake)
        applyServiceUserFields(intake)
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
          support_needs: intake.support_needs || [],
          onward_referrals: intake.onward_referrals || [],
        })
      }
    }).finally(() => setLoading(false))
  }, [bookingId, user])


  // Load service user data if booking has one
  useEffect(() => {
    if (booking?.service_user_id) {
      apiFetch(`/api/service-users/${booking.service_user_id}`)
        .then(r => r.json())
        .then(data => applyServiceUserFields({ ...data, ed_diversion: booking.ed_diversion ?? null }))
        .catch(() => {})
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
      held_over_phone: heldOverPhone,
      ...su,
      ...p2,
    }

    try {
      const res = await apiFetch('/api/intake-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      {isLocked && (
        <div className="bg-gray-100 border-2 border-gray-400 rounded-xl p-4 mb-4 text-gray-700 font-semibold">
          {LOCK_MESSAGE}
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
                onSelect={async (u) => {
                  setExistingUser(u)
                  setIsRepeat(true)
                  setSu(prev => ({ ...prev, full_name: u.full_name, phone: u.phone || '' }))
                  try {
                    const r = await apiFetch(`/api/service-users/${u.id}`)
                    const data = await r.json()
                    setSu(prev => ({
                      ...prev,
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
                    }))
                  } catch {}
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

          <div className="card">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setHeldOverPhone(v => !v)}
                className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${heldOverPhone ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${heldOverPhone ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className="text-base font-semibold text-gray-700">📞 Conversation held over phone (not in person)</span>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Records this as a support call rather than an in-person attendance.
            </p>
          </div>

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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Emergency Contact</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSuField('emergency_contact_name', 'N/A')
                      setSuField('emergency_contact_relationship', 'N/A')
                      setSuField('emergency_contact_phone', 'N/A')
                    }}
                    className="btn-secondary btn-sm"
                  >
                    Skip (N/A)
                  </button>
                </div>
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
                    onChange={e => setSuField('emergency_contact_phone', e.target.value)}
                    placeholder="Phone number or N/A" />
                </div>
          </div>

          <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">GP Details</h2>
                  <button
                    type="button"
                    onClick={() => { setSuField('gp_name', 'N/A'); setSuField('gp_phone', 'N/A') }}
                    className="btn-secondary btn-sm"
                  >
                    Skip (N/A)
                  </button>
                </div>
                <div className="field">
                  <label className="label">GP Name</label>
                  <input className="input" value={su.gp_name} onChange={e => setSuField('gp_name', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">GP Phone</label>
                  <input className="input" type="tel" value={su.gp_phone} onChange={e => setSuField('gp_phone', e.target.value)} />
                </div>
          </div>

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

          <button onClick={goToPage2} disabled={isLocked} className="btn-primary btn-lg w-full">
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

          {/* ── Optional: Support Needs (Section 3) ── */}
          <div className="card border-2 border-gray-200">
            <h2 className="text-lg font-bold mb-1 text-gray-700">Support Needs Assessment <span className="text-sm font-normal text-gray-400">(Optional)</span></h2>
            <p className="text-sm text-gray-500 mb-4">Tick all that apply. Can be completed now or updated later.</p>
            <KeyCheckGroup
              label="What support did this person need?"
              options={SUPPORT_NEEDS_OPTIONS}
              values={p2.support_needs}
              onChange={vals => setP2Field('support_needs', vals)}
            />
          </div>

          {/* ── Optional: Onward Referrals (Section 5) ── */}
          <div className="card border-2 border-gray-200">
            <h2 className="text-lg font-bold mb-1 text-gray-700">Onward Referrals <span className="text-sm font-normal text-gray-400">(Optional)</span></h2>
            <p className="text-sm text-gray-500 mb-4">Where was this person referred to? Can be completed now or updated later.</p>
            {ONWARD_REFERRAL_OPTIONS.map(({ group, items }) => (
              <div key={group} className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{group}</div>
                <KeyCheckGroup
                  options={items}
                  values={p2.onward_referrals}
                  onChange={vals => setP2Field('onward_referrals', vals)}
                />
              </div>
            ))}
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
            <button onClick={submit} disabled={saving || isLocked} className="btn-success btn-lg flex-1">
              {saving ? 'Saving...' : 'Submit Intake Form'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
