function requireAuth(req, res, next) {
  if ((req.isAuthenticated && req.isAuthenticated()) || req.session?.devUser) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

function requireLocation(req, res, next) {
  if (!req.session.location) {
    return res.status(400).json({ error: 'No location selected for this session' });
  }
  next();
}

module.exports = { requireAuth, requireLocation };
