// AI-Dost PWA Service Worker - Offline shell caching
// P3 #198: bump CACHE_NAME on every deploy that changes public assets —
// activate() below evicts every other ai-dost-* cache, which is what makes
// versioning actually reclaim stale entries.
const CACHE_NAME = 'ai-dost-v3';
const CACHE_PREFIX = 'ai-dost-';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/logo.jpg',
  '/favicon.ico',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
    })
  );
  self.skipWaiting();
});

// Activate - delete old ai-dost-* caches (keep only current CACHE_NAME)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - navigations network-first (never cache HTML), static assets cache-first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  // API requests - network first. P3 #211: the old `caches.match(request)`
  // fallback could only ever return undefined (API GETs are never put() into
  // a cache) — return an honest offline error instead.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Navigation/HTML requests - network first so deploys are never stale;
  // fall back to cached shell only when offline. Do NOT cache navigations.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Content-hashed build assets - cache first (immutable by hash)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // P3 #198: everything else (non-hashed public files: logo.jpg, favicon.ico,
  // audio-processor.js, /downloads/*) is network-first with cache fallback —
  // the old unconditional cache-first + fixed CACHE_NAME served them stale
  // forever after a deploy.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || Response.error())
      )
  );
});

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});