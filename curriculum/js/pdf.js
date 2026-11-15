// Exportación a PDF en el propio dispositivo, con pdf-lib + fontkit (vendor/).
// Técnica: se monta la hoja fuera de pantalla a tamaño real, se pagina igual que la vista previa y se
// recorre el DOM midiendo cada caja y cada tramo de texto. Cada tramo se escribe en el PDF como TEXTO
// (seleccionable, con la fuente incrustada) en la misma posición que ocupa en pantalla. No hay imágenes
// de la hoja: solo la foto, si la hay.

import { renderCV, paginate, ensureFont, PAGES } from './render.js';
import { FONTS, fontById, tplById } from './templates.js';

const PX2PT = 0.75;
// Mismo reparto que en css/fonts.css (unicode-range): qué caracteres salen del archivo "latin".
const LATIN = [[0x0, 0xFF], [0x131, 0x131], [0x152, 0x153], [0x2BB, 0x2BC], [0x2C6, 0x2C6], [0x2DA, 0x2DA], [0x2DC, 0x2DC], [0x304, 0x304],
  [0x308, 0x308], [0x329, 0x329], [0x2000, 0x206F], [0x20AC, 0x20AC], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xFEFF, 0xFEFF], [0xFFFD, 0xFFFD]];
const inLatin = (cp) => LATIN.some(([a, b]) => cp >= a && cp <= b);

let libs = null;
function loadScript(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
async function loadLibs() {
  if (!libs) {
    libs = (async () => {
      if (!window.PDFLib) await loadScript('vendor/pdf-lib.min.js');
      if (!window.fontkit) await loadScript('vendor/fontkit.umd.min.js');
      return { PDFLib: window.PDFLib, fontkit: window.fontkit };
    })();
    libs.catch(() => { libs = null; });
  }
  return libs;
}

const fontBytes = new Map();
async function fetchFont(file) {
  if (!fontBytes.has(file)) {
    const p = fetch('fonts/pdf/' + file + '.ttf').then((r) => { if (!r.ok) throw new Error('Falta la fuente ' + file); return r.arrayBuffer(); });
    fontBytes.set(file, p);
    p.catch(() => fontBytes.delete(file));
  }
  return fontBytes.get(file);
}

function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return { r: 0, g: 0, b: 0, a: 0 };
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
  return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p.length > 3 ? p[3] : 1 };
}

// Distancia entre el borde superior de la caja de texto y la línea base, como fracción del cuerpo.
const ascentCache = new Map();
function ascentRatio(host, family, weight, style) {
  const key = family + weight + style;
  if (!ascentCache.has(key)) {
    const span = document.createElement('span');
    span.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font:${style} ${weight} 200px/1 ${family};font-kerning:none`;
    const txt = document.createTextNode('Hx');
    const mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0';
    span.append(txt, mark);
    host.appendChild(span);
    const r = document.createRange(); r.selectNodeContents(txt);
    const tr = r.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    const scale = (span.getBoundingClientRect().height || 200) / (span.offsetHeight || 200);
    ascentCache.set(key, (mr.top - tr.top) / (200 * scale));
    span.remove();
  }
  return ascentCache.get(key);
}

function faceOf(cs) {
  const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const f = FONTS.find((x) => x.css.toLowerCase() === fam.toLowerCase()) || FONTS[0];
  const italic = cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique');
  const bold = parseInt(cs.fontWeight, 10) >= 600;
  // Solo hay tres caras por familia: la cursiva gana a la negrita, igual que hace el navegador.
  return { id: f.id, css: f.css, face: italic ? '400-italic' : bold ? '700-normal' : '400-normal', weight: italic ? 400 : bold ? 700 : 400, style: italic ? 'italic' : 'normal' };
}

function collectPage(pageEl, host) {
  const pr = pageEl.getBoundingClientRect();
  const scale = pr.width / pageEl.offsetWidth || 1;
  const k = PX2PT / scale;
  const X = (v) => (v - pr.left) * k, Y = (v) => (v - pr.top) * k;
  const ops = [];
  const range = document.createRange();

  const textNode = (node, cs) => {
    const data = node.data;
    if (!/\S/.test(data)) return;
    const face = faceOf(cs);
    const sizePx = parseFloat(cs.fontSize);
    const asc = ascentRatio(host, `"${face.css}"`, face.weight, face.style) * sizePx * scale;
    const color = parseColor(cs.color);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
    const up = cs.textTransform === 'uppercase';
    const mk = (r, text) => ({ t: 'text', text, x: X(r.left), y: Y(r.top + asc), top: r.top, size: sizePx * PX2PT, face, color, ls: ls * PX2PT });
    let run = null;
    const flush = () => { if (run) { if (up) run.text = run.text.toLocaleUpperCase(document.documentElement.lang || 'es'); ops.push(run); run = null; } };
    const re = /\S+/g; let m;
    while ((m = re.exec(data))) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      const split = rects.some((r) => Math.abs(r.top - rects[0].top) > 1);
      if (!split) {
        if (run && Math.abs(run.top - rects[0].top) < 1) run.text += ' ' + m[0];
        else { flush(); run = mk(rects[0], m[0]); }
        continue;
      }
      // Palabra partida entre líneas (direcciones web largas): letra a letra.
      let first = true;
      for (let i = 0; i < m[0].length; i++) {
        range.setStart(node, m.index + i); range.setEnd(node, m.index + i + 1);
        const r = range.getClientRects()[0];
        if (!r) continue;
        if (run && Math.abs(run.top - r.top) < 1) run.text += (first ? ' ' : '') + m[0][i];
        else { flush(); run = mk(r, m[0][i]); }
        first = false;
      }
    }
    flush();
  };

  const walk = (el) => {
    if (el.classList.contains('ghost')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el !== pageEl) {
      const box = { x: X(r.left), y: Y(r.top), w: r.width * k, h: r.height * k };
      let rad = cs.borderTopLeftRadius || '0';
      rad = rad.includes('%') ? (parseFloat(rad) / 100) * box.w : parseFloat(rad) * PX2PT;
      rad = Math.max(0, Math.min(rad || 0, box.w / 2, box.h / 2));
      const bg = parseColor(cs.backgroundColor);
      if (bg.a > 0 && el.tagName !== 'IMG') ops.push({ t: 'fill', ...box, rad, color: bg });
      if (el.tagName === 'IMG' && el.naturalWidth) ops.push({ t: 'img', ...box, rad, src: el.currentSrc || el.src, nw: el.naturalWidth, nh: el.naturalHeight });
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({
        w: cs['border' + s + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + s + 'Width']) * PX2PT, c: parseColor(cs['border' + s + 'Color']),
      }));
      const same = sides.every((s) => s.w > 0 && s.w === sides[0].w && s.c.r === sides[0].c.r && s.c.g === sides[0].c.g && s.c.b === sides[0].c.b);
      if (same && sides[0].c.a > 0) ops.push({ t: 'stroke', ...box, rad, lw: sides[0].w, color: sides[0].c });
      else {
        const [T, R, B, L] = sides;
        if (T.w && T.c.a) ops.push({ t: 'fill', x: box.x, y: box.y, w: box.w, h: T.w, rad: 0, color: T.c });
        if (B.w && B.c.a) ops.push({ t: 'fill', x: box.x, y: box.y + box.h - B.w, w: box.w, h: B.w, rad: 0, color: B.c });
        if (L.w && L.c.a) ops.push({ t: 'fill', x: box.x, y: box.y, w: L.w, h: box.h, rad: 0, color: L.c });
        if (R.w && R.c.a) ops.push({ t: 'fill', x: box.x + box.w - R.w, y: box.y, w: R.w, h: box.h, rad: 0, color: R.c });
      }
    }
    for (const ch of el.childNodes) {
      if (ch.nodeType === 3) textNode(ch, cs);
      else if (ch.nodeType === 1) walk(ch);
    }
  };
  walk(pageEl);
  return ops;
}

const KAPPA = 0.5523;
function roundPathSvg(w, h, r) {
  const c = r * KAPPA;
  return `M ${r} 0 L ${w - r} 0 C ${w - r + c} 0 ${w} ${r - c} ${w} ${r} L ${w} ${h - r} C ${w} ${h - r + c} ${w - r + c} ${h} ${w - r} ${h} ` +
    `L ${r} ${h} C ${r - c} ${h} 0 ${h - r + c} 0 ${h - r} L 0 ${r} C 0 ${r - c} ${r - c} 0 ${r} 0 Z`;
}

function dataUrlBytes(url) {
  const i = url.indexOf(',');
  const bin = atob(url.slice(i + 1));
  const out = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
  return out;
}

export async function buildPdf(cv, meta = {}) {
  const { PDFLib, fontkit } = await loadLibs();
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath, setCharacterSpacing } = PDFLib;
  const t = tplById(cv.template);
  await ensureFont(cv.design.font || t.font);

  // 1) Montar y paginar fuera de pantalla, a tamaño real.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-30000px;top:0;width:900px;pointer-events:none;contain:layout style';
  const docEl = renderCV(cv, {});
  host.appendChild(docEl);
  document.body.appendChild(host);
  let pagesOps;
  try {
    await Promise.all([...docEl.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    paginate(docEl);
    pagesOps = [...docEl.querySelectorAll('.page')].map((p) => collectPage(p, host));
  } finally { host.remove(); }

  // 2) Fuentes necesarias: el archivo "latin" de cada cara usada y el "latin-ext" solo si hace falta.
  const need = new Set();
  for (const ops of pagesOps) for (const o of ops) if (o.t === 'text') {
    need.add(`${o.face.id}-latin-${o.face.face}`);
    for (const ch of o.text) if (!inLatin(ch.codePointAt(0))) { need.add(`${o.face.id}-latin-ext-${o.face.face}`); break; }
  }

  const make = async (subset) => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const fonts = new Map();
    for (const file of need) {
      const font = await pdf.embedFont(await fetchFont(file), { subset, features: { kern: false, liga: false, clig: false, calt: false } });
      fonts.set(file, { font, set: new Set(font.getCharacterSet()) });
    }
    const images = new Map();
    let missing = 0;
    const pg = PAGES[cv.design.page] || PAGES.a4;
    const [W, H] = pg.pt;
    for (const ops of pagesOps) {
      const page = pdf.addPage([W, H]);
      for (const o of ops) {
        if (o.t === 'fill') {
          const color = rgb(o.color.r, o.color.g, o.color.b);
          if (o.rad > 0.2) page.drawSvgPath(roundPathSvg(o.w, o.h, o.rad), { x: o.x, y: H - o.y, color, opacity: o.color.a });
          else page.drawRectangle({ x: o.x, y: H - o.y - o.h, width: o.w, height: o.h, color, opacity: o.color.a });
        } else if (o.t === 'stroke') {
          const c = rgb(o.color.r, o.color.g, o.color.b), i = o.lw / 2;
          const w = o.w - o.lw, h = o.h - o.lw, r = Math.max(0, o.rad - i);
          if (r > 0.2) page.drawSvgPath(roundPathSvg(w, h, r), { x: o.x + i, y: H - o.y - i, borderColor: c, borderWidth: o.lw, borderOpacity: o.color.a });
          else page.drawRectangle({ x: o.x + i, y: H - o.y - o.h + i, width: w, height: h, borderColor: c, borderWidth: o.lw, borderOpacity: o.color.a });
        } else if (o.t === 'img') {
          if (!o.src.startsWith('data:image/jpeg') && !o.src.startsWith('data:image/png')) continue;
          if (!images.has(o.src)) images.set(o.src, o.src.startsWith('data:image/png') ? await pdf.embedPng(dataUrlBytes(o.src)) : await pdf.embedJpg(dataUrlBytes(o.src)));
          // object-fit: cover, recortado a la caja (con sus esquinas).
          const s = Math.max(o.w / o.nw, o.h / o.nh), iw = o.nw * s, ih = o.nh * s;
          const x0 = o.x, y0 = H - o.y - o.h, r = o.rad, c = r * KAPPA, w = o.w, h = o.h;
          page.pushOperators(pushGraphicsState(), moveTo(x0 + r, y0), lineTo(x0 + w - r, y0), appendBezierCurve(x0 + w - r + c, y0, x0 + w, y0 + r - c, x0 + w, y0 + r),
            lineTo(x0 + w, y0 + h - r), appendBezierCurve(x0 + w, y0 + h - r + c, x0 + w - r + c, y0 + h, x0 + w - r, y0 + h),
            lineTo(x0 + r, y0 + h), appendBezierCurve(x0 + r - c, y0 + h, x0, y0 + h - r + c, x0, y0 + h - r),
            lineTo(x0, y0 + r), appendBezierCurve(x0, y0 + r - c, x0 + r - c, y0, x0 + r, y0), closePath(), clip(), endPath());
          page.drawImage(images.get(o.src), { x: x0 - (iw - w) / 2, y: y0 - (ih - h) / 2, width: iw, height: ih });
          page.pushOperators(popGraphicsState());
        } else if (o.t === 'text') {
          const lat = fonts.get(`${o.face.id}-latin-${o.face.face}`), ext = fonts.get(`${o.face.id}-latin-ext-${o.face.face}`);
          // Trocea el tramo según qué archivo de fuente tiene cada carácter.
          const segs = [];
          for (const ch of o.text) {
            const cp = ch.codePointAt(0);
            let f = inLatin(cp) ? lat : ext;
            if (!f || !f.set.has(cp)) f = lat && lat.set.has(cp) ? lat : ext && ext.set.has(cp) ? ext : null;
            if (!f) { missing++; continue; }
            const last = segs[segs.length - 1];
            if (last && last.f === f) last.s += ch; else segs.push({ f, s: ch });
          }
          let x = o.x;
          const color = rgb(o.color.r, o.color.g, o.color.b);
          if (o.ls) page.pushOperators(setCharacterSpacing(o.ls));
          for (const sg of segs) {
            page.drawText(sg.s, { x, y: H - o.y, size: o.size, font: sg.f.font, color, opacity: o.color.a < 1 ? o.color.a : undefined });
            x += sg.f.font.widthOfTextAtSize(sg.s, o.size) + o.ls * [...sg.s].length;
          }
          if (o.ls) page.pushOperators(setCharacterSpacing(0));
        }
      }
    }
    pdf.setTitle(meta.title || 'Currículum');
    if (meta.author) pdf.setAuthor(meta.author);
    pdf.setLanguage(cv.docLang || 'es');
    pdf.setCreator('Currículum · by innovativecode');
    pdf.setProducer('pdf-lib');
    const bytes = await pdf.save();
    return { bytes, pages: pagesOps.length, missing };
  };

  let out;
  try { out = await make(true); }
  catch (e) { console.warn('Subconjunto de fuente no disponible; se incrusta la fuente completa.', e); out = await make(false); }
  return { blob: new Blob([out.bytes], { type: 'application/pdf' }), pages: out.pages, missing: out.missing };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const fontList = () => FONTS.map((f) => fontById(f.id));
