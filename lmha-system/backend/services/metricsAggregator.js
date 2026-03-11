const db = require('../db');

/**
 * Aggregate all 4 metric sections from SQLite for a date range + location.
 * Returns an object matching the Google Sheets sections.
 */
function aggregateMetrics(location, startDate, endDate) {
  const bookings = db.prepare(`
    SELECT b.*, i.referral_source, i.reasons_for_attending
    FROM bookings b
    LEFT JOIN intake_forms i ON i.booking_id = b.id
    WHERE b.location = ?
      AND b.date BETWEEN ? AND ?
      AND b.status != 'Cancelled'
  `).all(location, startDate, endDate);

  const attended = bookings.filter(b => b.outcome === 'Attended');
  const dna = bookings.filter(b => b.outcome === 'Did Not Attend');
  const walkInCrisis = bookings.filter(b => b.interaction_type === 'Crisis' && b.interaction_type === 'Walk-In');
  const crisisAll = bookings.filter(b => b.interaction_type === 'Crisis');
  const phoneCalls = bookings.filter(b => b.interaction_type === 'Phone Call');
  const walkIns = bookings.filter(b => b.interaction_type === 'Walk-In');

  // Collect service users for demographics
  const userIds = [...new Set(bookings.map(b => b.service_user_id).filter(Boolean))];
  const users = userIds.length
    ? db.prepare(`SELECT * FROM service_users WHERE id IN (${userIds.map(() => '?').join(',')})`)
        .all(...userIds)
    : [];

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  // Support types
  function hasSupport(booking, type) {
    if (!booking.type_of_support) return false;
    try {
      const arr = JSON.parse(booking.type_of_support);
      return Array.isArray(arr) ? arr.includes(type) : false;
    } catch {
      return booking.type_of_support.includes(type);
    }
  }

  // Referral sources
  function getReferral(booking) {
    return booking.referral_source || null;
  }

  // Reasons
  function getReasons(booking) {
    if (!booking.reasons_for_attending) return [];
    try { return JSON.parse(booking.reasons_for_attending); }
    catch { return []; }
  }

  // --- Section 1: General Service Information ---
  const section1 = {
    total_bookings_received: bookings.length,
    total_attendees_through_bookings: attended.length,
    total_walk_in_crisis: bookings.filter(b =>
      b.interaction_type === 'Walk-In' && (b.type_of_support || '').includes('C')
    ).length,
    total_support_calls: phoneCalls.length,
    total_walk_in_social: bookings.filter(b =>
      b.interaction_type === 'Walk-In' && hasSupport(b, 'SS')
    ).length,
    total_dna: dna.length,
    total_carer_attendees: bookings.filter(b => b.carer_attended).length,
    total_male: users.filter(u => u.gender === 'Male').length,
    total_female: users.filter(u => u.gender === 'Female').length,
    total_other_gender: users.filter(u => u.gender === 'Prefer not to say').length,
    total_new: bookings.filter(b => b.new_or_repeat === 'New').length,
    total_repeat: bookings.filter(b => b.new_or_repeat === 'Repeat').length,
    age_18_24: users.filter(u => u.age_group === '18-24').length,
    age_25_34: users.filter(u => u.age_group === '25-34').length,
    age_35_44: users.filter(u => u.age_group === '35-44').length,
    age_45_54: users.filter(u => u.age_group === '45-54').length,
    age_55_64: users.filter(u => u.age_group === '55-64').length,
    age_65_plus: users.filter(u => u.age_group === '65+').length,
  };

  // --- Section 2: Support Requirements ---
  const section2 = {
    information_seeking: bookings.filter(b =>
      getReasons(b).includes('Information seeking')
    ).length,
    social_support_signposting: bookings.filter(b =>
      hasSupport(b, 'SS') || hasSupport(b, 'SP')
    ).length,
    one_to_one_peer_support: bookings.filter(b => hasSupport(b, 'PS')).length,
    crisis_support: bookings.filter(b => hasSupport(b, 'C')).length,
    other_supports: bookings.filter(b =>
      hasSupport(b, 'O') ||
      ['Phone Call', 'Email', 'Text', 'Off-the-cuff'].includes(b.interaction_type)
    ).length,
  };

  // --- Section 3: Support Requirements by Type (Needs) ---
  // These are approximations — if you add more detail fields later, refine here
  const section3 = {
    info_statutory_mh_hse: 0,        // needs more granular field
    info_non_statutory_mh: 0,
    info_wider_community: 0,
    peer_support_coping: bookings.filter(b => hasSupport(b, 'PS')).length,
    peer_support_recovery: 0,
    crisis_deescalation: crisisAll.filter(b => !b.ed_diversion).length,
    crisis_onward_ae: bookings.filter(b => b.ed_diversion === 1).length,
    crisis_guards_community: 0,
    social_support: bookings.filter(b => hasSupport(b, 'SS')).length,
  };

  // --- Section 4: Referral Activity ---
  const section4 = {
    self_referral: bookings.filter(b => getReferral(b) === 'Self-referral').length,
    community_ngo: bookings.filter(b => getReferral(b) === 'Local NGO and Community Partner Agency').length,
    hse_mh_services: bookings.filter(b =>
      ['Community Mental Health Team', 'Liaison Psychiatry Team', 'Crisis Resolution Team'].includes(getReferral(b))
    ).length,
    hse_health_services: bookings.filter(b => getReferral(b) === 'Primary Care Provider').length,
    gp: bookings.filter(b => getReferral(b) === 'NGO Stakeholder').length,
    other_referral: bookings.filter(b => getReferral(b) === 'Other').length,
  };

  return { section1, section2, section3, section4, dateRange: { startDate, endDate }, location };
}

module.exports = { aggregateMetrics };
