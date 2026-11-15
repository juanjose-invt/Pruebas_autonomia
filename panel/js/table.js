// Tabla ordenable con búsqueda local y paginación (no pinta decenas de miles de filas de golpe).
import { t, fmtNum, fmtDate, fmtInt } from './i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let sortCache = { key: null, order: null };

function rowText(ds) {
  if (ds.rowText) return ds.rowText;
  const out = new Array(ds.n);
  for (let i = 0; i < ds.n; i++) {
    let s = '';
    for (const c of ds.columns) { const v = c.raw[i]; if (v != null && v !== '') s += (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)) + '\u0001'; }
    out[i] = s.toLowerCase();
  }
  ds.rowText = out;
  return out;
}

export function tableRows(ds, idx, state, filterKey) {
  let rows = idx;
  const q = (state.search || '').trim().toLowerCase();
  if (q) {
    const txt = rowText(ds);
    const out = [];
    for (let k = 0; k < idx.length; k++) if (txt[idx[k]].includes(q)) out.push(idx[k]);
    rows = Uint32Array.from(out);
  }
  if (state.sort) {
    const j = ds.columns.findIndex((c) => c.name === state.sort.col);
    if (j >= 0) {
      const key = `${filterKey}|${q}|${state.sort.col}|${state.sort.dir}|${ds.columns[j].type}`;
      if (sortCache.key === key && sortCache.ds === ds) return sortCache.order;
      const arr = ds.data[j];
      const dir = state.sort.dir === 'desc' ? -1 : 1;
      const list = Array.from(rows);
      const col = ds.columns[j];
      if (col.type === 'number' || col.type === 'date') {
        list.sort((a, b) => {
          const x = arr[a], y = arr[b];
          const nx = Number.isNaN(x), ny = Number.isNaN(y);
          if (nx || ny) return nx - ny;
          return (x - y) * dir || a - b;
        });
      } else {
        const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        list.sort((a, b) => {
          const x = arr[a], y = arr[b];
          if (x == null || y == null) return (x == null) - (y == null);
          return coll.compare(x, y) * dir || a - b;
        });
      }
      rows = Uint32Array.from(list);
      sortCache = { key, order: rows, ds };
    }
  }
  return rows;
}

export function cellText(ds, j, i) {
  const c = ds.columns[j];
  const v = ds.data[j][i];
  if (c.type === 'number') return Number.isNaN(v) ? (String(c.raw[i] ?? '').trim() || null) : fmtNum(v, '', { maxFrac: 6 });
  if (c.type === 'date') return Number.isNaN(v) ? (String(c.raw[i] ?? '').trim() || null) : fmtDate(v, c.hasTime);
  return v;
}

export function renderTable(wrap, ds, rows, state) {
  const size = state.pageSize || 50;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (state.page >= pages) state.page = pages - 1;
  const from = state.page * size;
  const to = Math.min(rows.length, from + size);
  let head = '<tr>';
  ds.columns.forEach((c) => {
    const s = state.sort && state.sort.col === c.name ? state.sort.dir : null;
    const aria = s ? ` aria-sort="${s === 'asc' ? 'ascending' : 'descending'}"` : '';
    const num = c.type === 'number' || c.type === 'date';
    head += `<th scope="col"${aria} class="${num ? 'num' : ''}"><button type="button" class="th-sort" data-col="${esc(c.name)}"><span>${esc(c.name)}</span><svg class="sort-ic ${s || ''}" viewBox="0 0 12 16" aria-hidden="true"><path class="up" d="M6 2l4 5H2z"/><path class="down" d="M6 14l4-5H2z"/></svg></button></th>`;
  });
  head += '</tr>';
  let body = '';
  for (let k = from; k < to; k++) {
    const i = rows[k];
    body += '<tr>';
    ds.columns.forEach((c, j) => {
      const txt = cellText(ds, j, i);
      const num = c.type === 'number' || c.type === 'date';
      const bad = (c.type === 'number' || c.type === 'date') && Number.isNaN(ds.data[j][i]) && txt != null;
      if (txt == null || txt === '') body += `<td class="${num ? 'num ' : ''}empty"><span aria-hidden="true">—</span><span class="sr">${esc(t('table.emptyCell'))}</span></td>`;
      else body += `<td class="${num ? 'num' : ''}${bad ? ' bad' : ''}">${esc(txt)}</td>`;
    });
    body += '</tr>';
  }
  if (!rows.length) body = `<tr><td class="none" colspan="${ds.columns.length}">${esc(t('table.empty'))}</td></tr>`;
  wrap.querySelector('thead').innerHTML = head;
  wrap.querySelector('tbody').innerHTML = body;
  const info = wrap.querySelector('[data-role="page-info"]');
  info.textContent = rows.length ? t('table.page', { from: fmtInt(from + 1), to: fmtInt(to), total: fmtInt(rows.length) }) : '';
  wrap.querySelector('[data-act="prev"]').disabled = state.page <= 0;
  wrap.querySelector('[data-act="next"]').disabled = state.page >= pages - 1;
}
