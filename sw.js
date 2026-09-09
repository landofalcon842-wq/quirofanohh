// QuirófanoHH — Service Worker v8.0
// Cambiar el número de versión fuerza que todos los navegadores
// descarguen de nuevo el index.html.
const CACHE_NAME = 'quirofanohh-v8-0';
const ASSETS = ['/'];

self.addEventListener('install', e => {
  // Activar de inmediato, sin esperar a que se cierren las pestañas anteriores
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  // Eliminar todos los cachés de versiones anteriores
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
  const url = new URL(e.request.url);

  // ══════════════════════════════════════════════════════════════
  // REGLA 1 — No tocar nada que venga de otro dominio.
  //
  // Aquí estaba el error de la versión anterior. El Service Worker
  // interceptaba también los recursos externos (Supabase, los íconos
  // de Tabler, Google Fonts, html2pdf) y los volvía a pedir con
  // fetch(). Pero una petición hecha desde código cuenta como
  // connect-src en la política de seguridad, no como script-src ni
  // font-src. Como connect-src no autorizaba esos dominios, el
  // Service Worker terminaba bloqueando recursos que la página sí
  // tenía permitido cargar, y el sistema quedaba sin Supabase, sin
  // íconos y sin tipografía.
  //
  // Al no llamar a respondWith(), la petición sigue su curso normal
  // y el navegador la evalúa con la directiva que le corresponde.
  // ══════════════════════════════════════════════════════════════
  if (url.origin !== self.location.origin) return;

  // REGLA 2 — Solo se gestionan peticiones GET.
  // Los POST a las funciones de Netlify y a Supabase pasan directo.
  if (e.request.method !== 'GET') return;

  // REGLA 3 — Las funciones serverless nunca se cachean.
  if (url.pathname.startsWith('/.netlify/')) return;

  // ── HTML principal: primero la red, para que las actualizaciones
  //    se vean de inmediato; el caché queda solo como respaldo. ──
  if (e.request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request))   // sin red, servir lo cacheado
    );
    return;
  }

  // ── Resto de archivos propios: primero el caché, y si no está,
  //    se pide a la red y se guarda para la próxima vez. ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => cached);   // si falla la red, lo que hubiera en caché
    })
  );
});

// Permite al cliente pedir la activación inmediata de una versión nueva
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});// QuirófanoHH — Service Worker v7.4
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
