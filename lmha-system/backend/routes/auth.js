const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.SESSION_SECRET || 'lmha-dev-secret-change-me';

router.get('/google', (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=unauthorized`,
    session: false,
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, name: req.user.name, picture: req.user.picture },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    console.log('[Auth] JWT issued for:', req.user.email);
    res.redirect(`${FRONTEND_URL}/location?token=${token}`);
  }
);

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = jwt.verify(auth.slice(7), JWT_SECRET);
    res.json({ id: user.id, email: user.email, name: user.name, picture: user.picture });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/location', (req, res) => {
  const { location } = req.body || {};
  if (!['LMHA', 'Solace Café'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  res.json({ ok: true });
});

router.get('/logout', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
