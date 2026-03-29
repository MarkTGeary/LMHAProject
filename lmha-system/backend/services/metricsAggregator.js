const db = require('../db');

/**
 * Aggregate all metric sections from SQLite for a date range + location.
 * Returns an object matching the Google Sheets sections.
 */
function aggregateMetrics(location, startDate, endDate) {
  const bookings = db.prepare(`
    SELECT b.*,
           i.referral_source, i.reasons_for_attending,
           i.support_needs, i.onward_referrals, i.limitations_detail
    FROM bookings b
    LEFT JOIN intake_forms i ON i.booking_id = b.id
    WHERE b.location = ?
      AND b.date BETWEEN ? AND ?
      AND b.status != 'Cancelled'
  `).all(location, startDate, endDate);

  const attended = bookings.filter(b => b.outcome === 'Attended');
  const dna      = bookings.filter(b => b.outcome === 'Did Not Attend');
  const phoneCalls = bookings.filter(b => b.interaction_type === 'Phone Call');

  // Unique service users for demographics
  const userIds = [...new Set(bookings.map(b => b.service_user_id).filter(Boolean))];
  const users = userIds.length
    ? db.prepare(`SELECT * FROM service_users WHERE id IN (${userIds.map(() => '?').join(',')})`)
        .all(...userIds)
    : [];

  // --- Helpers ---

  function hasSupport(booking, type) {
    if (!booking.type_of_support) return false;
    try {
      const arr = JSON.parse(booking.type_of_support);
      return Array.isArray(arr) ? arr.includes(type) : false;
    } catch {
      return booking.type_of_support.includes(type);
    }
  }

  function parseJson(val) {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  }

  function countNeed(key) {
    return bookings.filter(b => parseJson(b.support_needs).includes(key)).length;
  }

  function countOnward(key) {
    return bookings.filter(b => parseJson(b.onward_referrals).includes(key)).length;
  }

  function countLimitation(key) {
    return bookings.filter(b => parseJson(b.limitations_detail).includes(key)).length;
  }

  // --- Section 1: General Service Information ---
  const s1 = {
    total_bookings_received:          bookings.length,
    total_attendees_through_bookings: attended.length,
    total_walk_in_crisis: bookings.filter(b =>
      b.interaction_type === 'Walk-In' && hasSupport(b, 'C')
    ).length,
    total_support_calls:    phoneCalls.length,
    total_walk_in_social: bookings.filter(b =>
      b.interaction_type === 'Walk-In' && hasSupport(b, 'SS')
    ).length,
    total_dna:              dna.length,
    total_carer_attendees:  bookings.filter(b => b.carer_attended).length,
    total_male:             users.filter(u => u.gender === 'Male').length,
    total_female:           users.filter(u => u.gender === 'Female').length,
    total_other_gender:     users.filter(u => u.gender === 'Prefer not to say').length,
    total_new:              bookings.filter(b => b.new_or_repeat === 'New').length,
    total_repeat:           bookings.filter(b => b.new_or_repeat === 'Repeat').length,
    age_18_24:  users.filter(u => u.age_group === '18-24').length,
    age_25_34:  users.filter(u => u.age_group === '25-34').length,
    age_35_44:  users.filter(u => u.age_group === '35-44').length,
    age_45_54:  users.filter(u => u.age_group === '45-54').length,
    age_55_64:  users.filter(u => u.age_group === '55-64').length,
    age_65_plus: users.filter(u => u.age_group === '65+').length,
  };
  s1.total_people = s1.total_male + s1.total_female + s1.total_other_gender;

  // --- Section 2: Support Requirements ---
  const s2 = {
    information_seeking: bookings.filter(b =>
      parseJson(b.reasons_for_attending).includes('Information seeking')
    ).length,
    social_support_signposting: bookings.filter(b =>
      hasSupport(b, 'SS') || hasSupport(b, 'SP')
    ).length,
    one_to_one_peer_support: bookings.filter(b => hasSupport(b, 'PS')).length,
    crisis_support:          bookings.filter(b => hasSupport(b, 'C')).length,
    other_supports: bookings.filter(b =>
      hasSupport(b, 'O') ||
      ['Phone Call', 'Email', 'Text', 'Off-the-cuff'].includes(b.interaction_type)
    ).length,
  };
  s2.total = s2.information_seeking + s2.social_support_signposting +
             s2.one_to_one_peer_support + s2.crisis_support + s2.other_supports;

  // --- Section 3: Support Requirements by Type (from support_needs on intake) ---
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
    self_referral:    bookings.filter(b => b.referral_source === 'Self-referral').length,
    community_ngo:    bookings.filter(b => b.referral_source === 'Local NGO and Community Partner Agency').length,
    hse_mh_services:  bookings.filter(b =>
      ['Community Mental Health Team', 'Liaison Psychiatry Team', 'Crisis Resolution Team']
        .includes(b.referral_source)
    ).length,
    hse_health_services: bookings.filter(b => b.referral_source === 'HSE Health Services').length,
    gp:               bookings.filter(b => b.referral_source === 'GP').length,
    other_referral:   bookings.filter(b => b.referral_source === 'Other').length,
    cast_referral:    bookings.filter(b => b.referral_source === 'CAST').length,
    lsw_referral:     bookings.filter(b => b.referral_source === 'LSW').length,
    ltsp_referral:    bookings.filter(b => b.referral_source === 'LTSP').length,
    probation_referral: bookings.filter(b => b.referral_source === 'Probation').length,
    ed_diversion_yes: bookings.filter(b => b.ed_diversion === 1).length,
  };
  s4.total = s4.self_referral + s4.community_ngo + s4.hse_mh_services +
             s4.hse_health_services + s4.gp + s4.other_referral +
             s4.cast_referral + s4.lsw_referral + s4.ltsp_referral + s4.probation_referral;

  // --- Section 5: Advocacy / Follow-up (onward referrals made by staff) ---
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
    statutory_hse_mh:          countOnward('hse_mh'),
    statutory_hse_primary_care: countOnward('hse_primary_care'),
    statutory_hse_disability:   countOnward('hse_disability'),
    statutory_hse_older_persons: countOnward('hse_older_persons'),
    statutory_hse_crt:          countOnward('hse_crt'),
    statutory_tusla:            countOnward('tusla'),
    statutory_mabs:             countOnward('mabs'),
    statutory_dept_social:      countOnward('dept_social_protection'),
    statutory_citizens_info:    countOnward('citizens_information'),
    statutory_ags:              countOnward('ags'),
  };
  s5_statutory.total = Object.values(s5_statutory).reduce((a, b) => a + b, 0);

  // --- Limitations: out-of-hours contact attempts (location-specific days/times) ---
  const limitations = location === 'LMHA'
    ? {
        // LMHA: Mon–Fri 11:00–17:00 — closed weekends, outside 11–17
        lim_day1:          countLimitation('saturday'),
        lim_day2:          countLimitation('sunday'),
        lim_day3:          0, // only 2 closed days for LMHA
        lim_time_early:    countLimitation('before_11am'),
        lim_time_late:     countLimitation('after_5pm'),
        lim_calls_out_hours: countLimitation('calls_out_of_hours'),
        lim_text_out_hours:  countLimitation('text_out_of_hours'),
      }
    : {
        // Solace Café: Thu–Sun 18:00–00:00 — closed Mon/Tue/Wed, outside 18–00
        lim_day1:          countLimitation('monday'),
        lim_day2:          countLimitation('tuesday'),
        lim_day3:          countLimitation('wednesday'),
        lim_time_early:    countLimitation('before_6pm'),
        lim_time_late:     countLimitation('after_midnight'),
        lim_calls_out_hours: countLimitation('calls_out_of_hours'),
        lim_text_out_hours:  countLimitation('text_out_of_hours'),
      };
  limitations.total = limitations.lim_day1 + limitations.lim_day2 + limitations.lim_day3 +
                      limitations.lim_time_early + limitations.lim_time_late +
                      limitations.lim_calls_out_hours + limitations.lim_text_out_hours;
  // Total individuals who couldn't be facilitated (bookings that recorded any limitation)
  limitations.lim_indv_not_facilitated = bookings.filter(b =>
    parseJson(b.limitations_detail).length > 0
  ).length;

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
