// Exportación: CSV de los datos filtrados, imagen PNG del panel y PDF (escrito a mano, con las
// páginas como imágenes JPEG; no necesita librerías).
//
// INTEGRACIÓN FUTURA (envío por correo): cuando exista un servicio de correo de la empresa, el blob
// que devuelven exportPNG()/exportPDF() se podría adjuntar con un POST a ese servicio
// (p. ej. /api/enviar-informe con destinatario, asunto y el archivo). Hoy solo se descarga.

import { getLang, fmtDate, t } from './i18n.js';
import { INK } from './charts.js';

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeName(s) {
  return (s || 'panel').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'panel';
}

// ---------- CSV ----------
export function filteredCSV(ds, idx) {
  const es = getLang() === 'es';
  const sep = es ? ';' : ',';
  const quote = (v) => (/["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v);
  const iso = (ms, time) => { const d = new Date(ms).toISOString(); return time ? d.slice(0, 16).replace('T', ' ') : d.slice(0, 10); };
  const lines = [ds.columns.map((c) => quote(c.name)).join(sep)];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const cells = ds.columns.map((c, j) => {
      const v = ds.data[j][i];
      if (c.type === 'number') {
        if (Number.isNaN(v)) return quote(String(c.raw[i] ?? '').trim());
        const s = String(Math.round(v * 1e10) / 1e10);
        return quote(es ? s.replace('.', ',') : s);
      }
      if (c.type === 'date') return Number.isNaN(v) ? quote(String(c.raw[i] ?? '').trim()) : iso(v, c.hasTime);
      return v == null ? '' : quote(String(v));
    });
    lines.push(cells.join(sep));
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

// ---------- composición del panel en lienzo ----------
const FONT = "'Epilogue Variable', system-ui, sans-serif";
let fontDataUrl = null;

async function fontCSS() {
  if (!fontDataUrl) {
    try {
      const res = await fetch('fonts/epilogue-latin-wght-normal.woff2');
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      fontDataUrl = `data:font/woff2;base64,${btoa(bin)}`;
    } catch { fontDataUrl = ''; }
  }
  return fontDataUrl ? `@font-face{font-family:'Epilogue Variable';font-weight:100 900;src:url(${fontDataUrl}) format('woff2');}` : '';
}

async function svgToImage(svg, defs, css) {
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('.hits, .brush').forEach((n) => n.remove());
  clone.classList.remove('print', 'reprint');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  if (defs) clone.insertBefore(defs.cloneNode(true), clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return { img, w: +svg.getAttribute('width'), h: +svg.getAttribute('height') };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function overprint(ctx, text, x, y, size, weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = INK.pink;
  ctx.fillText(text, x + size * 0.04, y + size * 0.03);
  ctx.fillStyle = INK.blue;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Bloques medidos a un ancho dado; luego se colocan en una sola imagen o en páginas.
async function buildBlocks(model, W, pad) {
  const css = await fontCSS();
  const defs = document.getElementById('riso-defs')?.querySelector('defs');
  const inner = W - pad * 2;
  const meas = document.createElement('canvas').getContext('2d');
  const blocks = [];

  // Cabecera
  meas.font = `800 44px ${FONT}`;
  const titleLines = wrap(meas, model.title, inner);
  meas.font = `500 17px ${FONT}`;
  const metaLines = model.meta.flatMap((m) => wrap(meas, m, inner));
  blocks.push({
    h: 34 + titleLines.length * 52 + metaLines.length * 26 + 22,
    draw(ctx, x, y) {
      ctx.fillStyle = INK.blue;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText('Tirada', x, y + 18);
      let yy = y + 34;
      for (const l of titleLines) { overprint(ctx, l, x, yy + 42, 44); yy += 52; }
      ctx.font = `500 17px ${FONT}`;
      ctx.fillStyle = INK.blue;
      for (const l of metaLines) { ctx.fillText(l, x, yy + 20); yy += 26; }
    },
  });

  // Cifras clave
  if (model.kpis.length) {
    const per = Math.min(4, model.kpis.length);
    const cw = inner / per;
    const rows = Math.ceil(model.kpis.length / per);
    blocks.push({
      h: rows * 118 + 10,
      draw(ctx, x, y) {
        model.kpis.forEach((k, i) => {
          const cx = x + (i % per) * cw, cy = y + Math.floor(i / per) * 118;
          ctx.strokeStyle = INK.blue; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + cw - 24, cy + 4); ctx.stroke();
          ctx.fillStyle = INK.blue; ctx.font = `600 15px ${FONT}`;
          ctx.fillText(k.label, cx, cy + 28, cw - 24);
          overprint(ctx, k.value, cx, cy + 78, 44);
          ctx.font = `500 13px ${FONT}`; ctx.fillStyle = INK.blue;
          ctx.fillText(k.sub || '', cx, cy + 102, cw - 24);
        });
      },
    });
  }

  // Gráficos: medio ancho en parejas, completo en su propia fila.
  const gap = 36;
  const half = (inner - gap) / 2;
  const imgs = await Promise.all(model.charts.map((c) => (c.svg ? svgToImage(c.svg, defs, css) : null)));
  const cards = model.charts.map((c, i) => {
    const w = c.size === 'wide' ? inner : half;
    meas.font = `700 20px ${FONT}`;
    const tl = wrap(meas, c.title, w);
    const im = imgs[i];
    const ih = im ? (im.h * w) / im.w : 60;
    const legendH = c.legend?.length ? 28 : 0;
    meas.font = `500 13px ${FONT}`;
    const notes = c.note ? wrap(meas, c.note, w) : [];
    const h = tl.length * 26 + 10 + ih + legendH + notes.length * 18 + 8;
    return {
      w, h, draw(ctx, x, y) {
        ctx.fillStyle = INK.blue; ctx.font = `700 20px ${FONT}`;
        let yy = y;
        for (const l of tl) { ctx.fillText(l, x, yy + 20); yy += 26; }
        yy += 10;
        if (im) ctx.drawImage(im.img, x, yy, w, ih);
        else { ctx.font = `500 15px ${FONT}`; wrap(ctx, c.message || '', w).forEach((l, k) => ctx.fillText(l, x, yy + 24 + k * 20)); }
        yy += ih;
        if (legendH) {
          let lx = x;
          ctx.font = `600 13px ${FONT}`;
          c.legend.forEach((it) => {
            ctx.strokeStyle = INK.blue; ctx.setLineDash(it.dash || []);
            if (it.line) {
              ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, yy + 14.5); ctx.lineTo(lx + 22, yy + 14.5); ctx.stroke();
            } else {
              ctx.save(); ctx.globalCompositeOperation = 'multiply';
              ctx.fillStyle = it.color; ctx.fillRect(lx, yy + 9, 22, 11);
              ctx.restore();
              ctx.lineWidth = 1; ctx.strokeRect(lx + 0.5, yy + 9.5, 21, 10);
            }
            ctx.setLineDash([]);
            ctx.fillStyle = INK.blue; ctx.fillText(it.label, lx + 30, yy + 19);
            lx += 44 + ctx.measureText(it.label).width;
          });
          yy += legendH;
        }
        ctx.font = `500 13px ${FONT}`; ctx.fillStyle = INK.blue;
        for (const l of notes) { ctx.fillText(l, x, yy + 14); yy += 18; }
      },
    };
  });
  for (let i = 0; i < cards.length;) {
    const a = cards[i];
    if (a.w === inner || !cards[i + 1] || cards[i + 1].w === inner) {
      blocks.push({ h: a.h + gap, draw: (ctx, x, y) => a.draw(ctx, x, y) });
      i++;
    } else {
      const b = cards[i + 1];
      blocks.push({ h: Math.max(a.h, b.h) + gap, draw: (ctx, x, y) => { a.draw(ctx, x, y); b.draw(ctx, x + half + gap, y); } });
      i += 2;
    }
  }
  return blocks;
}

function footer(ctx, W, H, pad, page) {
  ctx.fillStyle = INK.blue;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(`${fmtDate(Date.now())}. ${t('foot.privacy')}`, pad, H - pad / 2);
  if (page) { ctx.textAlign = 'center'; ctx.fillText(page, W / 2, H - pad / 2); }
  ctx.textAlign = 'right';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('by innovativecode', W - pad, H - pad / 2);
  ctx.textAlign = 'left';
}

function paper(ctx, W, H) {
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, W, H);
  const tile = window.__risoPaperTile;
  if (tile) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

export async function renderPNG(model) {
  await document.fonts.ready;
  const W = 1400, pad = 64, scale = 2;
  const blocks = await buildBlocks(model, W, pad);
  const H = pad + blocks.reduce((a, b) => a + b.h, 0) + pad;
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  paper(ctx, W, H);
  let y = pad;
  for (const b of blocks) { b.draw(ctx, pad, y); y += b.h; }
  footer(ctx, W, H, pad);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

export async function renderPDF(model) {
  await document.fonts.ready;
  // A4 vertical a 150 ppp aprox.
  const W = 1240, H = 1754, pad = 72, scale = 1.5;
  const blocks = await buildBlocks(model, W, pad);
  const pages = [];
  let cur = [], used = 0;
  const avail = H - pad * 2 - 30;
  for (const b of blocks) {
    if (used + b.h > avail && cur.length) { pages.push(cur); cur = []; used = 0; }
    cur.push(b); used += b.h;
  }
  if (cur.length) pages.push(cur);
  const jpgs = [];
  for (let p = 0; p < pages.length; p++) {
    const cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    paper(ctx, W, H);
    let y = pad;
    for (const b of pages[p]) {
      // un bloque más alto que la página se reduce para que quepa
      if (b.h > avail) { const f = avail / b.h; ctx.save(); ctx.translate(pad, y); ctx.scale(f, f); b.draw(ctx, 0, 0); ctx.restore(); y += avail; }
      else { b.draw(ctx, pad, y); y += b.h; }
    }
    footer(ctx, W, H, pad, `${p + 1}/${pages.length}`);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
    jpgs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
  }
  return new Blob([pdfFromJpegs(jpgs, model.title)], { type: 'application/pdf' });
}

// PDF mínimo: una página A4 por imagen JPEG (DCTDecode).
function pdfFromJpegs(pages, title) {
  const enc = new TextEncoder();
  const chunks = [];
  let len = 0;
  const offsets = [];
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (num, body) => { offsets[num] = len; push(`${num} 0 obj\n`); body(); push('\nendobj\n'); };
  const pdfStr = (s) => `(${String(s).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')})`;

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // 1 catálogo, 2 páginas, 3 info; luego por página: página, contenido, imagen
  const pageNum = (i) => 4 + i * 3;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ')}] >>`));
  obj(3, () => push(`<< /Title ${pdfStr(title)} /Producer (Tirada by innovativecode) >>`));
  const PW = 595.28, PH = 841.89;
  pages.forEach((p, i) => {
    const pn = pageNum(i);
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>`));
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(pn + 1, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); });
    obj(pn + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes);
      push('\nendstream');
    });
  });
  const total = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) x += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`;
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
