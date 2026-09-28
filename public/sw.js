// Service Worker (§19.1, §19.4): guarda en caché la app y los archivos del
// banco para que el juego sea usable sin conexión tras la primera carga.
// Estrategia "stale-while-revalidate" a mano (sin Workbox ni otra
// dependencia): responde con lo cacheado si existe, y de paso pide la
// versión de red para refrescar la caché de cara a la próxima vez. Solo
// same-origin: Google Fonts y cualquier otro origen se dejan pasar sin
// cachear (CLAUDE.md, "sin peticiones de red salvo Google Fonts y archivos propios").
const CACHE_NAME = 'hm2-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {
        /* alguno de los core assets no se pudo precachear: no bloquea la instalación */
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
