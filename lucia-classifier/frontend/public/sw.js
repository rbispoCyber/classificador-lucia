// Service Worker Inteligente RonCore Analytics
const CACHE_NAME = 'roncore-analytics-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.jpg',
  '/logo.png',
  '/manifest.json'
];

// Instalação: Cacheia arquivos estáticos básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de Fetch: Híbrida para PWA Offline
self.addEventListener('fetch', (event) => {
  // Ignora APIs
  if (event.request.url.includes('/api/')) return;

  const url = new URL(event.request.url);

  // 1. Navegação (Home/Index): Cache First + Ignorar Search Params
  // Isso permite que o PWA abra mesmo com ?source=pwa no link
  if (event.request.mode === 'navigate' || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 2. Stale-While-Revalidate para outros ativos (JS, CSS, etc)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
