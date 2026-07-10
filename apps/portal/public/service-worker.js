const CACHE_NAME = 'stockpro-v1';
const STATIC_CACHE = 'stockpro-static-v1';
const DYNAMIC_CACHE = 'stockpro-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            const shouldCache = 
              url.origin === location.origin &&
              (request.destination === 'script' ||
               request.destination === 'style' ||
               request.destination === 'image' ||
               request.destination === 'font' ||
               request.destination === 'document');

            if (shouldCache) {
              const clonedResponse = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }

            return response;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            throw error;
          });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
