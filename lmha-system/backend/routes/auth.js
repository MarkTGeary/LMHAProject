const express = require('express');
const passport = require('passport');
const router = express.Router();

// Kick off Google login, store location in session for after callback
router.get('/google', (req, res, next) => {
  if (req.query.location) {
    req.session.pendingLocation = req.query.location;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:5173/login?error=unauthorized',
  }),
  (req, res) => {
    const location = req.session.pendingLocation;
    delete req.session.pendingLocation;

    if (location) {
      // They came from location select — send them to the app with location set
      req.session.location = location;
      return res.redirect('http://localhost:5173/dashboard');
    }

    // Normal login flow — send to location select first
    res.redirect('http://localhost:5173/location');
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

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('http://localhost:5173'));
});

module.exports = router;