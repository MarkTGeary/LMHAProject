const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function normaliseOrigin(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function getRequestOrigin(req) {
  const host = req.headers.host || '';
  if (!host) return '';
  return normaliseOrigin(`https://${host}`);
}

function getBackendOrigin(req) {
  const requestOrigin = getRequestOrigin(req);
  const candidates = [
    process.env.BACKEND_PROXY_URL,
    process.env.VITE_API_URL,
    process.env.BACKEND_URL,
  ].map(normaliseOrigin).filter(Boolean);

  const backendOrigin = candidates.find(origin => origin !== requestOrigin);
  if (!backendOrigin) {
    throw new Error('BACKEND_PROXY_URL must point to the Render backend origin, not the Vercel frontend origin');
  }
  return backendOrigin;
}

function getProxyPath(req) {
  const value = req.query.path;
  if (Array.isArray(value)) return value.join('/');
  return value || '';
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  try {
    const backendOrigin = getBackendOrigin(req);
    const proxyPath = getProxyPath(req).replace(/^\/+/, '');
    const incomingUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    incomingUrl.searchParams.delete('path');

    const target = new URL(`${backendOrigin}/${proxyPath}`);
    target.search = incomingUrl.searchParams.toString();

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];
    headers['x-forwarded-host'] = req.headers.host || '';
    headers['x-forwarded-proto'] = 'https';

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: await readBody(req),
      redirect: 'manual',
    });

    res.statusCode = upstream.status;
    const setCookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'set-cookie' || HOP_BY_HOP_HEADERS.has(lower)) return;
      res.setHeader(key, value);
    });
    if (setCookies.length) {
      res.setHeader('Set-Cookie', setCookies);
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Proxy failed' }));
  }
};
