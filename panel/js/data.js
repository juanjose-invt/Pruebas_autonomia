// Modelo del conjunto de datos, filtros y agregaciones.
import { inferColumn, typeColumn, parseNumber, parseDate, isEmpty, hasTime, detectUnit } from './types.js';

const DAY = 86400000;

function uniqueNames(names, fallback) {
  const seen = new Map();
  return names.map((raw, i) => {
    let name = (raw == null ? '' : raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw)).trim().replace(/\s+/g, ' ');
    if (!name) name = fallback(i + 1);
    const base = name;
    let k = seen.get(base.toLowerCase()) || 0;
    while (k > 0 && seen.has(name.toLowerCase())) name = `${base} (${++k})`;
    seen.set(base.toLowerCase(), Math.max(k, 1));
    seen.set(name.toLowerCase(), 1);
    return name;
  });
}

// ¿Parece la primera fila una cabecera?
function looksLikeHeader(rows) {
  if (rows.length < 2) return true;
  const first = rows[0];
  const body = rows.slice(1, 400);
  let dataLike = 0, headerLike = 0;
  for (let j = 0; j < first.length; j++) {
    const h = first[j];
    if (isEmpty(h)) continue;
    const col = body.map((r) => r[j]).filter((v) => !isEmpty(v));
    if (!col.length) continue;
    const numRest = col.filter((v) => !Number.isNaN(parseNumber(v, '.')) || !Number.isNaN(parseNumber(v, ','))).length / col.length;
    const dateRest = col.filter((v) => v instanceof Date || !Number.isNaN(parseDate(v))).length / col.length;
    const hNum = typeof h === 'number' || !Number.isNaN(parseNumber(h, '.')) || !Number.isNaN(parseNumber(h, ','));
    const hDate = h instanceof Date || !Number.isNaN(parseDate(h));
    if ((numRest > 0.9 && !hNum) || (dateRest > 0.9 && !hDate)) headerLike++;
    else if ((numRest > 0.9 && hNum) || (dateRest > 0.9 && hDate)) dataLike++;
    else if (col.includes(h)) dataLike += 0.5;
  }
  if (headerLike > 0 && headerLike >= dataLike) return true;
  if (dataLike > 0) return false;
  return true;
}

// Construye el conjunto tipado a partir de las filas crudas.
// opts: { header: 'auto'|true|false, decimal: 'auto'|','|'.', dateOrder: 'auto'|'dmy'|'mdy', types: {colName: type} }
export function buildDataset(source, opts = {}, fallbackName = (i) => `Columna ${i}`) {
  const rows = source.rows;
  const header = opts.header === 'auto' || opts.header == null ? looksLikeHeader(rows) : !!opts.header;
  const width = rows.reduce((w, r, i) => (i < 5000 ? Math.max(w, r.length) : w), 0);
  const body = header ? rows.slice(1) : rows;
  const names = uniqueNames(header ? Array.from({ length: width }, (_, j) => rows[0][j]) : Array.from({ length: width }, () => ''), fallbackName);
  const n = body.length;
  const decimalHint = source.delimiter === ';' ? ',' : '.';

  const columns = [];
  const data = [];
  for (let j = 0; j < width; j++) {
    const raw = new Array(n);
    for (let i = 0; i < n; i++) { const v = body[i][j]; raw[i] = v === undefined ? '' : v; }
    const info = inferColumn(names[j], raw, decimalHint);
    const col = {
      name: names[j],
      index: j,
      detected: info.type,
      type: info.type,
      decimal: opts.decimal && opts.decimal !== 'auto' ? opts.decimal : info.decimal,
      dateOrder: opts.dateOrder && opts.dateOrder !== 'auto' ? opts.dateOrder : info.dateOrder,
      idLike: info.idLike,
      unit: detectUnit(raw),
      raw,
    };
    const forced = opts.types && opts.types[col.name];
    if (forced && forced !== col.type) col.type = forced;
    columns.push(col);
    data.push(null);
  }
  const ds = { name: source.name, source, header, columns, data, n, rowText: null };
  columns.forEach((c, j) => retype(ds, j));
  return ds;
}

export function retype(ds, j) {
  const col = ds.columns[j];
  const typed = typeColumn(col.raw, col);
  ds.data[j] = typed.values;
  col.invalid = typed.invalid;
  col.empty = typed.empty;
  col.hasTime = col.type === 'date' ? hasTime(typed.values) : false;
  if (col.type === 'category' || col.type === 'text') {
    const set = new Set();
    for (const v of typed.values) { set.add(v); if (set.size > 5000) break; }
    col.distinct = set.size;
  } else col.distinct = null;
  ds.rowText = null;
}

export function colIndex(ds, name) {
  return ds.columns.findIndex((c) => c.name === name);
}

export const EMPTY_KEY = '\u0000';

function keyOf(v) { return v == null ? EMPTY_KEY : v; }

// ---------- filtros ----------

function predicate(ds, f) {
  const j = colIndex(ds, f.col);
  if (j < 0) return null;
  const col = ds.columns[j];
  const arr = ds.data[j];
  if (f.kind === 'in') {
    const set = new Set(f.values);
    if (col.type === 'number' || col.type === 'date') return null;
    return (i) => set.has(keyOf(arr[i]));
  }
  if (f.kind === 'range') {
    if (col.type !== 'number' && col.type !== 'date') return null;
    const lo = f.min == null ? -Infinity : f.min;
    const hi = f.max == null ? Infinity : f.max;
    return (i) => { const x = arr[i]; return x >= lo && x <= hi; };
  }
  return null;
}

// Índices de las filas que pasan los filtros. `skipCol` ignora los filtros de esa columna (filtro cruzado).
export function filterRows(ds, filters, skipCol = null) {
  const preds = [];
  for (const f of filters) {
    if (skipCol && f.col === skipCol) continue;
    const p = predicate(ds, f);
    if (p) preds.push(p);
  }
  const out = new Uint32Array(ds.n);
  let k = 0;
  outer: for (let i = 0; i < ds.n; i++) {
    for (const p of preds) if (!p(i)) continue outer;
    out[k++] = i;
  }
  return out.subarray(0, k);
}

export function filterIsValid(ds, f) { return predicate(ds, f) !== null; }

// ---------- agregación ----------

function newAcc(keepVals) { return { n: 0, cnt: 0, sum: 0, min: Infinity, max: -Infinity, vals: keepVals ? [] : null }; }
function addAcc(a, x) {
  a.n++;
  if (x === undefined) return;
  if (Number.isNaN(x)) return;
  a.cnt++; a.sum += x;
  if (x < a.min) a.min = x;
  if (x > a.max) a.max = x;
  if (a.vals) a.vals.push(x);
}
function mergeAcc(a, b) {
  a.n += b.n; a.cnt += b.cnt; a.sum += b.sum;
  a.min = Math.min(a.min, b.min); a.max = Math.max(a.max, b.max);
  if (a.vals && b.vals) for (const v of b.vals) a.vals.push(v);
}
export function median(vals) {
  if (!vals.length) return NaN;
  const s = Float64Array.from(vals).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function finish(a, agg) {
  switch (agg) {
    case 'count': return a.n;
    case 'sum': return a.cnt ? a.sum : 0;
    case 'mean': return a.cnt ? a.sum / a.cnt : NaN;
    case 'min': return a.cnt ? a.min : NaN;
    case 'max': return a.cnt ? a.max : NaN;
    case 'median': return median(a.vals || []);
    default: return NaN;
  }
}

export const AGGS = ['sum', 'mean', 'median', 'min', 'max', 'count'];

export function bucketStart(t, bucket) {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  switch (bucket) {
    case 'year': return Date.UTC(y, 0, 1);
    case 'quarter': return Date.UTC(y, m - (m % 3), 1);
    case 'month': return Date.UTC(y, m, 1);
    case 'week': {
      const day = Math.floor(t / DAY) * DAY;
      const dow = (new Date(day).getUTCDay() + 6) % 7; // lunes = 0
      return day - dow * DAY;
    }
    default: return Math.floor(t / DAY) * DAY;
  }
}
export function bucketNext(t, bucket) {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  switch (bucket) {
    case 'year': return Date.UTC(y + 1, 0, 1);
    case 'quarter': return Date.UTC(y, m + 3, 1);
    case 'month': return Date.UTC(y, m + 1, 1);
    case 'week': return t + 7 * DAY;
    default: return t + DAY;
  }
}

export function autoBucket(minT, maxT) {
  const days = (maxT - minT) / DAY;
  if (days <= 45) return 'day';
  if (days <= 180) return 'week';
  if (days <= 1500) return 'month';
  if (days <= 4000) return 'quarter';
  return 'year';
}

function rangeOf(arr, idx) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < idx.length; k++) {
    const x = arr[idx[k]];
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return [lo, hi];
}

// spec: { dim, measure, agg, bucket, topN, sort, split }
// Devuelve { kind: 'time'|'category', keys, labels, series: [{name, values, counts}], others, groups, bucket }
export function aggregate(ds, idx, spec) {
  const dj = colIndex(ds, spec.dim);
  if (dj < 0) throw new Error('noDim');
  const dcol = ds.columns[dj];
  const darr = ds.data[dj];
  const agg = spec.agg || 'count';
  const mj = agg === 'count' ? -1 : colIndex(ds, spec.measure);
  if (agg !== 'count' && (mj < 0 || ds.columns[mj].type !== 'number')) throw new Error('noMeasure');
  const marr = mj >= 0 ? ds.data[mj] : null;
  const keep = agg === 'median';
  const sj = spec.split ? colIndex(ds, spec.split) : -1;
  const sarr = sj >= 0 && (ds.columns[sj].type === 'category' || ds.columns[sj].type === 'text') ? ds.data[sj] : null;

  // Serie: top 3 por total.
  let seriesKeys = [null];
  let seriesOthers = 0;
  if (sarr) {
    const tot = new Map();
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      const key = keyOf(sarr[i]);
      let a = tot.get(key); if (!a) tot.set(key, a = newAcc(false));
      addAcc(a, marr ? marr[i] : undefined);
    }
    const ranked = [...tot.entries()].map(([k, a]) => [k, agg === 'count' ? a.n : a.cnt ? a.sum : 0]).sort((a, b) => b[1] - a[1]);
    seriesKeys = ranked.slice(0, 3).map((r) => r[0]);
    seriesOthers = Math.max(0, ranked.length - 3);
  }
  const sIndex = new Map(seriesKeys.map((k, i) => [k, i]));

  if (dcol.type === 'date') {
    const [lo, hi] = rangeOf(darr, idx);
    if (!Number.isFinite(lo)) return { kind: 'time', keys: [], labels: [], series: [], bucket: spec.bucket, others: 0, groups: 0, seriesOthers };
    const bucket = !spec.bucket || spec.bucket === 'auto' ? autoBucket(lo, hi) : spec.bucket;
    const first = bucketStart(lo, bucket), last = bucketStart(hi, bucket);
    const keys = [];
    for (let t = first, guard = 0; t <= last && guard < 5000; t = bucketNext(t, bucket), guard++) keys.push(t);
    const pos = new Map(keys.map((t, i) => [t, i]));
    const accs = seriesKeys.map(() => keys.map(() => newAcc(keep)));
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      const t = darr[i];
      if (Number.isNaN(t)) continue;
      const p = pos.get(bucketStart(t, bucket));
      if (p === undefined) continue;
      const s = sarr ? sIndex.get(keyOf(sarr[i])) : 0;
      if (s === undefined) continue;
      addAcc(accs[s][p], marr ? marr[i] : undefined);
    }
    const series = accs.map((list, s) => ({
      key: seriesKeys[s],
      values: list.map((a) => (a.n === 0 && agg !== 'count' && agg !== 'sum' ? NaN : finish(a, agg))),
      counts: list.map((a) => a.n),
    }));
    return { kind: 'time', keys, series, bucket, others: 0, groups: keys.length, seriesOthers };
  }

  // Categórica (o texto).
  const groups = new Map();
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const key = keyOf(darr[i]);
    let g = groups.get(key);
    if (!g) { g = { key, total: newAcc(keep), parts: seriesKeys.map(() => newAcc(keep)) }; groups.set(key, g); }
    addAcc(g.total, marr ? marr[i] : undefined);
    if (sarr) {
      const s = sIndex.get(keyOf(sarr[i]));
      if (s !== undefined) addAcc(g.parts[s], marr ? marr[i] : undefined);
    } else addAcc(g.parts[0], marr ? marr[i] : undefined);
  }
  let list = [...groups.values()].map((g) => ({ ...g, v: finish(g.total, agg) }));
  const sort = spec.sort || 'value';
  const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  if (sort === 'label') list.sort((a, b) => (a.key === EMPTY_KEY) - (b.key === EMPTY_KEY) || coll.compare(a.key, b.key));
  else {
    const val = (g) => (Number.isNaN(g.v) ? -Infinity : g.v);
    list.sort((a, b) => (val(b) - val(a)) || coll.compare(String(a.key), String(b.key)));
  }
  const topN = Math.max(1, spec.topN || 12);
  let others = 0;
  if (list.length > topN) {
    const rest = list.slice(topN - 1);
    others = rest.length;
    const o = { key: OTHERS_KEY, total: newAcc(keep), parts: seriesKeys.map(() => newAcc(keep)) };
    for (const g of rest) { mergeAcc(o.total, g.total); g.parts.forEach((p, s) => mergeAcc(o.parts[s], p)); }
    list = list.slice(0, topN - 1).concat([{ ...o, v: finish(o.total, agg) }]);
  }
  const series = seriesKeys.map((sk, s) => ({
    key: sk,
    values: list.map((g) => finish(g.parts[s], agg)),
    counts: list.map((g) => g.parts[s].n),
  }));
  return { kind: 'category', keys: list.map((g) => g.key), series, others, groups: groups.size, seriesOthers };
}

export const OTHERS_KEY = '\u0001others';

export function niceStep(span, count) {
  const raw = span / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}

export function histogram(ds, idx, colName, binsWanted) {
  const j = colIndex(ds, colName);
  if (j < 0 || ds.columns[j].type !== 'number') throw new Error('noMeasure');
  const arr = ds.data[j];
  const vals = [];
  for (let k = 0; k < idx.length; k++) { const x = arr[idx[k]]; if (!Number.isNaN(x)) vals.push(x); }
  if (!vals.length) return { bins: [], n: 0 };
  let lo = Infinity, hi = -Infinity, sum = 0;
  for (const x of vals) { if (x < lo) lo = x; if (x > hi) hi = x; sum += x; }
  const target = binsWanted || Math.min(30, Math.max(6, Math.ceil(Math.log2(vals.length) + 1)));
  let step, start;
  if (hi === lo) { step = Math.abs(lo) > 0 ? Math.abs(lo) / 10 : 1; start = lo - step / 2; }
  else { step = niceStep(hi - lo, target); start = Math.floor(lo / step) * step; }
  const count = Math.floor((hi - start) / step + 1e-9) + 1;
  const bins = Array.from({ length: count }, (_, b) => ({ x0: start + b * step, x1: start + (b + 1) * step, count: 0 }));
  for (const x of vals) {
    let b = Math.floor((x - start) / step);
    if (b >= count) b = count - 1;
    if (b < 0) b = 0;
    bins[b].count++;
  }
  while (bins.length > 1 && bins[bins.length - 1].count === 0) bins.pop();
  return { bins, n: vals.length, mean: sum / vals.length, median: median(vals), min: lo, max: hi };
}

export function scatter(ds, idx, xName, yName, max = 2500) {
  const xj = colIndex(ds, xName), yj = colIndex(ds, yName);
  if (xj < 0 || yj < 0 || ds.columns[xj].type !== 'number' || ds.columns[yj].type !== 'number') throw new Error('noMeasure');
  const xs = ds.data[xj], ys = ds.data[yj];
  const valid = [];
  for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (!Number.isNaN(xs[i]) && !Number.isNaN(ys[i])) valid.push(i); }
  const step = valid.length > max ? valid.length / max : 1;
  const pts = [];
  for (let k = 0; k < valid.length && pts.length < max; k += step) { const i = valid[Math.floor(k)]; pts.push([xs[i], ys[i], i]); }
  return { pts, total: valid.length };
}

export function kpiValue(ds, idx, measure, agg) {
  if (agg === 'count') return idx.length;
  const j = colIndex(ds, measure);
  if (j < 0 || ds.columns[j].type !== 'number') throw new Error('noMeasure');
  const a = newAcc(agg === 'median');
  const arr = ds.data[j];
  for (let k = 0; k < idx.length; k++) addAcc(a, arr[idx[k]]);
  return finish(a, agg);
}

export function allIndex(ds) {
  const out = new Uint32Array(ds.n);
  for (let i = 0; i < ds.n; i++) out[i] = i;
  return out;
}

// Valores distintos de una columna categórica con su recuento (para el panel de filtros).
export function distinctCounts(ds, colName, idx) {
  const j = colIndex(ds, colName);
  const arr = ds.data[j];
  const m = new Map();
  const n = idx ? idx.length : ds.n;
  for (let k = 0; k < n; k++) { const i = idx ? idx[k] : k; const key = keyOf(arr[i]); m.set(key, (m.get(key) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function columnRange(ds, colName) {
  const j = colIndex(ds, colName);
  const arr = ds.data[j];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
  return [lo, hi];
}

export { DAY };
