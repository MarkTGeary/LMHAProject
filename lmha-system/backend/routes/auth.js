const express = require('express');
const passport = require('passport');
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Kick off Google login, store location in session for after callback
router.get('/google', (req, res, next) => {
  if (req.query.location) {
    req.session.pendingLocation = req.query.location;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

// Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=unauthorized`,
  }),
  (req, res) => {
    const location = req.session.pendingLocation;
    delete req.session.pendingLocation;

    if (location) {
      req.session.location = location;
      return res.redirect(`${FRONTEND_URL}/`);
    }

    res.redirect(`${FRONTEND_URL}/location`);
  }
);

// Frontend calls this to get current user + location
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    ...req.user,
    location: req.session.location || null,
  });
});

// Set location in session without re-running OAuth
router.post('/location', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const { location } = req.body || {};
  if (!['LMHA', 'Solace Café'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  req.session.location = location;
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ ok: true });
  });
});

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect(FRONTEND_URL));
});

module.exports = router;
