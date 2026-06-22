const db = require('../db');

/**
 * Aggregate all metric sections from Turso for a date range + location.
 * Returns an object matching the Google Sheets sections.
 */
async function aggregateMetrics(location, startDate, endDate) {
  const [bookingsResult, standaloneResult] = await Promise.all([
    db.execute({
      sql: `SELECT b.*,
                   i.id as intake_id,
                   i.referral_source, i.reasons_for_attending,
                   i.support_needs, i.onward_referrals,
                   i.limitations_detail as intake_limitations_detail
            FROM bookings b
            LEFT JOIN intake_forms i ON i.booking_id = b.id
            WHERE b.location = ?
              AND b.date BETWEEN ? AND ?
              AND b.status != 'Cancelled'`,
      args: [location, startDate, endDate],
    }),
    db.execute({
      sql: `SELECT * FROM standalone_limitations WHERE location = ? AND date BETWEEN ? AND ?`,
      args: [location, startDate, endDate],
    }),
  ]);
  const bookings = bookingsResult.rows;
  const standaloneLimitations = standaloneResult.rows;

  const dna         = bookings.filter(b => b.outcome === 'Did Not Attend');
  const serviceBookings = bookings.filter(b => b.outcome !== 'Did Not Attend');

  // A support call is a remote / information-seeking contact (phone or flagged):
  // it counts toward support calls and Total People, but NOT toward bookings
  // received or attendees-through-bookings.
  const isSupportCall = (b) =>
    Number(b.information_seeking) === 1 ||
    Number(b.held_over_phone) === 1 ||
    b.interaction_type === 'Phone Call';
  // Walk-ins / crises are counted in their own buckets, separate from bookings.
  const isWalkIn = (b) =>
    b.interaction_type === 'Walk-In' || b.interaction_type === 'Crisis';

  const supportCalls = serviceBookings.filter(isSupportCall);

  // Build user list from all service interactions with a known service user —
  // not just attended/intake-complete ones — so demographics capture everyone
  // supported and stay consistent with total_people counts.
  const userIds = [...new Set(serviceBookings.filter(b => b.service_user_id).map(b => b.service_user_id))];
  let users = [];
  if (userIds.length) {
    const usersResult = await db.execute({
      sql: `SELECT * FROM service_users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      args: userIds,
    });
    users = usersResult.rows;
  }

  // --- Helpers ---

  function parseJson(val) {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  }

  function hasSupport(booking, type) {
    return parseJson(booking.type_of_support).includes(type);
  }

  function countNeed(key) {
    return serviceBookings.filter(b => parseJson(b.support_needs).includes(key)).length;
  }

  function countOnward(key) {
    return serviceBookings.filter(b => parseJson(b.onward_referrals).includes(key)).length;
  }

  function countLimitation(key) {
    const fromBookings = bookings.filter(b => {
      const fromBooking = parseJson(b.limitations_detail);
      const fromIntake = parseJson(b.intake_limitations_detail);
      return fromBooking.includes(key) || fromIntake.includes(key);
    }).length;
    const fromStandalone = standaloneLimitations.filter(r =>
      parseJson(r.limitations_detail).includes(key)
    ).length;
    return fromBookings + fromStandalone;
  }

  // --- Section 1: General Service Information ---
  const s1 = {
    // Only in-person appointments count as bookings received.
    // Phone calls (held_over_phone or Phone Call type) and information-seeking
    // contacts are support calls, not booked appointments.
    total_bookings_received: bookings.filter(b =>
      Number(b.information_seeking) !== 1 &&
      Number(b.held_over_phone) !== 1 &&
      b.interaction_type !== 'Phone Call'
    ).length,
    // The four event types are mutually exclusive (one per attended booking)
    // so they sum cleanly into total_people below. Set in the Outcome form.
    total_attendees_through_bookings: bookings.filter(b => b.service_event_type === 'Attended through booking').length,
    total_walk_in_crisis:             bookings.filter(b => b.service_event_type === 'Walk-in crisis').length,
    total_support_calls:              bookings.filter(b => b.service_event_type === 'Support call' || Number(b.information_seeking) === 1).length,
    total_walk_in_social:             bookings.filter(b => b.service_event_type === 'Walk-in social').length,
    total_dna:              dna.length,
    total_carer_attendees:  bookings.filter(b => b.carer_attended).length,
    total_male:             users.filter(u => u.gender === 'Male').length,
    total_female:           users.filter(u => u.gender === 'Female').length,
    total_other_gender:     users.filter(u => u.gender === 'Prefer not to say' || u.gender === 'Other').length,
    total_new:              serviceBookings.filter(b => b.new_or_repeat === 'New').length,
    total_repeat:           serviceBookings.filter(b => b.new_or_repeat === 'Repeat').length,
    age_18_24:  users.filter(u => u.age_group === '18-24').length,
    age_25_34:  users.filter(u => u.age_group === '25-34').length,
    age_35_44:  users.filter(u => u.age_group === '35-44').length,
    age_45_54:  users.filter(u => u.age_group === '45-54').length,
    age_55_64:  users.filter(u => u.age_group === '55-64').length,
    age_65_plus: users.filter(u => u.age_group === '65+').length,
    age_unknown: users.filter(u => u.age_group === 'Unknown').length,
  };
  // Total People supported = sum of the four mutually-exclusive event types.
  s1.total_people = s1.total_attendees_through_bookings + s1.total_support_calls +
                    s1.total_walk_in_crisis + s1.total_walk_in_social;

  // --- Section 2: Support Requirements ---
  const s2 = {
    information_seeking: serviceBookings.filter(b =>
      parseJson(b.reasons_for_attending).includes('Information seeking')
    ).length,
    social_support_signposting: serviceBookings.filter(b =>
      hasSupport(b, 'SS') || hasSupport(b, 'SP')
    ).length,
    one_to_one_peer_support: serviceBookings.filter(b => hasSupport(b, 'PS')).length,
    crisis_support:          serviceBookings.filter(b => hasSupport(b, 'C')).length,
    other_supports: serviceBookings.filter(b =>
      hasSupport(b, 'O') ||
      (b.outcome === 'Attended' && ['Phone Call', 'Email', 'Text'].includes(b.interaction_type))
    ).length,
  };
  s2.total = s2.information_seeking + s2.social_support_signposting +
             s2.one_to_one_peer_support + s2.crisis_support + s2.other_supports;

  // --- Section 3: Support Requirements by Type ---
  const s3 = {
    info_statutory_mh_hse:   countNeed('info_statutory_mh'),
    info_non_statutory_mh:   countNeed('info_non_statutory_mh'),
    info_wider_community:    countNeed('info_wider_community'),
    peer_support_coping:     countNeed('peer_coping'),
    peer_support_recovery:   countNeed('peer_recovery'),
    crisis_deescalation:     countNeed('crisis_deescalation'),
    crisis_onward_ae:        countNeed('crisis_ae'),
    crisis_guards_community: countNeed('crisis_guards'),
    social_support:          countNeed('social'),
  };
  s3.total = Object.values(s3).reduce((a, b) => a + b, 0);

  // --- Section 4: Referral Activity ---
  const s4 = {
    self_referral:    serviceBookings.filter(b => b.referral_source === 'Self-referral').length,
    community_ngo:    serviceBookings.filter(b => b.referral_source === 'Local NGO and Community Partner Agency').length,
    hse_mh_services:  serviceBookings.filter(b =>
      ['Community Mental Health Team', 'Liaison Psychiatry Team', 'Crisis Resolution Team']
        .includes(b.referral_source)
    ).length,
    hse_health_services: serviceBookings.filter(b => b.referral_source === 'HSE Health Services').length,
    gp:               serviceBookings.filter(b => b.referral_source === 'GP').length,
    other_referral:   serviceBookings.filter(b => b.referral_source === 'Other').length,
    cast_referral:    serviceBookings.filter(b => b.referral_source === 'CAST').length,
    lsw_referral:     serviceBookings.filter(b => b.referral_source === 'LSW').length,
    ltsp_referral:    serviceBookings.filter(b => b.referral_source === 'LTSP').length,
    probation_referral: serviceBookings.filter(b => b.referral_source === 'Probation').length,
    ed_diversion_yes: serviceBookings.filter(b => b.ed_diversion === 1).length,
  };
  s4.total = s4.self_referral + s4.community_ngo + s4.hse_mh_services +
             s4.hse_health_services + s4.gp + s4.other_referral +
             s4.cast_referral + s4.lsw_referral + s4.ltsp_referral + s4.probation_referral;

  // --- Section 5: Advocacy / Follow-up ---
  const s5_cv = {
    cv_counselling:       countOnward('cv_counselling'),
    cv_housing:           countOnward('cv_housing'),
    cv_finance:           countOnward('cv_finance'),
    cv_mh_groups:         countOnward('cv_mh_groups'),
    cv_addiction_groups:  countOnward('cv_addiction_groups'),
    cv_family:            countOnward('cv_family'),
  };
  s5_cv.total = Object.values(s5_cv).reduce((a, b) => a + b, 0);

  const s5_statutory = {
    statutory_hse_mh:             countOnward('hse_mh'),
    statutory_hse_primary_care:   countOnward('hse_primary_care'),
    statutory_hse_disability:     countOnward('hse_disability'),
    statutory_hse_older_persons:  countOnward('hse_older_persons'),
    statutory_hse_crt:            countOnward('hse_crt'),
    statutory_tusla:              countOnward('tusla'),
    statutory_mabs:               countOnward('mabs'),
    statutory_dept_social:        countOnward('dept_social_protection'),
    statutory_citizens_info:      countOnward('citizens_information'),
    statutory_ags:                countOnward('ags'),
  };
  s5_statutory.total = Object.values(s5_statutory).reduce((a, b) => a + b, 0);

  // --- Limitations ---
  const limitations = location === 'LMHA'
    ? {
        lim_day1:            countLimitation('saturday'),
        lim_day2:            countLimitation('sunday'),
        lim_day3:            0,
        lim_time_early:      countLimitation('before_11am'),
        lim_time_late:       countLimitation('after_5pm'),
        lim_no_appointment_week: countLimitation('no_appointment_in_week'),
        lim_closed_short_staff:  countLimitation('closed_short_staff'),
        lim_calls_out_hours: countLimitation('calls_out_of_hours'),
        lim_text_out_hours:  countLimitation('text_out_of_hours'),
      }
    : {
        lim_day1:            countLimitation('monday'),
        lim_day2:            countLimitation('tuesday'),
        lim_day3:            countLimitation('wednesday'),
        lim_time_early:      countLimitation('before_6pm'),
        lim_time_late:       countLimitation('after_midnight'),
        lim_no_appointment_week: countLimitation('no_appointment_in_week'),
        lim_closed_short_staff:  countLimitation('closed_short_staff'),
        lim_calls_out_hours: countLimitation('calls_out_of_hours'),
        lim_text_out_hours:  countLimitation('text_out_of_hours'),
      };
  limitations.total = limitations.lim_day1 + limitations.lim_day2 + limitations.lim_day3 +
                      limitations.lim_time_early + limitations.lim_time_late +
                      limitations.lim_no_appointment_week + limitations.lim_closed_short_staff +
                      limitations.lim_calls_out_hours + limitations.lim_text_out_hours;
  return {
    section1: s1,
    section2: s2,
    section3: s3,
    section4: s4,
    section5_cv: s5_cv,
    section5_statutory: s5_statutory,
    limitations,
    dateRange: { startDate, endDate },
    location,
  };
}

module.exports = { aggregateMetrics };
