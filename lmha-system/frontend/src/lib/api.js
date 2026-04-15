// Base URL for all API calls.
// In production (Vercel), set VITE_API_URL to your Render backend URL.
// In development, leave it empty — Vite's proxy handles /auth and /api.
const BASE = import.meta.env.VITE_API_URL || ''

export function apiUrl(path) {
  return `${BASE}${path}`
}
