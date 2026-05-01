const configuredBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const useDirectApi = import.meta.env.DEV || import.meta.env.VITE_USE_DIRECT_API === 'true';
const BASE = useDirectApi ? configuredBase : '';
let csrfToken = null;

export function apiUrl(path) {
  return `${BASE}${path}`;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function apiFetch(path, options = {}) {
  const location = localStorage.getItem('lmha_location');
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...options.headers,
    ...(location ? { 'X-Location': location } : {}),
  };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
    },
  });
}
