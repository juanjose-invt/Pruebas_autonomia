// Tratamiento de la imagen antes del reconocimiento: carga (imagen o PDF), giro,
// enderezado, recorte y mejora de contraste. Todo con canvas, en el dispositivo.

const MAX_SIDE = 2200; // lado mayor tras cargar: suficiente para el OCR y ligero en tablet

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function fit(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

export async function canvasFromBlob(blob) {
  let src;
  try {
    src = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (e) {
    src = await new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  const [w, h] = fit(src.width, src.height, MAX_SIDE);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  if (src.close) src.close();
  return c;
}

// ---------- PDF (pdf.js se carga solo si hace falta) ----------
let pdfjs = null;
async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  const base = new URL('../vendor/pdfjs/', import.meta.url);
  pdfjs = await import(new URL('pdf.min.mjs', base).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href;
  return pdfjs;
}

export async function openPdf(blob) {
  const lib = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await lib.getDocument({
    data,
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
  }).promise;
  return doc;
}

export async function renderPdfPage(doc, n) {
  const page = await doc.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(3, MAX_SIDE / Math.max(v1.width, v1.height));
  const vp = page.getViewport({ scale });
  const c = makeCanvas(vp.width, vp.height);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return c;
}

// ---------- geometría ----------
export function rotated(src, rot90, angleDeg) {
  const rad = ((rot90 + angleDeg) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const w = src.width * cos + src.height * sin;
  const h = src.width * sin + src.height * cos;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2);
  g.rotate(rad);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function cropped(src, crop) {
  if (!crop) return src;
  const x = Math.round(crop.x * src.width), y = Math.round(crop.y * src.height);
  const w = Math.round(crop.w * src.width), h = Math.round(crop.h * src.height);
  if (w < 8 || h < 8) return src;
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

// ---------- gris ----------
function grayOf(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
  const out = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) out[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  return out;
}

export function otsu(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, th = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; th = i; }
  }
  return th;
}

function small(src, maxSide) {
  const [w, h] = fit(src.width, src.height, maxSide);
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return c;
}

// ---------- enderezado automático ----------
// Busca el ángulo que hace más «nítidas» las filas de texto: proyección horizontal
// de los píxeles oscuros con la varianza más alta.
export function detectSkew(src, range = 15) {
  const c = small(src, 900);
  const gray = grayOf(c);
  const W = c.width, H = c.height;
  // Fondo normalizado para que sombras y bordes de mesa no cuenten como texto.
  const th = Math.min(otsu(gray), 200);
  const pts = [];
  const step = Math.max(1, Math.round(Math.sqrt((W * H) / 60000)));
  for (let y = 1; y < H - 1; y += step) {
    for (let x = 1; x < W - 1; x += step) {
      const v = gray[y * W + x];
      // Solo bordes oscuros finos (letras), no manchas grandes
      if (v < th && (gray[y * W + x - 1] >= th || gray[(y - 1) * W + x] >= th || gray[y * W + x + 1] >= th)) pts.push(x - W / 2, y - H / 2);
    }
  }
  if (pts.length < 200) return 0;
  const score = (deg) => {
    const r = (deg * Math.PI) / 180, s = Math.sin(r), co = Math.cos(r);
    const bins = new Float32Array(Math.ceil(Math.hypot(W, H)) + 2);
    const off = bins.length / 2;
    for (let i = 0; i < pts.length; i += 2) {
      const yy = Math.round(-pts[i] * s + pts[i + 1] * co + off);
      bins[yy]++;
    }
    let acc = 0;
    for (let i = 1; i < bins.length; i++) { const d = bins[i] - bins[i - 1]; acc += d * d; }
    return acc;
  };
  let best = 0, bestS = -1;
  for (let a = -range; a <= range; a += 0.5) { const sc = score(a); if (sc > bestS) { bestS = sc; best = a; } }
  const coarse = best;
  for (let a = coarse - 0.5; a <= coarse + 0.5; a += 0.1) { const sc = score(a); if (sc > bestS) { bestS = sc; best = a; } }
  // Girar la imagen en sentido contrario a la inclinación
  return Math.round(-best * 10) / 10;
}

// ---------- recorte automático: el papel claro sobre un fondo más oscuro ----------
export function detectPaper(src) {
  const c = small(src, 500);
  const gray = grayOf(c);
  const W = c.width, H = c.height;
  const th = otsu(gray);
  const colFrac = new Float32Array(W), rowFrac = new Float32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (gray[y * W + x] > th) { colFrac[x]++; rowFrac[y]++; }
  }
  const span = (arr, n, len) => {
    let a = 0, b = len - 1;
    while (a < len && arr[a] / n < 0.35) a++;
    while (b > a && arr[b] / n < 0.35) b--;
    return [a, b];
  };
  const [x0, x1] = span(colFrac, H, W);
  const [y0, y1] = span(rowFrac, W, H);
  if (x1 - x0 < W * 0.15 || y1 - y0 < H * 0.15) return null;
  const pad = 0.006;
  const r = {
    x: Math.max(0, x0 / W - pad), y: Math.max(0, y0 / H - pad),
    w: 0, h: 0,
  };
  r.w = Math.min(1, (x1 + 1) / W + pad) - r.x;
  r.h = Math.min(1, (y1 + 1) / H + pad) - r.y;
  if (r.w > 0.97 && r.h > 0.97) return null;
  return r;
}

// ---------- mejora: iluminación uniforme + niveles + (opcional) blanco y negro ----------
export function enhanced(src, amount, bw) {
  if (!amount && !bw) return src;
  const W = src.width, H = src.height;
  const gray = grayOf(src);
  const k = (amount || 0) / 100;
  // Fondo: versión muy reducida y suavizada, ampliada de nuevo (corrige sombras de la foto)
  const bgC = small(src, 48);
  const bgBig = makeCanvas(W, H);
  const bg = bgBig.getContext('2d', { willReadFrequently: true });
  bg.filter = 'blur(2px)';
  bg.imageSmoothingQuality = 'high';
  // Máximo local aproximado: el papel es lo más claro de cada zona
  const bgg = bgC.getContext('2d', { willReadFrequently: true });
  const bd = bgg.getImageData(0, 0, bgC.width, bgC.height);
  const bw0 = bgC.width, bh0 = bgC.height;
  const lum = new Uint8ClampedArray(bw0 * bh0);
  for (let i = 0, j = 0; i < bd.data.length; i += 4, j++) lum[j] = (bd.data[i] * 77 + bd.data[i + 1] * 150 + bd.data[i + 2] * 29) >> 8;
  for (let y = 0; y < bh0; y++) for (let x = 0; x < bw0; x++) {
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(bw0 - 1, Math.max(0, x + dx)), yy = Math.min(bh0 - 1, Math.max(0, y + dy));
      m = Math.max(m, lum[yy * bw0 + xx]);
    }
    const o = (y * bw0 + x) * 4;
    bd.data[o] = bd.data[o + 1] = bd.data[o + 2] = m;
  }
  bgg.putImageData(bd, 0, 0);
  bg.drawImage(bgC, 0, 0, W, H);
  const bgData = bg.getImageData(0, 0, W, H).data;

  const flat = new Uint8ClampedArray(W * H);
  for (let j = 0; j < flat.length; j++) {
    const b = Math.max(40, bgData[j * 4]);
    const v = Math.min(255, (gray[j] / b) * 255);
    flat[j] = gray[j] + (v - gray[j]) * Math.min(1, k * 1.5);
  }
  // Niveles por percentiles
  const hist = new Uint32Array(256);
  for (let j = 0; j < flat.length; j++) hist[flat[j]]++;
  const pct = (p) => { let acc = 0; const n = flat.length * p; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n) return i; } return 255; };
  const lo = pct(0.01), hi = Math.max(lo + 30, pct(0.9));
  const gamma = 1 + k * 0.6;
  const out = makeCanvas(W, H);
  const og = out.getContext('2d');
  const img = og.createImageData(W, H);
  const th = bw ? otsu(flat) : 0;
  for (let j = 0, i = 0; j < flat.length; j++, i += 4) {
    let v;
    if (bw) v = flat[j] > th ? 255 : 0;
    else {
      const n = Math.min(1, Math.max(0, (flat[j] - lo) / (hi - lo)));
      const stretched = Math.pow(n, gamma) * 255;
      v = flat[j] + (stretched - flat[j]) * k;
    }
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}

export function thumbnail(src, max = 320, quality = 0.7) {
  const c = small(src, max);
  return c.toDataURL('image/jpeg', quality);
}

export function toBlob(canvas, type = 'image/jpeg', q = 0.85) {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, q));
}
