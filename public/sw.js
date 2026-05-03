// Precache + stale-while-revalidate for Cultus hole images / scorecard and same-origin assets.
const CULTUS_MEDIA = 'https://golfcultus.com/wp-content/uploads'
const CACHE_CULTUS = 'borseth-cultus-media-v2'
const CACHE_APP = 'borseth-app-assets-v2'

const SCORECARD_URL = `${CULTUS_MEDIA}/2024/02/2021-CLGC-Scorecard-Back.webp`
const HOLE_BASE = `${CULTUS_MEDIA}/2024/03`

function cultusHoleImageUrls() {
  const urls = []
  for (let h = 1; h <= 18; h++) {
    if (h === 1) urls.push(`${HOLE_BASE}/hole1-1.webp`)
    else if (h === 14) urls.push(`${HOLE_BASE}/Hole14-1.webp`)
    else if (h === 16) urls.push(`${HOLE_BASE}/Hole16-e1561986125589.webp`)
    else urls.push(`${HOLE_BASE}/hole${h}.webp`)
  }
  return urls
}

const PRECACHE_CULTUS_URLS = [SCORECARD_URL, ...cultusHoleImageUrls()]

/**
 * @param {FetchEvent} event
 * @param {Request} request
 * @param {string} cacheName
 */
function staleWhileRevalidate(event, request, cacheName) {
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      const cached = await cache.match(request)

      const fetchPromise = fetch(request).then(async (response) => {
        if (response.ok || response.type === 'opaque') {
          try {
            await cache.put(request, response.clone())
          } catch {
            /* ignore quota / opaque quirks */
          }
        }
        return response
      })

      if (cached) {
        event.waitUntil(
          fetchPromise.then(
            () => {},
            () => {},
          ),
        )
        return cached
      }

      try {
        return await fetchPromise
      } catch {
        return (await cache.match(request)) || fetch(request)
      }
    })().catch(() => fetch(request)),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_CULTUS)
      await Promise.all(
        PRECACHE_CULTUS_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* install may run offline */
          }),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_CULTUS && k !== CACHE_APP)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  if (req.mode === 'navigate') return

  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  const scopeUrl = new URL(self.registration.scope)

  if (url.href.startsWith(CULTUS_MEDIA)) {
    staleWhileRevalidate(event, req, CACHE_CULTUS)
    return
  }

  if (url.origin === scopeUrl.origin) {
    staleWhileRevalidate(event, req, CACHE_APP)
    return
  }
})
