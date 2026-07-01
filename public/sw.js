
const CACHE_NAME = 'ward-link-ng-v1';

// Install: Skip caching (Vite handles asset hashing)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Fetch: Network first, no cache for HTML (so updates show immediately)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});