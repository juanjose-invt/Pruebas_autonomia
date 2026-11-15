// Service worker: guarda la app en caché para que funcione sin conexión.
const CACHE = 'impasto-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js', 'js/calc.js', 'js/cook.js', 'js/diagrams.js', 'js/i18n.js', 'js/pdf.js', 'js/recipes.js',
  'js/scene3d.js', 'js/steps.js', 'js/store.js', 'js/tables.js', 'js/timer.js', 'js/ui.js',
  'vendor/three.module.min.js', 'vendor/jspdf.umd.min.js',
  'fonts/abril-fatface-latin-400-normal.woff2', 'fonts/abril-fatface-latin-ext-400-normal.woff2', 'fonts/abril-fatface-400.ttf',
  'img/tile.svg', 'img/marble.webp', 'img/wood.webp',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('impasto-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la red para tener siempre la última versión; si no hay conexión, la copia guardada.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
