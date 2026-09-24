/**
 * Service Worker — caches the entire site for offline use.
 *
 * Strategy:
 *   - On install: pre-cache all critical pages (the "shell")
 *   - On fetch: try network first for HTML (fresh content when online),
 *     fall back to cache when offline.
 *   - For images, fonts, CSS from CDNs: cache-first (rarely change).
 *
 * Bump the CACHE_VERSION below to force all clients to re-cache when
 * you ship significant changes.
 */

// Cache key includes a build timestamp so every deploy invalidates the cache.
// The build timestamp is replaced at build time by build.js.
const CACHE_VERSION = '2026-09-24T07-34-53-492Z';
const CACHE_NAME = `gct-cache-${CACHE_VERSION}`;

// All same-origin pages to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './quiz.html',
  './quiz-data.json',
  './privacy.html',
  './sitemap.xml',
  './robots.txt',
  './manifest.webmanifest',
  './og-image.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  // English pages
  './en/index.html',
  './en/questions-001-050.html',
  './en/questions-051-100.html',
  './en/questions-101-150.html',
  './en/questions-151-200.html',
  './en/questions-201-250.html',
  './en/questions-251-300.html',
  './en/baden-wuerttemberg.html',
  './en/bayern.html',
  './en/berlin.html',
  './en/brandenburg.html',
  './en/bremen.html',
  './en/hamburg.html',
  './en/hessen.html',
  './en/mecklenburg-vorpommern.html',
  './en/niedersachsen.html',
  './en/nordrhein-westfalen.html',
  './en/rheinland-pfalz.html',
  './en/saarland.html',
  './en/sachsen.html',
  './en/sachsen-anhalt.html',
  './en/schleswig-holstein.html',
  './en/thueringen.html',
  // Urdu pages
  './ur/index.html',
  './ur/questions-001-050.html',
  './ur/questions-051-100.html',
  './ur/questions-101-150.html',
  './ur/questions-151-200.html',
  './ur/questions-201-250.html',
  './ur/questions-251-300.html',
  './ur/baden-wuerttemberg.html',
  './ur/bayern.html',
  './ur/berlin.html',
  './ur/brandenburg.html',
  './ur/bremen.html',
  './ur/hamburg.html',
  './ur/hessen.html',
  './ur/mecklenburg-vorpommern.html',
  './ur/niedersachsen.html',
  './ur/nordrhein-westfalen.html',
  './ur/rheinland-pfalz.html',
  './ur/saarland.html',
  './ur/sachsen.html',
  './ur/sachsen-anhalt.html',
  './ur/schleswig-holstein.html',
  './ur/thueringen.html',
];

// Install: pre-cache all known pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll with allSettled-style handling: if some optional URLs
      // fail (e.g., a state HTML doesn't exist yet), we don't break install.
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches from previous versions, then notify clients
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Tell every open client that a new SW just took over so the page can show
    // an "update available — tap to refresh" banner.
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of allClients) {
      c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
    }
  })());
});

// Allow page to ask SW to skip waiting (used when user taps "Refresh now")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GETs
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the service worker file itself or the manifest — the browser
  // needs to fetch fresh copies of these to detect new versions.
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  // Same for sitemap.xml and robots.txt — these are crawler-facing files
  // that must always reflect the latest build, never a stale cached copy.
  // (They're still listed in PRECACHE_URLS above so they work offline as
  // a fallback, but online they always try the network first.)
  if (url.pathname.endsWith('/sitemap.xml') || url.pathname.endsWith('/robots.txt')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // For navigation requests (HTML pages): network-first, fall back to cache.
  // Use { cache: 'no-store' } so the browser HTTP cache doesn't serve stale HTML.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          // Cache the fresh response so it's available offline next time
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // For other resources (CSS, JS, images, fonts): cache-first, fall back to network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        // Only cache successful, basic-type responses
        if (response.ok && (url.origin === self.location.origin ||
                            url.hostname.includes('jsdelivr.net') ||
                            url.hostname.includes('googleapis.com') ||
                            url.hostname.includes('gstatic.com'))) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
        }
        return response;
      }).catch(() => {
        // For images, return a transparent fallback if offline
        if (req.destination === 'image') {
          return new Response('', { status: 204 });
        }
        throw new Error('offline');
      });
    })
  );
});
