export default function MetricsPreview({ metrics }) {
  if (!metrics) return null
  const { section1: s1, section2: s2, section3: s3, section4: s4, dateRange, location } = metrics

  const Row = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="font-bold text-gray-900 text-lg min-w-[40px] text-right">{value ?? 0}</span>
    </div>
  )

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <h3 className="font-bold text-base text-gray-800 bg-gray-100 rounded-lg px-3 py-2 mb-2">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="print-metrics">
      {/* Print header */}
      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-2xl font-bold">Limerick Mental Health Association</h1>
        <h2 className="text-xl">{location} — Metrics Report</h2>
        <p>{dateRange?.startDate} to {dateRange?.endDate}</p>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString('en-IE')}</p>
      </div>

      <Section title="Section 1 — General Service Information">
        <Row label="Total bookings received" value={s1?.total_bookings_received} />
        <Row label="Total attendees through bookings" value={s1?.total_attendees_through_bookings} />
        <Row label="Walk-in crisis support" value={s1?.total_walk_in_crisis} />
        <Row label="Support calls" value={s1?.total_support_calls} />
        <Row label="Walk-in social support" value={s1?.total_walk_in_social} />
        <Row label="Did not attend" value={s1?.total_dna} />
        <Row label="Family/Carer attendees" value={s1?.total_carer_attendees} />
        <Row label="Male" value={s1?.total_male} />
        <Row label="Female" value={s1?.total_female} />
        <Row label="Other/Prefer not to say" value={s1?.total_other_gender} />
        <Row label="New attendees" value={s1?.total_new} />
        <Row label="Repeat attendees" value={s1?.total_repeat} />
        <Row label="Age 18–24" value={s1?.age_18_24} />
        <Row label="Age 25–34" value={s1?.age_25_34} />
        <Row label="Age 35–44" value={s1?.age_35_44} />
        <Row label="Age 45–54" value={s1?.age_45_54} />
        <Row label="Age 55–64" value={s1?.age_55_64} />
        <Row label="Age 65+" value={s1?.age_65_plus} />
      </Section>

      <Section title="Section 2 — Support Requirements">
        <Row label="Information seeking only" value={s2?.information_seeking} />
        <Row label="Social support / signposting / self-reflection" value={s2?.social_support_signposting} />
        <Row label="One-to-one peer support" value={s2?.one_to_one_peer_support} />
        <Row label="Crisis support" value={s2?.crisis_support} />
        <Row label="Other supports (phone, email, text, etc.)" value={s2?.other_supports} />
      </Section>

      <Section title="Section 3 — Support Requirements by Type">
        <Row label="Info: statutory MH services (HSE)" value={s3?.info_statutory_mh_hse} />
        <Row label="Info: non-statutory MH supports" value={s3?.info_non_statutory_mh} />
        <Row label="Info: wider community supports (e.g. MABS)" value={s3?.info_wider_community} />
        <Row label="Peer support — enhance coping skills" value={s3?.peer_support_coping} />
        <Row label="Peer support — support recovery" value={s3?.peer_support_recovery} />
        <Row label="Crisis — de-escalation" value={s3?.crisis_deescalation} />
        <Row label="Crisis — onward referral to A&E" value={s3?.crisis_onward_ae} />
        <Row label="Crisis — guards / community support" value={s3?.crisis_guards_community} />
        <Row label="Social support" value={s3?.social_support} />
      </Section>

      <Section title="Section 4 — Referral Activity">
        <Row label="Self-referral" value={s4?.self_referral} />
        <Row label="Community organisations (NGOs/Charities)" value={s4?.community_ngo} />
        <Row label="HSE Mental Health Services" value={s4?.hse_mh_services} />
        <Row label="HSE Health Services (Disability, Older Persons, Primary Care)" value={s4?.hse_health_services} />
        <Row label="GP" value={s4?.gp} />
        <Row label="Other" value={s4?.other_referral} />
      </Section>
    </div>
  )
}
