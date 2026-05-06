const db = require('../db');
const { isRootAdminEmail } = require('../lib/config');
const { hasValidCsrf, publicUserFromPayload, readAuthPayload } = require('../lib/authTokens');

async function getAccessRecord(email) {
  const result = await db.execute({
    sql: 'SELECT email, role FROM allowed_emails WHERE email = ?',
    args: [email],
  });
  return result.rows[0] || null;
}

async function requireAuth(req, res, next) {
  try {
    if (req.user) return next();

    const payload = readAuthPayload(req);
    if (!payload) return res.status(401).json({ error: 'Not authenticated' });

    const user = publicUserFromPayload(payload);
    const access = await getAccessRecord(user.email);
    if (!access) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const role = isRootAdminEmail(user.email) ? 'admin' : access.role || 'worker';
    user.role = role;
    user.isAdmin = role === 'admin';
    if (!hasValidCsrf(req, user)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    req.user = user;
    req.jwtUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    await requireAuth(req, res, err => {
      if (err) return next(err);
      if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
      next();
    });
  } catch (err) {
    next(err);
  }
}

async function requireLocation(req, res, next) {
  try {
    await requireAuth(req, res, err => {
      if (err) return next(err);
      const location = decodeURIComponent(req.headers['x-location'] || '');
      if (!['LMHA', 'Solace Café'].includes(location)) {
        return res.status(403).json({ error: 'No location selected' });
      }
      req.location = location;
      next();
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin, requireAuth, requireLocation };
