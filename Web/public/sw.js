const CACHE_VERSION = 'ecom-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const STATIC_EXTENSIONS = /\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|webp|gif|ico)$/i;
const OFFLINE_URL = '/offline.html';

// The page registers this worker as /sw.js?admin=<ADMIN_PATH> so the admin panel is never cached.
const ADMIN_PREFIX = `/${new URL(self.location.href).searchParams.get('admin') || 'admin'}`;

const SOCIAL_LOGIN_PATHS = /^\/auth\/(google|facebook)(\/|$)/;

const PRIVATE_PATHS = /^\/(dashboard|checkout|order|auth|cart|wishlist|chat|compare)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('ecom-') && key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname === ADMIN_PREFIX ||
    url.pathname.startsWith(`${ADMIN_PREFIX}/`) ||
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    SOCIAL_LOGIN_PATHS.test(url.pathname) ||
    request.method !== 'GET'
  ) {
    return;
  }

  if (url.pathname === '/auth/login') {
    event.waitUntil(
      caches.delete(PAGES_CACHE).then(() => caches.open(PAGES_CACHE)).then((cache) => cache.add(OFFLINE_URL))
    );
  }

  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
        );
      })
    );
    return;
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !PRIVATE_PATHS.test(url.pathname)) {
            const clone = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-pages') {
    event.waitUntil(
      caches.delete(PAGES_CACHE).then(() => caches.open(PAGES_CACHE)).then((cache) => cache.add(OFFLINE_URL))
    );
  }
});
