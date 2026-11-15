// Extracción de campos de un ticket o factura a partir de las palabras reconocidas.
// Todo es heurístico: cada campo lleva una confianza (0–1) y un estado.
//   ok     → confianza alta (OCR nítido y regla clara)
//   check  → probable, conviene mirarlo
//   doubt  → dudoso o no encontrado: nunca se da por bueno
//   manual → lo ha fijado o corregido la persona
// Módulo puro (sin DOM) para poder probarlo aparte.

export const FIELDS = ['vendor', 'date', 'total', 'tax'];

const OK = 0.8;
const CHECK = 0.6;

export function statusOf(conf, found = true) {
  if (!found) return 'doubt';
  if (conf >= OK) return 'ok';
  if (conf >= CHECK) return 'check';
  return 'doubt';
}

export const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- números ----------
// Importes con dos decimales: 12,50 · 1.234,56 · 1,234.56 · 12.50 · -3,00
const AMOUNT_RE = /(?<![\d.,])-?\d{1,3}(?:[.,' ]\d{3})*[.,]\s?\d{2}(?![\d.,]*\d)|(?<![\d.,])-?\d+[.,]\s?\d{2}(?![\d])/g;

// Corrige confusiones típicas del OCR dentro de algo que ya parece un número.
function fixDigits(tok) {
  if (!/\d/.test(tok)) return tok;
  return tok.replace(/[Oo](?=[\d.,])|(?<=[\d.,])[Oo]/g, '0').replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1').replace(/(?<=\d)S|S(?=\d)/g, '5');
}

export function parseAmount(str) {
  if (str == null) return null;
  let s = fixDigits(String(str)).replace(/[€$£\s]/g, '').replace(/[^\d.,'-]/g, '');
  const m = s.match(/^(-?)([\d.,']*?)[.,](\d{2})$/);
  if (!m) {
    if (/^-?\d+$/.test(s)) return Number(s);
    return null;
  }
  const int = m[2].replace(/[.,']/g, '') || '0';
  const v = Number(`${m[1]}${int}.${m[3]}`);
  return Number.isFinite(v) ? v : null;
}

// Devuelve los importes de un texto (ignora porcentajes como 21,00 %).
export function amountsIn(text) {
  const out = [];
  const t = fixDigits(text);
  for (const m of t.matchAll(AMOUNT_RE)) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (/^\s?%/.test(after)) continue;
    const v = parseAmount(m[0]);
    if (v != null) out.push({ value: v, raw: m[0], index: m.index });
  }
  return out;
}

export function formatAmount(v, lang = 'es') {
  if (v == null || !Number.isFinite(v)) return '';
  return v.toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
}

// ---------- fechas ----------
const MONTHS = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};
const MON = '(ene|jan|feb|mar|abr|apr|may|jun|jul|ago|aug|sep|set|oct|nov|dic|dec)[a-z]*\\.?';

function validDate(y, m, d, now = new Date()) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  if (y < 2000 || y > now.getFullYear() + 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Busca fechas en un texto. `english` decide los casos ambiguos mm/dd.
export function datesIn(text, english = false) {
  const t = fold(fixDigits(text));
  const out = [];
  let m;
  const reIso = /(?<!\d)(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/g;
  while ((m = reIso.exec(t))) {
    const iso = validDate(+m[1], +m[2], +m[3]);
    if (iso) out.push({ iso, raw: m[0], ambiguous: false, index: m.index });
  }
  const reNum = /(?<!\d)(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{4}|\d{2})(?!\d)/g;
  while ((m = reNum.exec(t))) {
    const a = +m[1], b = +m[2], y = +m[3];
    let iso = null, ambiguous = false;
    if (a > 12) iso = validDate(y, b, a);
    else if (b > 12) iso = validDate(y, a, b);
    else {
      ambiguous = a !== b;
      iso = english ? validDate(y, a, b) : validDate(y, b, a);
    }
    if (iso) out.push({ iso, raw: m[0], ambiguous, index: m.index });
  }
  const reTxt = new RegExp(`(?<!\\d)(\\d{1,2})\\s*(?:de\\s+)?${MON}\\s*(?:de\\s+)?,?\\s*(\\d{4}|\\d{2})(?!\\d)`, 'g');
  while ((m = reTxt.exec(t))) {
    const iso = validDate(+m[3], MONTHS[m[2]], +m[1]);
    if (iso) out.push({ iso, raw: m[0], ambiguous: false, index: m.index });
  }
  const reTxtEn = new RegExp(`${MON}\\s+(\\d{1,2}),?\\s+(\\d{4})(?!\\d)`, 'g');
  while ((m = reTxtEn.exec(t))) {
    const iso = validDate(+m[3], MONTHS[m[1]], +m[2]);
    if (iso) out.push({ iso, raw: m[0], ambiguous: false, index: m.index });
  }
  return out;
}

// ---------- filas visuales ----------
// Agrupa las palabras por altura (y no por bloques de Tesseract) para que la etiqueta
// «TOTAL» y su importe, aunque estén en columnas distintas, caigan en la misma fila.
export function buildRows(words) {
  const ws = words.filter((w) => w.text && w.text.trim()).map((w) => ({ ...w, cy: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }));
  if (!ws.length) return [];
  const hs = ws.map((w) => w.h).sort((a, b) => a - b);
  const medH = hs[Math.floor(hs.length / 2)] || 10;
  ws.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const w of ws) {
    const row = rows.find((r) => Math.abs(r.cy - w.cy) < medH * 0.55);
    if (row) {
      row.words.push(w);
      row.cy = row.words.reduce((s, x) => s + x.cy, 0) / row.words.length;
    } else rows.push({ cy: w.cy, words: [w] });
  }
  for (const r of rows) {
    r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    r.text = r.words.map((w) => w.text).join(' ');
    r.folded = fold(r.text);
    r.conf = r.words.reduce((s, w) => s + w.conf, 0) / r.words.length / 100;
    r.minConf = Math.min(...r.words.map((w) => w.conf)) / 100;
    r.bbox = unionBox(r.words.map((w) => w.bbox));
    r.h = r.bbox.y1 - r.bbox.y0;
  }
  rows.sort((a, b) => a.cy - b.cy);
  rows.medH = medH;
  return rows;
}

export function unionBox(boxes) {
  return boxes.reduce((u, b) => ({
    x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1),
  }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
}

// Palabras de una fila que forman un texto concreto (para resaltar solo el importe).
function wordsFor(row, raw) {
  const target = raw.replace(/\s/g, '');
  const ws = row.words;
  for (let i = 0; i < ws.length; i++) {
    let acc = '';
    for (let j = i; j < ws.length && j < i + 4; j++) {
      acc += fixDigits(ws[j].text);
      if (acc.includes(target)) return ws.slice(i, j + 1);
      if (!target.startsWith(acc.replace(/[€$£:]/g, '')) && !acc.includes(target.slice(0, 2))) break;
    }
  }
  return ws.filter((w) => fixDigits(w.text).includes(target.slice(-3)));
}

function fieldFrom(row, raw, value, rule, extra = {}) {
  const ws = (raw && wordsFor(row, raw)) || [];
  const used = ws.length ? ws : row.words;
  const ocr = used.reduce((s, w) => s + w.conf, 0) / used.length / 100;
  const conf = Math.max(0, Math.min(1, ocr * rule));
  return { value, conf, status: statusOf(conf), bbox: unionBox(used.map((w) => w.bbox)), source: 'auto', ...extra };
}

const empty = () => ({ value: null, conf: 0, status: 'doubt', bbox: null, source: 'auto' });

// ---------- campos ----------
const RX_TOTAL = /\b(total|importe|a pagar|amount due|balance due|grand total|to pay|tota1)\b/;
const RX_NOT_TOTAL = /(sub\s*-?\s*total|total\s+(iva|tax|vat|sin|neto|net|base|art|items?|unid|uds|qty|desc)|base\s+imp|\bneto\b|\bnet\b|entregad|cambio|change|cash|efectivo|tarjeta|card|n[ºo°]?\s*art|articulos|items|propina|tip\b)/;
const RX_TAX = /\b(i\.?\s?v\.?\s?a\.?|vat|tax|igic|impuesto|impuestos|cuota|sales tax)\b/;
const RX_SUBTOTAL = /(sub\s*-?\s*total|base\s+imp|\bneto\b|\bnet\b|total sin)/;
const RX_DATE_LABEL = /\b(fecha|date|emision|emitida|issued|dated)\b/;
const RX_DUE = /(vencim|due date|valid|caduc|hasta|until|alta|desde)/;
const RX_NOT_VENDOR = /(factura|invoice|ticket|recibo|receipt|simplificada|tel[ef.:]|telf|tfno|phone|c\.?i\.?f|n\.?i\.?f|vat\s*(no|n[ºo°]|reg)|\bc\/|calle|avda|avenida|plaza|street|\brd\b|road|www\.|http|@|fecha|date|hora|time|cliente|customer|bill to|n[ºo°]\s|^\W*$|gracias|thank|caja|cajero|cashier|mesa|table|pedido|order|bienvenid|welcome)/;
const RX_LEGAL = /\b(s\.?\s?l\.?u?|s\.?\s?a\.?|ltd|llc|inc|gmbh|s\.?\s?coop|c\.?\s?b\.?)\b\.?$/;

export function extractFields(words, { width = 1000, height = 1000, lang = 'es' } = {}) {
  const rows = buildRows(words);
  const all = fold(rows.map((r) => r.text).join('\n'));
  const enHits = (all.match(/\b(total|tax|amount|due|receipt|invoice|thank|date|change|cash|subtotal)\b/g) || []).length;
  const esHits = (all.match(/\b(iva|importe|fecha|factura|gracias|cambio|efectivo|ticket|cif|nif|base|cuota)\b/g) || []).length;
  const english = enHits > esHits + 1 || (lang === 'en' && enHits >= esHits);

  const fields = { vendor: empty(), date: empty(), total: empty(), tax: empty() };
  const notes = [];

  // ---- total ----
  const totals = [];
  rows.forEach((r, i) => {
    if (!RX_TOTAL.test(r.folded) || RX_NOT_TOTAL.test(r.folded) || RX_TAX.test(r.folded.replace(/iva\s+incl\w*|incl\w*\s+iva|tax\s+incl\w*/g, ''))) return;
    let amts = amountsIn(r.text);
    let row = r;
    // Si la fila no tiene importe, se mira la siguiente (etiqueta y número en dos líneas).
    if (!amts.length && rows[i + 1]) { row = rows[i + 1]; amts = amountsIn(row.text); }
    if (!amts.length) return;
    const a = amts[amts.length - 1];
    let score = /\b(total|a pagar|amount due|grand total|balance due)\b/.test(r.folded) ? 1 : 0.85;
    if (/[€$£]|eur|usd|gbp/.test(r.folded)) score += 0.05;
    if (/^\W*total\b/.test(r.folded)) score += 0.03;
    totals.push({ row, a, score: Math.min(1, score), i });
  });
  const allAmounts = rows.flatMap((r) => amountsIn(r.text).map((a) => ({ r, a })));
  if (totals.length) {
    // Prioriza la regla más fuerte; a igualdad, el importe mayor (el total ≥ subtotal).
    totals.sort((x, y) => (y.score - x.score) || (y.a.value - x.a.value));
    const best = totals[0];
    let rule = best.score;
    const max = Math.max(...allAmounts.map((x) => x.a.value));
    if (best.a.value < max && totals.length > 1 && totals.some((t) => t.a.value !== best.a.value)) rule -= 0.15;
    fields.total = fieldFrom(best.row, best.a.raw, best.a.value, rule);
  } else if (allAmounts.length) {
    const big = allAmounts.reduce((m, x) => (x.a.value > m.a.value ? x : m));
    fields.total = fieldFrom(big.r, big.a.raw, big.a.value, 0.5);
    fields.total.status = 'doubt';
    notes.push('total-guess');
  }

  // ---- impuestos ----
  const taxRows = [];
  rows.forEach((r, i) => {
    const f = r.folded;
    if (!RX_TAX.test(f)) return;
    const amts = amountsIn(r.text).filter((a) => !fields.total.value || a.value < fields.total.value * 0.5 || (fields.total.value && Math.abs(a.value - fields.total.value) > 0.001 && a.value < fields.total.value));
    if (amts.length) {
      const isTotalTax = /total\s+(iva|tax|vat|impuestos?)|(iva|tax|vat)\s+total|total\s+cuota/.test(f);
      // Con varias cifras (base, cuota, total) la cuota es la menor.
      const a = amts.length > 1 ? amts.reduce((m, x) => (x.value < m.value ? x : m)) : amts[0];
      taxRows.push({ row: r, a, isTotalTax, score: isTotalTax ? 0.95 : 0.85 });
    } else {
      // Cabecera de tabla «IVA  BASE  CUOTA»: las filas siguientes con % llevan las cifras.
      for (let k = i + 1; k < Math.min(rows.length, i + 4); k++) {
        const rr = rows[k];
        if (!/\d\s?%/.test(rr.text)) continue;
        const am = amountsIn(rr.text);
        if (am.length >= 2) {
          const a = am.reduce((m, x) => (x.value < m.value ? x : m));
          taxRows.push({ row: rr, a, isTotalTax: false, score: 0.75 });
        }
      }
    }
  });
  if (taxRows.length) {
    const tot = taxRows.find((t) => t.isTotalTax);
    if (tot) fields.tax = fieldFrom(tot.row, tot.a.raw, tot.a.value, tot.score);
    else {
      const uniq = [];
      for (const t of taxRows) if (!uniq.some((u) => u.row === t.row || Math.abs(u.a.value - t.a.value) < 0.001)) uniq.push(t);
      if (uniq.length === 1) fields.tax = fieldFrom(uniq[0].row, uniq[0].a.raw, uniq[0].a.value, uniq[0].score);
      else {
        const sum = Math.round(uniq.reduce((s, t) => s + t.a.value, 0) * 100) / 100;
        const f = fieldFrom(uniq[0].row, uniq[0].a.raw, sum, 0.7);
        f.bbox = unionBox(uniq.map((t) => fieldFrom(t.row, t.a.raw, 0, 1).bbox));
        fields.tax = f;
        notes.push('tax-sum');
      }
    }
  }

  // ---- coherencia total / subtotal / impuestos ----
  if (fields.total.value != null) {
    const subRow = rows.find((r) => RX_SUBTOTAL.test(r.folded) && amountsIn(r.text).length);
    const sub = subRow ? amountsIn(subRow.text).slice(-1)[0].value : null;
    const tv = fields.total.value;
    if (fields.tax.value != null) {
      if (fields.tax.value >= tv) { fields.tax.conf *= 0.5; fields.tax.status = 'doubt'; }
      else if (sub != null && Math.abs(sub + fields.tax.value - tv) < 0.02) {
        fields.total.conf = Math.min(1, fields.total.conf + 0.1);
        fields.tax.conf = Math.min(1, fields.tax.conf + 0.1);
        notes.push('sum-ok');
      }
    }
    fields.total.status = fields.total.status === 'doubt' && notes.includes('total-guess') ? 'doubt' : statusOf(fields.total.conf);
    if (fields.tax.value != null && fields.tax.status !== 'doubt') fields.tax.status = statusOf(fields.tax.conf);
  }

  // ---- fecha ----
  const dates = [];
  rows.forEach((r) => {
    for (const d of datesIn(r.text, english)) {
      let rule = 0.9;
      if (RX_DATE_LABEL.test(r.folded)) rule += 0.08;
      if (RX_DUE.test(r.folded)) rule -= 0.3;
      if (d.ambiguous) rule -= 0.2;
      dates.push({ r, d, rule: Math.min(1, rule) });
    }
  });
  if (dates.length) {
    dates.sort((x, y) => y.rule - x.rule || x.r.cy - y.r.cy);
    const b = dates[0];
    fields.date = fieldFrom(b.r, null, b.d.iso, b.rule);
    const ws = b.r.words.filter((w) => /\d/.test(w.text) || new RegExp(MON).test(fold(w.text)));
    if (ws.length) fields.date.bbox = unionBox(ws.map((w) => w.bbox));
    if (b.d.ambiguous) notes.push('date-ambiguous');
  }

  // ---- proveedor ----
  const top = rows.filter((r) => r.cy < height * 0.4).slice(0, 9);
  const cands = top.map((r, i) => {
    const t = r.text.trim();
    const letters = (t.match(/[a-záéíóúñüç]/gi) || []).length;
    const ratio = letters / Math.max(1, t.replace(/\s/g, '').length);
    if (letters < 3 || ratio < 0.6 || RX_NOT_VENDOR.test(r.folded) || amountsIn(t).length || datesIn(t).length) return null;
    let s = 0.55 + (ratio - 0.6) * 0.5;
    if (t === t.toUpperCase()) s += 0.08;
    if (r.h > rows.medH * 1.25) s += 0.12;
    if (RX_LEGAL.test(fold(t))) s += 0.1;
    s -= i * 0.04;
    if (t.length > 42) s -= 0.15;
    return { r, s: Math.min(0.85, s) };
  }).filter(Boolean);
  if (cands.length) {
    cands.sort((a, b) => b.s - a.s);
    const v = cands[0];
    fields.vendor = fieldFrom(v.r, null, cleanVendor(v.r.text), v.s);
  }

  return { fields, rows, english, notes, currency: detectCurrency(all) };
}

export function cleanVendor(t) {
  return t.replace(/^[^\p{L}\d]+|[^\p{L}\d.)]+$/gu, '').replace(/\s{2,}/g, ' ').slice(0, 80);
}

export function detectCurrency(folded) {
  const c = { EUR: (folded.match(/€|\beur\b|euros?/g) || []).length, USD: (folded.match(/\$|\busd\b/g) || []).length, GBP: (folded.match(/£|\bgbp\b/g) || []).length };
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : null;
}

// Interpreta un texto señalado a mano para un campo concreto.
export function parseForField(field, text, english = false) {
  const t = String(text || '').trim();
  if (field === 'vendor') return cleanVendor(t) || null;
  if (field === 'date') {
    const d = datesIn(t, english)[0];
    return d ? d.iso : null;
  }
  const a = amountsIn(t);
  if (a.length) return a[a.length - 1].value;
  const n = parseAmount(t);
  return n;
}
