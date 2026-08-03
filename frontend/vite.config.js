import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A handful of API path prefixes (/auth, /habits, /insights) collide with
// client-side route names of the same string. A real page navigation (full
// browser load, refresh, typed URL) sends "Accept: text/html"; an API call
// from fetch()/apiFetch() does not. Bypass the proxy for the former so the
// SPA shell — and client-side routing — still loads on a hard refresh.
function bypassNavigations(req) {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return '/index.html'
  }
}

// Overridable so the proxy can reach a Docker Compose service name
// (e.g. "http://backend:5000") instead of localhost when running in a container.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'

const proxyTarget = { target: backendUrl, changeOrigin: true, bypass: bypassNavigations }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/habits': proxyTarget,
      '/tasks': proxyTarget,
      '/goals': proxyTarget,
      '/auth': proxyTarget,
      '/insights': proxyTarget,
      '/analytics': proxyTarget,
      '/reminders': proxyTarget,
      '/ai': proxyTarget,
      '/agent': proxyTarget,
      '/notifications': proxyTarget,
      '/health': proxyTarget,
    },
  },
})
