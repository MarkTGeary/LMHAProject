const BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return `${BASE}${path}`;
}

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('lmha_token');
  const location = localStorage.getItem('lmha_location');
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token    ? { Authorization: `Bearer ${token}` }  : {}),
      ...(location ? { 'X-Location': location }            : {}),
    },
  });
}
