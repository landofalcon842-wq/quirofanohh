// QuirófanoHH — Service Worker v7.4
// Cambiar el número de versión fuerza que todos los navegadores descarguen el nuevo index.html
const CACHE_NAME = 'quirofanohh-v7-4';
const ASSETS = ['/'];

self.addEventListener('install', e => {
  // Activar inmediatamente sin esperar a que se cierren las pestañas anteriores
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  // Eliminar TODOS los cachés anteriores
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando caché antiguo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Estrategia: Network First para HTML, Cache First para assets
  const url = new URL(e.request.url);
  
  // Para el HTML principal — siempre ir a la red primero
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Guardar copia fresca en caché
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          return response;
        })
        .catch(() => caches.match(e.request)) // fallback a caché si no hay red
    );
    return;
  }

  // Para otros assets — caché primero
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request);
    })
  );
});

// Escuchar mensaje SKIP_WAITING del cliente
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
