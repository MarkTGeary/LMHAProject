const { ApiError } = require('../lib/errors');

function securityHeaders(_req, res, next) {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  next();
}

function createRateLimit({ windowMs, max, namespace }) {
  const buckets = new Map();
  let requestsSinceSweep = 0;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const identity = req.user?.email || req.ip || 'unknown';
    const key = `${namespace}:${identity}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    bucket.count += 1;
    buckets.set(key, bucket);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    requestsSinceSweep += 1;
    if (requestsSinceSweep >= 500) {
      requestsSinceSweep = 0;
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return next(new ApiError(429, 'Too many requests. Please wait and try again.'));
    }
    next();
  };
}

module.exports = { createRateLimit, securityHeaders };
