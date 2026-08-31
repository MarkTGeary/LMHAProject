require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');

const { ApiError } = require('./lib/errors');
const {
  getBackendUrl,
  getFrontendUrls,
  getPrimaryFrontendUrl,
  getRootAdminEmail,
  validateProductionEnv,
} = require('./lib/config');

validateProductionEnv();

const db = require('./db');
const { createRateLimit, securityHeaders } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URLS = getFrontendUrls();
const FRONTEND_URL = getPrimaryFrontendUrl();
const BACKEND_URL = getBackendUrl();

const PROTECTED_EMAIL = getRootAdminEmail();

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({
  origin(origin, cb) {
    if (!origin || FRONTEND_URLS.includes(origin)) return cb(null, true);
    return cb(new ApiError(403, 'CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// Passport setup
app.use(passport.initialize());

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

// Ensure DB is initialised before any request is handled (important in serverless)
app.use(async (_req, _res, next) => {
  try { await db.ready; next(); } catch (err) { next(err); }
});

// Routes
app.use('/auth', require('./routes/auth'));
const { requireAdmin, requireLocation } = require('./middleware/requireAuth');
const apiReadLimit = createRateLimit({ namespace: 'api', windowMs: 5 * 60 * 1000, max: 600 });
const personSearchLimit = createRateLimit({ namespace: 'person-search', windowMs: 60 * 1000, max: 30 });
app.use('/api/admin',         requireAdmin,    apiReadLimit, require('./routes/admin'));
app.use('/api/bookings',      requireLocation, apiReadLimit, require('./routes/bookings'));
app.use('/api/service-users/search', requireLocation, personSearchLimit);
app.use('/api/service-users', requireLocation, apiReadLimit, require('./routes/serviceUsers'));
app.use('/api/intake-forms',  requireLocation, apiReadLimit, require('./routes/intakeForms'));
app.use('/api/metrics',       requireLocation, apiReadLimit, require('./routes/metrics'));
app.use('/api/limitations',   requireLocation, apiReadLimit, require('./routes/limitations'));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', req.method, req.path, err.message || err);
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  if ((err.message || '').includes('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'Invalid record value' });
  }
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err.message || 'Internal server error') : 'Internal server error' });
});

if (require.main === module) {
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
}

module.exports = app;
