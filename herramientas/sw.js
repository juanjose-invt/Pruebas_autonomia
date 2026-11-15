// Service worker de Cinco hojas: todo se sirve desde la caché (rutas relativas).
const VERSION = 'cincohojas-v1';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css',
  'js/app.js', 'js/core.js', 'js/qr-render.js',
  'js/tools/conversor.js', 'js/tools/qr.js', 'js/tools/claves.js', 'js/tools/tiempo.js', 'js/tools/notas.js',
  'vendor/qrcode-generator.mjs', 'vendor/jsQR.js', 'vendor/marked.esm.js', 'vendor/purify.es.mjs',
  'vendor/words-es.json', 'vendor/words-en.json',
  'fonts/familjen-grotesk-latin-wght-normal.woff2', 'fonts/familjen-grotesk-latin-ext-wght-normal.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('cincohojas-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location.href).pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const inicio = await cache.match('index.html'); if (inicio) return inicio; }
      throw err;
    }
  })());
});
