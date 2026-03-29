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
//  Row 24  (blank)
//  Row 25  TOTAL People
//  Row 26  "2. Support Requirements" header
//  Row 27  Peer Support & Connection / Information Seeking only
//  ...
//  Row 32  TOTAL (Section 2)
//  Row 33  "3. Support requirements by type" header
//  Row 34  Needs / Statutory MH info
//  ...
//  Row 43  TOTAL (Section 3)
//  Row 44  "4. Referral Activity" header
//  Row 45  ED Diversion / Self-referrals
//  ...
//  Row 56  TOTAL (Section 4)
//  Row 57  "5. Advocacy/Follow up" header
//  Row 58  C&V / Counselling Services
//  ...
//  Row 64  (blank)
//  Row 65  TOTAL C&V
//  Row 66  Statutory / HSE Mental Health
//  ...
//  Row 76  TOTAL Statutory
//  Row 77  (blank)
//  Rows 78-83: Miscellaneous/Feedback (not tracked in system)
//  Row 84  (blank)
//  Row 85  Limitations / INDV not facilitated
//  ...
//  Row 93  Total (Limitations)
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
  // row 24: blank
  total_people:                     25,

  // row 26: "2. Support Requirements" header
  // ── Section 2: Support Requirements ─────────────────────────────
  information_seeking:              27,
  social_support_signposting:       28,
  one_to_one_peer_support:          29,
  crisis_support:                   30,
  other_supports:                   31,
  s2_total:                         32,

  // row 33: "3. Support requirements by type" header
  // ── Section 3: Support Requirements by Type ──────────────────────
  info_statutory_mh_hse:            34,
  info_non_statutory_mh:            35,
  info_wider_community:             36,
  peer_support_coping:              37,
  peer_support_recovery:            38,
  crisis_deescalation:              39,
  crisis_onward_ae:                 40,
  crisis_guards_community:          41,
  social_support:                   42,
  s3_total:                         43,

  // row 44: "4. Referral Activity" header
  // ── Section 4: Referral Activity ─────────────────────────────────
  self_referral:                    45,
  community_ngo:                    46,
  hse_mh_services:                  47,
  hse_health_services:              48,
  gp:                               49,
  other_referral:                   50,
  cast_referral:                    51,
  lsw_referral:                     52,
  ltsp_referral:                    53,
  probation_referral:               54,
  ed_diversion_yes:                 55,
  s4_total:                         56,

  // row 57: "5. Advocacy/Follow up" header
  // ── Section 5 C&V ────────────────────────────────────────────────
  cv_counselling:                   58,
  cv_housing:                       59,
  cv_finance:                       60,
  cv_mh_groups:                     61,
  cv_addiction_groups:              62,
  cv_family:                        63,
  // row 64: blank
  s5_cv_total:                      65,

  // ── Section 5 Statutory ───────────────────────────────────────────
  statutory_hse_mh:                 66,
  statutory_hse_primary_care:       67,
  statutory_hse_disability:         68,
  statutory_hse_older_persons:      69,
  statutory_hse_crt:                70,
  statutory_tusla:                  71,
  statutory_mabs:                   72,
  statutory_dept_social:            73,
  statutory_citizens_info:          74,
  statutory_ags:                    75,
  s5_statutory_total:               76,

  // rows 77-84: blank + Miscellaneous/Feedback (not tracked in system)

  // ── Limitations (positional — same rows for both locations) ───────
  // lim_day1/2/3  = Mon/Tue/Wed for Solace Café, Sat/Sun/(none) for LMHA
  // lim_time_early = before 6pm for Solace, before 11am for LMHA
  // lim_time_late  = after midnight for Solace, after 5pm for LMHA
  lim_indv_not_facilitated:         85,
  lim_day1:                         86,
  lim_day2:                         87,
  lim_day3:                         88,
  lim_time_early:                   89,
  lim_time_late:                    90,
  lim_calls_out_hours:              91,
  lim_text_out_hours:               92,
  lim_total:                        93,
};

async function getAuthClient() {
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

/**
 * Find the column for a given date range by reading the header row.
 * Returns the A1 column letter (e.g. 'C', 'D', ...).
 */
async function findWeekColumn(sheets, spreadsheetId, startDate, endDate) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '1:1',
  });

  const headers = response.data.values ? response.data.values[0] : [];
  const weekLabel = `${startDate} to ${endDate}`;

  let colIndex = headers.findIndex(h => h && h.toString().includes(startDate));
  if (colIndex === -1) {
    colIndex = headers.findIndex(h => h && h.toString().includes(weekLabel));
  }

  if (colIndex === -1) {
    throw new Error(
      `Could not find week column for ${weekLabel} in spreadsheet header row. ` +
      `Headers found: ${headers.slice(0, 10).join(', ')}`
    );
  }

  return columnToLetter(colIndex + 1);
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

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const colLetter = await findWeekColumn(sheets, spreadsheetId, startDate, endDate);
  console.log(`[Sheets] Writing to column ${colLetter} for ${location} week ${startDate}–${endDate}`);

  // Flatten all sections including totals
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

module.exports = { writeMetrics };
