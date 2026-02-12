const CACHE_NAME = 'weeklytodo-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/reset.css',
  '/css/tokens.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/utils.js',
  '/js/categories.js',
  '/js/store.js',
  '/js/stickers.js',
  '/js/ui.js',
  '/js/ai.js',
  '/js/app.js',
  '/manifest.json',
];

// Install — cache core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for HTML, cache-first for assets
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Skip non-GET and cross-origin requests (like Anthropic API, Google Fonts)
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // HTML: network-first so updates show immediately
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other assets: cache-first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      });
    })
  );
});
