const express = require('express');
const passport = require('passport');
const router = express.Router();

// Dev bypass — skip Google auth, log straight in
router.post('/dev-login', (req, res) => {
  req.session.devUser = { id: 'dev', email: 'dev@lmha.ie', name: 'Dev User', picture: null };
  res.json({ ok: true });
});

// Google OAuth login
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    res.redirect('http://localhost:5173/location');
  }
);

router.get('/failure', (req, res) => {
  res.redirect('http://localhost:5173/login?error=unauthorized');
});

// Get current session user
router.get('/me', (req, res) => {
  const user = req.session?.devUser || (req.isAuthenticated() ? req.user : null);
  if (user) {
    return res.json({
      user: { email: user.email, name: user.name, picture: user.picture },
      location: req.session.location || null,
    });
  }
  res.status(401).json({ user: null });
});

// Set location for session
router.post('/location', (req, res) => {
  if (!req.isAuthenticated() && !req.session?.devUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { location } = req.body;
  if (!['LMHA', 'Solace Café'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  req.session.location = location;
  res.json({ ok: true, location });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy();
    res.json({ ok: true });
  });
});

module.exports = router;
