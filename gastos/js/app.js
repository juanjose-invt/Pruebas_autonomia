import {
  load, save, wipe, uid, today, monthOf, shiftMonth, daysInMonth, monthTotals, monthTx,
  sampleData, toCSV, PALETTE, CURRENCIES,
} from './store.js';
import { t, setLang, getLang, locale } from './i18n.js';
import { categoryBars, dailyLine, monthBars, escapeHtml as h } from './charts.js';

const SX = 1.6, SY = 2.4; // proporción de celda; debe coincidir con scene.js
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let state = load();
setLang(state.lang);
const view = { month: monthOf(today()), tab: 'moves' };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const twoCol = window.matchMedia('(min-width: 900px) and (orientation: landscape)');
let gl = null;
let cols = 0;

const el = {
  wall: $('#wall'), top: $('.top'), shelves: $('#shelves'), canvas: $('#gl'), jars: $('#jars'), hint: $('#hint'),
  monthLabel: $('#monthLabel'), todayMonth: $('#todayMonth'),
  balTotal: $('#balTotal'), balIncome: $('#balIncome'), balExpense: $('#balExpense'),
  panel: $('#panel'), scroll: $('#scroll'), sheet: $('#sheet'), fab: $('#fab'),
  entry: $('#entry'), amount: $('#amount'), amountCur: $('#amountCur'), chips: $('#chips'), keySep: $('#keySep'),
  entryDate: $('#entryDate'), entryNote: $('#entryNote'), entrySave: $('#entrySave'), entryDelete: $('#entryDelete'),
  entryTitle: $('#entryTitle'), entryErr: $('#entryErr'),
  toast: $('#toast'), toastMsg: $('#toastMsg'), toastAct: $('#toastAct'),
};

// ---------- dinero y fechas ----------
let money = null;
function moneyInfo() {
  const key = state.currency + getLang();
  if (money && money.key === key) return money;
  const nf = new Intl.NumberFormat(locale(), { style: 'currency', currency: state.currency, useGrouping: 'always' });
  const nf0 = new Intl.NumberFormat(locale(), { style: 'currency', currency: state.currency, maximumFractionDigits: 0, useGrouping: 'always' });
  const parts = nf.formatToParts(1.5);
  money = {
    key, nf, nf0,
    digits: nf.resolvedOptions().maximumFractionDigits,
    symbol: (parts.find((p) => p.type === 'currency') || {}).value || state.currency,
    sep: (parts.find((p) => p.type === 'decimal') || {}).value || ',',
  };
  return money;
}
const fmt = (c) => moneyInfo().nf.format(c / 100);
const fmt0 = (c) => moneyInfo().nf0.format(Math.round(c / 100));
const fmtSigned = (c) => (c > 0 ? '+' : c < 0 ? '−' : '') + fmt(Math.abs(c));
const fmtSigned0 = (c) => (c > 0 ? '+' : c < 0 ? '−' : '') + fmt0(Math.abs(c));

function monthName(ym, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), opts).format(new Date(y, m - 1, 1));
}
function dayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric' }).format(new Date(y, m - 1, d));
}

// ---------- categorías ----------
const catName = (c) => (c ? c.name ?? t('cat.' + c.id) : t('nocat'));
const catById = (id) => state.categories.find((c) => c.id === id);
const cats = (kind) => state.categories.filter((c) => c.kind === kind);

function persist() {
  if (!save(state)) toast(t('toast.storage'), { ms: 6000 });
}

// ---------- aviso ----------
let toastTimer = 0;
function toast(msg, { action, label, ms = 3200 } = {}) {
  clearTimeout(toastTimer);
  el.toastMsg.textContent = msg;
  el.toastAct.hidden = !action;
  if (action) {
    el.toastAct.textContent = label;
    el.toastAct.onclick = () => { hideToast(); action(); };
  }
  el.toast.hidden = false;
  toastTimer = setTimeout(hideToast, action ? Math.max(ms, 6000) : ms);
}
function hideToast() { el.toast.hidden = true; el.toastAct.onclick = null; }

// ---------- textos estáticos ----------
function applyI18n() {
  document.documentElement.lang = getLang();
  document.title = t('app.title');
  $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
  $$('[data-i18n-ph]').forEach((n) => n.setAttribute('placeholder', t(n.dataset.i18nPh)));
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  el.wall.setAttribute('aria-label', t('wall.label'));
}

// ---------- cabecera ----------
function renderHeader() {
  const tot = monthTotals(state, view.month);
  el.monthLabel.textContent = monthName(view.month);
  el.todayMonth.hidden = view.month === monthOf(today());
  el.balTotal.textContent = fmtSigned(tot.balance).replace(/^\+/, '');
  el.balTotal.classList.toggle('neg', tot.balance < 0);
  el.balIncome.textContent = fmt(tot.income);
  el.balExpense.textContent = fmt(tot.expense);
}

// ---------- tarros ----------
function jarModel() {
  const tot = monthTotals(state, view.month);
  const list = cats('expense');
  const ref = Math.max(10000, ...list.map((c) => c.budget));
  return list.map((c) => {
    const spent = tot.byCat[c.id] || 0;
    const fill = c.budget > 0 ? spent / c.budget : Math.min(1, spent / ref);
    return { id: c.id, color: c.color, name: catName(c), spent, budget: c.budget, fill };
  });
}

function fallbackJar(fill) {
  // Tarro plano para cuando no hay WebGL: mismas proporciones, monedas apiladas.
  const n = fill > 0 ? Math.min(60, Math.max(1, Math.round(fill * 60))) : 0;
  let coins = '';
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 5), k = i % 5;
    const x = 22 + k * 14 + ((row * 7 + k * 3) % 5) - 2 + (row % 2 ? 4 : 0);
    const y = 118 - row * 7.2;
    const tone = ['#E9B23A', '#F3C955', '#D9962B', '#C9703A', '#E9B23A'][(i * 7 + row) % 5];
    coins += `<ellipse cx="${x}" cy="${y}" rx="9.5" ry="3.6" fill="${tone}" stroke="#8a5a14" stroke-width=".8"/>`;
  }
  let spill = '';
  if (fill > 1) {
    const m = Math.min(4, Math.ceil((fill - 1) * 8));
    for (let i = 0; i < m; i++) spill += `<ellipse cx="${18 + i * 21}" cy="${127.5 - (i % 2) * 0.6}" rx="9.5" ry="3.4" fill="#F3C955" stroke="#8a5a14" stroke-width=".8"/>`;
  }
  return `<svg viewBox="0 0 100 132" aria-hidden="true" focusable="false">
    <ellipse cx="54" cy="125" rx="46" ry="6" fill="rgba(20,6,2,.35)"/>
    <path d="M14 30 Q14 20 24 17 L24 8 Q24 4 28 4 L72 4 Q76 4 76 8 L76 17 Q86 20 86 30 L86 114 Q86 124 76 124 L24 124 Q14 124 14 114 Z" fill="rgba(215,240,230,.14)"/>
    ${coins}
    <path d="M14 30 Q14 20 24 17 L24 8 Q24 4 28 4 L72 4 Q76 4 76 8 L76 17 Q86 20 86 30 L86 114 Q86 124 76 124 L24 124 Q14 124 14 114 Z" fill="none" stroke="rgba(235,250,244,.85)" stroke-width="2.2"/>
    <path d="M21 34 L21 106" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/>
    <rect x="22" y="9.5" width="56" height="6" rx="3" fill="var(--c)"/>
    ${spill}
  </svg>`;
}

function layoutShelves(n) {
  const width = el.shelves.clientWidth;
  if (!n || !width) { el.shelves.style.height = '0px'; return { cols: 1, rows: 0 }; }
  const vh = window.innerHeight;
  let maxH;
  if (twoCol.matches) maxH = el.wall.clientHeight - el.top.offsetHeight - el.hint.offsetHeight - 28;
  else maxH = width < 560 ? vh * 0.66 : vh * 0.5;
  maxH = Math.max(maxH, 200);
  let best = null;
  for (let c = 1; c <= 8; c++) {
    const rows = Math.ceil(n / c);
    const rowH = Math.min(maxH / rows, (width / c) * (SY / SX), 330);
    if (!best || rowH > best.rowH + 0.5) best = { cols: c, rows, rowH };
  }
  if ((best.rowH * SX) / SY < 92) {
    const c = Math.max(2, Math.floor(width / 92));
    best = { cols: c, rows: Math.ceil(n / c), rowH: (width / c) * (SY / SX) };
  }
  const colW = (best.rowH * SX) / SY;
  const height = Math.round(best.rows * best.rowH);
  el.shelves.style.height = height + 'px';
  el.jars.style.width = Math.round(colW * best.cols) + 'px';
  el.jars.style.gridTemplateColumns = `repeat(${best.cols}, 1fr)`;
  el.jars.style.gridAutoRows = best.rowH + 'px';
  el.jars.classList.toggle('tight', colW < 120);
  if (gl) gl.resize(width, height);
  return best;
}

let jarIds = '';
function renderJars({ rain = false, instant = false } = {}) {
  const model = jarModel();
  const lay = layoutShelves(model.length);
  const ids = model.map((j) => j.id).join('|') + '#' + lay.cols + (gl ? 'g' : 'f');
  if (ids !== jarIds) {
    jarIds = ids;
    el.jars.innerHTML = model.map((j) => `<button type="button" class="jar" data-id="${h(j.id)}">
      <span class="jar-pic"></span>
      <span class="tag"><span class="tag-name"></span><span class="tag-num"></span></span>
    </button>`).join('');
  }
  const plain = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0, useGrouping: 'always' });
  model.forEach((j, i) => {
    const b = el.jars.children[i];
    const over = j.budget > 0 && j.spent > j.budget;
    b.style.setProperty('--c', j.color);
    b.classList.toggle('over', over);
    b.classList.toggle('sel', !!entry && entry.type === 'expense' && entry.cat === j.id);
    $('.tag-name', b).textContent = j.name;
    $('.tag-num', b).innerHTML = j.budget > 0
      ? `<b>${h(plain.format(Math.round(j.spent / 100)))}</b> / ${h(fmt0(j.budget))}`
      : `<b>${h(fmt0(j.spent))}</b>`;
    b.setAttribute('aria-label', j.budget > 0
      ? t('jar.aria', { name: j.name, spent: fmt(j.spent), budget: fmt(j.budget), pct: Math.round(j.fill * 100) })
      : t('jar.aria.nobudget', { name: j.name, spent: fmt(j.spent) }));
    if (!gl) $('.jar-pic', b).innerHTML = fallbackJar(j.fill);
  });
  el.hint.textContent = model.length ? t('hint.tap') : t('hint.nojars');
  if (gl && model.length) gl.update(model, { cols: lay.cols, rain, instant });
}

// ---------- panel: movimientos ----------
const ICON = {
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

function renderMoves() {
  const list = monthTx(state, view.month).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!list.length) {
    el.panel.innerHTML = `<div class="empty">
      <h3>${h(t('moves.empty.title', { month: monthName(view.month) }))}</h3>
      <p>${h(t('moves.empty.body'))}</p>
      ${state.tx.length ? '' : `<button type="button" class="btn ghost" data-act="sample">${h(t('set.sample'))}</button>`}
    </div>`;
    return;
  }
  const days = [];
  for (const x of list) {
    let d = days[days.length - 1];
    if (!d || d.date !== x.date) { d = { date: x.date, items: [], net: 0 }; days.push(d); }
    d.items.push(x);
    d.net += x.type === 'income' ? x.amount : -x.amount;
  }
  el.panel.innerHTML = `<div class="panel-head">
      <p class="count">${h(list.length === 1 ? t('moves.count.one') : t('moves.count', { n: list.length }))}</p>
      <button type="button" class="btn ghost small" data-act="export-month">${ICON.download}<span>${h(t('moves.export'))}</span></button>
    </div>
    <ol class="days">${days.map((d) => `<li>
      <h3 class="day"><span>${h(dayName(d.date))}</span><span class="day-net">${h(fmtSigned(d.net))}</span></h3>
      <ul class="rows">${d.items.map((x) => {
        const c = catById(x.cat);
        return `<li><button type="button" class="row${x.type === 'income' ? ' inc' : ''}" data-tx="${h(x.id)}">
          <span class="dot" style="background:${c ? h(c.color) : 'transparent'}"></span>
          <span class="row-main"><span class="row-cat">${h(catName(c))}</span>${x.note ? `<span class="row-note">${h(x.note)}</span>` : ''}</span>
          <span class="row-amt">${h(x.type === 'income' ? '+' + fmt(x.amount) : fmt(x.amount))}</span>
        </button></li>`;
      }).join('')}</ul>
    </li>`).join('')}</ol>`;
}

// ---------- panel: gráficos ----------
function renderCharts() {
  const tot = monthTotals(state, view.month);
  const width = Math.max(280, el.panel.clientWidth - 2);
  const rows = cats('expense')
    .map((c) => ({ name: catName(c), color: c.color, spent: tot.byCat[c.id] || 0, budget: c.budget }))
    .sort((a, b) => b.spent - a.spent);
  const orphan = Object.entries(tot.byCat).filter(([id]) => !catById(id)).reduce((s, [, v]) => s + v, 0);
  if (orphan) rows.push({ name: t('nocat'), color: '#8a6a55', spent: orphan, budget: 0 });

  const days = daysInMonth(view.month);
  const nowM = monthOf(today());
  const lastDay = view.month === nowM ? Number(today().slice(8)) : days;
  const perDay = new Array(days).fill(0);
  for (const x of monthTx(state, view.month)) if (x.type === 'expense') perDay[Number(x.date.slice(8)) - 1] += x.amount;
  const cum = [];
  perDay.reduce((s, v, i) => (cum[i] = s + v), 0);
  const budget = cats('expense').reduce((s, c) => s + c.budget, 0);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const ym = shiftMonth(view.month, -i);
    const mt = monthTotals(state, ym);
    months.push({
      label: monthName(ym, { month: 'short' }).replace('.', ''), income: mt.income, expense: mt.expense,
      incomeFull: fmt(mt.income), expenseFull: fmt(mt.expense), current: i === 0,
    });
  }
  const anyHistory = months.some((m) => m.income || m.expense);

  el.panel.innerHTML = `
    <section class="chart">
      <h3>${h(t('charts.bycat'))}</h3>
      <p class="sub">${h(t('charts.bycat.sub'))}</p>
      ${rows.length ? categoryBars(rows, { fmt: fmt0, t }) : ''}
    </section>
    <section class="chart">
      <h3>${h(t('charts.daily'))}</h3>
      ${tot.expense ? dailyLine({ days, cum, lastDay, budget, width, fmt: fmt0, labelBudget: t('charts.daily.budget') }) : `<p class="sub">${h(t('charts.empty'))}</p>`}
    </section>
    <section class="chart">
      <h3>${h(t('charts.months'))}</h3>
      <p class="sub">${h(t('charts.months.sub'))}</p>
      ${anyHistory ? monthBars({ months, width, fmtShort: fmtSigned0, labels: { income: t('bal.income'), expense: t('bal.expense'), title: t('charts.months') } }) : ''}
    </section>`;
}

// ---------- panel: categorías ----------
let openSwatch = null;
function catRow(c) {
  const name = catName(c);
  const m = moneyInfo();
  return `<li class="cat" data-id="${h(c.id)}">
    <button type="button" class="swatch" style="background:${h(c.color)}" aria-expanded="${openSwatch === c.id}" aria-label="${h(t('cats.color', { name }))}" data-act="swatch"></button>
    <input class="cat-name" type="text" maxlength="24" value="${h(name)}" aria-label="${h(t('cats.name'))}" autocomplete="off">
    ${c.kind === 'expense' ? `<label class="cat-budget"><span class="sr">${h(t('cats.budget'))}</span>
      <input type="number" inputmode="decimal" min="0" step="${m.digits ? '0.01' : '1'}" value="${c.budget ? c.budget / 100 : ''}" placeholder="0"><span aria-hidden="true">${h(m.symbol)}</span></label>` : ''}
    <button type="button" class="round dark small" data-act="cat-del" aria-label="${h(t('cats.delete', { name }))}">${ICON.trash}</button>
    ${openSwatch === c.id ? `<div class="swatches" role="group" aria-label="${h(t('cats.colorpick'))}">${PALETTE.map((p) =>
      `<button type="button" style="background:${p}" data-color="${p}" aria-pressed="${p === c.color}" aria-label="${p}"></button>`).join('')}</div>` : ''}
  </li>`;
}

function renderCats() {
  el.panel.innerHTML = `
    <section class="catgroup">
      <h3>${h(t('cats.expense'))}</h3>
      <p class="sub">${h(t('cats.help'))}</p>
      <div class="cat-cols" aria-hidden="true"><span>${h(t('cats.name'))}</span><span>${h(t('cats.budget'))}</span></div>
      <ul class="cats">${cats('expense').map(catRow).join('')}</ul>
      <button type="button" class="btn ghost" data-act="cat-add" data-kind="expense">${ICON.plus}<span>${h(t('cats.add.expense'))}</span></button>
    </section>
    <section class="catgroup">
      <h3>${h(t('cats.income'))}</h3>
      <ul class="cats">${cats('income').map(catRow).join('')}</ul>
      <button type="button" class="btn ghost" data-act="cat-add" data-kind="income">${ICON.plus}<span>${h(t('cats.add.income'))}</span></button>
    </section>`;
}

// ---------- panel: ajustes ----------
function renderSettings() {
  const names = new Intl.DisplayNames([locale()], { type: 'currency' });
  el.panel.innerHTML = `
    <section class="set">
      <label class="field"><span>${h(t('set.currency'))}</span>
        <select id="currency">${CURRENCIES.map((c) => `<option value="${c}"${c === state.currency ? ' selected' : ''}>${c} — ${h(names.of(c))}</option>`).join('')}</select>
      </label>
      <div class="field"><span id="setLangLabel">${h(t('set.lang'))}</span>
        <div class="seg" role="group" aria-labelledby="setLangLabel">
          <button type="button" data-lang="es" aria-pressed="${getLang() === 'es'}">Español</button>
          <button type="button" data-lang="en" aria-pressed="${getLang() === 'en'}">English</button>
        </div>
      </div>
    </section>
    <section class="set">
      <h3>${h(t('set.data'))}</h3>
      <p class="sub">${h(t('set.privacy'))}</p>
      <div class="set-act"><button type="button" class="btn ghost" data-act="export-all">${ICON.download}<span>${h(t('set.export'))}</span></button><p>${h(t('set.export.help'))}</p></div>
      <div class="set-act"><button type="button" class="btn ghost" data-act="sample">${h(t('set.sample'))}</button><p>${h(t('set.sample.help'))}</p></div>
      <div class="set-act"><button type="button" class="btn ghost danger" data-act="wipe">${h(t('set.wipe'))}</button><p>${h(t('set.wipe.help'))}</p></div>
    </section>`;
}

function renderPanel() {
  ({ moves: renderMoves, charts: renderCharts, cats: renderCats, settings: renderSettings })[view.tab]();
}

function renderAll(opts) {
  renderHeader();
  renderJars(opts);
  renderPanel();
}

// ---------- confirmación en línea ----------
function askInline(btn, message, onYes) {
  const box = document.createElement('div');
  box.className = 'confirm';
  box.innerHTML = `<p>${h(message)}</p><div><button type="button" class="btn primary danger-fill">${h(btn.textContent.trim() || t('entry.delete'))}</button><button type="button" class="btn ghost">${h(getLang() === 'en' ? 'Cancel' : 'Cancelar')}</button></div>`;
  const host = btn.closest('.set-act, .cat') || btn.parentElement;
  host.after(box);
  btn.disabled = true;
  const [yes, no] = $$('button', box);
  const done = () => { box.remove(); btn.disabled = false; };
  yes.onclick = () => { done(); onYes(); };
  no.onclick = () => { done(); btn.focus(); };
  yes.focus();
}

// ---------- CSV ----------
function exportCSV(list, filename) {
  if (!list.length) { toast(t('toast.nothing')); return; }
  const es = getLang() === 'es';
  const rows = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((x) => ({
    date: x.date,
    type: t(x.type === 'income' ? 'entry.income' : 'entry.expense'),
    category: catName(catById(x.cat)),
    amount: x.amount,
    sign: x.type === 'income' ? 1 : -1,
    currency: state.currency,
    note: x.note,
  }));
  const csv = toCSV(rows, {
    sep: es ? ';' : ',', decimal: es ? ',' : '.',
    header: ['csv.date', 'csv.type', 'csv.category', 'csv.amount', 'csv.currency', 'csv.note'].map((k) => t(k)),
  });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('toast.exported', { n: list.length }));
}

// ---------- alta y edición ----------
let entry = null;

function lastCat(type) {
  for (let i = state.tx.length - 1; i >= 0; i--) {
    const x = state.tx[i];
    if (x.type === type && catById(x.cat)) return x.cat;
  }
  return (cats(type)[0] || {}).id || '';
}

function openEntry({ cat, type = 'expense', tx = null, opener = null } = {}) {
  const cur = monthOf(today());
  entry = tx
    ? { id: tx.id, type: tx.type, cat: catById(tx.cat) ? tx.cat : '', amt: centsToInput(tx.amount), date: tx.date, note: tx.note, opener }
    : { id: null, type, cat: cat || lastCat(type), amt: '', date: view.month === cur ? today() : view.month + '-01', note: '', opener };
  el.entry.hidden = false;
  document.body.classList.add('entry-open');
  el.entryDate.value = entry.date;
  el.entryNote.value = entry.note;
  el.entryErr.hidden = true;
  renderEntry();
  el.amount.focus({ preventScroll: true });
  syncSel();
}

function centsToInput(c) {
  const s = (c / 100).toFixed(2);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}
const inputToCents = (s) => Math.round(parseFloat(s || '0') * 100) || 0;

function renderEntry() {
  if (!entry) return;
  const m = moneyInfo();
  el.entryTitle.textContent = t(entry.id ? 'entry.edit' : 'entry.new');
  $$('.seg button', el.entry).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === entry.type)));
  el.amount.value = (entry.amt || '0').replace('.', m.sep);
  el.amount.classList.toggle('zero', !entry.amt);
  el.amountCur.textContent = m.symbol;
  el.keySep.textContent = m.sep;
  el.keySep.disabled = m.digits === 0;
  el.chips.innerHTML = cats(entry.type).map((c) =>
    `<button type="button" class="chip" data-cat="${h(c.id)}" aria-pressed="${c.id === entry.cat}"><span class="dot" style="background:${h(c.color)}"></span>${h(catName(c))}</button>`).join('');
  el.entrySave.textContent = t(entry.id ? 'entry.save.changes' : entry.type === 'income' ? 'entry.save.income' : 'entry.save.expense');
  el.entryDelete.hidden = !entry.id;
  el.entry.dataset.type = entry.type;
}

function syncSel() {
  $$('.jar', el.jars).forEach((b) => b.classList.toggle('sel', !!entry && entry.type === 'expense' && entry.cat === b.dataset.id));
}

function closeEntry(restoreFocus = true) {
  if (!entry) return;
  const opener = entry.opener;
  entry = null;
  el.entry.hidden = true;
  document.body.classList.remove('entry-open');
  syncSel();
  if (restoreFocus) {
    const target = opener && document.contains(opener) ? opener : el.fab;
    target.focus({ preventScroll: true });
  }
}

function pressKey(k) {
  if (!entry) return;
  const m = moneyInfo();
  let a = entry.amt;
  if (k === 'back') a = a.slice(0, -1);
  else if (k === '.') {
    if (m.digits === 0 || a.includes('.')) return;
    a = (a || '0') + '.';
  } else {
    const [int, dec] = a.split('.');
    if (dec !== undefined) { if (dec.length >= 2) return; a += k; }
    else if (int === '0') a = k;
    else { if (int.length >= 7) return; a += k; }
  }
  entry.amt = a === '0' ? '' : a;
  el.entryErr.hidden = true;
  const sep = m.sep;
  el.amount.value = (entry.amt || '0').replace('.', sep);
  el.amount.classList.toggle('zero', !entry.amt);
}

function fail(key) {
  el.entryErr.textContent = t(key);
  el.entryErr.hidden = false;
}

function saveEntry() {
  if (!entry) return;
  const amount = inputToCents(entry.amt);
  if (amount <= 0) return fail('entry.err.amount');
  if (!catById(entry.cat)) return fail('entry.err.cat');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(el.entryDate.value) ? el.entryDate.value : today();
  const rec = { id: entry.id || uid(), type: entry.type, amount, cat: entry.cat, date, note: el.entryNote.value.trim().slice(0, 120) };
  const editing = !!entry.id;
  if (editing) state.tx = state.tx.map((x) => (x.id === rec.id ? rec : x));
  else state.tx.push(rec);
  persist();
  const jump = monthOf(date) !== view.month;
  if (jump) view.month = monthOf(date);
  closeEntry();
  if (!twoCol.matches && rec.type === 'expense') showWall();
  renderAll({ rain: jump });
  toast(editing ? t('toast.updated') : rec.type === 'income' ? t('toast.saved.income') : t('toast.saved.expense', { cat: catName(catById(rec.cat)) }));
}

function showWall() {
  const r = el.shelves.getBoundingClientRect();
  if (r.top < 0 || r.top > window.innerHeight * 0.5) {
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
  }
}

function deleteEntry() {
  if (!entry || !entry.id) return;
  const id = entry.id;
  const idx = state.tx.findIndex((x) => x.id === id);
  if (idx < 0) return closeEntry();
  const [gone] = state.tx.splice(idx, 1);
  persist();
  closeEntry();
  renderAll();
  toast(t('toast.deleted'), {
    label: t('toast.undo'),
    action: () => { state.tx.splice(Math.min(idx, state.tx.length), 0, gone); persist(); renderAll(); },
  });
}

// ---------- eventos ----------
function setMonth(ym) {
  view.month = ym;
  renderAll({ rain: true });
}

function setTab(tab, focus = false) {
  view.tab = tab;
  openSwatch = null;
  $$('.tabs [role=tab]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  el.panel.setAttribute('aria-labelledby', 'tab-' + tab);
  renderPanel();
  if (twoCol.matches) el.scroll.scrollTop = 0;
}

function changeLang(l) {
  if (l === getLang()) return;
  setLang(l);
  state.lang = getLang();
  persist();
  applyI18n();
  renderAll({ instant: true });
  renderEntry();
}

$('#prevMonth').addEventListener('click', () => setMonth(shiftMonth(view.month, -1)));
$('#nextMonth').addEventListener('click', () => setMonth(shiftMonth(view.month, 1)));
el.todayMonth.addEventListener('click', () => { setMonth(monthOf(today())); $('#prevMonth').focus(); });

document.addEventListener('click', (e) => {
  const lb = e.target.closest('[data-lang]');
  if (lb) changeLang(lb.dataset.lang);
});

$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role=tab]');
  if (b) setTab(b.dataset.tab);
});
$('.tabs').addEventListener('keydown', (e) => {
  const order = ['moves', 'charts', 'cats', 'settings'];
  let i = order.indexOf(view.tab);
  if (e.key === 'ArrowRight') i = (i + 1) % order.length;
  else if (e.key === 'ArrowLeft') i = (i + order.length - 1) % order.length;
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = order.length - 1;
  else return;
  e.preventDefault();
  setTab(order[i], true);
});

el.jars.addEventListener('click', (e) => {
  const b = e.target.closest('.jar');
  if (!b) return;
  if (entry && entry.type === 'expense') {
    entry.cat = b.dataset.id;
    renderEntry(); syncSel();
    el.amount.focus({ preventScroll: true });
  } else {
    if (entry) closeEntry(false);
    openEntry({ cat: b.dataset.id, opener: b });
  }
});

el.fab.addEventListener('click', () => openEntry({ opener: el.fab }));

el.panel.addEventListener('click', (e) => {
  const row = e.target.closest('[data-tx]');
  if (row) {
    const tx = state.tx.find((x) => x.id === row.dataset.tx);
    if (tx) openEntry({ tx, opener: row });
    return;
  }
  const colorBtn = e.target.closest('[data-color]');
  if (colorBtn) {
    const c = catById(colorBtn.closest('.cat').dataset.id);
    c.color = colorBtn.dataset.color;
    openSwatch = null;
    persist(); renderJars({ instant: true }); renderCats();
    const sw = $(`.cat[data-id="${CSS.escape(c.id)}"] .swatch`);
    if (sw) sw.focus();
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'export-month') exportCSV(monthTx(state, view.month), `huchas-${view.month}.csv`);
  else if (a === 'export-all') exportCSV(state.tx, `huchas-${getLang() === 'en' ? 'all' : 'todo'}.csv`);
  else if (a === 'sample') {
    const note = (cat, i) => (t('note.' + cat).split('|')[i] || '');
    state.tx = state.tx.concat(sampleData(state, note));
    persist(); renderAll({ rain: true }); toast(t('toast.sample'));
  } else if (a === 'wipe') {
    askInline(act, t('set.wipe.confirm'), () => {
      const lang = getLang();
      state = wipe(); state.lang = lang; money = null;
      persist(); renderAll({ instant: true }); toast(t('toast.wiped'));
    });
  } else if (a === 'swatch') {
    const id = act.closest('.cat').dataset.id;
    openSwatch = openSwatch === id ? null : id;
    renderCats();
    const again = $(`.cat[data-id="${CSS.escape(id)}"] ${openSwatch ? '.swatches button[aria-pressed=true], .swatches button' : '.swatch'}`);
    if (again) again.focus();
  } else if (a === 'cat-add') {
    const kind = act.dataset.kind;
    const used = new Set(cats(kind).map((c) => c.color));
    const color = PALETTE.find((p) => !used.has(p)) || PALETTE[cats(kind).length % PALETTE.length];
    const c = { id: 'c' + uid(), kind, name: t('cats.new.' + kind), color, budget: kind === 'expense' ? 10000 : 0 };
    state.categories.push(c);
    persist(); renderJars({ instant: true }); renderCats();
    const inp = $(`.cat[data-id="${CSS.escape(c.id)}"] .cat-name`);
    if (inp) { inp.focus(); inp.select(); }
  } else if (a === 'cat-del') {
    const id = act.closest('.cat').dataset.id;
    const c = catById(id);
    const n = state.tx.filter((x) => x.cat === id).length;
    const run = () => {
      state.categories = state.categories.filter((x) => x.id !== id);
      persist(); renderAll({ instant: true }); toast(t('toast.catdeleted'));
    };
    if (n) askInline(act, t('cats.confirm', { name: catName(c), n }), run);
    else askInline(act, t('cats.confirm0', { name: catName(c) }), run);
  }
});

el.panel.addEventListener('change', (e) => {
  const row = e.target.closest('.cat');
  if (row) {
    const c = catById(row.dataset.id);
    if (!c) return;
    if (e.target.classList.contains('cat-name')) {
      const v = e.target.value.trim().slice(0, 24);
      if (v) c.name = v; else e.target.value = catName(c);
    } else if (e.target.type === 'number') {
      const v = parseFloat(e.target.value);
      c.budget = Number.isFinite(v) && v > 0 ? Math.min(Math.round(v * 100), 99999999) : 0;
    }
    persist(); renderJars({ instant: true });
    return;
  }
  if (e.target.id === 'currency') {
    state.currency = e.target.value;
    money = null;
    persist(); renderAll({ instant: true }); renderEntry();
  }
});

// formulario
el.entry.addEventListener('submit', (e) => { e.preventDefault(); saveEntry(); });
$('#entryClose').addEventListener('click', () => closeEntry());
el.entryDelete.addEventListener('click', deleteEntry);
$('#keys').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (b) pressKey(b.dataset.k);
});
el.chips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b || !entry) return;
  entry.cat = b.dataset.cat;
  el.entryErr.hidden = true;
  $$('.chip', el.chips).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
  syncSel();
});
$('.seg', el.entry).addEventListener('click', (e) => {
  const b = e.target.closest('[data-type]');
  if (!b || !entry || b.dataset.type === entry.type) return;
  entry.type = b.dataset.type;
  entry.cat = lastCat(entry.type);
  renderEntry(); syncSel();
});
el.entry.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeEntry(); return; }
  if (e.target === el.entryNote || e.target === el.entryDate || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^\d$/.test(e.key)) { pressKey(e.key); e.preventDefault(); }
  else if (e.key === ',' || e.key === '.') { pressKey('.'); e.preventDefault(); }
  else if (e.key === 'Backspace') { pressKey('back'); e.preventDefault(); }
});

// paralaje con ratón (no en táctil)
el.wall.addEventListener('pointermove', (e) => {
  if (!gl || e.pointerType !== 'mouse') return;
  const r = el.shelves.getBoundingClientRect();
  if (!r.width || !r.height) return;
  gl.pointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
});
el.wall.addEventListener('pointerleave', () => { if (gl) gl.pointer(0, 0); });

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderJars({ instant: true });
    if (view.tab === 'charts') renderCharts();
  }, 80);
}
window.addEventListener('resize', onResize);
twoCol.addEventListener('change', onResize);

// ---------- arranque ----------
function useFallback() {
  if (gl) { try { gl.dispose(); } catch (e) { /* contexto ya perdido */ } }
  gl = null;
  document.documentElement.dataset.gl = 'off';
  jarIds = '';
  renderJars({ instant: true });
}

async function start() {
  applyI18n();
  document.documentElement.dataset.gl = 'off';
  renderAll({ instant: true });
  const wantGl = !new URLSearchParams(location.search).has('nogl');
  if (wantGl) {
    try {
      const mod = await import('./scene.js');
      gl = mod.createScene(el.canvas, { reducedMotion: () => reduced.matches, onLost: useFallback });
    } catch (e) {
      gl = null;
    }
  }
  if (gl) {
    document.documentElement.dataset.gl = 'on';
    jarIds = '';
    try {
      renderJars({ rain: true });
    } catch (e) {
      useFallback();
    }
    window.__huchas = { gl };
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderJars({ instant: true }));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  }
}

start();
