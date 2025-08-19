/* service-worker.js — v1.1.0 (GitHub Pages friendly) */

const VERSION = 'v1.1.0';
const CACHE_PREFIX = 'doitfedon-pwa';
const CACHE_NAME = `${CACHE_PREFIX}-${VERSION}`;

/**
 * Use ONLY relative paths here so the SW works under:
 * https://prodigymicmic.github.io/doitfedon-pwa/
 */
const APP_SHELL = [
  './',                      // resolves to /doitfedon-pwa/
  './index.html',
  './manifest.json',
  './service-worker.js',
  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-192x192-maskable.png',
  './icons/icon-512x512-maskable.png',
  './icons/apple-touch-icon-180x180.png'
];

/* ---------------- Install: pre-cache app shell ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Even if some resources fail, don't block install.
      })
  );
});

/* ---------------- Activate: clean old caches ------------------ */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ------------ Helpers: caching strategies (same-origin) ------- */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (request.method === 'GET') cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (request.method === 'GET' && response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback to app shell for navigations
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/* ---------------------- Fetch routing ------------------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore cross-origin (e.g., iframe to figma.site). This prevents
  // mixed-content/SSL checks from being attributed to your PWA shell.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fallback to cached index.html
  if (req.mode === 'navigate'
      || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(networkFirst(req));
    return;
  }

  // App shell assets: cache-first for speed
  // Normalize to a relative path string like './path...'
  const relativePath = `.${url.pathname.endsWith('/') ? url.pathname : url.pathname}`;
  if (APP_SHELL.includes(relativePath)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Other same-origin requests: network-first
  event.respondWith(networkFirst(req));
});

/* ------------- Messages: runtime controls (optional) ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_OLD_CACHES') {
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    );
  }
});
