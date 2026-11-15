// Service worker: guarda la app entera para usarla sin conexión (rutas relativas al propio sw).
const CACHE = 'ofz-presupuestos-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/i18n.js',
  'js/calc.js',
  'js/icons.js',
  'js/pdf.js',
  'js/integraciones.js',
  'vendor/jspdf.umd.min.js',
  'fonts/figtree-latin-wght-normal.woff2',
  'fonts/figtree-latin-ext-wght-normal.woff2',
  'fonts/mohave-latin-wght-normal.woff2',
  'fonts/mohave-latin-ext-wght-normal.woff2',
  'fonts/pdf/figtree-400.ttf',
  'fonts/pdf/figtree-600.ttf',
  'fonts/pdf/mohave-300.ttf',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ofz-presupuestos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL('./', self.location).pathname;
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      // Se sirve la copia guardada y, si hay red, se actualiza en segundo plano.
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
      if (hit) { fresh.catch(() => {}); return hit; }
      return fresh.catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
