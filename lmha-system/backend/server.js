require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const path = require('path');

// Init DB (runs migrations)
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// First email in ALLOWED_EMAILS env is permanently protected (cannot be removed via UI)
const PROTECTED_EMAIL = (process.env.ALLOWED_EMAILS || '').split(',')[0]?.trim().toLowerCase() || '';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions — file-based store, survives restarts, no native compilation needed
const FileStore = require('session-file-store')(session);
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
    retries: 1,
    ttl: 8 * 60 * 60, // 8 hours in seconds
  }),
  secret: process.env.SESSION_SECRET || 'lmha-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true in production with HTTPS
    maxAge: 8 * 60 * 60 * 1000, // 8-hour session
  },
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`,
  },
  (accessToken, refreshToken, profile, done) => {
    const email = (profile.emails?.[0]?.value || '').toLowerCase();

    const allowed = db.prepare('SELECT 1 FROM allowed_emails WHERE email = ?').get(email);
    if (!allowed) {
      console.warn(`[Auth] Rejected login attempt from: ${email}`);
      return done(null, false, { message: 'Email not on allowlist' });
    }

    const user = {
      id: profile.id,
      email,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value || null,
    };

    console.log(`[Auth] Login: ${email}`);
    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.use('/auth', require('./routes/auth'));
const { requireAuth, requireLocation } = require('./middleware/requireAuth');
app.use('/api/admin', requireAuth, require('./routes/admin'));
app.use('/api/bookings', requireLocation, require('./routes/bookings'));
app.use('/api/service-users', requireLocation, require('./routes/serviceUsers'));
app.use('/api/intake-forms', requireLocation, require('./routes/intakeForms'));
app.use('/api/metrics', requireLocation, require('./routes/metrics'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Global error handler — logs the real error instead of silently returning 500
app.use((err, req, res, _next) => {
  console.error('[ERROR]', req.method, req.path, err.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err.message || 'Internal server error') : 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LMHA backend running on http://localhost:${PORT}`);
  console.log(`Protected admin email: ${PROTECTED_EMAIL || '(none set)'}`);
});
