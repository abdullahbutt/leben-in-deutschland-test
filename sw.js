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
const CACHE_VERSION = '2026-10-28T17-48-21-478Z';
const CACHE_NAME = `gct-cache-${CACHE_VERSION}`;

// All same-origin pages to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './quiz.html',
  './quiz-data.json',
  './assets/page.js?v=325dc48cf2',
  './privacy.html',
  './sitemap.xml',
  './robots.txt',
  './manifest.webmanifest',
  './og-image.png',
  './icons/192.png',
  './icons/512.png',
  './icons/180.png',
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
  './ar/index.html',
  './ar/questions-001-050.html',
  './ar/questions-051-100.html',
  './ar/questions-101-150.html',
  './ar/questions-151-200.html',
  './ar/questions-201-250.html',
  './ar/questions-251-300.html',
  './ar/baden-wuerttemberg.html',
  './ar/bayern.html',
  './ar/berlin.html',
  './ar/brandenburg.html',
  './ar/bremen.html',
  './ar/hamburg.html',
  './ar/hessen.html',
  './ar/mecklenburg-vorpommern.html',
  './ar/niedersachsen.html',
  './ar/nordrhein-westfalen.html',
  './ar/rheinland-pfalz.html',
  './ar/saarland.html',
  './ar/sachsen.html',
  './ar/sachsen-anhalt.html',
  './ar/schleswig-holstein.html',
  './ar/thueringen.html',
  './de/index.html',
  './de/questions-001-050.html',
  './de/questions-051-100.html',
  './de/questions-101-150.html',
  './de/questions-151-200.html',
  './de/questions-201-250.html',
  './de/questions-251-300.html',
  './de/baden-wuerttemberg.html',
  './de/bayern.html',
  './de/berlin.html',
  './de/brandenburg.html',
  './de/bremen.html',
  './de/hamburg.html',
  './de/hessen.html',
  './de/mecklenburg-vorpommern.html',
  './de/niedersachsen.html',
  './de/nordrhein-westfalen.html',
  './de/rheinland-pfalz.html',
  './de/saarland.html',
  './de/sachsen.html',
  './de/sachsen-anhalt.html',
  './de/schleswig-holstein.html',
  './de/thueringen.html',
  './tr/index.html',
  './tr/questions-001-050.html',
  './tr/questions-051-100.html',
  './tr/questions-101-150.html',
  './tr/questions-151-200.html',
  './tr/questions-201-250.html',
  './tr/questions-251-300.html',
  './tr/baden-wuerttemberg.html',
  './tr/bayern.html',
  './tr/berlin.html',
  './tr/brandenburg.html',
  './tr/bremen.html',
  './tr/hamburg.html',
  './tr/hessen.html',
  './tr/mecklenburg-vorpommern.html',
  './tr/niedersachsen.html',
  './tr/nordrhein-westfalen.html',
  './tr/rheinland-pfalz.html',
  './tr/saarland.html',
  './tr/sachsen.html',
  './tr/sachsen-anhalt.html',
  './tr/schleswig-holstein.html',
  './tr/thueringen.html',
  './ru/index.html',
  './ru/questions-001-050.html',
  './ru/questions-051-100.html',
  './ru/questions-101-150.html',
  './ru/questions-151-200.html',
  './ru/questions-201-250.html',
  './ru/questions-251-300.html',
  './ru/baden-wuerttemberg.html',
  './ru/bayern.html',
  './ru/berlin.html',
  './ru/brandenburg.html',
  './ru/bremen.html',
  './ru/hamburg.html',
  './ru/hessen.html',
  './ru/mecklenburg-vorpommern.html',
  './ru/niedersachsen.html',
  './ru/nordrhein-westfalen.html',
  './ru/rheinland-pfalz.html',
  './ru/saarland.html',
  './ru/sachsen.html',
  './ru/sachsen-anhalt.html',
  './ru/schleswig-holstein.html',
  './ru/thueringen.html',
  './uk/index.html',
  './uk/questions-001-050.html',
  './uk/questions-051-100.html',
  './uk/questions-101-150.html',
  './uk/questions-151-200.html',
  './uk/questions-201-250.html',
  './uk/questions-251-300.html',
  './uk/baden-wuerttemberg.html',
  './uk/bayern.html',
  './uk/berlin.html',
  './uk/brandenburg.html',
  './uk/bremen.html',
  './uk/hamburg.html',
  './uk/hessen.html',
  './uk/mecklenburg-vorpommern.html',
  './uk/niedersachsen.html',
  './uk/nordrhein-westfalen.html',
  './uk/rheinland-pfalz.html',
  './uk/saarland.html',
  './uk/sachsen.html',
  './uk/sachsen-anhalt.html',
  './uk/schleswig-holstein.html',
  './uk/thueringen.html',
  './fa/index.html',
  './fa/questions-001-050.html',
  './fa/questions-051-100.html',
  './fa/questions-101-150.html',
  './fa/questions-151-200.html',
  './fa/questions-201-250.html',
  './fa/questions-251-300.html',
  './fa/baden-wuerttemberg.html',
  './fa/bayern.html',
  './fa/berlin.html',
  './fa/brandenburg.html',
  './fa/bremen.html',
  './fa/hamburg.html',
  './fa/hessen.html',
  './fa/mecklenburg-vorpommern.html',
  './fa/niedersachsen.html',
  './fa/nordrhein-westfalen.html',
  './fa/rheinland-pfalz.html',
  './fa/saarland.html',
  './fa/sachsen.html',
  './fa/sachsen-anhalt.html',
  './fa/schleswig-holstein.html',
  './fa/thueringen.html',
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
