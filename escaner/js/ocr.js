// Reconocimiento de texto con Tesseract.js, todo servido desde vendor/ (sin CDN).
//   vendor/tesseract/       tesseract.esm.min.js (hilo principal) y worker.min.js (worker)
//   vendor/tesseract-core/  núcleo wasm (embebido en .wasm.js), versión SIMD y sin SIMD, solo LSTM
//   vendor/lang/            spa y eng «best_int» (los modelos LSTM más ligeros), comprimidos .gz
import Tesseract from '../vendor/tesseract/tesseract.esm.min.js';

const base = new URL('../vendor/', import.meta.url);
let workerP = null;
let listener = () => {};

// Misma prueba que wasm-feature-detect usa para SIMD.
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
export const coreFile = () => {
  let simd = false;
  try { simd = WebAssembly.validate(SIMD); } catch (e) { /* sin SIMD */ }
  return simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
};

function getWorker() {
  if (!workerP) {
    workerP = Tesseract.createWorker(['spa', 'eng'], Tesseract.OEM.LSTM_ONLY, {
      workerPath: new URL('tesseract/worker.min.js', base).href,
      // Un archivo concreto: así no se intenta cargar la variante «relaxed SIMD», que no se incluye.
      corePath: new URL(`tesseract-core/${coreFile()}`, base).href,
      langPath: new URL('lang/', base).href.replace(/\/$/, ''),
      gzip: true,
      // El service worker ya guarda los datos de idioma; no se duplican en IndexedDB.
      cacheMethod: 'none',
      // Worker normal (no blob:) para que el service worker lo controle sin conexión.
      workerBlobURL: false,
      logger: (m) => listener(m),
      errorHandler: (e) => listener({ status: 'error', error: e }),
    }).then(async (w) => {
      await w.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return w;
    }).catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

// Reconoce un canvas. onProgress recibe { stage, progress } con stage en
// core | lang | init | reading. Devuelve palabras con caja y confianza.
export async function recognize(canvas, onProgress = () => {}) {
  listener = (m) => {
    const s = m.status || '';
    let stage = 'init';
    if (s.includes('core')) stage = 'core';
    else if (s.includes('traineddata')) stage = 'lang';
    else if (s.includes('recognizing')) stage = 'reading';
    onProgress({ stage, progress: typeof m.progress === 'number' ? m.progress : 0 });
  };
  onProgress({ stage: 'warm', progress: 0 });
  const w = await getWorker();
  const res = await w.recognize(canvas, {}, { text: true, tsv: true });
  listener = () => {};
  return parse(res.data);
}

function parse(data) {
  const words = [];
  const lines = new Map();
  for (const row of String(data.tsv || '').split('\n')) {
    const c = row.split('\t');
    if (c.length < 12 || !/^\d+$/.test(c[0])) continue;
    const level = +c[0];
    if (level !== 5) continue;
    const text = c.slice(11).join('\t').trim();
    const conf = +c[10];
    if (!text || conf < 0) continue;
    const x = +c[6], y = +c[7], w = +c[8], h = +c[9];
    const key = `${c[2]}.${c[3]}.${c[4]}`;
    const word = { text, conf, bbox: { x0: x, y0: y, x1: x + w, y1: y + h }, line: key };
    words.push(word);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(word);
  }
  return {
    text: (data.text || '').replace(/\n{3,}/g, '\n\n').trim(),
    conf: data.confidence ?? 0,
    words,
  };
}

export async function terminate() {
  if (!workerP) return;
  const w = await workerP.catch(() => null);
  workerP = null;
  if (w) await w.terminate();
}
