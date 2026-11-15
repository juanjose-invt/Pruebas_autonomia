// Detección y conversión de tipos de columna: número, fecha, categoría o texto.

const DAY = 86400000;
const NUM_CLEAN = /[\s   '€$£¥₹%]/g;
const RE_COMMA_DEC = /^[-+]?(?:\d{1,3}(?:\.\d{3})+|\d+)?(?:,\d+)?$/;
const RE_DOT_DEC = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?$/i;

export function isEmpty(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

export function parseNumber(v, decimal = '.') {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'boolean' || v instanceof Date || v == null) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(NUM_CLEAN, '').replace(/^−/, '-');
  if (!s || !/\d/.test(s)) return NaN;
  if (decimal === ',') {
    if (!RE_COMMA_DEC.test(s)) return NaN;
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    if (!RE_DOT_DEC.test(s)) return NaN;
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

// Mira qué separador decimal encaja mejor con los valores de una columna.
export function detectDecimal(values, hint = '.') {
  let comma = 0, dot = 0;
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim().replace(NUM_CLEAN, '');
    if (!/^[-+(]?[\d.,]+\)?$/.test(s)) continue;
    const lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
    if (/^[-+(]?\d+$/.test(s)) continue;
    if (lastC >= 0 && lastD >= 0) { if (lastC > lastD) comma += 3; else dot += 3; continue; }
    // Solo un tipo de signo: "1,5" es decimal; "1,234,567" son miles; "1,234" es ambiguo y no cuenta.
    const only = lastC >= 0 ? ',' : lastD >= 0 ? '.' : '';
    if (!only) continue;
    const count = s.split(only).length - 1;
    const tail = s.length - s.lastIndexOf(only) - 1;
    let isDecimal = null;
    if (count > 1) isDecimal = false;
    else if (tail !== 3) isDecimal = true;
    else if (/^[-+(]?0[.,]/.test(s)) isDecimal = true;
    if (isDecimal === null) continue;
    if ((only === ',') === isDecimal) comma += 2; else dot += 2;
  }
  if (comma === dot) return hint;
  return comma > dot ? ',' : '.';
}

const MONTHS = {
  ene: 1, jan: 1, enero: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, apr: 4, abril: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, aug: 8, agosto: 8, august: 8,
  sep: 9, set: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, dec: 12, diciembre: 12, december: 12,
};

function mk(y, m, d, hh = 0, mi = 0, ss = 0) {
  if (y < 100) y += y < 50 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return NaN;
  const t = Date.UTC(y, m - 1, d, hh, mi, ss);
  const dt = new Date(t);
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return NaN;
  return t;
}

const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const RE_YMD = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const RE_XYZ = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const RE_YM = /^(\d{4})[-/](\d{1,2})$/;
const RE_NAMED_DMY = /^(\d{1,2})(?:\s+de)?[\s-]+([a-záéíóú]+)\.?(?:\s+de)?[\s-]+(\d{2,4})$/i;
const RE_NAMED_MDY = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i;
const RE_NAMED_MY = /^([a-záéíóú]+)\.?(?:\s+de)?[\s-]+(\d{4})$/i;

// Devuelve milisegundos (UTC) o NaN.
export function parseDate(v, order = 'dmy') {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? NaN : v.getTime();
  if (typeof v === 'number') {
    // Número de serie de Excel (días desde 1899-12-30).
    if (v > 0 && v < 2958466) return Math.round((v - 25569) * DAY);
    return NaN;
  }
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (s.length < 6 || s.length > 32) return NaN;
  let m = RE_ISO.exec(s);
  if (m) return mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = RE_YMD.exec(s);
  if (m) return mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = RE_XYZ.exec(s);
  if (m) {
    const a = +m[1], b = +m[2];
    const [d, mo] = order === 'mdy' ? [b, a] : [a, b];
    return mk(+m[3], mo, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  m = RE_YM.exec(s);
  if (m) return mk(+m[1], +m[2], 1);
  m = RE_NAMED_DMY.exec(s);
  if (m) { const mo = MONTHS[m[2].toLowerCase()]; return mo ? mk(+m[3], mo, +m[1]) : NaN; }
  m = RE_NAMED_MDY.exec(s);
  if (m) { const mo = MONTHS[m[1].toLowerCase()]; return mo ? mk(+m[3], mo, +m[2]) : NaN; }
  m = RE_NAMED_MY.exec(s);
  if (m) { const mo = MONTHS[m[1].toLowerCase()]; return mo ? mk(+m[2], mo, 1) : NaN; }
  return NaN;
}

export function detectDateOrder(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = RE_XYZ.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

function sampleValues(values, max = 3000) {
  const out = [];
  const n = values.length;
  const step = n > max ? n / max : 1;
  for (let i = 0; i < n && out.length < max; i += step) {
    const v = values[Math.floor(i)];
    if (!isEmpty(v)) out.push(v);
  }
  return out;
}

const ID_NAME = /(^|[^a-záéíóúñ])(id|código|codigo|code|ref|referencia|cp|zip|teléfono|telefono|phone|dni|nif|sku)([^a-záéíóúñ]|$)/i;
const YEAR_NAME = /(^|[^a-záéíóúñ])(año|anio|year|ejercicio)([^a-záéíóúñ]|$)/i;

// Inferencia del tipo de una columna a partir de sus valores (crudos).
export function inferColumn(name, values, decimalHint) {
  const sample = sampleValues(values);
  const nonEmpty = sample.length;
  const info = { type: 'text', decimal: '.', dateOrder: 'dmy', idLike: false };
  if (!nonEmpty) { info.type = 'category'; return info; }

  info.decimal = detectDecimal(sample, decimalHint);
  info.dateOrder = detectDateOrder(sample);

  let dates = 0, nums = 0, leadingZero = 0, ints = 0, dateObjs = 0;
  for (const v of sample) {
    if (v instanceof Date) { dates++; dateObjs++; continue; }
    if (typeof v === 'string' && !Number.isNaN(parseDate(v, info.dateOrder))) dates++;
    const n = parseNumber(v, info.decimal);
    if (!Number.isNaN(n)) {
      nums++;
      if (Number.isInteger(n)) ints++;
      if (typeof v === 'string' && /^0\d/.test(v.trim())) leadingZero++;
    }
  }
  const distinct = new Set(sample.map((v) => (v instanceof Date ? v.getTime() : String(v).trim().toLowerCase()))).size;

  if (dates / nonEmpty >= 0.9) { info.type = 'date'; return info; }
  if (nums / nonEmpty >= 0.95 && leadingZero / nonEmpty < 0.2) {
    info.type = 'number';
    const intsAll = ints === nums;
    if (ID_NAME.test(name) && intsAll) info.idLike = true;
    if (intsAll && distinct === nonEmpty && nonEmpty > 50 && /(^|\W)(n\.?º|num|nº|#)/i.test(name)) info.idLike = true;
    if (YEAR_NAME.test(name) && intsAll && distinct <= 60) { info.type = 'category'; }
    return info;
  }
  const avgLen = sample.reduce((a, v) => a + String(v).length, 0) / nonEmpty;
  if ((distinct <= 40 || distinct / nonEmpty < 0.35) && avgLen < 48) info.type = 'category';
  else info.type = 'text';
  return info;
}

// Convierte la columna cruda al tipo pedido. Devuelve los valores tipados y cuántos no encajan.
export function typeColumn(values, col) {
  const n = values.length;
  if (col.type === 'number' || col.type === 'date') {
    const out = new Float64Array(n);
    let invalid = 0, empty = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (isEmpty(v)) { out[i] = NaN; empty++; continue; }
      const x = col.type === 'number' ? parseNumber(v, col.decimal) : parseDate(v, col.dateOrder);
      if (Number.isNaN(x)) invalid++;
      out[i] = x;
    }
    return { values: out, invalid, empty };
  }
  const out = new Array(n);
  let empty = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (isEmpty(v)) { out[i] = null; empty++; continue; }
    out[i] = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
  }
  return { values: out, invalid: 0, empty };
}

// ¿Tiene alguna fecha con hora distinta de medianoche?
export function hasTime(arr) {
  for (let i = 0; i < arr.length; i += Math.max(1, Math.floor(arr.length / 500))) {
    const t = arr[i];
    if (!Number.isNaN(t) && t % DAY !== 0) return true;
  }
  return false;
}

// Unidad típica de la columna (símbolo de moneda o %), para rotular ejes.
export function detectUnit(values) {
  let eur = 0, usd = 0, pct = 0, gbp = 0, seen = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    if (++seen > 400) break;
    if (v.includes('€')) eur++;
    else if (v.includes('$')) usd++;
    else if (v.includes('£')) gbp++;
    else if (v.includes('%')) pct++;
  }
  const lim = Math.max(1, seen * 0.5);
  if (eur >= lim) return '€';
  if (usd >= lim) return '$';
  if (gbp >= lim) return '£';
  if (pct >= lim) return '%';
  return '';
}
