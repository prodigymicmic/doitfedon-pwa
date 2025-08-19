/* service-worker.js */

const VERSION = 'v1.0.0';
const CACHE_NAME = `doitfedon-pwa-${VERSION}`;

// Cache only same-origin app shell assets (GitHub Pages scope).
const APP_SHELL = [
  './',                      // resolves to /doitfedon-pwa/
  './index.html',
  './manifest.json',
  './service-worker.js',
  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon-180x180.png'
];

// ----- Install: pre-cache app shell -----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {
        // If any file fails, we still want SW to install.
      })
  );
});

// ----- Activate: cleanup old caches -----
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(n => n.startsWith('doitfedon-pwa-') && n !== CACHE_NAME)
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// Utility: network-first with cache fallback
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    // Optionally: put a copy in cache (only for GET and same-origin)
    if (request.method === 'GET' && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || Promise.reject(err);
  }
}

// Utility: cache-first for static assets
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (request.method === 'GET' && new URL(request.url).origin === self.location.origin) {
    cache.put(request, fresh.clone());
  }
  return fresh;
}

// Decide strategy based on request
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return; // let the network handle (e.g., your figma.site iframe)
  }

  // For navigations (user enters URL, clicks links), serve index.html (SPA fallback)
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith((async () => {
      try {
        // Try network first for latest HTML
        const fresh = await fetch(req);
        return fresh;
      } catch {
        // Offline: return cached index.html if available
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('./index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // For app shell assets -> cache-first
  const assetPaths = new Set(APP_SHELL);
  const relPath = `.${url.pathname.endsWith('/') ? url.pathname : url.pathname}`;
  if (assetPaths.has(relPath)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // For everything else on same-origin -> network-first
  event.respondWith(networkFirst(req));
});

// Optional: allow immediate activation from the page
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
