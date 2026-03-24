// Service Worker básico para conformidade PWA
const CACHE_NAME = 'roncore-analytics-v1';
const ASSETS = [
  '/',
  '/logo.jpg',
  '/manifest.json'
];

// Instalação do Service Worker - Cache inicial
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets principais');
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker Ativo');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Interceptor de requisições - Essencial para PWA e Offline
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de API para não cachear dados dinâmicos de forma errada
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a rede funcionar, retorna a resposta original
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tenta buscar no cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Se não tiver no cache e for uma navegação, retorna a home para manter o PWA vivo
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
