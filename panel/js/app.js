// Tirada: orquesta la importación, el panel, los filtros y el guardado.
import { t, getLang, setLang, applyI18n, fmtNum, fmtInt, fmtDate, fmtBucket, fmtBytes } from './i18n.js';
import { decodeBuffer, readCSVText, ImportError } from './parse-csv.js';
import {
  buildDataset, retype, colIndex, filterRows, aggregate, histogram, scatter, kpiValue, allIndex,
  distinctCounts, columnRange, bucketNext, EMPTY_KEY, OTHERS_KEY, AGGS, filterIsValid,
} from './data.js';
import { proposePanel, blankChart, chartProblem, autoTitle, measureLabel, measureCols, dateCols, dimCols, newId } from './auto.js';
import { drawChart, legendSwatch, keyLabel, emptyPlate, SERIES, INK } from './charts.js';
import { tableRows, renderTable } from './table.js';
import { putSource, getSource, putPanel, getPanel, listPanels, deletePanel, pruneSources, DRAFT_ID } from './store.js';
import { SAMPLES } from './samples.js';
import { filteredCSV, renderPNG, renderPDF, download, safeName } from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_BYTES = 150 * 1024 * 1024;

const S = {
  source: null,
  ds: null,
  panel: null,
  idx: null,
  filterKey: '',
  editing: null,
  showData: new Set(),
  printed: new Set(),
  lastW: new Map(),
};

// ---------- grano y papel ----------
function makeGrain() {
  const size = 192;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < size * size; i++) {
    // la tinta cubre casi todo; unas motas dejan ver el papel y la densidad varía un poco
    const r = rnd();
    let v = 255 - Math.floor(rnd() * 26);
    if (r < 0.05) v = 60 + Math.floor(rnd() * 90);
    else if (r < 0.065) v = 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  $('#riso-grain-img').setAttribute('href', url);

  // Papel: fibras muy suaves.
  const pv = document.createElement('canvas');
  pv.width = pv.height = 240;
  const p = pv.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * 0.05;
    p.fillStyle = rnd() < 0.5 ? `rgba(61,85,136,${a})` : `rgba(120,110,90,${a})`;
    p.fillRect(rnd() * 240, rnd() * 240, 1, 1);
  }
  for (let i = 0; i < 60; i++) {
    p.strokeStyle = `rgba(110,100,80,${0.025 + rnd() * 0.03})`;
    p.lineWidth = 0.6;
    p.beginPath();
    const x = rnd() * 240, y = rnd() * 240, ang = rnd() * Math.PI, len = 4 + rnd() * 10;
    p.moveTo(x, y); p.quadraticCurveTo(x + Math.cos(ang) * len * 0.6 + rnd() * 2, y + Math.sin(ang) * len * 0.6, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    p.stroke();
  }
  window.__risoPaperTile = pv;
  document.documentElement.style.setProperty('--paper-tex', `url(${pv.toDataURL('image/png')})`);
  // máscara de grano para los textos sobreimpresos (blanco = tinta)
  const mv = document.createElement('canvas');
  mv.width = mv.height = size;
  const m = mv.getContext('2d');
  const mi = m.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = img.data[i * 4];
    mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = 0;
    mi.data[i * 4 + 3] = v;
  }
  m.putImageData(mi, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${mv.toDataURL('image/png')})`);
}

// ---------- avisos ----------
let toastTimer = null;
function toast(msg, action) {
  const el = $('#toast');
  $('#toastText').textContent = msg;
  const btn = $('#toastAct');
  if (action) { btn.hidden = false; btn.textContent = action.label; btn.onclick = () => { el.hidden = true; action.run(); }; }
  else btn.hidden = true;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 7000 : 3600);
}

function confirmBox(text, yesLabel) {
  const dlg = $('#dlgConfirm');
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = yesLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((res) => dlg.addEventListener('close', () => res(dlg.returnValue === 'yes'), { once: true }));
}

// ---------- importación ----------
let xlsxLoading = null;
function loadXlsxLib() {
  if (window.readXlsxFile) return Promise.resolve(window.readXlsxFile);
  if (!xlsxLoading) {
    xlsxLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/read-excel-file.min.js';
      s.onload = () => (window.readXlsxFile ? res(window.readXlsxFile) : rej(new Error('lib')));
      s.onerror = () => { xlsxLoading = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  return xlsxLoading;
}

function cleanXlsxRows(data) {
  const rows = data.map((r) => r.map((v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v)));
  // quita filas y columnas vacías del final
  while (rows.length && rows[rows.length - 1].every((v) => v === '')) rows.pop();
  let width = 0;
  for (const r of rows) for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '') { width = Math.max(width, j + 1); break; }
  return rows.filter((r) => r.some((v) => v !== '')).map((r) => r.slice(0, width));
}

async function readFile(file) {
  const name = file.name || 'datos';
  if (file.size > MAX_BYTES) throw Object.assign(new ImportError('tooBig'), { size: fmtBytes(file.size) });
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'xls') throw new ImportError('oldXls');
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4;
  if (ext === 'xlsx' || ext === 'xlsm' || isZip) {
    let sheets;
    try {
      const read = await loadXlsxLib();
      sheets = await read(buf);
    } catch (e) {
      throw new ImportError(isZip ? 'xlsx' : 'binary');
    }
    const sheet = (sheets || []).find((s) => s.data && s.data.some((r) => r.some((v) => v !== null && v !== ''))) || (sheets || [])[0];
    if (!sheet) throw new ImportError('empty');
    const rows = cleanXlsxRows(sheet.data);
    if (!rows.length) throw new ImportError('empty');
    return { name, kind: 'xlsx', sheet: sheet.sheet, rows, size: file.size };
  }
  const { text, encoding } = decodeBuffer(buf);
  const { rows, delimiter } = readCSVText(text);
  return { name, kind: 'csv', encoding, delimiter, rows, size: file.size };
}

function showImportError(code, name, extra = {}) {
  const box = $('#importError');
  box.textContent = t(`err.${code}`, { name, ...extra });
  if (box.textContent === `err.${code}`) box.textContent = t('err.generic', { name });
  box.hidden = false;
}

async function handleFile(file) {
  const drop = $('#drop');
  $('#importError').hidden = true;
  $('#importStatus').textContent = t('start.reading', { name: file.name });
  drop.classList.add('is-busy');
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const src = await readFile(file);
    await openSource({ ...src, id: `s${Date.now().toString(36)}`, sample: false }, null);
    toast(t('toast.loaded', { rows: fmtInt(S.ds.n), cols: S.ds.columns.length }));
  } catch (e) {
    const code = e instanceof ImportError ? e.code : 'generic';
    if (!(e instanceof ImportError)) console.warn(e);
    showImportError(code, file.name, { size: e.size });
  } finally {
    $('#importStatus').textContent = '';
    drop.classList.remove('is-busy');
  }
}

async function openSample(id) {
  const sample = SAMPLES.find((s) => s.id === id);
  const text = sample.build(getLang());
  const { rows, delimiter } = readCSVText(text);
  const name = t(`sample.${id}.name`);
  await openSource({ id: `s${Date.now().toString(36)}`, name, kind: 'csv', encoding: 'UTF-8', delimiter, rows, size: text.length, sample: true }, null);
}

// Construye el conjunto y el panel; guarda borrador para poder seguir tras recargar.
async function openSource(source, saved) {
  const opts = saved?.config?.opts || { header: 'auto', decimal: 'auto', dateOrder: 'auto', types: {} };
  const ds = buildDataset(source, opts, (i) => `${getLang() === 'en' ? 'Column' : 'Columna'} ${i}`);
  if (!ds.n) throw new ImportError('noRows');
  S.source = source;
  S.ds = ds;
  S.panel = saved
    ? { id: saved.id === DRAFT_ID ? saved.panelId || null : saved.id, name: saved.name, ...structuredClone(saved.config) }
    : { id: null, name: source.name.replace(/\.(csv|tsv|txt|xlsx)$/i, ''), charts: proposePanel(ds), filters: [], opts, table: { sort: null, search: '', page: 0 } };
  S.panel.table = S.panel.table || { sort: null, search: '', page: 0 };
  S.panel.table.page = 0;
  S.editing = null;
  S.showData.clear();
  S.printed.clear();
  showBoard();
  render(true);
  if (!saved || saved.id !== DRAFT_ID) {
    await putSource(source);
    saveDraft(true);
  }
}

// ---------- borrador automático ----------
let draftTimer = null;
function saveDraft(now = false) {
  clearTimeout(draftTimer);
  const run = async () => {
    if (!S.panel || !S.source) return;
    await putPanel({
      id: DRAFT_ID, panelId: S.panel.id, name: S.panel.name, savedAt: Date.now(), sourceId: S.source.id,
      rows: S.ds.n, config: panelConfig(),
    });
    pruneSources();
  };
  if (now) run(); else draftTimer = setTimeout(run, 600);
}

function panelConfig() {
  const { charts, filters, opts, table } = S.panel;
  return structuredClone({ charts, filters, opts, table: { sort: table.sort, search: table.search, page: 0 } });
}

// ---------- vistas ----------
function showBoard() {
  $('#start').hidden = true;
  $('#board').hidden = false;
  window.scrollTo(0, 0);
}

async function showStart() {
  S.ds = null; S.source = null; S.panel = null;
  $('#board').hidden = true;
  $('#start').hidden = false;
  closeMenus();
  await renderStart();
  printHero();
}

function printHero() {
  const h = $('#startTitle');
  const ink = h.querySelector('.hero-ink');
  ink.classList.add('ink-over');
  ink.dataset.text = ink.textContent;
  h.classList.remove('print');
  void h.offsetWidth;
  h.classList.add('print');
}

const SAMPLE_ART = {
  shop: `<svg viewBox="0 0 76 60" aria-hidden="true"><rect x="6" y="30" width="12" height="26" fill="${INK.pink}" style="mix-blend-mode:multiply"/><rect x="24" y="14" width="12" height="42" fill="${INK.pink}" style="mix-blend-mode:multiply"/><rect x="42" y="22" width="12" height="34" fill="${INK.pink}" style="mix-blend-mode:multiply"/><path d="M2 40 L22 20 L40 30 L58 8 L74 14 V58 H2Z" fill="${INK.yellow}" style="mix-blend-mode:multiply"/><path d="M2 40 L22 20 L40 30 L58 8 L74 14" fill="none" stroke="${INK.blue}" stroke-width="2.2"/><path d="M2 57h72" stroke="${INK.blue}" stroke-width="1.6"/></svg>`,
  library: `<svg viewBox="0 0 76 60" aria-hidden="true"><rect x="4" y="6" width="44" height="10" fill="${INK.pink}" style="mix-blend-mode:multiply"/><rect x="4" y="20" width="62" height="10" fill="${INK.pink}" style="mix-blend-mode:multiply"/><rect x="4" y="34" width="30" height="10" fill="${INK.pink}" style="mix-blend-mode:multiply"/><rect x="18" y="12" width="40" height="40" rx="20" fill="${INK.yellow}" style="mix-blend-mode:multiply"/><path d="M4 2v54" stroke="${INK.blue}" stroke-width="2"/><path d="M8 52h60" stroke="${INK.blue}" stroke-width="1.6" stroke-dasharray="3 3"/></svg>`,
};

async function renderStart() {
  $('#sampleList').innerHTML = SAMPLES.map((s) => `
    <button type="button" class="sample" data-sample="${s.id}">
      ${SAMPLE_ART[s.id]}
      <span><strong>${esc(t(`sample.${s.id}.name`))}</strong><span>${esc(t(`sample.${s.id}.desc`))}</span></span>
    </button>`).join('');
  const [panels, draft] = await Promise.all([listPanels(), getPanel(DRAFT_ID)]);
  $('#resume').innerHTML = draft ? `<button type="button" class="btn" data-resume>
    <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/></svg>
    <span>${esc(t('start.resume'))}: ${esc(draft.name)}</span></button>` : '';
  $('#savedList').innerHTML = panels.length ? panels.map((p) => `
    <li class="saved-item">
      <div><strong>${esc(p.name)}</strong><span class="meta">${esc(t('saved.rows', { n: fmtInt(p.rows) }))}, ${esc(t('saved.when', { date: fmtDate(p.savedAt, true) }))}</span></div>
      <div class="acts">
        <button type="button" class="btn small" data-open="${esc(p.id)}">${esc(t('saved.open'))}</button>
        <button type="button" class="btn small danger" data-del="${esc(p.id)}" aria-label="${esc(t('saved.delete'))}: ${esc(p.name)}">${esc(t('saved.delete'))}</button>
      </div>
    </li>`).join('') : `<li class="note">${esc(t('start.savedEmpty'))}</li>`;
}

async function openSaved(id) {
  const p = await getPanel(id);
  if (!p) { renderStart(); return; }
  const src = await getSource(p.sourceId);
  if (!src) { showImportError('generic', p.name); return; }
  try {
    await openSource(src, p);
    if (id !== DRAFT_ID) saveDraft(true);
  } catch (e) {
    console.warn(e);
    showImportError('generic', p.name);
  }
}

// ---------- render del panel ----------
function filterLabel(f) {
  const j = colIndex(S.ds, f.col);
  const col = S.ds.columns[j];
  if (f.kind === 'in') {
    const vals = f.values.map((v) => (v === EMPTY_KEY ? t('chart.emptyValue') : v));
    return vals.length <= 2 ? t('filters.in', { col: f.col, values: vals.join(', ') }) : t('filters.inMany', { col: f.col, n: vals.length });
  }
  const fmt = (v) => (col?.type === 'date' ? fmtDate(v) : fmtNum(v, col?.unit));
  if (f.min != null && f.max != null) return t('filters.range', { col: f.col, min: fmt(f.min), max: fmt(f.max) });
  if (f.min != null) return t('filters.from', { col: f.col, min: fmt(f.min) });
  return t('filters.to', { col: f.col, max: fmt(f.max) });
}

function activeFilters() { return S.panel.filters.filter((f) => filterIsValid(S.ds, f)); }

function render(first = false, reprint = false) {
  const ds = S.ds;
  const filters = activeFilters();
  S.filterKey = JSON.stringify(filters);
  S.idx = filters.length ? filterRows(ds, filters) : allIndex(ds);
  renderHead(filters);
  renderChips(filters);
  renderKpis(first);
  renderCharts(first, reprint);
  renderTableNow();
}

function renderHead(filters) {
  $('#boardTitle').textContent = S.panel.name;
  const meta = [];
  meta.push(`<span>${esc(filters.length ? t('board.rows', { shown: fmtInt(S.idx.length), total: fmtInt(S.ds.n) }) : t('board.rowsAll', { total: fmtInt(S.ds.n) }))}</span>`);
  if (S.source.name !== S.panel.name) meta.push(`<span>${esc(S.source.name)}</span>`);
  if (S.source.sample) meta.push(`<span class="badge">${esc(t('sample.badge'))}</span>`);
  $('#boardMeta').innerHTML = meta.join('');
  const fc = $('#filterCount');
  fc.hidden = !filters.length;
  fc.textContent = filters.length;
  document.title = `${S.panel.name} — Tirada`;
}

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function renderChips(filters) {
  const el = $('#chips');
  if (!filters.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="sr">${esc(t('filters.active'))}</span>` + filters.map((f) => {
    const label = filterLabel(f);
    return `<span class="chip"><span>${esc(label)}</span><button type="button" data-unfilter="${esc(f.id)}" aria-label="${esc(t('filters.remove', { label }))}">${X_ICON}</button></span>`;
  }).join('') + (filters.length > 1 ? `<button type="button" class="chip clear" data-clearall>${esc(t('board.clearFilters'))}</button>` : '');
}

const PEN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>';

function renderKpis(first) {
  const kpis = S.panel.charts.filter((c) => c.type === 'kpi');
  const filtered = S.idx.length !== S.ds.n;
  const all = filtered ? allIndex(S.ds) : null;
  $('#kpis').innerHTML = kpis.map((c) => {
    const problem = chartProblem(S.ds, c);
    const title = autoTitle(c);
    let value = '', sub = '';
    if (!problem) {
      const unit = c.agg === 'count' ? '' : S.ds.columns[colIndex(S.ds, c.measure)].unit;
      const v = kpiValue(S.ds, S.idx, c.measure, c.agg);
      value = fmtNum(v, unit);
      if (c.agg === 'count') sub = filtered ? t('chart.kpiOf', { total: fmtInt(S.ds.n) }) : '';
      else if (filtered) sub = t('chart.kpiFiltered', { v: fmtNum(kpiValue(S.ds, all, c.measure, c.agg), unit) });
      else sub = t('chart.kpiOf', { total: fmtInt(S.ds.n) });
    }
    return `<div class="kpi${problem ? ' is-error' : ''}" data-id="${c.id}">
      <div class="kpi-label">${esc(title)}</div>
      <span class="kpi-value ink-over" data-text="${esc(problem ? '' : value)}">${esc(problem || value)}</span>
      <div class="kpi-sub">${esc(sub)}</div>
      <button type="button" class="btn icon" data-edit="${c.id}" aria-label="${esc(t('chart.edit'))}: ${esc(title)}" aria-expanded="${S.editing === c.id}">${PEN}</button>
    </div>`;
  }).join('');
  if (first && !reduced()) $('#kpis').querySelectorAll('.kpi').forEach((k, i) => { k.style.setProperty('animation-delay', `${i * 60}ms`); k.classList.add('print'); });
  const ed = $('#kpiEditor');
  const editingKpi = kpis.find((c) => c.id === S.editing);
  ed.innerHTML = editingKpi ? editorHTML(editingKpi) : '';
}

// Datos para un gráfico, con filtro cruzado: un gráfico de barras ignora el filtro de su propia columna
// y en su lugar resalta lo seleccionado.
function chartData(c) {
  const ds = S.ds;
  if (c.type === 'histogram') return { res: histogram(ds, S.idx, c.measure) };
  if (c.type === 'scatter') return { res: scatter(ds, S.idx, c.x, c.y) };
  const dcol = ds.columns[colIndex(ds, c.dim)];
  let idx = S.idx, selected = null;
  if (dcol.type !== 'date') {
    const own = activeFilters().filter((f) => f.col === c.dim && f.kind === 'in');
    if (own.length) {
      idx = filterRows(ds, activeFilters(), c.dim);
      selected = new Set(own[0].values);
    }
  }
  const res = aggregate(ds, idx, c);
  return { res, selected };
}

function chartHeight(c, W) {
  if (c.size === 'wide' && W > 700) return 320;
  return W < 420 ? 240 : 280;
}

function sheetEl(c) {
  let el = document.querySelector(`.sheet[data-id="${c.id}"]`);
  if (!el) {
    el = document.createElement('article');
    el.className = 'sheet';
    el.dataset.id = c.id;
    el.innerHTML = `<div class="sheet-head"><h3 class="sheet-title"></h3><div class="sheet-acts"></div></div>
      <div class="plot"></div><div class="legend"></div><p class="sheet-note"></p><div class="datatable" hidden></div><div class="editor-slot"></div>`;
  }
  return el;
}

function renderCharts(first, reprint) {
  const grid = $('#grid');
  const charts = S.panel.charts.filter((c) => c.type !== 'kpi');
  $('#gridEmpty').hidden = charts.length > 0;
  $('#gridEmpty').textContent = t('board.noCharts');
  const keep = new Set(charts.map((c) => c.id));
  grid.querySelectorAll('.sheet').forEach((el) => { if (!keep.has(el.dataset.id)) el.remove(); });
  charts.forEach((c, i) => {
    const el = sheetEl(c);
    if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
    el.classList.toggle('wide', c.size === 'wide');
  });
  // medir después de colocar
  charts.forEach((c) => renderSheet(c, { first: first || !S.printed.has(c.id), reprint }));
}

function renderSheet(c, { first = false, reprint = false } = {}) {
  const el = sheetEl(c);
  const plot = el.querySelector('.plot');
  const W = Math.max(260, Math.floor(plot.clientWidth || el.clientWidth || 600));
  S.lastW.set(c.id, W);
  const problem = chartProblem(S.ds, c);
  let res = null, selected = null, bucket = null;
  if (!problem) {
    try { ({ res, selected } = chartData(c)); bucket = res.bucket || null; } catch (e) { console.warn(e); }
  }
  const title = autoTitle(c, res?.kind === 'time' ? bucket : null);
  el.querySelector('.sheet-title').textContent = title;
  const editing = S.editing === c.id;
  const showing = S.showData.has(c.id);
  el.querySelector('.sheet-acts').innerHTML = `
    <button type="button" class="btn" data-showdata="${c.id}" aria-pressed="${showing}" ${problem ? 'disabled' : ''}>${esc(showing ? t('chart.hideData') : t('chart.data'))}</button>
    <button type="button" class="btn" data-edit="${c.id}" aria-expanded="${editing}">${PEN}<span>${esc(editing ? t('chart.done') : t('chart.edit'))}</span></button>`;
  const H = chartHeight(c, W);
  const legend = el.querySelector('.legend');
  const note = el.querySelector('.sheet-note');
  const table = el.querySelector('.datatable');
  legend.innerHTML = ''; note.textContent = '';
  plot.classList.remove('selectable');
  plot._meta = null;

  const isEmpty = res && (res.series ? !res.keys.length : res.bins ? !res.bins.length : res.pts ? !res.pts.length : false);
  if (problem || !res || isEmpty) {
    const msg = problem || (res ? t('chart.empty') : t('chart.missing', { col: c.dim || c.measure || '' }));
    plot.innerHTML = emptyPlate(W, Math.min(H, 220), msg) + `<div class="plate-msg"><p>${esc(msg)}</p>${!problem && activeFilters().length ? `<button type="button" class="btn small" data-clearall>${esc(t('chart.emptyAction'))}</button>` : ''}</div>`;
    table.hidden = true;
  } else {
    const ctx = {
      title, height: H, selected,
      unit: c.agg === 'count' ? '' : (S.ds.columns[colIndex(S.ds, c.measure)]?.unit || ''),
      measureLabel: measureLabel(c),
      valueTitle: '', dimTitle: '',
    };
    if (c.type === 'histogram') {
      ctx.unit = S.ds.columns[colIndex(S.ds, c.measure)].unit;
      ctx.dimTitle = c.measure;
    } else if (c.type === 'scatter') {
      ctx.unitX = S.ds.columns[colIndex(S.ds, c.x)].unit; ctx.unitY = S.ds.columns[colIndex(S.ds, c.y)].unit;
      ctx.valueTitle = c.y; ctx.dimTitle = c.x;
    } else {
      ctx.valueTitle = measureLabel(c) + (ctx.unit ? ` (${ctx.unit})` : '');
      ctx.dimTitle = res.kind === 'time' ? `${c.dim} (${t(`bucket.${bucket}`).toLowerCase()})` : c.dim;
    }
    const out = drawChart(W, c, res, ctx);
    plot.innerHTML = out.svg;
    plot._meta = { ...out, chart: c, res };
    plot.classList.toggle('selectable', !!out.selectable);
    const svg = plot.querySelector('svg');
    if (!reduced()) {
      if (first) { svg.classList.add('print'); S.printed.add(c.id); }
      else if (reprint) svg.classList.add('reprint');
    } else S.printed.add(c.id);

    // leyenda y notas
    if (res.series && res.series.length > 1) {
      legend.innerHTML = res.series.map((s, si) => `<span>${legendSwatch(si, c.type)}${esc(keyLabel(s.key, 'category'))}</span>`).join('');
    }
    const notes = [];
    if (res.others) notes.push(t('chart.notePlus', { shown: res.keys.length - 1, n: res.others }));
    if (res.seriesOthers) notes.push(t('chart.noteSeries', { n: res.seriesOthers }));
    if (res.pts && res.total > res.pts.length) notes.push(t('chart.noteSample', { shown: fmtInt(res.pts.length), total: fmtInt(res.total) }));
    note.textContent = notes.join(' ');
    // tabla de datos accesible
    table.hidden = !showing;
    if (showing) table.innerHTML = dataTableHTML(c, res, ctx);
  }
  el.querySelector('.editor-slot').innerHTML = editing ? editorHTML(c) : '';
}

function dataTableHTML(c, res, ctx) {
  if (res.bins) {
    return `<table><thead><tr><th>${esc(c.measure)}</th><th class="num">${esc(t('axis.freq'))}</th></tr></thead><tbody>${res.bins.map((b) => `<tr><td>${res.integer ? esc(fmtNum(b.x0 + 0.5, ctx.unit)) : `${esc(fmtNum(b.x0, ctx.unit))} – ${esc(fmtNum(b.x1, ctx.unit))}`}</td><td class="num">${fmtInt(b.count)}</td></tr>`).join('')}</tbody></table>`;
  }
  if (res.pts) {
    return `<table><thead><tr><th class="num">${esc(c.x)}</th><th class="num">${esc(c.y)}</th></tr></thead><tbody>${res.pts.slice(0, 300).map((p) => `<tr><td class="num">${esc(fmtNum(p[0], ctx.unitX))}</td><td class="num">${esc(fmtNum(p[1], ctx.unitY))}</td></tr>`).join('')}</tbody></table>`;
  }
  const head = res.series.length > 1 ? res.series.map((s) => `<th class="num">${esc(keyLabel(s.key, 'category'))}</th>`).join('') : `<th class="num">${esc(ctx.measureLabel)}</th>`;
  const rows = res.keys.map((k, i) => `<tr><td>${esc(keyLabel(k, res.kind, res.bucket))}</td>${res.series.map((s) => `<td class="num">${esc(fmtNum(s.values[i], ctx.unit))}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr><th>${esc(c.dim)}</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTableNow() {
  const rows = tableRows(S.ds, S.idx, S.panel.table, S.filterKey);
  renderTable($('#tableWrap'), S.ds, rows, S.panel.table);
  const search = $('#tableSearch');
  if (document.activeElement !== search) search.value = S.panel.table.search || '';
}

// ---------- editor de gráfico ----------
function opt(v, label, cur) { return `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`; }
function sel(name, label, options, full = false) {
  return `<label class="field${full ? ' full' : ''}"><span>${esc(label)}</span><select data-field="${name}">${options}</select></label>`;
}

function editorHTML(c) {
  const ds = S.ds;
  const nums = measureCols(ds).concat(ds.columns.filter((k) => k.type === 'number' && k.idLike));
  const dates = dateCols(ds);
  const cats = dimCols(ds);
  let f = '';
  if (c.type !== 'kpi') {
    f += sel('type', t('chart.type'), ['bar', 'column', 'line', 'area', 'histogram', 'scatter'].map((ty) => opt(ty, t(`ctype.${ty}`), c.type)).join(''));
  }
  const measureOpts = (cur, withCount) => (withCount ? opt('__count', t('chart.countRows'), cur ?? '__count') : '') + nums.map((k) => opt(k.name, k.name, cur)).join('');
  if (c.type === 'kpi' || ['bar', 'column', 'line', 'area'].includes(c.type)) {
    if (c.type !== 'kpi') {
      const dimList = c.type === 'line' || c.type === 'area' ? dates : cats.concat(dates);
      f += sel('dim', t('chart.dim'), (c.dim && !dimList.some((k) => k.name === c.dim) ? opt('', '—', '') : '') + dimList.map((k) => opt(k.name, `${k.name} (${t(`type.${k.type}`).toLowerCase()})`, c.dim)).join(''));
    }
    f += sel('measure', t('chart.measure'), measureOpts(c.agg === 'count' ? '__count' : c.measure, true));
    if (c.agg !== 'count') f += sel('agg', t('chart.agg'), AGGS.filter((a) => a !== 'count').map((a) => opt(a, t(`agg.${a}`), c.agg)).join(''));
  }
  if (['bar', 'column', 'line', 'area'].includes(c.type)) {
    const dcol = ds.columns[colIndex(ds, c.dim)];
    if (dcol?.type === 'date') f += sel('bucket', t('chart.bucket'), ['auto', 'day', 'week', 'month', 'quarter', 'year'].map((b) => opt(b, t(`bucket.${b}`), c.bucket || 'auto')).join(''));
    else {
      f += sel('topN', t('chart.topN'), [5, 8, 10, 12, 15, 20, 30, 50].map((n) => opt(n, String(n), c.topN || 10)).join(''));
      f += sel('sort', t('chart.sort'), opt('value', t('chart.sortValue'), c.sort || 'value') + opt('label', t('chart.sortLabel'), c.sort || 'value'));
    }
    if (c.type !== 'bar') f += sel('split', t('chart.split'), opt('', t('chart.splitNone'), c.split || '') + cats.filter((k) => k.name !== c.dim && k.type === 'category').map((k) => opt(k.name, k.name, c.split || '')).join(''));
  }
  if (c.type === 'histogram') f += sel('measure', t('chart.column'), measureOpts(c.measure, false));
  if (c.type === 'scatter') {
    f += sel('x', t('chart.x'), measureOpts(c.x, false));
    f += sel('y', t('chart.y'), measureOpts(c.y, false));
  }
  f += `<label class="field"><span>${esc(t('chart.titleField'))}</span><input type="text" data-field="title" value="${esc(c.title || '')}" placeholder="${esc(autoTitle({ ...c, title: '' }))}" maxlength="90"></label>`;
  if (c.type !== 'kpi') {
    f += `<div class="field"><span id="sz-${c.id}">${esc(t('chart.size'))}</span><div class="seg" role="group" aria-labelledby="sz-${c.id}">
      <button type="button" data-size="half" aria-pressed="${c.size !== 'wide'}">${esc(t('chart.sizeHalf'))}</button>
      <button type="button" data-size="wide" aria-pressed="${c.size === 'wide'}">${esc(t('chart.sizeWide'))}</button></div></div>`;
  }
  f += `<div class="editor-acts"><div class="grp">
      <button type="button" class="btn small" data-move="-1">${esc(t('chart.moveUp'))}</button>
      <button type="button" class="btn small" data-move="1">${esc(t('chart.moveDown'))}</button>
      <button type="button" class="btn small danger" data-remove>${esc(t('chart.remove'))}</button></div>
      <button type="button" class="btn small primary" data-edit="${c.id}">${esc(t('chart.done'))}</button></div>`;
  return `<div class="editor" data-editor="${c.id}" role="group" aria-label="${esc(t('chart.edit'))}">${f}</div>`;
}

function findChart(id) { return S.panel.charts.find((c) => c.id === id); }

function normalize(c) {
  const ds = S.ds;
  const col = (n) => ds.columns[colIndex(ds, n)];
  if (['line', 'area'].includes(c.type) && col(c.dim)?.type !== 'date') c.dim = dateCols(ds)[0]?.name ?? c.dim;
  if (['bar', 'column', 'line', 'area'].includes(c.type)) {
    if (!c.dim) c.dim = (dimCols(ds)[0] || dateCols(ds)[0])?.name ?? null;
    if (!c.agg) c.agg = 'count';
    if (c.type === 'bar') c.split = null;
    if (!c.topN) c.topN = 10;
  }
  if (c.type === 'histogram' && col(c.measure)?.type !== 'number') c.measure = measureCols(ds)[0]?.name ?? null;
  if (c.type === 'scatter') {
    const nums = measureCols(ds);
    if (col(c.x)?.type !== 'number') c.x = nums[0]?.name ?? null;
    if (col(c.y)?.type !== 'number') c.y = nums[1]?.name ?? nums[0]?.name ?? null;
  }
}

function updateChart(id, field, value) {
  const c = findChart(id);
  if (!c) return;
  if (field === 'measure') {
    if (value === '__count') { c.agg = 'count'; c.measure = null; }
    else { c.measure = value; if (c.agg === 'count' || !c.agg) c.agg = 'sum'; }
  } else if (field === 'topN') c.topN = +value;
  else if (field === 'split') c.split = value || null;
  else if (field === 'title') c.title = value.trim();
  else c[field] = value;
  if (field === 'type') normalize(c);
  if (field === 'dim') { c.bucket = 'auto'; if (c.split === value) c.split = null; }
  rerenderOne(c, field !== 'title');
  saveDraft();
}

function rerenderOne(c, reprint = true) {
  if (c.type === 'kpi') { renderKpis(false); return; }
  const focusField = document.activeElement?.dataset?.field;
  renderSheet(c, { first: false, reprint });
  if (focusField) document.querySelector(`.sheet[data-id="${c.id}"] [data-field="${focusField}"]`)?.focus();
}

function addChart(type) {
  const c = blankChart(S.ds, type);
  normalize(c);
  S.panel.charts.push(c);
  S.editing = c.id;
  if (type === 'kpi') renderKpis(true);
  else renderCharts(false);
  saveDraft();
  const target = type === 'kpi' ? $('#kpiEditor') : document.querySelector(`.sheet[data-id="${c.id}"]`);
  target?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  target?.querySelector('select, input')?.focus({ preventScroll: true });
}

function removeChart(id) {
  const i = S.panel.charts.findIndex((c) => c.id === id);
  if (i < 0) return;
  const [c] = S.panel.charts.splice(i, 1);
  if (S.editing === id) S.editing = null;
  render();
  saveDraft();
  toast(t('toast.removed'), { label: t('toast.undo'), run: () => { S.panel.charts.splice(i, 0, c); S.printed.delete(c.id); render(); saveDraft(); } });
}

function moveChart(id, dir) {
  const list = S.panel.charts;
  const c = findChart(id);
  const same = list.filter((k) => (k.type === 'kpi') === (c.type === 'kpi'));
  const pos = same.indexOf(c);
  const other = same[pos + dir];
  if (!other) return;
  const a = list.indexOf(c), b = list.indexOf(other);
  [list[a], list[b]] = [list[b], list[a]];
  if (c.type === 'kpi') renderKpis(false); else renderCharts(false);
  document.querySelector(`[data-editor="${id}"] [data-move="${dir}"]`)?.focus();
  saveDraft();
}

// ---------- filtros ----------
function setFilter(f) {
  const list = S.panel.filters;
  const i = list.findIndex((x) => x.col === f.col && x.kind === f.kind);
  if (i >= 0) list.splice(i, 1, { ...list[i], ...f });
  else list.push({ id: newId(), ...f });
}
function removeFilter(col, kind) {
  S.panel.filters = S.panel.filters.filter((x) => !(x.col === col && (!kind || x.kind === kind)));
}
function afterFilter() {
  S.panel.table.page = 0;
  render(false, true);
  saveDraft();
}

function toggleCategory(col, key) {
  const f = S.panel.filters.find((x) => x.col === col && x.kind === 'in');
  if (!f) setFilter({ col, kind: 'in', values: [key] });
  else {
    const set = new Set(f.values);
    if (set.has(key)) set.delete(key); else set.add(key);
    if (!set.size) removeFilter(col, 'in'); else f.values = [...set];
  }
  afterFilter();
}

function renderFiltersBody() {
  const ds = S.ds;
  const body = $('#filtersBody');
  const openSet = new Set([...body.querySelectorAll('details[open]')].map((d) => d.dataset.col));
  let html = '';
  for (const c of ds.columns) {
    const f = S.panel.filters.filter((x) => x.col === c.name && filterIsValid(ds, x));
    const on = f.length > 0;
    const tag = `<span class="tag${on ? ' on' : ''}">${esc(t(`type.${c.type}`))}</span>`;
    let inner = '';
    if (c.type === 'category' || c.type === 'text') {
      const counts = distinctCounts(ds, c.name);
      if (c.type === 'text' && counts.length > 300) { inner = `<p class="note">${esc(t('filters.empty'))}</p>`; }
      else {
        const fin = f.find((x) => x.kind === 'in');
        const chosen = fin ? new Set(fin.values) : null;
        const shown = counts.slice(0, 250);
        inner = `<label class="field"><span class="sr">${esc(t('filters.search'))}</span><input type="search" data-fsearch placeholder="${esc(t('filters.search'))}" autocomplete="off"></label>
          <div class="row-btns"><button type="button" class="btn small" data-fall>${esc(t('filters.all'))}</button><button type="button" class="btn small" data-fnone>${esc(t('filters.none'))}</button></div>
          <div class="checks">${shown.map(([k, n]) => `<label class="check" data-lab="${esc(String(k === EMPTY_KEY ? t('chart.emptyValue') : k).toLowerCase())}"><input type="checkbox" value="${esc(k)}" ${!chosen || chosen.has(k) ? 'checked' : ''}><span class="lab">${esc(k === EMPTY_KEY ? t('chart.emptyValue') : k)}</span><span class="n">${fmtInt(n)}</span></label>`).join('')}</div>
          ${counts.length > shown.length ? `<p class="note">${esc(t('filters.more', { n: fmtInt(counts.length - shown.length) }))}</p>` : ''}`;
      }
    } else {
      const fr = f.find((x) => x.kind === 'range');
      const [lo, hi] = columnRange(ds, c.name);
      if (!Number.isFinite(lo)) continue;
      if (c.type === 'date') {
        const iso = (v) => (v == null || !Number.isFinite(v) ? '' : new Date(v).toISOString().slice(0, 10));
        inner = `<div class="range2"><label class="field"><span>${esc(t('filters.min'))}</span><input type="date" data-rmin value="${iso(fr?.min)}" min="${iso(lo)}" max="${iso(hi)}"></label>
          <label class="field"><span>${esc(t('filters.max'))}</span><input type="date" data-rmax value="${iso(fr?.max != null ? fr.max - 86399999 : null)}" min="${iso(lo)}" max="${iso(hi)}"></label></div>`;
      } else {
        const show = (v) => (v == null ? '' : String(v).replace('.', getLang() === 'es' ? ',' : '.'));
        inner = `<div class="range2"><label class="field"><span>${esc(t('filters.min'))}</span><input type="text" inputmode="decimal" data-rmin value="${esc(show(fr?.min))}" placeholder="${esc(fmtNum(lo))}"></label>
          <label class="field"><span>${esc(t('filters.max'))}</span><input type="text" inputmode="decimal" data-rmax value="${esc(show(fr?.max))}" placeholder="${esc(fmtNum(hi))}"></label></div>`;
      }
    }
    html += `<details class="fgroup" data-col="${esc(c.name)}" data-type="${c.type}"${openSet.has(c.name) ? ' open' : ''}><summary><span>${esc(c.name)}</span>${tag}</summary><div class="fbody">${inner}</div></details>`;
  }
  body.innerHTML = html;
}

function readCheckFilter(group) {
  const col = group.dataset.col;
  const boxes = [...group.querySelectorAll('.checks input')];
  const total = distinctCounts(S.ds, col).length;
  const checked = boxes.filter((b) => b.checked).map((b) => b.value);
  const unchecked = boxes.filter((b) => !b.checked).length;
  if (!unchecked && boxes.length === total) removeFilter(col, 'in');
  else setFilter({ col, kind: 'in', values: checked });
  afterFilter();
  group.querySelector('.tag').classList.toggle('on', !!S.panel.filters.find((x) => x.col === col));
}

function readRangeFilter(group) {
  const col = group.dataset.col;
  const type = group.dataset.type;
  const a = group.querySelector('[data-rmin]').value.trim();
  const b = group.querySelector('[data-rmax]').value.trim();
  let min = null, max = null;
  if (type === 'date') {
    if (a) min = Date.parse(`${a}T00:00:00Z`);
    if (b) max = Date.parse(`${b}T00:00:00Z`) + 86399999;
  } else {
    const p = (s) => { if (!s) return null; const n = Number(s.replace(/\s/g, '').replace(getLang() === 'es' ? /\./g : /,/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    min = p(a); max = p(b);
  }
  if (min == null && max == null) removeFilter(col, 'range');
  else setFilter({ col, kind: 'range', min, max });
  afterFilter();
  group.querySelector('.tag').classList.toggle('on', !!S.panel.filters.find((x) => x.col === col));
}

// ---------- columnas ----------
function renderColsBody() {
  const ds = S.ds;
  const o = S.panel.opts;
  const src = S.source;
  const delimName = src.delimiter ? t(`delim.${src.delimiter}`) : '';
  let html = `<div class="cols-opts">
    <label class="switch"><input type="checkbox" data-opt="header" ${ds.header ? 'checked' : ''}><span>${esc(t('cols.header'))}</span></label>
    ${sel('decimal', t('cols.decimal'), opt('auto', t('cols.auto'), o.decimal) + opt(',', t('cols.comma'), o.decimal) + opt('.', t('cols.dot'), o.decimal)).replace('data-field', 'data-opt')}
    ${sel('dateOrder', t('cols.dateOrder'), opt('auto', t('cols.auto'), o.dateOrder) + opt('dmy', t('cols.dmy'), o.dateOrder) + opt('mdy', t('cols.mdy'), o.dateOrder)).replace('data-field', 'data-opt')}
    <div class="srcinfo"><strong>${esc(t('cols.source'))}: ${esc(src.name)}</strong>
      ${src.encoding ? `<span>${esc(t('cols.encoding', { v: src.encoding }))}</span>` : ''}
      ${delimName ? `<span>${esc(t('cols.delimiter', { v: delimName }))}</span>` : ''}
      ${src.sheet ? `<span>${esc(t('cols.sheet', { v: src.sheet }))}</span>` : ''}</div>
  </div>`;
  for (const c of ds.columns) {
    const ex = [];
    for (let i = 0; i < c.raw.length && ex.length < 3; i++) {
      const v = c.raw[i];
      if (v !== '' && v != null) { const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v); if (!ex.includes(s)) ex.push(s.length > 40 ? `${s.slice(0, 40)}…` : s); }
    }
    html += `<div class="colrow"><div class="top"><strong>${esc(c.name)}</strong>
      <label class="field"><span class="sr">${esc(c.name)}</span><select data-coltype="${esc(c.name)}">${['number', 'date', 'category', 'text'].map((ty) => opt(ty, t(`type.${ty}`), c.type)).join('')}</select></label></div>
      <span class="ex">${esc(t('cols.example', { v: ex.join('; ') }))}${c.type !== c.detected ? ` (${esc(t('cols.detected', { t: t(`type.${c.detected}`).toLowerCase() }))})` : ''}</span>
      ${c.invalid ? `<span class="warn">${esc(t('cols.invalid', { n: fmtInt(c.invalid) }))}</span>` : ''}
      ${c.empty ? `<span class="ex">${esc(t('cols.empties', { n: fmtInt(c.empty) }))}</span>` : ''}</div>`;
  }
  $('#colsBody').innerHTML = html;
}

function rebuild() {
  // reconstruye el conjunto con las opciones actuales, conservando gráficos y filtros válidos
  const ds = buildDataset(S.source, S.panel.opts, (i) => `${getLang() === 'en' ? 'Column' : 'Columna'} ${i}`);
  S.ds = ds;
  render(false, true);
  renderColsBody();
  saveDraft();
}

// ---------- tooltip y gestos sobre gráficos ----------
const tip = $('#tip');
function showTip(plot, i, clientX, clientY) {
  const meta = plot._meta;
  const it = meta?.items?.[i];
  if (!it) { tip.hidden = true; return; }
  const sel = meta.selectable && it.key !== OTHERS_KEY ? '' : '';
  tip.innerHTML = `<strong>${esc(it.title)}</strong>${it.lines.map((l) => `<span class="tl"><span>${esc(l[0])}</span><b>${esc(l[1])}</b></span>`).join('')}${sel}`;
  tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = clientX + window.scrollX + 14, y = clientY + window.scrollY - th - 12;
  if (x + tw > window.scrollX + document.documentElement.clientWidth - 8) x = clientX + window.scrollX - tw - 14;
  if (x < 8) x = 8;
  if (y < window.scrollY + 8) y = clientY + window.scrollY + 18;
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}

function wirePlots() {
  const grid = $('#grid');
  let brush = null;
  grid.addEventListener('pointermove', (e) => {
    const plot = e.target.closest('.plot');
    if (!plot) return;
    if (brush && brush.plot === plot) {
      const svg = plot.querySelector('svg');
      const r = svg.getBoundingClientRect();
      const scale = svg.viewBox.baseVal.width / r.width;
      const x = (e.clientX - r.left) * scale;
      if (Math.abs(x - brush.x0) > 10) brush.active = true;
      if (brush.active) {
        const b = plot._meta.band;
        const a = Math.max(b.x0, Math.min(brush.x0, x)), z = Math.min(b.x0 + b.step * b.n, Math.max(brush.x0, x));
        plot.querySelector('.brush').innerHTML = `<rect x="${a}" y="${b.top}" width="${Math.max(0, z - a)}" height="${b.bottom - b.top}" fill="url(#riso-dots-blue)" fill-opacity="0.6" stroke="${INK.blue}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
        tip.hidden = true;
        return;
      }
    }
    if (e.pointerType !== 'mouse') return;
    const hit = e.target.closest('.hit');
    if (hit) showTip(plot, +hit.dataset.i, e.clientX, e.clientY); else tip.hidden = true;
  });
  grid.addEventListener('pointerleave', () => { tip.hidden = true; }, true);
  grid.addEventListener('pointerdown', (e) => {
    const plot = e.target.closest('.plot');
    if (!plot || !plot._meta || e.button > 0) return;
    if (plot._meta.brushable) {
      const svg = plot.querySelector('svg');
      const r = svg.getBoundingClientRect();
      brush = { plot, x0: (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width), active: false, id: e.pointerId };
      if (e.pointerType === 'mouse') plot.setPointerCapture?.(e.pointerId);
    }
  });
  const endBrush = (e) => {
    if (!brush) return false;
    const { plot, active } = brush;
    const meta = plot._meta;
    const svg = plot.querySelector('svg');
    brush = null;
    if (!active || !meta) return false;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
    const b = meta.band;
    const rect = plot.querySelector('.brush rect');
    const a = rect ? +rect.getAttribute('x') : Math.min(x, b.x0);
    const z = rect ? a + +rect.getAttribute('width') : x;
    const i0 = Math.max(0, Math.floor((a - b.x0) / b.step));
    const i1 = Math.min(b.n - 1, Math.floor((z - b.x0 - 0.01) / b.step));
    plot.querySelector('.brush').innerHTML = '';
    if (i1 < i0) return true;
    const keys = meta.res.keys;
    const f = { col: meta.chart.dim, kind: 'range', min: keys[i0], max: bucketNext(keys[i1], meta.res.bucket) - 1 };
    setFilter(f);
    afterFilter();
    toast(t('toast.filterAdded', { label: filterLabel(f) }));
    return true;
  };
  window.addEventListener('pointerup', (e) => {
    if (endBrush(e)) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  });
  window.addEventListener('pointercancel', () => {
    if (brush) { brush.plot.querySelector('.brush').innerHTML = ''; brush = null; }
  });
  let suppressClick = false;
  grid.addEventListener('click', (e) => {
    if (suppressClick) return;
    const hit = e.target.closest('.hit');
    const plot = e.target.closest('.plot');
    if (!hit || !plot?._meta) return;
    const i = +hit.dataset.i;
    const meta = plot._meta;
    if (meta.selectable) {
      const key = meta.items[i]?.key;
      if (key == null || key === OTHERS_KEY) { showTip(plot, i, e.clientX, e.clientY); return; }
      tip.hidden = true;
      toggleCategory(meta.chart.dim, key);
    } else {
      showTip(plot, i, e.clientX, e.clientY);
    }
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.plot')) tip.hidden = true; });
}

// ---------- menús ----------
function closeMenus() {
  document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; });
  document.querySelectorAll('[aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function toggleMenu(btn, menu) {
  const open = menu.hidden;
  closeMenus();
  if (open) {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    menu.querySelector('button')?.focus();
  }
}

function renderAddMenu() {
  const types = ['kpi', 'bar', 'column', 'line', 'area', 'histogram', 'scatter'];
  const art = {
    kpi: `<svg viewBox="0 0 28 20" aria-hidden="true"><text x="1" y="16" font-size="15" font-weight="800" fill="${INK.blue}" font-family="inherit">12</text><rect x="17" y="4" width="9" height="12" fill="${INK.pink}"/></svg>`,
    bar: `<svg viewBox="0 0 28 20" aria-hidden="true"><rect x="2" y="2" width="22" height="4" fill="${INK.pink}"/><rect x="2" y="8" width="15" height="4" fill="${INK.pink}"/><rect x="2" y="14" width="9" height="4" fill="${INK.pink}"/><path d="M2 1v18" stroke="${INK.blue}" stroke-width="1.5"/></svg>`,
    column: `<svg viewBox="0 0 28 20" aria-hidden="true"><rect x="3" y="8" width="5" height="11" fill="${INK.pink}"/><rect x="11" y="3" width="5" height="16" fill="${INK.pink}"/><rect x="19" y="11" width="5" height="8" fill="${INK.pink}"/><path d="M1 19h26" stroke="${INK.blue}" stroke-width="1.5"/></svg>`,
    line: `<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M1 15l7-6 6 4 7-9 6 3" fill="none" stroke="${INK.blue}" stroke-width="2"/><circle cx="14" cy="13" r="2.2" fill="${INK.pink}"/></svg>`,
    area: `<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M1 15l7-6 6 4 7-9 6 3V19H1z" fill="${INK.yellow}"/><path d="M1 15l7-6 6 4 7-9 6 3" fill="none" stroke="${INK.blue}" stroke-width="2"/></svg>`,
    histogram: `<svg viewBox="0 0 28 20" aria-hidden="true"><rect x="2" y="12" width="6" height="7" fill="${INK.yellow}" stroke="${INK.blue}"/><rect x="8" y="4" width="6" height="15" fill="${INK.yellow}" stroke="${INK.blue}"/><rect x="14" y="7" width="6" height="12" fill="${INK.yellow}" stroke="${INK.blue}"/><rect x="20" y="14" width="6" height="5" fill="${INK.yellow}" stroke="${INK.blue}"/></svg>`,
    scatter: `<svg viewBox="0 0 28 20" aria-hidden="true"><g fill="${INK.pink}"><circle cx="5" cy="15" r="2.2"/><circle cx="10" cy="11" r="2.2"/><circle cx="14" cy="13" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="24" cy="4" r="2.2"/></g><path d="M1 19h26M1 1v18" stroke="${INK.blue}" stroke-width="1.2"/></svg>`,
  };
  $('#addMenu').innerHTML = types.map((ty) => `<button type="button" role="menuitem" data-addtype="${ty}">${art[ty]}<span>${esc(t(`ctype.${ty}`))}</span></button>`).join('');
}

// ---------- exportación ----------
function exportModel() {
  const filters = activeFilters();
  const meta = [filters.length ? t('board.rows', { shown: fmtInt(S.idx.length), total: fmtInt(S.ds.n) }) : t('board.rowsAll', { total: fmtInt(S.ds.n) })];
  meta[0] += `. ${S.source.name}${S.source.sample ? ` (${t('sample.badge').toLowerCase()})` : ''}`;
  if (filters.length) meta.push(`${t('filters.active')}: ${filters.map(filterLabel).join('; ')}`);
  const kpis = [...document.querySelectorAll('#kpis .kpi')].map((k) => ({
    label: k.querySelector('.kpi-label').textContent,
    value: k.classList.contains('is-error') ? '—' : k.querySelector('.kpi-value').textContent,
    sub: k.classList.contains('is-error') ? k.querySelector('.kpi-value').textContent : k.querySelector('.kpi-sub').textContent,
  }));
  const colors = [INK.pink, 'rgba(61,85,136,0.55)', INK.yellow];
  const charts = S.panel.charts.filter((c) => c.type !== 'kpi').map((c) => {
    const el = document.querySelector(`.sheet[data-id="${c.id}"]`);
    const plot = el.querySelector('.plot');
    const svg = plot.querySelector('svg.riso:not(.is-empty)');
    const series = plot._meta?.res?.series;
    return {
      title: el.querySelector('.sheet-title').textContent,
      size: c.size,
      svg,
      message: svg ? '' : plot.querySelector('.plate-msg p')?.textContent || '',
      note: el.querySelector('.sheet-note').textContent,
      legend: series && series.length > 1 ? series.map((s, si) => ({ line: c.type === 'line', label: keyLabel(s.key, 'category'), color: colors[si], dash: SERIES[si].dash ? SERIES[si].dash.split(' ').map(Number) : [] })) : [],
    };
  });
  return { title: S.panel.name, meta, kpis, charts };
}

async function doExport(kind) {
  closeMenus();
  const base = safeName(S.panel.name);
  try {
    if (kind === 'csv') {
      const name = `${base}-datos.csv`;
      download(filteredCSV(S.ds, S.idx), name);
      toast(t('export.done', { name }));
      return;
    }
    toast(t('export.working'));
    const blob = kind === 'png' ? await renderPNG(exportModel()) : await renderPDF(exportModel());
    const name = `${base}.${kind}`;
    download(blob, name);
    toast(t('export.done', { name }));
  } catch (e) {
    console.warn(e);
    toast(t('export.failed'));
  }
}

// ---------- guardar ----------
function openSave() {
  const dlg = $('#dlgSave');
  $('#saveName').value = S.panel.name;
  $('#saveCopy').hidden = !S.panel.id;
  dlg.returnValue = '';
  dlg.showModal();
  $('#saveName').select();
}

async function doSave(asCopy) {
  const name = $('#saveName').value.trim() || S.panel.name;
  S.panel.name = name;
  if (!S.panel.id || asCopy) S.panel.id = `p${Date.now().toString(36)}`;
  const okSrc = await putSource(S.source);
  const ok = okSrc && await putPanel({
    id: S.panel.id, name, savedAt: Date.now(), sourceId: S.source.id, rows: S.ds.n, cols: S.ds.columns.length, config: panelConfig(),
  });
  if (!ok) { toast(t('save.failed')); return; }
  renderHead(activeFilters());
  saveDraft(true);
  toast(t('save.done', { name }));
}

// ---------- idioma ----------
function applyLang() {
  applyI18n();
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('#dropText').textContent = t('start.drop');
  document.querySelector('.drop-formats').textContent = t('start.formats');
  renderAddMenu();
  if (S.ds) {
    render();
    if ($('#dlgFilters').open) renderFiltersBody();
    if ($('#dlgCols').open) renderColsBody();
  } else {
    document.title = t('app.title');
    renderStart();
    const ink = $('#startTitle .hero-ink');
    ink.dataset.text = ink.textContent;
  }
}

// ---------- eventos ----------
function wire() {
  const fileInput = $('#file');
  fileInput.addEventListener('change', () => { const f = fileInput.files[0]; fileInput.value = ''; if (f) handleFile(f); });
  const drop = $('#drop');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e) || $('#start').hidden) return; depth++; drop.classList.add('is-over'); $('#dropText').textContent = t('start.dropActive'); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) { drop.classList.remove('is-over'); $('#dropText').textContent = t('start.drop'); } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0; drop.classList.remove('is-over'); $('#dropText').textContent = t('start.drop');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!$('#start').hidden) handleFile(f);
    else { showStart().then(() => handleFile(f)); }
  });

  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); applyLang(); }));

  $('#start').addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sample]');
    if (s) { await openSample(s.dataset.sample); return; }
    if (e.target.closest('[data-resume]')) { openSaved(DRAFT_ID); return; }
    const o = e.target.closest('[data-open]');
    if (o) { openSaved(o.dataset.open); return; }
    const d = e.target.closest('[data-del]');
    if (d) {
      const p = await getPanel(d.dataset.del);
      if (p && await confirmBox(t('saved.deleteConfirm', { name: p.name }), t('saved.delete'))) {
        await deletePanel(p.id);
        const draft = await getPanel(DRAFT_ID);
        if (draft && draft.panelId === p.id) { draft.panelId = null; await putPanel(draft); }
        toast(t('toast.deleted'));
        renderStart();
      }
    }
  });
  $('#brand').addEventListener('click', (e) => { if (S.ds) { e.preventDefault(); showStart(); } });
  $('#btnClose').addEventListener('click', () => showStart());

  // barra de herramientas
  $('#btnFilters').addEventListener('click', () => { renderFiltersBody(); $('#dlgFilters').showModal(); });
  $('#btnCols').addEventListener('click', () => { renderColsBody(); $('#dlgCols').showModal(); });
  $('#btnAdd').addEventListener('click', (e) => toggleMenu(e.currentTarget, $('#addMenu')));
  $('#btnExport').addEventListener('click', (e) => toggleMenu(e.currentTarget, $('#exportMenu')));
  $('#addMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-addtype]'); if (b) { closeMenus(); addChart(b.dataset.addtype); } });
  $('#exportMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-export]'); if (b) doExport(b.dataset.export); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.menu:not([hidden])');
      if (open) { closeMenus(); open.parentElement.querySelector('[aria-haspopup]')?.focus(); }
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest('.menu')) {
      const items = [...e.target.closest('.menu').querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    }
  });
  $('#btnSave').addEventListener('click', openSave);
  $('#saveForm').addEventListener('submit', (e) => {
    const v = e.submitter?.value;
    if (v === 'save' || v === 'copy') { e.preventDefault(); $('#dlgSave').close(); doSave(v === 'copy'); }
  });
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog.drawer').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // panel: delegación
  $('#board').addEventListener('click', (e) => {
    const t1 = e.target;
    const un = t1.closest('[data-unfilter]');
    if (un) { S.panel.filters = S.panel.filters.filter((f) => f.id !== un.dataset.unfilter); afterFilter(); return; }
    if (t1.closest('[data-clearall]')) { S.panel.filters = []; afterFilter(); return; }
    const ed = t1.closest('[data-edit]');
    if (ed) {
      const id = ed.dataset.edit;
      const prev = S.editing;
      S.editing = prev === id ? null : id;
      const c = findChart(id);
      if (prev && prev !== id) { const p = findChart(prev); if (p) rerenderOne(p, false); }
      if (c) rerenderOne(c, false);
      const sheet = c.type === 'kpi' ? $('#kpiEditor') : document.querySelector(`.sheet[data-id="${id}"]`);
      if (S.editing) sheet?.querySelector('.editor select, .editor input')?.focus();
      else (c.type === 'kpi' ? document.querySelector(`.kpi[data-id="${id}"] [data-edit]`) : sheet?.querySelector('.sheet-acts [data-edit]'))?.focus();
      return;
    }
    const sd = t1.closest('[data-showdata]');
    if (sd) { const id = sd.dataset.showdata; if (S.showData.has(id)) S.showData.delete(id); else S.showData.add(id); rerenderOne(findChart(id), false); document.querySelector(`[data-showdata="${id}"]`)?.focus(); return; }
    const editor = t1.closest('[data-editor]');
    if (editor) {
      const id = editor.dataset.editor;
      const sz = t1.closest('[data-size]');
      if (sz) { const c = findChart(id); c.size = sz.dataset.size; renderCharts(false); saveDraft(); document.querySelector(`[data-editor="${id}"] [data-size="${c.size}"]`)?.focus(); return; }
      const mv = t1.closest('[data-move]');
      if (mv) { moveChart(id, +mv.dataset.move); return; }
      if (t1.closest('[data-remove]')) { removeChart(id); return; }
    }
    const sortBtn = t1.closest('.th-sort');
    if (sortBtn) {
      const col = sortBtn.dataset.col;
      const cur = S.panel.table.sort;
      S.panel.table.sort = !cur || cur.col !== col ? { col, dir: 'asc' } : cur.dir === 'asc' ? { col, dir: 'desc' } : null;
      S.panel.table.page = 0;
      renderTableNow();
      document.querySelector(`.th-sort[data-col="${CSS.escape(col)}"]`)?.focus();
      saveDraft();
      return;
    }
    const pg = t1.closest('.pager [data-act]');
    if (pg) { S.panel.table.page += pg.dataset.act === 'next' ? 1 : -1; renderTableNow(); return; }
  });
  $('#board').addEventListener('change', (e) => {
    const f = e.target.closest('[data-editor] [data-field]');
    if (f) updateChart(f.closest('[data-editor]').dataset.editor, f.dataset.field, f.value);
  });
  $('#board').addEventListener('input', (e) => {
    const f = e.target.closest('[data-editor] [data-field="title"]');
    if (f) { const c = findChart(f.closest('[data-editor]').dataset.editor); c.title = f.value.trim(); if (c.type === 'kpi') { document.querySelector(`.kpi[data-id="${c.id}"] .kpi-label`).textContent = autoTitle(c); } else document.querySelector(`.sheet[data-id="${c.id}"] .sheet-title`).textContent = autoTitle(c); saveDraft(); }
  });
  let searchTimer = null;
  $('#tableSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { S.panel.table.search = e.target.value; S.panel.table.page = 0; renderTableNow(); saveDraft(); }, 160);
  });

  // filtros
  const fb = $('#filtersBody');
  fb.addEventListener('change', (e) => {
    const g = e.target.closest('.fgroup');
    if (!g) return;
    if (e.target.matches('.checks input')) readCheckFilter(g);
    else if (e.target.matches('[data-rmin], [data-rmax]')) readRangeFilter(g);
  });
  fb.addEventListener('input', (e) => {
    if (!e.target.matches('[data-fsearch]')) return;
    const q = e.target.value.trim().toLowerCase();
    e.target.closest('.fgroup').querySelectorAll('.check').forEach((c) => { c.hidden = q && !c.dataset.lab.includes(q); });
  });
  fb.addEventListener('click', (e) => {
    const g = e.target.closest('.fgroup');
    if (!g) return;
    if (e.target.closest('[data-fall]')) { g.querySelectorAll('.checks input').forEach((i) => { i.checked = true; }); readCheckFilter(g); }
    if (e.target.closest('[data-fnone]')) { g.querySelectorAll('.checks input').forEach((i) => { i.checked = false; }); readCheckFilter(g); }
  });
  $('#btnClearAll').addEventListener('click', () => { S.panel.filters = []; afterFilter(); renderFiltersBody(); });

  // columnas
  $('#colsBody').addEventListener('change', (e) => {
    const ct = e.target.closest('[data-coltype]');
    if (ct) {
      const name = ct.dataset.coltype;
      S.panel.opts.types = { ...(S.panel.opts.types || {}), [name]: ct.value };
      const j = colIndex(S.ds, name);
      S.ds.columns[j].type = ct.value;
      retype(S.ds, j);
      S.panel.filters = S.panel.filters.filter((f) => f.col !== name);
      render(false, true);
      renderColsBody();
      $('#colsBody').querySelector(`[data-coltype="${CSS.escape(name)}"]`)?.focus();
      saveDraft();
      return;
    }
    const o = e.target.closest('[data-opt]');
    if (o) {
      const k = o.dataset.opt;
      S.panel.opts[k] = k === 'header' ? o.checked : o.value;
      rebuild();
      $('#colsBody').querySelector(`[data-opt="${k}"]`)?.focus();
    }
  });
  $('#btnRegen').addEventListener('click', async () => {
    if (!(await confirmBox(t('board.regenConfirm'), t('board.regen')))) return;
    S.panel.charts = proposePanel(S.ds);
    S.editing = null; S.printed.clear();
    $('#dlgCols').close();
    render(true);
    saveDraft();
  });

  wirePlots();

  // redimensionado: vuelve a dibujar sin animación cuando cambia el ancho
  let rT = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      if (!S.ds || $('#board').hidden) return;
      S.panel.charts.filter((c) => c.type !== 'kpi').forEach((c) => {
        const el = document.querySelector(`.sheet[data-id="${c.id}"] .plot`);
        if (el && Math.abs((S.lastW.get(c.id) || 0) - el.clientWidth) > 2) renderSheet(c);
      });
    }, 120);
  });
  ro.observe($('#grid'));
}

// ---------- arranque ----------
async function init() {
  setLang(getLang());
  makeGrain();
  applyLang();
  wire();
  printHero();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'activated' && !navigator.serviceWorker.controller) toast(t('offline.ready')); });
      });
    }).catch(() => {});
  }
  try { indexedDB; } catch { toast(t('err.storage')); }
}

init();
