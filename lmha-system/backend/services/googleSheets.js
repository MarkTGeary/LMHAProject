const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const SPREADSHEET_IDS = {
  'LMHA': process.env.SPREADSHEET_ID_LMHA,
  'Solace Café': process.env.SPREADSHEET_ID_SOLACE,
};

// ─────────────────────────────────────────────────────────────────
//  ROW MAP — 1-indexed rows matching the Google Sheet layout.
//
//  Counted from the actual sheet structure (Row 1 = "Month" header):
//
//  Row 1   Month / Week (column headers)
//  Row 2   (Week sub-label)
//  Row 3   blank
//  Row 4   "1. General Café Service information" | "Sub headings"
//  Row 5   Demographics / Total no of bookings received
//  ...
//  Row 11  Total no of Family/Carer attendees
//  Row 12  (blank)
//  Row 13  Total number of attendees Male
//  ...
//  Row 23  Age 65+
//  Row 24  Age Unknown   ← inserted; all rows below shifted down by 1
//  Row 25  (blank)
//  Row 26  TOTAL People
//  Row 27  "2. Support Requirements" header
//  Row 28  Peer Support & Connection / Information Seeking only
//  ...
//  Row 33  TOTAL (Section 2)
//  Row 34  "3. Support requirements by type" header
//  Row 35  Needs / Statutory MH info
//  ...
//  Row 44  TOTAL (Section 3)
//  Row 45  "4. Referral Activity" header
//  Row 46  ED Diversion / Self-referrals
//  ...
//  Row 57  TOTAL (Section 4)
//  Row 58  "5. Advocacy/Follow up" header
//  Row 59  C&V / Counselling Services
//  ...
//  Row 65  (blank)
//  Row 66  TOTAL C&V
//  Row 67  Statutory / HSE Mental Health
//  ...
//  Row 77  TOTAL Statutory
//  Row 78  (blank)
//  Rows 79-84: Miscellaneous/Feedback (not tracked in system)
//  Row 85  (blank)
//  Row 87+  Limitations (days/times/etc.)
//  Row 96  Total (Limitations)
// ─────────────────────────────────────────────────────────────────
const ROW_MAP = {
  // ── Section 1: General Service Information ──────────────────────
  total_bookings_received:          5,
  total_attendees_through_bookings: 6,
  total_walk_in_crisis:             7,
  total_support_calls:              8,
  total_walk_in_social:             9,
  total_dna:                        10,
  total_carer_attendees:            11,
  // row 12: blank
  total_male:                       13,
  total_female:                     14,
  total_other_gender:               15,
  total_new:                        16,
  total_repeat:                     17,
  age_18_24:                        18,
  age_25_34:                        19,
  age_35_44:                        20,
  age_45_54:                        21,
  age_55_64:                        22,
  age_65_plus:                      23,
  age_unknown:                      24,
  // row 25: blank
  total_people:                     26,

  // row 27: "2. Support Requirements" header
  // ── Section 2: Support Requirements ─────────────────────────────
  information_seeking:              28,
  social_support_signposting:       29,
  one_to_one_peer_support:          30,
  crisis_support:                   31,
  other_supports:                   32,
  s2_total:                         33,

  // row 34: "3. Support requirements by type" header
  // ── Section 3: Support Requirements by Type ──────────────────────
  info_statutory_mh_hse:            35,
  info_non_statutory_mh:            36,
  info_wider_community:             37,
  peer_support_coping:              38,
  peer_support_recovery:            39,
  crisis_deescalation:              40,
  crisis_onward_ae:                 41,
  crisis_guards_community:          42,
  social_support:                   43,
  s3_total:                         44,

  // row 45: "4. Referral Activity" header
  // ── Section 4: Referral Activity ─────────────────────────────────
  self_referral:                    46,
  community_ngo:                    47,
  hse_mh_services:                  48,
  hse_health_services:              49,
  gp:                               50,
  other_referral:                   51,
  cast_referral:                    52,
  lsw_referral:                     53,
  ltsp_referral:                    54,
  probation_referral:               55,
  ed_diversion_yes:                 56,
  s4_total:                         57,

  // row 58: "5. Advocacy/Follow up" header
  // ── Section 5 C&V ────────────────────────────────────────────────
  cv_counselling:                   59,
  cv_housing:                       60,
  cv_finance:                       61,
  cv_mh_groups:                     62,
  cv_addiction_groups:              63,
  cv_family:                        64,
  // row 65: blank
  s5_cv_total:                      66,

  // ── Section 5 Statutory ───────────────────────────────────────────
  statutory_hse_mh:                 67,
  statutory_hse_primary_care:       68,
  statutory_hse_disability:         69,
  statutory_hse_older_persons:      70,
  statutory_hse_crt:                71,
  statutory_tusla:                  72,
  statutory_mabs:                   73,
  statutory_dept_social:            74,
  statutory_citizens_info:          75,
  statutory_ags:                    76,
  s5_statutory_total:               77,

  // row 78: blank
  // row 79: "Miscellaneous / Feedback from service users" header (no data written)
  // ── Miscellaneous: Feedback from Service Users ────────────────────
  misc_thankyou_letters:            80,
  misc_verbal_feedback:             81,
  misc_testimonials:                82,
  misc_vox_pop:                     83,
  misc_total:                       84,
  // row 85: blank

  // ── Limitations (positional — same rows for both locations) ───────
  // lim_day1/2/3  = Mon/Tue/Wed for Solace Café, Sat/Sun/(none) for LMHA
  // lim_time_early = before 6pm for Solace, before 11am for LMHA
  // lim_time_late  = after midnight for Solace, after 5pm for LMHA
  lim_day1:                         87,
  lim_day2:                         88,
  lim_day3:                         89,
  lim_time_early:                   90,
  lim_time_late:                    91,
  lim_no_appointment_week:          92,
  lim_closed_short_staff:           93,
  lim_calls_out_hours:              94,
  lim_text_out_hours:               95,
  lim_total:                        96,
};

function getAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json');
  return new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Find the column for a given date range by reading the two header rows.
 * Row 1 = month names (e.g. "April"), Row 2 = day ranges (e.g. "2nd- 5th").
 * Returns the A1 column letter (e.g. 'C', 'D', ...).
 */
async function findWeekColumn(sheets, spreadsheetId, startDate, endDate) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '1:2',
  });

  const rows = response.data.values || [];
  const row1 = rows[0] || []; // month labels
  const row2 = rows[1] || []; // week day-range labels

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  // Parse date parts directly to avoid timezone shifts
  const [, sm, sd] = startDate.split('-').map(Number);
  const [, em, ed] = endDate.split('-').map(Number);
  const startMonth = MONTHS[sm - 1];
  const endMonth   = MONTHS[em - 1];

  /**
   * Try to find the column where row1 contains targetMonth (first 3 chars)
   * and row2 matches targetDay at the position described by positionHint:
   *   'end'   – day appears at the end of the label  (e.g. "2nd- 5th" for day 5)
   *   'start' – day appears at the start of the label (e.g. "30th - Apr 3" for day 30)
   *   'any'   – day appears anywhere in the label
   */
  function matchCol(targetMonth, targetDay, positionHint) {
    const suffix = '(?:st|nd|rd|th)?';
    let dayRe;
    if (positionHint === 'end') {
      dayRe = new RegExp(`\\b${targetDay}${suffix}\\s*$`, 'i');
    } else if (positionHint === 'start') {
      dayRe = new RegExp(`^\\s*${targetDay}${suffix}\\b`, 'i');
    } else {
      dayRe = new RegExp(`\\b${targetDay}${suffix}\\b`, 'i');
    }
    const monthKey = targetMonth.toLowerCase().slice(0, 3);
    for (let i = 0; i < row1.length; i++) {
      if (!(row1[i] || '').toLowerCase().includes(monthKey)) continue;
      if (dayRe.test((row2[i] || '').trim())) return columnToLetter(i + 1);
    }
    return null;
  }

  // Try strategies in decreasing specificity
  const col =
    matchCol(endMonth,   ed, 'end')   ||  // e.g. April col ending in "5th"
    matchCol(startMonth, sd, 'start') ||  // e.g. March col starting with "30th"
    matchCol(endMonth,   ed, 'any')   ||
    matchCol(startMonth, sd, 'any');

  if (col) return col;

  throw new Error(
    `Could not find week column for ${startDate} to ${endDate}. ` +
    `Looked for ${endMonth} (ending day ${ed}) or ${startMonth} (starting day ${sd}). ` +
    `Row-1 headers found: ${row1.slice(0, 10).join(', ')}`
  );
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Write metrics to the appropriate Google Sheet.
 * Never deletes or clears — only writes to the found week column.
 */
async function writeMetrics(location, metrics, startDate, endDate) {
  const spreadsheetId = SPREADSHEET_IDS[location];
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for location: ${location}`);
  }

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });

  const colLetter = await findWeekColumn(sheets, spreadsheetId, startDate, endDate);
  console.log(`[Sheets] Writing to column ${colLetter} for ${location} week ${startDate}–${endDate}`);

  // Flatten all sections including totals
  const fb = metrics.feedback || {};
  const miscTotal = (fb.thankyou_letters || 0) + (fb.verbal_feedback || 0) +
                    (fb.testimonials || 0) + (fb.vox_pop || 0);
  const flat = {
    ...metrics.section1,
    ...metrics.section2,
    s2_total: metrics.section2.total,
    ...metrics.section3,
    s3_total: metrics.section3.total,
    ...metrics.section4,
    s4_total: metrics.section4.total,
    ...metrics.section5_cv,
    s5_cv_total: metrics.section5_cv.total,
    ...metrics.section5_statutory,
    s5_statutory_total: metrics.section5_statutory.total,
    misc_thankyou_letters: fb.thankyou_letters || 0,
    misc_verbal_feedback:  fb.verbal_feedback  || 0,
    misc_testimonials:     fb.testimonials     || 0,
    misc_vox_pop:          fb.vox_pop          || 0,
    misc_total:            miscTotal,
    ...metrics.limitations,
    lim_total: metrics.limitations.total,
  };

  const data = [];
  for (const [key, row] of Object.entries(ROW_MAP)) {
    if (flat[key] !== undefined) {
      data.push({
        range: `${colLetter}${row}`,
        values: [[flat[key]]],
      });
    }
  }

  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });

  console.log(`[Sheets] Updated ${result.data.totalUpdatedCells} cells for ${location}`);
  return {
    ok: true,
    updatedCells: result.data.totalUpdatedCells,
    column: colLetter,
    location,
  };
}

/**
 * Read metrics back from the Google Sheet for a given week.
 * Returns an object shaped like aggregateMetrics() output so MetricsPreview
 * can render it identically.
 */
async function readMetrics(location, startDate, endDate) {
  const spreadsheetId = SPREADSHEET_IDS[location];
  if (!spreadsheetId) {
    throw new Error(`No spreadsheet ID configured for location: ${location}`);
  }

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const colLetter = await findWeekColumn(sheets, spreadsheetId, startDate, endDate);
  console.log(`[Sheets] Reading from column ${colLetter} for ${location} week ${startDate}–${endDate}`);

  // Build a list of ranges — one per ROW_MAP entry
  const keys = Object.keys(ROW_MAP);
  const ranges = keys.map(k => `${colLetter}${ROW_MAP[k]}`);

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  // Map results back to { key: value }
  const flat = {};
  (response.data.valueRanges || []).forEach((vr, i) => {
    flat[keys[i]] = Number((vr.values || [[0]])[0][0]) || 0;
  });

  // Reconstruct the nested section structure
  const s1 = {
    total_bookings_received:          flat.total_bookings_received,
    total_attendees_through_bookings: flat.total_attendees_through_bookings,
    total_walk_in_crisis:             flat.total_walk_in_crisis,
    total_support_calls:              flat.total_support_calls,
    total_walk_in_social:             flat.total_walk_in_social,
    total_dna:                        flat.total_dna,
    total_carer_attendees:            flat.total_carer_attendees,
    total_male:                       flat.total_male,
    total_female:                     flat.total_female,
    total_other_gender:               flat.total_other_gender,
    total_new:                        flat.total_new,
    total_repeat:                     flat.total_repeat,
    age_18_24:                        flat.age_18_24,
    age_25_34:                        flat.age_25_34,
    age_35_44:                        flat.age_35_44,
    age_45_54:                        flat.age_45_54,
    age_55_64:                        flat.age_55_64,
    age_65_plus:                      flat.age_65_plus,
    age_unknown:                      flat.age_unknown,
    total_people:                     flat.total_people,
  };

  const s2 = {
    information_seeking:        flat.information_seeking,
    social_support_signposting: flat.social_support_signposting,
    one_to_one_peer_support:    flat.one_to_one_peer_support,
    crisis_support:             flat.crisis_support,
    other_supports:             flat.other_supports,
    total:                      flat.s2_total,
  };

  const s3 = {
    info_statutory_mh_hse:   flat.info_statutory_mh_hse,
    info_non_statutory_mh:   flat.info_non_statutory_mh,
    info_wider_community:    flat.info_wider_community,
    peer_support_coping:     flat.peer_support_coping,
    peer_support_recovery:   flat.peer_support_recovery,
    crisis_deescalation:     flat.crisis_deescalation,
    crisis_onward_ae:        flat.crisis_onward_ae,
    crisis_guards_community: flat.crisis_guards_community,
    social_support:          flat.social_support,
    total:                   flat.s3_total,
  };

  const s4 = {
    self_referral:       flat.self_referral,
    community_ngo:       flat.community_ngo,
    hse_mh_services:     flat.hse_mh_services,
    hse_health_services: flat.hse_health_services,
    gp:                  flat.gp,
    other_referral:      flat.other_referral,
    cast_referral:       flat.cast_referral,
    lsw_referral:        flat.lsw_referral,
    ltsp_referral:       flat.ltsp_referral,
    probation_referral:  flat.probation_referral,
    ed_diversion_yes:    flat.ed_diversion_yes,
    total:               flat.s4_total,
  };

  const s5cv = {
    cv_counselling:      flat.cv_counselling,
    cv_housing:          flat.cv_housing,
    cv_finance:          flat.cv_finance,
    cv_mh_groups:        flat.cv_mh_groups,
    cv_addiction_groups: flat.cv_addiction_groups,
    cv_family:           flat.cv_family,
    total:               flat.s5_cv_total,
  };

  const s5stat = {
    statutory_hse_mh:            flat.statutory_hse_mh,
    statutory_hse_primary_care:  flat.statutory_hse_primary_care,
    statutory_hse_disability:    flat.statutory_hse_disability,
    statutory_hse_older_persons: flat.statutory_hse_older_persons,
    statutory_hse_crt:           flat.statutory_hse_crt,
    statutory_tusla:             flat.statutory_tusla,
    statutory_mabs:              flat.statutory_mabs,
    statutory_dept_social:       flat.statutory_dept_social,
    statutory_citizens_info:     flat.statutory_citizens_info,
    statutory_ags:               flat.statutory_ags,
    total:                       flat.s5_statutory_total,
  };

  const feedback = {
    thankyou_letters: flat.misc_thankyou_letters,
    verbal_feedback:  flat.misc_verbal_feedback,
    testimonials:     flat.misc_testimonials,
    vox_pop:          flat.misc_vox_pop,
  };

  const limitations = {
    lim_day1:                 flat.lim_day1,
    lim_day2:                 flat.lim_day2,
    lim_day3:                 flat.lim_day3,
    lim_time_early:           flat.lim_time_early,
    lim_time_late:            flat.lim_time_late,
    lim_no_appointment_week:  flat.lim_no_appointment_week,
    lim_closed_short_staff:   flat.lim_closed_short_staff,
    lim_calls_out_hours:      flat.lim_calls_out_hours,
    lim_text_out_hours:       flat.lim_text_out_hours,
    total:                    flat.lim_total,
  };

  return {
    section1:          s1,
    section2:          s2,
    section3:          s3,
    section4:          s4,
    section5_cv:       s5cv,
    section5_statutory: s5stat,
    feedback,
    limitations,
    dateRange: { startDate, endDate },
    location,
    _source: 'sheets',
    _column: colLetter,
  };
}

module.exports = { writeMetrics, readMetrics };
