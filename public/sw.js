// v2 — do not intercept navigations or cross-origin requests; those break Chrome
// (ERR_CACHE_MISS, missing CSS) when passed through respondWith(fetch).
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  // Full document loads / soft-navigations: browser must handle (streaming SSR, bfcache).
  if (req.mode === 'navigate') return

  // Convex, analytics, etc.
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  const scopeUrl = new URL(self.registration.scope)
  if (url.origin !== scopeUrl.origin) return

  event.respondWith(fetch(req))
})
