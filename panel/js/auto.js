// Propuesta automática del panel y utilidades de configuración de gráficos.
import { t } from './i18n.js';
import { colIndex } from './data.js';

let seq = 0;
export const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

const MONEY = /(importe|venta|ventas|total|ingreso|factur|precio|coste|costo|gasto|amount|revenue|sales|price|cost|income|spend|valor|value|euros?|€)/i;
const RATE = /(precio|price|tasa|rate|ratio|media|avg|average|edad|age|valoraci|rating|puntua|score|nota|temperatura|temp|porcentaje|%|duraci|días|dias|days|minutos|minutes)/i;

export function measureCols(ds) {
  return ds.columns.filter((c) => c.type === 'number' && !c.idLike && c.invalid < ds.n * 0.5);
}
export function dimCols(ds) {
  return ds.columns.filter((c) => (c.type === 'category' || c.type === 'text') && c.distinct >= 1);
}
export function dateCols(ds) {
  return ds.columns.filter((c) => c.type === 'date' && c.invalid < ds.n * 0.5);
}

const RATE_STRONG = /(valoraci|rating|puntua|score|nota|edad|age|precio unit|unit price|temperatura|temp|humedad|humidity|%|tasa|rate)/i;
function defaultAgg(col) { return RATE_STRONG.test(col.name) || (RATE.test(col.name) && !MONEY.test(col.name)) ? 'mean' : 'sum'; }

// Elige una propuesta sensata de panel según los tipos de columna.
export function proposePanel(ds) {
  const nums = measureCols(ds);
  const rank = (c) => (MONEY.test(c.name) && !RATE_STRONG.test(c.name) ? 2 : MONEY.test(c.name) ? 1 : 0);
  nums.sort((a, b) => rank(b) - rank(a));
  const dates = dateCols(ds);
  const cats = dimCols(ds).filter((c) => c.type === 'category' && c.distinct >= 2 && c.distinct <= 200)
    .sort((a, b) => score(a) - score(b));
  function score(c) { const d = c.distinct; return d <= 12 ? Math.abs(d - 6) : d; }

  const charts = [];
  const primary = nums[0] || null;
  const pAgg = primary ? defaultAgg(primary) : 'count';

  // Cifras clave
  charts.push({ id: newId(), type: 'kpi', agg: 'count', measure: null });
  for (const c of nums.slice(0, 3)) charts.push({ id: newId(), type: 'kpi', agg: defaultAgg(c), measure: c.name });

  // Evolución temporal
  if (dates.length) {
    charts.push({ id: newId(), type: primary ? (pAgg === 'mean' ? 'line' : 'area') : 'column', dim: dates[0].name, measure: primary?.name ?? null, agg: pAgg, bucket: 'auto', split: null, size: 'wide' });
  }
  // Reparto por categoría
  if (cats[0]) {
    charts.push({ id: newId(), type: 'bar', dim: cats[0].name, measure: primary?.name ?? null, agg: pAgg, topN: 10, sort: 'value', size: 'half' });
  }
  // Distribución
  const histCol = nums.find((c) => c !== primary && RATE.test(c.name)) || primary;
  if (histCol) charts.push({ id: newId(), type: 'histogram', measure: histCol.name, size: 'half' });
  // Segunda categoría por recuento
  if (cats[1] && cats[1].distinct <= 20) {
    charts.push({ id: newId(), type: cats[1].distinct > 8 ? 'bar' : 'column', dim: cats[1].name, measure: null, agg: 'count', topN: Math.min(20, cats[1].distinct), sort: 'value', split: null, size: 'half' });
  }
  // Evolución separada por una categoría pequeña: aquí se ven las tintas superpuestas.
  const small = cats.find((c) => c.distinct >= 2 && c.distinct <= 4);
  if (dates.length && small) {
    charts.push({ id: newId(), type: 'line', dim: dates[0].name, measure: primary?.name ?? null, agg: pAgg, bucket: 'auto', split: small.name, size: cats[1] ? 'half' : 'wide' });
  }
  if (!dates.length && nums.length >= 2) {
    charts.push({ id: newId(), type: 'scatter', x: nums[0].name, y: nums[1].name, size: 'half' });
  }
  if (!cats.length && !dates.length && !nums.length) {
    const any = dimCols(ds)[0];
    if (any) charts.push({ id: newId(), type: 'bar', dim: any.name, measure: null, agg: 'count', topN: 12, sort: 'value', size: 'wide' });
  }
  // Ajusta anchos: si queda un medio suelto al final, se hace completo.
  const halves = charts.filter((c) => c.type !== 'kpi' && c.size === 'half');
  if (halves.length % 2 === 1) halves[halves.length - 1].size = 'wide';
  return charts;
}

// Gráfico nuevo con valores por defecto razonables.
export function blankChart(ds, type = 'bar') {
  const nums = measureCols(ds);
  const dates = dateCols(ds);
  const cats = dimCols(ds).filter((c) => c.type === 'category');
  const m = nums[0];
  const base = { id: newId(), type, size: 'half' };
  if (type === 'kpi') return { ...base, agg: m ? defaultAgg(m) : 'count', measure: m?.name ?? null };
  if (type === 'histogram') return { ...base, measure: m?.name ?? null };
  if (type === 'scatter') return { ...base, x: nums[0]?.name ?? null, y: nums[1]?.name ?? nums[0]?.name ?? null };
  const dim = type === 'line' || type === 'area' ? (dates[0] || cats[0]) : (cats[0] || dates[0]);
  return { ...base, dim: dim?.name ?? null, measure: m?.name ?? null, agg: m ? defaultAgg(m) : 'count', bucket: 'auto', topN: 10, sort: 'value', split: null };
}

// Comprueba si la configuración encaja con el conjunto actual. Devuelve null o un mensaje.
export function chartProblem(ds, c) {
  const col = (name) => { const j = colIndex(ds, name); return j < 0 ? null : ds.columns[j]; };
  const needNum = (name) => { const k = col(name); return k && k.type === 'number' ? null : name ? t('chart.missing', { col: name }) : t('chart.needNumber'); };
  if (c.type === 'kpi') return c.agg === 'count' ? null : needNum(c.measure);
  if (c.type === 'histogram') return needNum(c.measure);
  if (c.type === 'scatter') return needNum(c.x) || needNum(c.y);
  if (!c.dim) return t('chart.needDim');
  const d = col(c.dim);
  if (!d) return t('chart.missing', { col: c.dim });
  if (d.type === 'number') return t('chart.missing', { col: c.dim });
  if ((c.type === 'line' || c.type === 'area') && d.type !== 'date') return t('chart.needDate');
  if (c.agg !== 'count') return needNum(c.measure);
  return null;
}

export function measureLabel(c) {
  return c.agg === 'count' || !c.measure ? t('aggof.count') : t(`aggof.${c.agg}`, { col: c.measure });
}

export function autoTitle(c, bucketUsed) {
  if (c.title) return c.title;
  if (c.type === 'kpi') return c.agg === 'count' ? t('title.count') : measureLabel(c);
  if (c.type === 'histogram') return t('title.hist', { col: c.measure ?? '' });
  if (c.type === 'scatter') return t('title.scatter', { x: c.x ?? '', y: c.y ?? '' });
  const what = measureLabel(c);
  if (bucketUsed) {
    const b = t(`bucket.${bucketUsed}`).toLowerCase();
    return c.split ? t('title.bySplit', { what, dim: b, split: c.split }) : t('title.byTime', { what, bucket: b });
  }
  return c.split ? t('title.bySplit', { what, dim: c.dim ?? '', split: c.split }) : t('title.by', { what, dim: c.dim ?? '' });
}
