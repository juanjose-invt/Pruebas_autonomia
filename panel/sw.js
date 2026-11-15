// Service worker: guarda la aplicación entera para usarla sin conexión.
const CACHE = 'tirada-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/i18n.js',
  'js/parse-csv.js',
  'js/types.js',
  'js/data.js',
  'js/auto.js',
  'js/charts.js',
  'js/table.js',
  'js/store.js',
  'js/samples.js',
  'js/export.js',
  'vendor/read-excel-file.min.js',
  'fonts/epilogue-latin-wght-normal.woff2',
  'fonts/epilogue-latin-ext-wght-normal.woff2',
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tirada-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      // Se sirve la copia guardada y, si hay red, se refresca en segundo plano.
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
