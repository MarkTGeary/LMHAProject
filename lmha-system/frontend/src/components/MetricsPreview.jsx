export default function MetricsPreview({ metrics }) {
  if (!metrics) return null
  const {
    section1: s1, section2: s2, section3: s3, section4: s4,
    section5_cv: s5cv, section5_statutory: s5stat,
    limitations: lim, feedback: fb,
    dateRange, location,
  } = metrics

  // Rows whose values sum to the section TOTAL are tinted green; section
  // totals are tinted yellow. Informational rows (collected but not summed
  // into the total, e.g. age bands) are left untinted via `info`.
  const Row = ({ label, value, total, info }) => (
    <div className={`flex justify-between items-center py-2 px-2 rounded border-b border-gray-100 last:border-0 ${
      total ? 'font-bold bg-yellow-100 border-yellow-200' : info ? 'bg-white' : 'bg-green-50'
    }`}>
      <span className={`text-sm ${total ? 'text-gray-900' : 'text-gray-700'}`}>{label}</span>
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
        <Row label="Total bookings received" value={s1?.total_bookings_received} info />
        <Row label="Total attendees through bookings" value={s1?.total_attendees_through_bookings} />
        <Row label="Walk-in crisis support" value={s1?.total_walk_in_crisis} />
        <Row label="Support calls" value={s1?.total_support_calls} />
        <Row label="Walk-in social support" value={s1?.total_walk_in_social} />
        <Row label="Did not attend" value={s1?.total_dna} info />
        <Row label="Family/Carer attendees" value={s1?.total_carer_attendees} info />
        <Row label="Male" value={s1?.total_male} info />
        <Row label="Female" value={s1?.total_female} info />
        <Row label="Other / Prefer not to say" value={s1?.total_other_gender} info />
        <Row label="New attendees" value={s1?.total_new} info />
        <Row label="Repeat attendees" value={s1?.total_repeat} info />
        <Row label="Age 18–24" value={s1?.age_18_24} info />
        <Row label="Age 25–34" value={s1?.age_25_34} info />
        <Row label="Age 35–44" value={s1?.age_35_44} info />
        <Row label="Age 45–54" value={s1?.age_45_54} info />
        <Row label="Age 55–64" value={s1?.age_55_64} info />
        <Row label="Age 65+" value={s1?.age_65_plus} info />
        <Row label="Age Unknown" value={s1?.age_unknown} info />
        <Row label="TOTAL People" value={s1?.total_people} total />
      </Section>

      <Section title="Section 2 — Support Requirements">
        <Row label="Information seeking only" value={s2?.information_seeking} />
        <Row label="Social support / signposting / self-reflection" value={s2?.social_support_signposting} />
        <Row label="One-to-one peer support" value={s2?.one_to_one_peer_support} />
        <Row label="Crisis support" value={s2?.crisis_support} />
        <Row label="Other supports (phone, email, text, etc.)" value={s2?.other_supports} />
        <Row label="TOTAL" value={s2?.total} total />
      </Section>

      <Section title="Section 3 — Support Requirements by Type">
        <Row label="Info: statutory MH services (HSE)" value={s3?.info_statutory_mh_hse} />
        <Row label="Info: non-statutory MH supports" value={s3?.info_non_statutory_mh} />
        <Row label="Info: wider community supports (e.g. MABS)" value={s3?.info_wider_community} />
        <Row label="Peer support — enhance coping skills" value={s3?.peer_support_coping} />
        <Row label="Peer support — support recovery" value={s3?.peer_support_recovery} />
        <Row label="Crisis — de-escalation" value={s3?.crisis_deescalation} />
        <Row label="Crisis — onward referral to A&E" value={s3?.crisis_onward_ae} />
        <Row label="Crisis — Gardaí / community support" value={s3?.crisis_guards_community} />
        <Row label="Social support" value={s3?.social_support} />
        <Row label="TOTAL" value={s3?.total} total />
      </Section>

      <Section title="Section 4 — Referral Activity">
        <Row label="Self-referral" value={s4?.self_referral} />
        <Row label="Community organisations (NGOs/Charities)" value={s4?.community_ngo} />
        <Row label="HSE Mental Health Services" value={s4?.hse_mh_services} />
        <Row label="HSE Health Services (Disability, Older Persons, Primary Care)" value={s4?.hse_health_services} />
        <Row label="GP" value={s4?.gp} />
        <Row label="Other" value={s4?.other_referral} />
        <Row label="CAST" value={s4?.cast_referral} />
        <Row label="LSW" value={s4?.lsw_referral} />
        <Row label="LTSP" value={s4?.ltsp_referral} />
        <Row label="Probation" value={s4?.probation_referral} />
        <Row label="Would have attended A&E if service not available" value={s4?.ed_diversion_yes} info />
        <Row label="TOTAL" value={s4?.total} total />
      </Section>

      <Section title="Section 5 — Advocacy / Follow-up: Community & Voluntary">
        <Row label="C&V Counselling Services (MyMind, Turn2Me etc)" value={s5cv?.cv_counselling} />
        <Row label="C&V Housing Support Services" value={s5cv?.cv_housing} />
        <Row label="C&V Finance Support Services" value={s5cv?.cv_finance} />
        <Row label="C&V MH Support Groups (GROW, Aware, Shine, Adapt etc)" value={s5cv?.cv_mh_groups} />
        <Row label="C&V Addiction/Substance Misuse Groups (AlAnon, AA etc)" value={s5cv?.cv_addiction_groups} />
        <Row label="C&V Family Support Services" value={s5cv?.cv_family} />
        <Row label="TOTAL" value={s5cv?.total} total />
      </Section>

      <Section title="Section 5 — Advocacy / Follow-up: Statutory Services">
        <Row label="HSE Mental Health Services" value={s5stat?.statutory_hse_mh} />
        <Row label="HSE Primary Care Services" value={s5stat?.statutory_hse_primary_care} />
        <Row label="HSE Disability Services" value={s5stat?.statutory_hse_disability} />
        <Row label="HSE Older Persons" value={s5stat?.statutory_hse_older_persons} />
        <Row label="HSE CRT" value={s5stat?.statutory_hse_crt} />
        <Row label="Tusla" value={s5stat?.statutory_tusla} />
        <Row label="MABS" value={s5stat?.statutory_mabs} />
        <Row label="Dept of Social Protection" value={s5stat?.statutory_dept_social} />
        <Row label="Citizens Information" value={s5stat?.statutory_citizens_info} />
        <Row label="AGS (Gardaí)" value={s5stat?.statutory_ags} />
        <Row label="TOTAL" value={s5stat?.total} total />
      </Section>

      <Section title="Miscellaneous — Feedback from Service Users">
        <Row label="Thank you letter / Card / Email" value={fb?.thankyou_letters} />
        <Row label="Verbal Feedback" value={fb?.verbal_feedback} />
        <Row label="Testimonials" value={fb?.testimonials} />
        <Row label="Vox Pop (on street)" value={fb?.vox_pop} />
        <Row label="TOTAL" value={(fb?.thankyou_letters ?? 0) + (fb?.verbal_feedback ?? 0) + (fb?.testimonials ?? 0) + (fb?.vox_pop ?? 0)} total />
      </Section>

      <Section title="Limitations — Out-of-Hours Contact">
        <Row label="Individuals who could not be facilitated" value={lim?.lim_indv_not_facilitated} info />
        {location === 'LMHA' ? (
          <>
            <Row label="Looked for appointment on Saturday" value={lim?.lim_day1} />
            <Row label="Looked for appointment on Sunday" value={lim?.lim_day2} />
            <Row label="Looked for appointment before 11am" value={lim?.lim_time_early} />
            <Row label="Looked for appointment after 5pm" value={lim?.lim_time_late} />
          </>
        ) : (
          <>
            <Row label="Looked for appointment on Monday" value={lim?.lim_day1} />
            <Row label="Looked for appointment on Tuesday" value={lim?.lim_day2} />
            <Row label="Looked for appointment on Wednesday" value={lim?.lim_day3} />
            <Row label="Looked for appointment before 6pm" value={lim?.lim_time_early} />
            <Row label="Looked for appointment after midnight" value={lim?.lim_time_late} />
          </>
        )}
        <Row label="Could not offer an appointment within the week" value={lim?.lim_no_appointment_week} />
        <Row label="Forced to close due to short staff" value={lim?.lim_closed_short_staff} />
        <Row label="Calls out of hours" value={lim?.lim_calls_out_hours} />
        <Row label="Text out of hours" value={lim?.lim_text_out_hours} />
        <Row label="TOTAL" value={lim?.total} total />
      </Section>
    </div>
  )
}
