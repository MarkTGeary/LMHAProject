const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.SESSION_SECRET || 'lmha-dev-secret-change-me';

function getJwtUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  req.jwtUser = getJwtUser(req);
  if (req.jwtUser) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

function requireLocation(req, res, next) {
  req.jwtUser = getJwtUser(req);
  if (!req.jwtUser) return res.status(401).json({ error: 'Not authenticated' });
  const location = req.headers['x-location'];
  if (!['LMHA', 'Solace Café'].includes(location)) {
    return res.status(403).json({ error: 'No location selected' });
  }
  req.location = location;
  next();
}

module.exports = { requireAuth, requireLocation };
