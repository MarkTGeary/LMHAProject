require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  || `http://localhost:${PORT}`;

const PROTECTED_EMAIL = (process.env.ALLOWED_EMAILS || '').split(',')[0]?.trim().toLowerCase() || '';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions — MemoryStore (single Render instance; users re-login on restart)
app.use(session({
  secret: process.env.SESSION_SECRET || 'lmha-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    callbackURL: `${BACKEND_URL}/auth/google/callback`,
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = (profile.emails?.[0]?.value || '').toLowerCase();

    try {
      const result = await db.execute({
        sql: 'SELECT 1 FROM allowed_emails WHERE email = ?',
        args: [email],
      });
      if (!result.rows.length) {
        console.warn(`[Auth] Rejected login attempt from: ${email}`);
        return done(null, false, { message: 'Email not on allowlist' });
      }
    } catch (err) {
      return done(err);
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
app.use('/api/admin',         requireAuth,     require('./routes/admin'));
app.use('/api/bookings',      requireLocation, require('./routes/bookings'));
app.use('/api/service-users', requireLocation, require('./routes/serviceUsers'));
app.use('/api/intake-forms',  requireLocation, require('./routes/intakeForms'));
app.use('/api/metrics',       requireLocation, require('./routes/metrics'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', req.method, req.path, err.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err.message || 'Internal server error') : 'Internal server error' });
});

// Wait for DB to be fully initialised before accepting traffic
db.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LMHA backend running on port ${PORT}`);
      console.log(`Frontend: ${FRONTEND_URL}`);
      console.log(`Protected admin email: ${PROTECTED_EMAIL || '(none set)'}`);
    });
  })
  .catch(err => {
    console.error('[DB] Initialisation failed:', err);
    process.exit(1);
  });
