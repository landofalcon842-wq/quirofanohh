// ═══════════════════════════════════════════════════════════════
// QuirófanoHH — Service Worker
// Auto-actualización: cuando Netlify despliega una nueva versión,
// todos los dispositivos (PC, celular, PWA) se actualizan solos.
//
// IMPORTANTE: Este archivo debe estar en la RAÍZ del repositorio
// (mismo nivel que index.html), NO dentro de netlify/functions/
// ═══════════════════════════════════════════════════════════════

// Cambia este número cada vez que quieras forzar actualización en todos los dispositivos.
// Netlify lo hace automáticamente con cada deploy porque el archivo cambia.
const CACHE_NAME = 'quirofanohh-v1';

// Archivos a cachear para funcionamiento offline básico
const CACHE_ASSETS = [
  '/',
  '/index.html',
];

// ── Instalación: cachear assets básicos ──────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_ASSETS).catch(err => {
        // Si falla el caché (ej: sin conexión), continuar igual
        console.warn('[SW] No se pudo cachear:', err.message);
      });
    })
  );
  // Activar inmediatamente sin esperar a que se cierren las pestañas
  self.skipWaiting();
});

// ── Activación: limpiar cachés anteriores ────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando versión:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando caché antiguo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Tomar control de todas las pestañas abiertas inmediatamente
      return self.clients.claim();
    })
  );
});

// ── Fetch: estrategia Network First ──────────────────────────
// Siempre intenta la red primero para garantizar contenido fresco.
// Solo usa caché si no hay conexión.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar llamadas a APIs externas (Supabase, Brevo, Fonts, CDN)
  const externalDomains = [
    'supabase.co',
    'brevo.com',
    'googleapis.com',
    'jsdelivr.net',
    'cloudflare.com',
    'cdnjs.cloudflare.com',
    'fonts.gstatic.com',
  ];
  if (externalDomains.some(d => url.hostname.includes(d))) {
    return; // Dejar pasar sin interceptar
  }

  // No interceptar las Netlify Functions
  if (url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // Para el resto (index.html, assets propios): Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualizar el caché
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin conexión: intentar desde caché
        return caches.match(event.request).then(cached => {
          if (cached) {
            console.log('[SW] Sirviendo desde caché (sin conexión):', event.request.url);
            return cached;
          }
          // Si no hay caché y no hay conexión, mostrar página básica
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── Mensajes desde el cliente ─────────────────────────────────
// Recibe SKIP_WAITING para activarse inmediatamente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING recibido — activando nueva versión');
    self.skipWaiting();
  }
});
