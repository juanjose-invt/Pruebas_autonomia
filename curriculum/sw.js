// Service worker: guarda la aplicación entera (incluidas las fuentes del PDF) para usarla sin conexión.
// Todas las rutas son relativas al propio sw.js, así funciona bajo cualquier subruta.
const CACHE = 'ic-curriculum-v1';
const ASSETS = [
  './',
  'css/app.css',
  'css/fonts.css',
  'css/sheet.css',
  'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-ext-400-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2',
  'fonts/bitter-latin-400-italic.woff2',
  'fonts/bitter-latin-400-normal.woff2',
  'fonts/bitter-latin-700-normal.woff2',
  'fonts/bitter-latin-ext-400-italic.woff2',
  'fonts/bitter-latin-ext-400-normal.woff2',
  'fonts/bitter-latin-ext-700-normal.woff2',
  'fonts/eb-garamond-latin-400-italic.woff2',
  'fonts/eb-garamond-latin-400-normal.woff2',
  'fonts/eb-garamond-latin-700-normal.woff2',
  'fonts/eb-garamond-latin-ext-400-italic.woff2',
  'fonts/eb-garamond-latin-ext-400-normal.woff2',
  'fonts/eb-garamond-latin-ext-700-normal.woff2',
  'fonts/libre-franklin-latin-400-italic.woff2',
  'fonts/libre-franklin-latin-400-normal.woff2',
  'fonts/libre-franklin-latin-700-normal.woff2',
  'fonts/libre-franklin-latin-ext-400-italic.woff2',
  'fonts/libre-franklin-latin-ext-400-normal.woff2',
  'fonts/libre-franklin-latin-ext-700-normal.woff2',
  'fonts/pdf/atkinson-hyperlegible-latin-400-italic.ttf',
  'fonts/pdf/atkinson-hyperlegible-latin-400-normal.ttf',
  'fonts/pdf/atkinson-hyperlegible-latin-700-normal.ttf',
  'fonts/pdf/atkinson-hyperlegible-latin-ext-400-italic.ttf',
  'fonts/pdf/atkinson-hyperlegible-latin-ext-400-normal.ttf',
  'fonts/pdf/atkinson-hyperlegible-latin-ext-700-normal.ttf',
  'fonts/pdf/bitter-latin-400-italic.ttf',
  'fonts/pdf/bitter-latin-400-normal.ttf',
  'fonts/pdf/bitter-latin-700-normal.ttf',
  'fonts/pdf/bitter-latin-ext-400-italic.ttf',
  'fonts/pdf/bitter-latin-ext-400-normal.ttf',
  'fonts/pdf/bitter-latin-ext-700-normal.ttf',
  'fonts/pdf/eb-garamond-latin-400-italic.ttf',
  'fonts/pdf/eb-garamond-latin-400-normal.ttf',
  'fonts/pdf/eb-garamond-latin-700-normal.ttf',
  'fonts/pdf/eb-garamond-latin-ext-400-italic.ttf',
  'fonts/pdf/eb-garamond-latin-ext-400-normal.ttf',
  'fonts/pdf/eb-garamond-latin-ext-700-normal.ttf',
  'fonts/pdf/libre-franklin-latin-400-italic.ttf',
  'fonts/pdf/libre-franklin-latin-400-normal.ttf',
  'fonts/pdf/libre-franklin-latin-700-normal.ttf',
  'fonts/pdf/libre-franklin-latin-ext-400-italic.ttf',
  'fonts/pdf/libre-franklin-latin-ext-400-normal.ttf',
  'fonts/pdf/libre-franklin-latin-ext-700-normal.ttf',
  'fonts/pdf/source-sans-3-latin-400-italic.ttf',
  'fonts/pdf/source-sans-3-latin-400-normal.ttf',
  'fonts/pdf/source-sans-3-latin-700-normal.ttf',
  'fonts/pdf/source-sans-3-latin-ext-400-italic.ttf',
  'fonts/pdf/source-sans-3-latin-ext-400-normal.ttf',
  'fonts/pdf/source-sans-3-latin-ext-700-normal.ttf',
  'fonts/pdf/source-serif-4-latin-400-italic.ttf',
  'fonts/pdf/source-serif-4-latin-400-normal.ttf',
  'fonts/pdf/source-serif-4-latin-700-normal.ttf',
  'fonts/pdf/source-serif-4-latin-ext-400-italic.ttf',
  'fonts/pdf/source-serif-4-latin-ext-400-normal.ttf',
  'fonts/pdf/source-serif-4-latin-ext-700-normal.ttf',
  'fonts/source-sans-3-latin-400-italic.woff2',
  'fonts/source-sans-3-latin-400-normal.woff2',
  'fonts/source-sans-3-latin-700-normal.woff2',
  'fonts/source-sans-3-latin-ext-400-italic.woff2',
  'fonts/source-sans-3-latin-ext-400-normal.woff2',
  'fonts/source-sans-3-latin-ext-700-normal.woff2',
  'fonts/source-serif-4-latin-400-italic.woff2',
  'fonts/source-serif-4-latin-400-normal.woff2',
  'fonts/source-serif-4-latin-700-normal.woff2',
  'fonts/source-serif-4-latin-ext-400-italic.woff2',
  'fonts/source-serif-4-latin-ext-400-normal.woff2',
  'fonts/source-serif-4-latin-ext-700-normal.woff2',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'index.html',
  'js/app.js',
  'js/countries.js',
  'js/doc-i18n.js',
  'js/dom.js',
  'js/editor.js',
  'js/hints.js',
  'js/i18n.js',
  'js/integraciones.js',
  'js/pdf.js',
  'js/render.js',
  'js/samples.js',
  'js/store.js',
  'js/templates.js',
  'js/tour.js',
  'manifest.webmanifest',
  'vendor/fontkit.umd.min.js',
  'vendor/pdf-lib.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ic-curriculum-') && k !== CACHE).map((k) => caches.delete(k))))
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
