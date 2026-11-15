// Service worker: guarda la app, el motor de OCR y los idiomas para usarla sin conexión.
const VERSION = 'escaner-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/i18n.js',
  'js/imaging.js',
  'js/ocr.js',
  'js/extract.js',
  'js/db.js',
  'js/huchas.js',
  'fonts/ibm-plex-mono-latin-400-normal.woff2',
  'fonts/ibm-plex-mono-latin-500-normal.woff2',
  'fonts/ibm-plex-mono-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-ext-400-normal.woff2',
  'fonts/ibm-plex-mono-latin-ext-500-normal.woff2',
  'fonts/ibm-plex-mono-latin-ext-600-normal.woff2',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/tesseract/tesseract.esm.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/lang/spa.traineddata.gz',
  'vendor/lang/eng.traineddata.gz',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
];
// Fuentes estándar de pdf.js: solo hacen falta con PDF que no incrustan sus fuentes.
const LAZY_OK = ['vendor/pdfjs/standard_fonts/'];

// Solo se descarga la variante del núcleo wasm que este dispositivo va a usar (misma prueba que ocr.js).
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
function coreFile() {
  let simd = false;
  try { simd = WebAssembly.validate(SIMD); } catch (e) { /* sin SIMD */ }
  return `vendor/tesseract-core/${simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll([...SHELL, coreFile()]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('escaner-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const scope = new URL('./', self.location).pathname;
const heavy = (p) => p.includes('/vendor/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo el propio origen y la carpeta de esta app (Huchas y el resto del sitio tienen lo suyo).
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      // Las librerías no cambian dentro de una versión: se sirven de la caché sin ir a la red.
      if (hit && heavy(url.pathname)) return hit;
      const fresh = fetch(req).then((res) => {
        if (res && res.ok && (!heavy(url.pathname) || LAZY_OK.some((p) => url.pathname.includes(p)) || url.pathname.includes('/tesseract-core/'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
      if (hit) { fresh.catch(() => {}); return hit; }
      return fresh.catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
