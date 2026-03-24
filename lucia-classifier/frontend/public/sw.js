// Service Worker Inteligente RonCore Analytics
const CACHE_NAME = 'roncore-analytics-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.jpg',
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

// Estratégia Stale-While-Revalidate: Serve do cache e atualiza por trás
self.addEventListener('fetch', (event) => {
  // Não cacheia chamadas de API (embora agora usemos quase nada de API)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cacheia a nova resposta para uso futuro
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });

      // Retorna o cache se existir, se não espera a rede
      return cachedResponse || fetchPromise;
    })
  );
});
