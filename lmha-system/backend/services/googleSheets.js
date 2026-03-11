const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const SPREADSHEET_IDS = {
  'LMHA': process.env.SPREADSHEET_ID_LMHA,
  'Solace Café': process.env.SPREADSHEET_ID_SOLACE,
};

// Row mappings in the Google Sheet (1-indexed as used in Sheets API)
// These must match your existing spreadsheet structure exactly.
const ROW_MAP = {
  // Section 1
  total_bookings_received:          5,
  total_attendees_through_bookings: 6,
  total_walk_in_crisis:             7,
  total_support_calls:              8,
  total_walk_in_social:             9,
  total_dna:                        10,
  total_carer_attendees:            11,
  total_male:                       12,
  total_female:                     13,
  total_other_gender:               14,
  total_new:                        15,
  total_repeat:                     16,
  age_18_24:                        17,
  age_25_34:                        18,
  age_35_44:                        19,
  age_45_54:                        20,
  age_55_64:                        21,
  age_65_plus:                      22,
  // Section 2
  information_seeking:              26,
  social_support_signposting:       27,
  one_to_one_peer_support:          28,
  crisis_support:                   29,
  other_supports:                   30,
  // Section 3
  info_statutory_mh_hse:            34,
  info_non_statutory_mh:            35,
  info_wider_community:             36,
  peer_support_coping:              37,
  peer_support_recovery:            38,
  crisis_deescalation:              39,
  crisis_onward_ae:                 40,
  crisis_guards_community:          41,
  social_support:                   42,
  // Section 4
  self_referral:                    46,
  community_ngo:                    47,
  hse_mh_services:                  48,
  hse_health_services:              49,
  gp:                               50,
  other_referral:                   51,
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
  // Read row 1 (header row) to find the week label
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '1:1',
  });

  const headers = response.data.values ? response.data.values[0] : [];
  const weekLabel = `${startDate} to ${endDate}`;

  // Try exact match first
  let colIndex = headers.findIndex(h => h && h.toString().includes(startDate));
  if (colIndex === -1) {
    // Try partial match
    colIndex = headers.findIndex(h => h && h.toString().includes(weekLabel));
  }

  if (colIndex === -1) {
    throw new Error(`Could not find week column for ${weekLabel} in spreadsheet header row. ` +
      `Headers found: ${headers.slice(0, 10).join(', ')}`);
  }

  // Convert 0-indexed to A1 column letter
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
 * Never deletes or overwrites — only writes to the found week column.
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

  // Flatten all sections
  const allMetrics = {
    ...metrics.section1,
    ...metrics.section2,
    ...metrics.section3,
    ...metrics.section4,
  };

  const data = [];
  for (const [key, row] of Object.entries(ROW_MAP)) {
    if (allMetrics[key] !== undefined) {
      data.push({
        range: `${colLetter}${row}`,
        values: [[allMetrics[key]]],
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
