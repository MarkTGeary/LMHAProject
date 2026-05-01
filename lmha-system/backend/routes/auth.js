const express = require('express');
const passport = require('passport');
const router = express.Router();

const { getPrimaryFrontendUrl } = require('../lib/config');
const { createAuthToken, clearAuthCookie, hasValidCsrf, publicUserFromPayload, readAuthPayload, setAuthCookie } = require('../lib/authTokens');
const { requireAuth } = require('../middleware/requireAuth');

const FRONTEND_URL = getPrimaryFrontendUrl();

router.get('/google', (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=unauthorized`,
    session: false,
  }),
  (req, res) => {
    const { token } = createAuthToken(req.user);
    setAuthCookie(res, token);
    console.log('[Auth] Cookie JWT issued for:', req.user.email);
    res.redirect(`${FRONTEND_URL}/location`);
  }
);

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.post('/location', requireAuth, (req, res) => {
  const { location } = req.body || {};
  if (!['LMHA', 'Solace Café'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const payload = readAuthPayload(req);
  if (payload) {
    const user = publicUserFromPayload(payload);
    if (!hasValidCsrf(req, user)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});

module.exports = router;
