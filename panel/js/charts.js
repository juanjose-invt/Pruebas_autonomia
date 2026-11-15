// Gráficos en SVG con tintas de risografía.
// Cada gráfico se dibuja en capas: amarillo y rosa (con grano y un leve desregistro) y la plancha azul,
// que lleva ejes, texto y líneas en su posición exacta para que la lectura de los datos no dependa del efecto.
import { t, fmtNum, fmtAxis, fmtBucket } from './i18n.js';
import { niceStep, OTHERS_KEY, EMPTY_KEY } from './data.js';

export const INK = { blue: '#3D5588', pink: '#FF48B0', yellow: '#FFE800', paper: '#F2F1EC' };
const FONT = "'Epilogue Variable', 'Epilogue', system-ui, sans-serif";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (x) => Math.round(x * 10) / 10;

let measureCtx = null;
export function textWidth(s, size = 12, weight = 500) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weight} ${size}px ${FONT}`;
  return measureCtx.measureText(s).width;
}
function clip(s, maxW, size = 12, weight = 500) {
  s = String(s);
  if (textWidth(s, size, weight) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(s.slice(0, mid) + '…', size, weight) <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? s.slice(0, lo) + '…' : '…';
}

export function keyLabel(k, kind, bucket, short = false) {
  if (k === EMPTY_KEY || k == null) return t('chart.emptyValue');
  if (k === OTHERS_KEY) return t('chart.others');
  if (kind === 'time') return fmtBucket(k, bucket, short);
  return String(k);
}

// Escala "bonita" para un eje numérico.
function niceScale(lo, hi, count = 5, zero = true) {
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) { const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1; lo -= zero && lo >= 0 ? 0 : pad; hi += pad; }
  const step = niceStep(hi - lo, count);
  const a = Math.floor(lo / step + 1e-9) * step;
  const b = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = a; v <= b + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { lo: a, hi: b, step, ticks };
}

// Desregistro determinista por gráfico: nunca más de 1,5 px.
function misreg(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const f = (k) => (((h >>> k) & 255) / 255 - 0.5) * 2.4;
  return { pink: [r1(f(0)), r1(f(8))], yellow: [r1(f(16)), r1(f(24))] };
}

function layer(ink, body, off, grain = true) {
  if (!body) return '';
  const tr = off ? ` transform="translate(${off[0]} ${off[1]})"` : '';
  const mask = grain ? ' mask="url(#riso-speckle)"' : '';
  return `<g class="ink ink-${ink}" style="mix-blend-mode:multiply"${tr}><g${mask}>${body}</g></g>`;
}

// Estilo de cada serie: color de tinta + trama + trazo, para no depender solo del color.
export const SERIES = [
  { fill: INK.pink, ink: 'pink', pattern: null, dash: '', marker: 'circle' },
  { fill: 'url(#riso-hatch-blue)', ink: 'blue', pattern: 'hatch', dash: '7 4', marker: 'square' },
  { fill: INK.yellow, ink: 'yellow', pattern: null, dash: '2 4', marker: 'triangle' },
];

function marker(kind, x, y, r = 4) {
  if (kind === 'square') return `<rect x="${r1(x - r)}" y="${r1(y - r)}" width="${r * 2}" height="${r * 2}"/>`;
  if (kind === 'triangle') return `<path d="M${r1(x)} ${r1(y - r - 1)}L${r1(x + r + 1)} ${r1(y + r)}L${r1(x - r - 1)} ${r1(y + r)}Z"/>`;
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}"/>`;
}

function svgWrap(W, H, label, body, cls = '') {
  return `<svg class="riso ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" style="font-family:${esc(FONT)}">${body}</svg>`;
}

function yAxis(sc, x0, x1, y, unit, title) {
  let g = '';
  for (const v of sc.ticks) {
    const yy = r1(y(v));
    g += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="${INK.blue}" stroke-opacity="${v === 0 ? 0.9 : 0.16}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    g += `<text x="${x0 - 8}" y="${yy}" dy="0.35em" text-anchor="end" font-size="12" fill="${INK.blue}" font-weight="500" style="font-variant-numeric:tabular-nums">${esc(fmtAxis(v, unit, sc.step))}</text>`;
  }
  if (title) g += `<text x="${x0 - 8 >= 0 ? 0 : 0}" y="14" font-size="12" font-weight="650" fill="${INK.blue}">${esc(title)}</text>`;
  return g;
}

function xTitle(W, H, title) {
  return title ? `<text x="${W - 4}" y="${H - 6}" text-anchor="end" font-size="12" font-weight="650" fill="${INK.blue}">${esc(title)}</text>` : '';
}

function yTickWidth(sc, unit) {
  return Math.max(...sc.ticks.map((v) => textWidth(fmtAxis(v, unit, sc.step), 12)));
}

// ---------- barras horizontales (ranking) ----------
function barChart(W, spec, res, ctx) {
  const s0 = res.series[0];
  const n = res.keys.length;
  const labels = res.keys.map((k) => keyLabel(k, res.kind, res.bucket));
  const rowH = n > 14 ? 24 : 30;
  const top = 26, bottom = 42;
  const H = top + bottom + n * rowH;
  const vals = s0.values.map((v) => (Number.isNaN(v) ? 0 : v));
  const sc = niceScale(Math.min(...vals, 0), Math.max(...vals, 0), Math.max(2, Math.floor(W / 120)));
  const labW = Math.min(W * 0.36, Math.max(...labels.map((l) => textWidth(l, 13))) + 6);
  const x0 = Math.round(labW + 12), x1 = W - 12;
  const x = (v) => x0 + ((v - sc.lo) / (sc.hi - sc.lo)) * (x1 - x0);
  let pink = '', blue = '', hits = '';
  // rejilla vertical y eje
  for (const v of sc.ticks) {
    const xx = r1(x(v));
    blue += `<line x1="${xx}" x2="${xx}" y1="${top - 4}" y2="${H - bottom}" stroke="${INK.blue}" stroke-opacity="${v === 0 ? 0.9 : 0.16}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    blue += `<text x="${xx}" y="${H - bottom + 16}" text-anchor="middle" font-size="12" font-weight="500" fill="${INK.blue}" style="font-variant-numeric:tabular-nums">${esc(fmtAxis(v, ctx.unit, sc.step))}</text>`;
  }
  const items = [];
  for (let i = 0; i < n; i++) {
    const yy = top + i * rowH;
    const v = s0.values[i];
    const bh = rowH - (rowH > 26 ? 10 : 7);
    const by = yy + (rowH - bh) / 2;
    const xa = x(Math.min(0, Number.isNaN(v) ? 0 : v)), xb = x(Math.max(0, Number.isNaN(v) ? 0 : v));
    const sel = ctx.selected;
    const isSel = (!sel || sel.has(res.keys[i])) && res.keys[i] !== OTHERS_KEY;
    const w = Math.max(Number.isNaN(v) ? 0 : 1, xb - xa);
    if (isSel) {
      pink += `<rect x="${r1(xa)}" y="${r1(by)}" width="${r1(w)}" height="${r1(bh)}" fill="${INK.pink}"/>`;
      // remate azul en el extremo del valor: marca exacta y contraste suficiente
      const xe = r1(v < 0 ? xa : xb);
      if (!Number.isNaN(v)) blue += `<line x1="${xe}" x2="${xe}" y1="${r1(by)}" y2="${r1(by + bh)}" stroke="${INK.blue}" stroke-width="2"/>`;
    }
    else blue += `<rect x="${r1(xa) + 0.5}" y="${r1(by) + 0.5}" width="${r1(Math.max(0, w - 1))}" height="${r1(bh - 1)}" fill="url(#riso-dots-blue)" stroke="${INK.blue}" stroke-width="1"/>`;
    const lab = clip(labels[i], labW, 13);
    blue += `<text x="${x0 - 10}" y="${r1(yy + rowH / 2)}" dy="0.35em" text-anchor="end" font-size="13" font-weight="${isSel && sel ? 700 : 500}" fill="${INK.blue}">${esc(lab)}${lab !== labels[i] ? `<title>${esc(labels[i])}</title>` : ''}</text>`;
    const vt = fmtNum(v, ctx.unit);
    const tw = textWidth(vt, 12, 650);
    const inside = xb + tw + 8 > x1;
    blue += `<text x="${r1(inside ? xb - 6 : xb + 6)}" y="${r1(yy + rowH / 2)}" dy="0.35em" text-anchor="${inside ? 'end' : 'start'}" font-size="12" font-weight="650" fill="${INK.blue}"${inside ? ` paint-order="stroke" stroke="${INK.paper}" stroke-width="3.5" stroke-linejoin="round"` : ''} style="font-variant-numeric:tabular-nums">${esc(vt)}</text>`;
    hits += `<rect class="hit" data-i="${i}" x="0" y="${yy}" width="${W}" height="${rowH}" fill="transparent"/>`;
    items.push({ title: labels[i], lines: [[ctx.measureLabel, vt], [t('axis.count'), fmtNum(s0.counts[i])]], key: res.keys[i] });
  }
  blue += xTitle(W, H, ctx.valueTitle);
  const mi = vals.indexOf(Math.max(...vals));
  const aria = t('chart.ariaBar', { title: ctx.title, n, maxLabel: labels[mi] ?? '', maxValue: fmtNum(vals[mi], ctx.unit) });
  const body = layer('pink', pink, ctx.reg.pink) + `<g class="ink ink-blue">${blue}</g><g class="hits">${hits}</g>`;
  return { svg: svgWrap(W, H, aria, body), H, items, selectable: res.kind === 'category' };
}

// ---------- bandas (columnas, línea, área) ----------
function bandChart(W, H, spec, res, ctx) {
  const n = res.keys.length;
  const type = spec.type;
  const nS = res.series.length;
  const all = res.series.flatMap((s) => s.values.filter((v) => !Number.isNaN(v)));
  const zero = type !== 'line' || ['sum', 'count'].includes(spec.agg);
  const sc = niceScale(all.length ? Math.min(...all) : 0, all.length ? Math.max(...all) : 1, H < 250 ? 4 : 5, zero);
  const top = 28, bottom = res.kind === 'category' ? 56 : 44;
  const x0 = Math.ceil(yTickWidth(sc, ctx.unit) + 14), x1 = W - 14;
  const step = (x1 - x0) / Math.max(1, n);
  const y = (v) => H - bottom - ((v - sc.lo) / (sc.hi - sc.lo)) * (H - bottom - top);
  const cx = (i) => x0 + step * (i + 0.5);
  const labels = res.keys.map((k) => keyLabel(k, res.kind, res.bucket));
  const short = res.keys.map((k) => keyLabel(k, res.kind, res.bucket, true));

  let yellow = '', pink = '', blue = yAxis(sc, x0, x1, y, ctx.unit, ctx.valueTitle), blueFill = '', hits = '';
  // rótulos del eje X sin solaparse
  const maxLab = Math.max(...short.map((s) => textWidth(s, 12)), 10);
  // categorías: todas rotuladas (en dos líneas si hace falta); periodos: se salta rótulos para no solapar
  const wrapCat = res.kind === 'category' && step >= 44;
  const every = wrapCat ? 1 : Math.max(1, Math.ceil((Math.min(maxLab, 110) + 14) / step));
  for (let i = 0; i < n; i += every) {
    let lines;
    if (wrapCat) {
      const maxW = step - 6;
      const words = String(short[i]).split(/\s+/);
      let a = '', k = 0;
      while (k < words.length && textWidth((a ? a + ' ' : '') + words[k], 11.5) <= maxW) { a = (a ? a + ' ' : '') + words[k]; k++; }
      if (!a) { a = clip(words[0], maxW, 11.5); k = 1; }
      const rest = words.slice(k).join(' ');
      lines = rest ? [a, clip(rest, maxW, 11.5)] : [a];
    } else lines = [clip(short[i], Math.max(step * every - 8, 30), 12)];
    const full = labels[i];
    blue += `<text x="${r1(cx(i))}" y="${H - bottom + 17}" text-anchor="middle" font-size="${wrapCat ? 11.5 : 12}" font-weight="500" fill="${INK.blue}">${lines.map((l, li) => `<tspan x="${r1(cx(i))}" dy="${li ? '1.15em' : 0}">${esc(l)}</tspan>`).join('')}${lines.join(' ') !== full ? `<title>${esc(full)}</title>` : ''}</text>`;
    blue += `<line x1="${r1(cx(i))}" x2="${r1(cx(i))}" y1="${H - bottom}" y2="${H - bottom + 4}" stroke="${INK.blue}"/>`;
  }
  blue += xTitle(W, H, ctx.dimTitle);
  const base = y(Math.max(sc.lo, Math.min(0, sc.hi)));

  if (type === 'column') {
    const groupW = step * (n > 40 ? 0.9 : 0.72);
    const bw = groupW / nS;
    res.series.forEach((s, si) => {
      const st = SERIES[si];
      s.values.forEach((v, i) => {
        if (Number.isNaN(v)) return;
        const xx = cx(i) - groupW / 2 + si * bw;
        const ya = y(Math.max(0, v)), yb = y(Math.min(0, v));
        const h = Math.max(v === 0 ? 0 : 1, yb - ya);
        const sel = ctx.selected;
        const isSel = (!sel || sel.has(res.keys[i])) && res.keys[i] !== OTHERS_KEY;
        const rect = `x="${r1(xx)}" y="${r1(ya)}" width="${r1(Math.max(1, bw - (nS > 1 ? 1.5 : 0)))}" height="${r1(h)}"`;
        if (!isSel) { blue += `<rect ${rect} fill="url(#riso-dots-blue)" stroke="${INK.blue}" stroke-width="1"/>`; return; }
        if (st.ink === 'pink') {
          pink += `<rect ${rect} fill="${INK.pink}"/>`;
          const ye = r1(v < 0 ? yb : ya);
          blue += `<line x1="${r1(xx)}" x2="${r1(xx + Math.max(1, bw - (nS > 1 ? 1.5 : 0)))}" y1="${ye}" y2="${ye}" stroke="${INK.blue}" stroke-width="2"/>`;
        }
        else if (st.ink === 'yellow') { yellow += `<rect ${rect} fill="${INK.yellow}"/>`; blue += `<rect ${rect} fill="none" stroke="${INK.blue}" stroke-width="1"/>`; }
        else { blueFill += `<rect ${rect} fill="url(#riso-hatch-blue)"/>`; blue += `<rect ${rect} fill="none" stroke="${INK.blue}" stroke-width="1"/>`; }
      });
    });
    // valor encima si caben
    if (nS === 1 && n <= 16) {
      res.series[0].values.forEach((v, i) => {
        if (Number.isNaN(v)) return;
        const vt = Math.abs(v) >= 10000 ? fmtAxis(v, ctx.unit, 1) : fmtNum(v, ctx.unit);
        if (textWidth(vt, 11, 650) > step - 2) return;
        blue += `<text x="${r1(cx(i))}" y="${r1(y(Math.max(0, v)) - 5)}" text-anchor="middle" font-size="11" font-weight="650" fill="${INK.blue}" style="font-variant-numeric:tabular-nums">${esc(vt)}</text>`;
      });
    }
  } else {
    // línea / área
    res.series.forEach((s, si) => {
      const st = SERIES[si];
      const segs = [];
      let cur = [];
      s.values.forEach((v, i) => { if (Number.isNaN(v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push([cx(i), y(v)]); });
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        const d = seg.map((p, k) => `${k ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join('');
        if (type === 'area') {
          const area = `${d}L${r1(seg[seg.length - 1][0])} ${r1(base)}L${r1(seg[0][0])} ${r1(base)}Z`;
          if (nS === 1) yellow += `<path d="${area}" fill="${INK.yellow}"/>`;
          else if (st.ink === 'pink') pink += `<path d="${area}" fill="${INK.pink}" fill-opacity="0.62"/>`;
          else if (st.ink === 'yellow') yellow += `<path d="${area}" fill="${INK.yellow}" fill-opacity="0.95"/>`;
          else blueFill += `<path d="${area}" fill="url(#riso-hatch-blue)"/>`;
        }
        blue += `<path d="${d}" fill="none" stroke="${INK.blue}" stroke-width="${nS === 1 ? 2.5 : 2.2}" stroke-linejoin="round" stroke-linecap="round"${st.dash && nS > 1 ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
        if (seg.length === 1) blue += `<circle cx="${r1(seg[0][0])}" cy="${r1(seg[0][1])}" r="3" fill="${INK.blue}"/>`;
      }
      // marcadores (si no hay demasiados puntos) y rótulo directo al final
      const showMarks = n <= 40 && step >= 9;
      if (showMarks) {
        let m = '';
        s.values.forEach((v, i) => { if (!Number.isNaN(v)) m += marker(nS > 1 ? st.marker : 'circle', cx(i), y(v), nS > 1 ? 3.5 : 3); });
        if (nS === 1) pink += `<g fill="${INK.pink}">${m}</g>`;
        else blue += `<g fill="${INK.paper}" stroke="${INK.blue}" stroke-width="1.5">${m}</g>`;
      }
    });
    // valor del último punto en serie única
    if (nS === 1) {
      const vals = res.series[0].values;
      let li = vals.length - 1; while (li >= 0 && Number.isNaN(vals[li])) li--;
      if (li >= 0) {
        const vt = fmtNum(vals[li], ctx.unit);
        const tx = cx(li), ty = y(vals[li]) - 10;
        const anchor = tx + textWidth(vt, 12, 700) / 2 > W - 2 ? 'end' : 'middle';
        blue += `<text x="${r1(anchor === 'end' ? W - 2 : tx)}" y="${r1(Math.max(top + 2, ty))}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${INK.blue}" paint-order="stroke" stroke="${INK.paper}" stroke-width="3" style="font-variant-numeric:tabular-nums">${esc(vt)}</text>`;
      }
    }
  }

  const items = res.keys.map((k, i) => ({
    title: labels[i],
    lines: res.series.map((s, si) => [nS > 1 ? keyLabel(s.key, 'category') : ctx.measureLabel, fmtNum(s.values[i], ctx.unit), si]),
    key: k,
  }));
  for (let i = 0; i < n; i++) hits += `<rect class="hit" data-i="${i}" x="${r1(x0 + step * i)}" y="${top}" width="${r1(step + 0.5)}" height="${H - bottom - top}" fill="transparent"/>`;

  const s0 = res.series[0]?.values || [];
  let mi = 0; s0.forEach((v, i) => { if (!(s0[mi] >= v)) mi = i; });
  const aria = res.kind === 'time'
    ? t('chart.ariaTime', { title: ctx.title, n, first: labels[0] ?? '', last: labels[n - 1] ?? '', maxLabel: labels[mi] ?? '', maxValue: fmtNum(s0[mi], ctx.unit) })
    : t('chart.ariaBar', { title: ctx.title, n, maxLabel: labels[mi] ?? '', maxValue: fmtNum(s0[mi], ctx.unit) });

  const body = layer('yellow', yellow, ctx.reg.yellow) + layer('pink', pink, ctx.reg.pink)
    + (blueFill ? layer('blue', blueFill, null) : '')
    + `<g class="ink ink-blue">${blue}</g><g class="brush"></g><g class="hits">${hits}</g>`;
  return {
    svg: svgWrap(W, H, aria, body), H, items,
    band: { x0, step, n, top, bottom: H - bottom },
    selectable: res.kind === 'category',
    brushable: res.kind === 'time',
  };
}

// ---------- histograma ----------
function histChart(W, H, spec, res, ctx) {
  const bins = res.bins;
  const top = 28, bottom = 44;
  const maxC = Math.max(...bins.map((b) => b.count), 1);
  const sc = niceScale(0, maxC, H < 250 ? 4 : 5, true);
  const x0 = Math.ceil(yTickWidth(sc, '') + 14), x1 = W - 14;
  const lo = bins[0].x0, hi = bins[bins.length - 1].x1;
  const x = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const y = (v) => H - bottom - (v / sc.hi) * (H - bottom - top);
  let yellow = '', blue = yAxis(sc, x0, x1, y, '', t('axis.freq')), dots = '', pink = '', hits = '';
  const items = [];
  bins.forEach((b, i) => {
    const xa = x(b.x0) + 0.75, xb = x(b.x1) - 0.75;
    const ya = y(b.count);
    const rect = `x="${r1(xa)}" y="${r1(ya)}" width="${r1(Math.max(0.5, xb - xa))}" height="${r1(H - bottom - ya)}"`;
    if (b.count) { yellow += `<rect ${rect} fill="${INK.yellow}"/>`; dots += `<rect ${rect} fill="url(#riso-dots-blue)"/>`; blue += `<rect ${rect} fill="none" stroke="${INK.blue}" stroke-width="1"/>`; }
    const range = res.integer ? fmtNum(b.x0 + 0.5, ctx.unit) : `${fmtNum(b.x0, ctx.unit)} – ${fmtNum(b.x1, ctx.unit)}`;
    items.push({ title: range, lines: [[t('axis.freq'), fmtNum(b.count)]] });
    hits += `<rect class="hit" data-i="${i}" x="${r1(x(b.x0))}" y="${top}" width="${r1(x(b.x1) - x(b.x0))}" height="${H - bottom - top}" fill="transparent"/>`;
  });
  // eje X numérico
  const xs = niceScale(lo, hi, Math.max(2, Math.floor((x1 - x0) / 90)), false);
  if (res.integer) {
    const st = Math.max(1, Math.ceil(niceStep(hi - lo, Math.max(2, Math.floor((x1 - x0) / 60)))));
    xs.step = st; xs.ticks = [];
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) xs.ticks.push(v);
  }
  for (const v of xs.ticks) {
    if (v < lo - 1e-9 || v > hi + 1e-9) continue;
    blue += `<text x="${r1(x(v))}" y="${H - bottom + 17}" text-anchor="middle" font-size="12" font-weight="500" fill="${INK.blue}" style="font-variant-numeric:tabular-nums">${esc(fmtAxis(v, ctx.unit, xs.step))}</text>`;
    blue += `<line x1="${r1(x(v))}" x2="${r1(x(v))}" y1="${H - bottom}" y2="${H - bottom + 4}" stroke="${INK.blue}"/>`;
  }
  blue += xTitle(W, H, ctx.dimTitle);
  // mediana
  const mx = r1(x(res.median));
  pink += `<line x1="${mx}" x2="${mx}" y1="${top - 2}" y2="${H - bottom}" stroke="${INK.pink}" stroke-width="3"/>`;
  blue += `<line x1="${mx}" x2="${mx}" y1="${top - 2}" y2="${H - bottom}" stroke="${INK.blue}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  const mt = `${t('chart.median')} ${fmtNum(res.median, ctx.unit)}`;
  const mtw = textWidth(mt, 12, 700);
  const right = mx + mtw + 8 < W;
  blue += `<text x="${right ? mx + 6 : mx - 6}" y="${top + 10}" text-anchor="${right ? 'start' : 'end'}" font-size="12" font-weight="700" fill="${INK.blue}" paint-order="stroke" stroke="${INK.paper}" stroke-width="3">${esc(mt)}</text>`;
  const aria = t('chart.ariaHist', { title: ctx.title, n: fmtNum(res.n), min: fmtNum(res.min, ctx.unit), max: fmtNum(res.max, ctx.unit), median: fmtNum(res.median, ctx.unit) });
  const body = layer('yellow', yellow, ctx.reg.yellow) + layer('pink', pink, ctx.reg.pink) + layer('blue', dots, null) + `<g class="ink ink-blue">${blue}</g><g class="hits">${hits}</g>`;
  return { svg: svgWrap(W, H, aria, body), H, items };
}

// ---------- dispersión ----------
function scatterChart(W, H, spec, res, ctx) {
  const top = 28, bottom = 44;
  const xsV = res.pts.map((p) => p[0]), ysV = res.pts.map((p) => p[1]);
  const sy = niceScale(Math.min(...ysV), Math.max(...ysV), 5, false);
  const sx = niceScale(Math.min(...xsV), Math.max(...xsV), Math.max(2, Math.floor(W / 110)), false);
  const x0 = Math.ceil(yTickWidth(sy, ctx.unitY) + 14), x1 = W - 14;
  const x = (v) => x0 + ((v - sx.lo) / (sx.hi - sx.lo)) * (x1 - x0);
  const y = (v) => H - bottom - ((v - sy.lo) / (sy.hi - sy.lo)) * (H - bottom - top);
  let blue = yAxis(sy, x0, x1, y, ctx.unitY, ctx.valueTitle);
  for (const v of sx.ticks) {
    blue += `<line x1="${r1(x(v))}" x2="${r1(x(v))}" y1="${top}" y2="${H - bottom}" stroke="${INK.blue}" stroke-opacity="0.12"/>`;
    blue += `<text x="${r1(x(v))}" y="${H - bottom + 17}" text-anchor="middle" font-size="12" font-weight="500" fill="${INK.blue}" style="font-variant-numeric:tabular-nums">${esc(fmtAxis(v, ctx.unitX, sx.step))}</text>`;
  }
  blue += xTitle(W, H, ctx.dimTitle);
  const r = res.pts.length > 800 ? 2.4 : 3.4;
  let pink = '';
  for (const p of res.pts) pink += `<circle cx="${r1(x(p[0]))}" cy="${r1(y(p[1]))}" r="${r}"/>`;
  const aria = t('chart.ariaScatter', { title: ctx.title, n: fmtNum(res.total) });
  const body = layer('pink', `<g fill="${INK.pink}" fill-opacity="0.72">${pink}</g>`, ctx.reg.pink, false) + `<g class="ink ink-blue">${blue}</g>`;
  return { svg: svgWrap(W, H, aria, body), H, items: [] };
}

// Punto de entrada: decide el dibujo según el tipo.
export function drawChart(W, spec, res, ctx) {
  ctx.reg = misreg(spec.id);
  const H = ctx.height;
  if (spec.type === 'bar') return barChart(W, spec, res, ctx);
  if (spec.type === 'histogram') return histChart(W, H, spec, res, ctx);
  if (spec.type === 'scatter') return scatterChart(W, H, spec, res, ctx);
  return bandChart(W, H, spec, res, ctx);
}

// Muestra pequeña de la serie para la leyenda (trama + trazo).
export function legendSwatch(si, type) {
  const st = SERIES[si];
  const fill = st.ink === 'pink' ? INK.pink : st.ink === 'yellow' ? INK.yellow : 'url(#riso-hatch-blue)';
  const line = type === 'line' || type === 'area'
    ? `<line x1="1" x2="27" y1="9" y2="9" stroke="${INK.blue}" stroke-width="2"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/><g fill="${INK.paper}" stroke="${INK.blue}" stroke-width="1.5">${marker(st.marker, 14, 9, 3.5)}</g>`
    : '';
  const box = type === 'line' ? '' : `<rect x="2" y="3" width="24" height="12" fill="${fill}" style="mix-blend-mode:multiply"/>${st.ink !== 'pink' ? `<rect x="2.5" y="3.5" width="23" height="11" fill="none" stroke="${INK.blue}"/>` : ''}`;
  return `<svg width="28" height="18" viewBox="0 0 28 18" aria-hidden="true">${box}${line}</svg>`;
}

export function emptyPlate(W, H, msg) {
  return svgWrap(W, H, msg, `<g class="ink ink-blue"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="url(#riso-dots-blue)" fill-opacity="0.35" stroke="${INK.blue}" stroke-dasharray="6 5"/></g>`, 'is-empty');
}
