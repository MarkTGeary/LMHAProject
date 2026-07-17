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
   - Local redirect URI: `http://localhost:3000/auth/google/callback`
   - Production redirect URI, if using the Vercel proxy: `https://your-frontend.vercel.app/auth/google/callback`
4. Copy Client ID and Secret to `backend/.env`

## Production Auth on Vercel + Render

Browsers can block cross-site cookies between `vercel.app` and `onrender.com`,
especially on tablets. In production, prefer the included Vercel same-origin
proxy:

- On Vercel, set `BACKEND_PROXY_URL` to the Render backend origin, for example
  `https://lmha-backend.onrender.com`. Production frontend builds use the
  same-origin proxy by default so browser cookies stay on the Vercel domain.
- On Render, set `FRONTEND_URL` and `BACKEND_URL` to the Vercel frontend origin.
- In Google OAuth, use the Vercel callback URL shown above.

Do not point the deployed browser app directly at Render with `VITE_API_URL`
unless you also set `VITE_USE_DIRECT_API=true` and accept third-party cookie
blocking in Firefox, Brave, Safari, and stricter tablet browsers.

This makes `/auth/*` and `/api/*` same-origin from the browser while still
running the backend on Render.

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
ADMIN_EMAILS=supervisor@lmha.ie
ROOT_ADMIN_EMAIL=supervisor@lmha.ie
APP_TIME_ZONE=Europe/Dublin
```

`ALLOWED_EMAILS` seeds ordinary workers. `ADMIN_EMAILS` is an environment-level
admin list and is re-applied on startup, even if those emails are not also in
`ALLOWED_EMAILS`.
`ROOT_ADMIN_EMAIL` is always kept as an admin and cannot be removed or demoted;
if it is blank, the first `ADMIN_EMAILS` address is used, then the first
`ALLOWED_EMAILS` address.

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

- Database: Turso/libSQL (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`)
- Auth: Google OAuth issues an 8-hour `HttpOnly` cookie with CSRF protection
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
