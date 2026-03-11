# LMHA Case Management System

Internal web application for Limerick Mental Health Association (LMHA) and Solace Café.
Replaces all paper forms. Tablet-first, staff-only.

## Quick Start

### 1. Copy environment config
```bash
cp .env.example backend/.env
# Edit backend/.env with your credentials
```

### 2. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Run
```bash
# Terminal 1 — Backend (port 3000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open http://localhost:5173

---

## Setup: Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Credentials
3. Create **OAuth 2.0 Client ID** (Web application)
   - Authorised redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Secret to `backend/.env`

## Setup: Google Service Account (for Sheets API)

1. In same GCP project → APIs & Services → Credentials
2. Create **Service Account**
3. Download JSON key → save as `backend/service-account-key.json`
4. Enable **Google Sheets API** in the project
5. Share your spreadsheets with the service account email (Editor access)

## Setup: Allowed Emails

In `backend/.env`, set:
```
ALLOWED_EMAILS=staff1@lmha.ie,staff2@lmha.ie
```

Only these Google accounts can log in.

## Setup: Google Sheets

Your spreadsheets must have a **header row** (row 1) with week date ranges as column headers.
The app finds the correct column by searching for the start date string.

Row numbers in `backend/services/googleSheets.js` → `ROW_MAP` must match your
actual spreadsheet row layout exactly. **Edit these before first use.**

---

## Application Flow

```
Login (Google OAuth)
  → Location Select: LMHA | Solace Café
    → Dashboard
      ├── New Booking      — phone call / walk-in
      ├── Active Cases     — all open bookings
      ├── Today's Schedule — visual timeline
      └── Submit Metrics   — push week data to Sheets
```

## Booking Rules

| Location | Days | Hours |
|---|---|---|
| LMHA | Mon–Fri | 11:00–17:00 |
| Solace Café | Thu–Sun | 18:00–00:00 |

- 1-hour appointments
- No double-booking (conflict within 60 mins blocked)
- Bookings stay Active until explicitly closed

## Data

- SQLite database: `backend/lmha.db`
- Sessions: `backend/sessions.db`
- **No records are ever deleted.** Cancellations set `status = 'Cancelled'`.

---

## File Structure

```
lmha-system/
├── backend/
│   ├── server.js           Express app, Passport setup
│   ├── db.js               SQLite init + schema
│   ├── routes/
│   │   ├── auth.js         Google OAuth, session, location
│   │   ├── bookings.js     CRUD + double-booking validation
│   │   ├── serviceUsers.js Search + CRUD
│   │   ├── intakeForms.js  Intake form upsert
│   │   └── metrics.js      Preview + submit to Sheets
│   ├── services/
│   │   ├── metricsAggregator.js  All 4 sections from SQLite
│   │   └── googleSheets.js       Sheets API writer
│   └── middleware/
│       └── requireAuth.js
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.jsx
        │   ├── LocationSelect.jsx
        │   ├── Dashboard.jsx
        │   ├── NewBooking.jsx       (also edit mode)
        │   ├── ActiveCases.jsx
        │   ├── TodaySchedule.jsx
        │   ├── IntakeForm.jsx       (2-page form)
        │   ├── OutcomeForm.jsx
        │   └── MetricsDashboard.jsx
        └── components/
            ├── Layout.jsx
            ├── BookingCard.jsx
            ├── RepeatUserSearch.jsx
            └── MetricsPreview.jsx  (also printable)
```
