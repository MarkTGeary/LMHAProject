const express = require('express');
const passport = require('passport');
const router = express.Router();

const { getBackendUrl, getFrontendUrls, getPrimaryFrontendUrl, normaliseOrigin } = require('../lib/config');
const { createAuthToken, clearAuthCookie, hasValidCsrf, publicUserFromPayload, readAuthPayload, setAuthCookie } = require('../lib/authTokens');
const { requireAuth } = require('../middleware/requireAuth');

const FRONTEND_URL = getPrimaryFrontendUrl();
const FRONTEND_URLS = getFrontendUrls();
const BACKEND_URL = getBackendUrl();

function getTrustedRequestOrigin(req) {
  const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || (req.get('host') || '').split(',')[0].trim();
  if (!host) return '';
  const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim() || req.protocol || 'http';
  const origin = normaliseOrigin(`${proto}://${host}`);
  return FRONTEND_URLS.includes(origin) ? origin : '';
}

function getOAuthCallbackUrl(req) {
  const origin = getTrustedRequestOrigin(req);
  return `${origin || BACKEND_URL}/auth/google/callback`;
}

function getRedirectFrontendUrl(req) {
  return getTrustedRequestOrigin(req) || FRONTEND_URL;
}

router.get('/google', (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    callbackURL: getOAuthCallbackUrl(req),
  })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', {
      failureRedirect: `${getRedirectFrontendUrl(req)}/login?error=unauthorized`,
      session: false,
      callbackURL: getOAuthCallbackUrl(req),
    })(req, res, next);
  },
  (req, res) => {
    const { token } = createAuthToken(req.user);
    setAuthCookie(res, token);
    res.setHeader('Cache-Control', 'no-store');
    console.log('[Auth] Cookie JWT issued for:', req.user.email);
    res.redirect(`${getRedirectFrontendUrl(req)}/location?auth=1`);
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
