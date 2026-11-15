// Arranque, pantalla de inicio (muestrario), cabecera del editor, vista previa y acciones generales.

import { h, icon, btn, toast, hideToast, confirmDelete, dialog } from './dom.js';
import { t, tr, setLang, getLang } from './i18n.js';
import { state, load, persist, backupOf, parseBackup } from './store.js';
import { TEMPLATES, GROUPS, tplById, newCV, applyTemplate, uid } from './templates.js';
import { fillSample } from './samples.js';
import { renderCV, paginate, ensureFont, PAGES } from './render.js';
import { renderContent, renderTemplates, renderDesign, renderDest } from './editor.js';
import { destById } from './countries.js';
import { startTour, endTour, tourActive } from './tour.js';
import { afterPdfReady } from './integraciones.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');
const narrow = () => matchMedia('(max-width: 759px)').matches;

const app = {
  view: 'home', cv: null, tab: 'content', open: 'personal', openItem: null, mobile: 'form', zoom: false,
  undoStack: [], redoStack: [], lastJson: '', lastChange: 0, coalesceKey: null,
  change, undo, renderPanel, applyTpl, pickPhoto, thumb,
  toggleSec(id) { app.open = app.open === id ? null : id; app.openItem = null; renderPanel(); if (app.open) requestAnimationFrame(() => { const c = document.querySelector('.sec-card.open'); c && c.scrollIntoView({ block: 'nearest' }); }); },
};

// ───────── Guardado, deshacer ─────────
let saveTimer;
function setStatus(kind) {
  const el = $('#save-status');
  if (!el) return;
  el.dataset.kind = kind;
  el.replaceChildren(...[kind === 'saved' ? icon('check', 18) : null, h('span', { text: t(kind === 'saved' ? 'saved' : kind === 'saving' ? 'saving' : 'saveErr') })].filter(Boolean));
}
function queueSave() {
  setStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = persist();
    setStatus(ok ? 'saved' : 'error');
    if (!ok) toast(t('saveErrLong'));
  }, 450);
}
function saveNow() { clearTimeout(saveTimer); const ok = persist(); setStatus(ok ? 'saved' : 'error'); return ok; }

function change(fn, { structural = false, coalesce = null, focus = null } = {}) {
  const now = Date.now();
  const merge = coalesce && app.coalesceKey === coalesce && now - app.lastChange < 1500;
  if (!merge) { app.undoStack.push(app.lastJson); if (app.undoStack.length > 80) app.undoStack.shift(); app.redoStack.length = 0; }
  app.coalesceKey = coalesce; app.lastChange = now;
  fn(app.cv);
  app.cv.updated = now;
  app.lastJson = JSON.stringify(app.cv);
  queueSave(); schedulePreview(); syncUndo();
  if (structural) renderPanel(focus);
}
function swapCv(json) {
  const fresh = JSON.parse(json);
  const i = state.cvs.indexOf(app.cv);
  state.cvs[i] = fresh; app.cv = fresh; app.lastJson = json; app.coalesceKey = null;
  queueSave(); renderPanel(); schedulePreview(true); syncUndo();
  const n = $('#cv-name'); if (n) n.value = fresh.name;
}
function undo() {
  if (!app.undoStack.length) return;
  app.redoStack.push(app.lastJson);
  swapCv(app.undoStack.pop());
  toast(t('undone'));
}
function redo() {
  if (!app.redoStack.length) return;
  app.undoStack.push(app.lastJson);
  swapCv(app.redoStack.pop());
  toast(t('redone'));
}
function syncUndo() {
  const u = $('#b-undo'), r = $('#b-redo');
  if (u) u.disabled = !app.undoStack.length;
  if (r) r.disabled = !app.redoStack.length;
}

// ───────── Miniaturas (muestrario y lista de currículums) ─────────
const thumbRO = new ResizeObserver((entries) => { for (const e of entries) fitThumb(e.target); });
function fitThumb(box) {
  const inner = box.firstElementChild;
  if (!inner) return;
  const pw = parseFloat(inner.dataset.pw);
  const s = box.clientWidth / pw;
  inner.style.transform = `scale(${s})`;
}
const sampleCache = new Map();
function sampleCv(tplId) {
  const key = tplId + getLang();
  if (!sampleCache.has(key)) { const c = newCV(tplId, ''); c.docLang = getLang(); fillSample(c, tplById(tplId).sample, getLang()); sampleCache.set(key, c); }
  return sampleCache.get(key);
}
// Devuelve una hoja en miniatura: de una plantilla (con datos inventados) o de un currículum guardado.
function thumb(src) {
  const cv = typeof src === 'string' ? sampleCv(src) : src;
  const pg = PAGES[cv.design.page] || PAGES.a4;
  const inner = h('div', { class: 'thumb-in', 'data-pw': pg.w, 'data-ph': pg.h, style: `width:${pg.w}px;height:${pg.h}px` });
  const box = h('div', { class: 'thumb', 'aria-hidden': 'true', style: `aspect-ratio:${pg.w}/${pg.h}` }, inner);
  const fill = () => {
    const doc = renderCV(cv, typeof src === 'string' ? { samplePhoto: true } : { ghost: ghostTexts() });
    inner.replaceChildren(doc);
    if (box.isConnected) { paginate(doc); [...doc.querySelectorAll('.page')].slice(1).forEach((p) => p.remove()); fitThumb(box); }
  };
  ensureFont(cv.design.font).then(() => requestAnimationFrame(fill));
  thumbRO.observe(box);
  return box;
}
const ghostTexts = () => ({ name: t('gName'), title: t('gTitle'), empty: t('gEmpty'), photo: t('gPhoto') });

// ───────── Inicio ─────────
function fmtDay(ts) {
  try { return new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts)); } catch { return ''; }
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
const FOLD = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', ß: 'ss', đ: 'd', Đ: 'D', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE' };
// Nombre de archivo sin acentos ni signos raros, para que no dé problemas al adjuntarlo o subirlo.
const safeName = (s) => (s || 'curriculum').replace(/[łŁøØßđĐæÆœŒ]/g, (c) => FOLD[c]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'curriculum';

function backupCvs(list, name) {
  download(`${safeName(name)}-copia.json`, backupOf(list), 'application/json');
  toast(t('backupDone'));
}
function importBackup() {
  const inp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    inp.remove();
    if (!f) return;
    try {
      const list = parseBackup(await f.text());
      for (const c of list) { c.id = uid(); state.cvs.unshift(c); }
      persist();
      if (app.view === 'home') renderHome();
      toast(t('imported', list.length));
    } catch { toast(t('importBad')); }
  });
  document.body.append(inp);
  inp.click();
}
function duplicateCv(cv, openIt) {
  const copy = JSON.parse(JSON.stringify(cv));
  copy.id = uid(); copy.name = t('copyOf', cv.name); copy.created = copy.updated = Date.now();
  state.cvs.splice(state.cvs.indexOf(cv), 0, copy);
  persist();
  if (openIt) { openCv(copy.id); toast(t('duplicated')); } else renderHome();
  return copy;
}
function createCv(tplId) {
  const n = state.cvs.length;
  const cv = newCV(tplId, t('cvDefault') + (n ? ' ' + (n + 1) : ''));
  cv.docLang = 'es';
  state.cvs.unshift(cv);
  persist();
  openCv(cv.id, true);
}

function renderHome() {
  app.view = 'home'; app.cv = null;
  document.body.dataset.view = 'home';
  renderHeader();
  const kids = [h('div', { class: 'home-intro' }, h('h1', { text: t('homeH1') }), h('p', { class: 'lead', text: t('homeLead') }))];
  if (state.cvs.length) {
    kids.push(h('section', { class: 'shelf', 'aria-labelledby': 'mine-h' },
      h('div', { class: 'shelf-head' }, h('h2', { id: 'mine-h', text: t('mine') }),
        h('div', { class: 'btn-row' }, btn('onmat', 'upload', t('importBtn'), importBackup), btn('onmat', 'download', t('backupAll'), () => backupCvs(state.cvs, 'curriculums')))),
      h('ul', { class: 'mine' }, state.cvs.map((cv) => h('li', { class: 'mine-card' },
        h('button', { type: 'button', class: 'mine-open', onclick: () => openCv(cv.id), 'aria-label': t('open') + ': ' + cv.name }, h('span', { class: 'lift' }, thumb(cv))),
        h('div', { class: 'mine-info' },
          h('h3', { text: cv.name }), h('p', { class: 'meta', text: tr(tplById(cv.template).name) + '. ' + t('edited', fmtDay(cv.updated)) }),
          h('div', { class: 'btn-row' },
            btn('primary', 'pencil', t('open'), () => openCv(cv.id)),
            btn('ghost', 'copy', t('duplicate'), () => duplicateCv(cv, false)),
            btn('ghost', 'download', t('backup'), () => backupCvs([cv], cv.name)),
            btn('ghost danger-t', 'trash', t('delete'), async () => {
              if (await confirmDelete(t('delCvT', cv.name), t('delCvB'))) { state.cvs = state.cvs.filter((c) => c !== cv); persist(); renderHome(); }
            }))))))));
  }
  const book = h('section', { class: 'shelf', id: 'muestrario', 'aria-labelledby': 'book-h' },
    h('div', { class: 'shelf-head' }, h('div', null, h('h2', { id: 'book-h', text: t('samplesH') }), h('p', { class: 'lead', text: t('samplesLead') })),
      state.cvs.length ? null : btn('onmat', 'upload', t('importBtn'), importBackup)));
  for (const [gid, gname] of GROUPS) {
    book.append(h('h3', { class: 'grp', text: tr(gname) }));
    book.append(h('ul', { class: 'samples' }, TEMPLATES.filter((x) => x.group === gid).map((tp) => h('li', null,
      h('button', { type: 'button', class: 'sample', 'data-tpl': tp.id, onclick: () => createCv(tp.id) },
        h('span', { class: 'lift' }, thumb(tp.id)),
        h('span', { class: 'sample-tag' }, h('strong', { text: tr(tp.name) }), h('span', { text: tr(tp.desc) })),
        h('span', { class: 'sample-go' }, icon('plus', 18), h('span', { text: t('useTpl') })))))));
  }
  kids.push(book);
  main.className = 'home';
  main.replaceChildren(...kids);
  scrollTo(0, 0);
  if (!state.tourDone && !homeTourSeen) { homeTourSeen = true; homeTour(); }
}

// ───────── Cabecera ─────────
function langSwitch() {
  return h('div', { class: 'lang', role: 'group', 'aria-label': t('langLabel') }, ['es', 'en'].map((l) => h('button', {
    type: 'button', 'aria-pressed': String(getLang() === l), lang: l,
    onclick: () => { if (getLang() === l) return; state.lang = l; setLang(l); persist(); sampleCache.clear(); renderStatic(); app.view === 'home' ? renderHome() : renderEditor(); },
  }, l.toUpperCase())));
}
function renderHeader() {
  const bar = $('#appbar');
  if (app.view === 'home') {
    bar.replaceChildren(h('a', { class: 'brand', href: '#/', 'aria-current': 'page' }, brandMark(), h('span', { text: t('brand') })),
      h('span', { class: 'grow' }),
      btn('bar', 'help', t('mTour'), () => { state.tourDone = false; homeTour(); }, { id: 'b-tour' }), langSwitch());
    return;
  }
  const cv = app.cv;
  bar.replaceChildren(
    h('div', { class: 'bar-row' },
      h('button', { type: 'button', class: 'btn bar', id: 'b-home', onclick: goHome }, icon('back'), h('span', { class: 'long', text: t('backHome') }), h('span', { class: 'short', text: t('backShort') })),
      h('input', { id: 'cv-name', class: 'cv-name-in', value: cv.name, 'aria-label': t('cvName'), title: t('cvName'), autocomplete: 'off', maxlength: '80',
        oninput: (e) => change((c) => { c.name = e.target.value || t('cvDefault'); }, { coalesce: 'name' }) }),
      langSwitch()),
    h('div', { class: 'bar-row tools', id: 'tools' },
      h('button', { type: 'button', class: 'btn bar', id: 'b-undo', onclick: undo }, icon('undo'), h('span', { text: t('undo') })),
      h('button', { type: 'button', class: 'btn bar', id: 'b-redo', title: t('redo'), onclick: redo }, icon('redo'), h('span', { text: t('redo') })),
      h('div', { class: 'menu-wrap' },
        h('button', { type: 'button', class: 'btn bar', id: 'b-more', 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: toggleMenu }, icon('more'), h('span', { text: t('more') })),
        h('div', { class: 'menu', id: 'menu', hidden: true }, [
          ['copy', 'mDup', 'mDupHint', () => duplicateCv(app.cv, true)],
          ['download', 'mBackup', 'mBackupHint', () => backupCvs([app.cv], app.cv.name)],
          ['sheet', 'mSample', 'mSampleHint', sampleFill],
          ['help', 'mTour', 'mTourHint', () => editorTour()],
        ].map(([ic, k, hk, fn]) => h('button', { type: 'button', class: 'menu-item', 'data-act': k, onclick: () => { closeMenu(); fn(); } }, icon(ic), h('span', null, h('strong', { text: t(k) }), h('small', { text: t(hk) })))))),
      h('span', { id: 'save-status', class: 'save', role: 'status', 'aria-live': 'polite' }),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn cta', id: 'b-pdf', onclick: exportPdf }, icon('download'), h('span', { text: t('pdf') }))));
  setStatus('saved'); syncUndo();
}
function brandMark() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('width', 30); s.setAttribute('height', 30); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="7" y="3" width="18" height="26" rx="1.5" fill="#fff"/><rect x="10.5" y="8" width="8" height="2.6" fill="#F5C518"/><path d="M10.5 14.5h11M10.5 18.5h11M10.5 22.5h7" stroke="#1C3B31" stroke-width="1.8" stroke-linecap="round"/>';
  return s;
}
function toggleMenu() {
  const m = $('#menu'), b = $('#b-more');
  const open = m.hidden;
  m.hidden = !open; b.setAttribute('aria-expanded', String(open));
  if (open) m.querySelector('button').focus();
}
function closeMenu() { const m = $('#menu'); if (m && !m.hidden) { m.hidden = true; $('#b-more').setAttribute('aria-expanded', 'false'); } }
document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenu(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const m = $('#menu'); if (m && !m.hidden) { closeMenu(); $('#b-more').focus(); } }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && app.view === 'edit' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
});

async function sampleFill() {
  const ok = await dialog({ title: t('sampleT'), body: t('sampleB'), actions: [{ label: t('cancel'), value: false }, { label: t('sampleDo'), value: true, cls: 'primary', focus: true }] });
  if (!ok) return;
  change((c) => fillSample(c, tplById(c.template).sample, c.docLang), { structural: true });
  toast(t('sampleDone'), { label: t('undo'), run: undo });
}

// ───────── Editor ─────────
function openCv(id, fresh) {
  const cv = state.cvs.find((c) => c.id === id);
  if (!cv) return renderHome();
  app.view = 'edit'; app.cv = cv; app.tab = 'content'; app.open = 'personal'; app.openItem = null; app.mobile = 'form'; app.zoom = false;
  app.undoStack = []; app.redoStack = []; app.lastJson = JSON.stringify(cv); app.coalesceKey = null;
  if (location.hash !== '#/cv/' + id) history.pushState(null, '', '#/cv/' + id);
  renderEditor();
  if (!state.tourDone) editorTour(true);
}
function goHome() {
  saveNow(); endTour();
  if (location.hash !== '#/' && location.hash !== '') history.pushState(null, '', '#/');
  renderHome();
}
addEventListener('popstate', route);
function route() {
  const m = /^#\/cv\/(.+)$/.exec(location.hash);
  hideToast();
  if (m && state.cvs.some((c) => c.id === m[1])) { if (!app.cv || app.cv.id !== m[1]) openCv(m[1]); }
  else { endTour(); renderHome(); }
}

function setTab(tab, focusIt) {
  app.tab = tab;
  for (const b of document.querySelectorAll('.tabs [role=tab]')) { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focusIt) b.focus(); }
  renderPanel();
  $('#panel-scroll').scrollTop = 0;
}
function setMobile(v) {
  app.mobile = v;
  document.body.dataset.mobile = v;
  for (const b of document.querySelectorAll('.viewbar [data-v]')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  if (v === 'sheet') { if (app.previewDirty) schedulePreview(true); else requestAnimationFrame(fitStage); }
}

function renderEditor() {
  document.body.dataset.view = 'edit';
  renderHeader();
  const tabs = [['content', 'tabContent'], ['template', 'tabTemplate'], ['design', 'tabDesign'], ['dest', 'tabDest']];
  main.className = 'editor';
  main.replaceChildren(
    h('section', { class: 'panel', id: 'panel', 'aria-label': t('vForm') },
      h('div', { class: 'tabs', role: 'tablist', onkeydown: (e) => {
        const i = tabs.findIndex((x) => x[0] === app.tab);
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); setTab(tabs[(i + d + tabs.length) % tabs.length][0], true); }
      } }, tabs.map(([id, k]) => h('button', { type: 'button', role: 'tab', id: 'tab-' + id, 'data-tab': id, 'aria-selected': String(app.tab === id), 'aria-controls': 'panel-scroll', tabindex: app.tab === id ? 0 : -1, onclick: () => setTab(id) }, t(k)))),
      h('div', { class: 'panel-scroll', id: 'panel-scroll', role: 'tabpanel' })),
    h('section', { class: 'stage', id: 'stage', 'aria-label': t('stageLabel') },
      h('div', { class: 'stage-bar' }, h('span', { class: 'pages', id: 'pages', role: 'status' }),
        h('button', { type: 'button', class: 'btn onmat', id: 'b-zoom', onclick: () => { app.zoom = !app.zoom; fitStage(); syncZoom(); } }, icon('zoom'), h('span', null))),
      h('div', { class: 'stage-scroll', id: 'stage-scroll' }, h('div', { class: 'sheet-outer', id: 'sheet-outer' }, h('div', { class: 'sheet-scale', id: 'sheet-scale' })))),
    h('nav', { class: 'viewbar', 'aria-label': t('stageLabel') },
      h('button', { type: 'button', 'data-v': 'form', onclick: () => setMobile('form') }, icon('pencil'), h('span', { text: t('vForm') })),
      h('button', { type: 'button', 'data-v': 'sheet', onclick: () => setMobile('sheet') }, icon('sheet'), h('span', { text: t('vSheet') })),
      h('button', { type: 'button', class: 'vb-pdf', id: 'b-pdf-m', onclick: exportPdf }, icon('download'), h('span', { text: t('pdf') }))));
  $('#sheet-scale').addEventListener('click', (e) => {
    if (tourActive()) return;
    const sec = e.target.closest('[data-sec]'), head = e.target.closest('.cv-head, .k-contact, .side-photo');
    if (!sec && !head) return;
    app.tab = 'content'; app.open = sec ? sec.dataset.sec : 'personal'; app.openItem = null;
    setTab('content'); setMobile('form');
    requestAnimationFrame(() => { const c = document.querySelector('.sec-card.open'); if (c) { c.scrollIntoView({ block: 'start' }); c.querySelector('.sec-toggle').focus({ preventScroll: true }); } });
  });
  syncZoom(); setMobile(app.mobile); renderPanel(); schedulePreview(true);
}
function syncZoom() { const b = $('#b-zoom'); if (b) { b.lastChild.textContent = t(app.zoom ? 'zoomFit' : 'zoomIn'); b.setAttribute('aria-pressed', String(app.zoom)); } }

function renderPanel(focusSel) {
  const box = $('#panel-scroll');
  if (!box) return;
  const active = document.activeElement, keepId = active && box.contains(active) ? active.id : null;
  const top = box.scrollTop;
  const pane = app.tab === 'content' ? renderContent(app) : app.tab === 'template' ? renderTemplates(app) : app.tab === 'design' ? renderDesign(app) : renderDest(app);
  box.setAttribute('aria-labelledby', 'tab-' + app.tab);
  box.replaceChildren(pane, h('footer', { class: 'panel-foot' }, h('span', { text: t('footLocal') }), h('a', { class: 'seal', href: '../', text: t('seal') })));
  box.scrollTop = top;
  const target = focusSel ? box.querySelector(focusSel) : keepId ? document.getElementById(keepId) : null;
  if (target) target.focus({ preventScroll: !focusSel });
}

// ───────── Vista previa ─────────
let prevTimer, prevSeq = 0;
function schedulePreview(now) {
  clearTimeout(prevTimer);
  prevTimer = setTimeout(renderPreview, now === true ? 0 : 140);
}
async function renderPreview() {
  const cv = app.cv, seq = ++prevSeq;
  if (!cv || app.view !== 'edit') return;
  await ensureFont(cv.design.font || tplById(cv.template).font);
  if (seq !== prevSeq || cv !== app.cv) return;
  const holder = $('#sheet-scale');
  if (!holder) return;
  // En móvil la mesa está oculta mientras se rellena: no se puede medir, se pinta al volver a «Ver hoja».
  if (!$('#stage').offsetWidth) { app.previewDirty = true; return; }
  app.previewDirty = false;
  const doc = renderCV(cv, { ghost: ghostTexts() });
  holder.replaceChildren(doc);
  const n = paginate(doc);
  fitStage();
  const dest = destById(cv.country);
  const pages = $('#pages');
  const txt = n === 1 ? t('pages1') : t('pagesN', n);
  pages.textContent = n > dest.pages ? txt + '. ' + t('pagesWarn', tr(dest.name), dest.pages === 1 ? t('pages1') : t('pagesN', dest.pages)) : txt;
  pages.dataset.warn = String(n > dest.pages);
}
function fitStage() {
  const outer = $('#sheet-outer'), holder = $('#sheet-scale'), sc = $('#stage-scroll');
  if (!outer || !holder.firstElementChild) return;
  const pg = PAGES[app.cv.design.page] || PAGES.a4;
  const pad = narrow() ? 12 : 28;
  const avail = sc.clientWidth - pad * 2;
  if (avail <= 0) return;
  const s = app.zoom ? Math.max(1, avail / pg.w) : Math.min(1.15, avail / pg.w);
  holder.style.transform = `scale(${s})`;
  outer.style.width = Math.round(pg.w * s) + 'px';
  outer.style.height = Math.round(holder.firstElementChild.offsetHeight * s) + 'px';
}
new ResizeObserver(() => { if (app.view === 'edit') fitStage(); }).observe(document.documentElement);

function applyTpl(id) {
  change((c) => applyTemplate(c, id), { structural: true });
  const holder = $('#sheet-outer');
  holder.classList.remove('swap'); void holder.offsetWidth; holder.classList.add('swap');
  toast(t('tplChanged', tr(tplById(id).name)), { label: t('undo'), run: undo });
}

// ───────── Foto: se abre, se recorta y se reduce aquí mismo, en el navegador. No se sube a ningún sitio. ─────────
function pickPhoto() {
  const inp = h('input', { type: 'file', accept: 'image/*', hidden: true, id: 'photo-input' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    inp.remove();
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      const img = new Image();
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
      const W = 480, H = 600; // 4:5, suficiente para imprimir a tamaño carné
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const c = h('canvas', { width: W, height: H });
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', 0.86);
      change((cv) => { cv.personal.photo = data; cv.design.photo = true; }, { structural: true });
    } catch { toast(t('photoErr')); }
  });
  document.body.append(inp);
  inp.click();
}

// ───────── PDF ─────────
let pdfBusy = false;
async function exportPdf() {
  if (pdfBusy) return;
  pdfBusy = true;
  const btns = [$('#b-pdf'), $('#b-pdf-m')].filter(Boolean);
  for (const b of btns) { b.disabled = true; b.lastChild.textContent = t('pdfBusy'); }
  try {
    const { buildPdf, downloadBlob } = await import('./pdf.js');
    const cv = app.cv, p = cv.personal;
    const person = [p.firstName, p.lastName].filter(Boolean).join(' ');
    const res = await buildPdf(cv, { title: (cv.docLang === 'es' ? 'Currículum' : 'CV') + (person ? ' – ' + person : ''), author: person });
    const filename = 'CV-' + safeName(person || cv.name) + '.pdf';
    downloadBlob(res.blob, filename);
    // Punto de integración futuro (ahora no hace nada): enviar o compartir el PDF. Ver js/integraciones.js.
    afterPdfReady({ blob: res.blob, filename, cv });
    toast(t('pdfDone', res.pages === 1 ? t('pages1') : t('pagesN', res.pages)) + (res.missing ? ' ' + t('pdfMissing') : ''));
  } catch (e) {
    console.error(e);
    toast(t('pdfErr'));
  } finally {
    pdfBusy = false;
    for (const b of btns) { b.disabled = false; b.lastChild.textContent = t('pdf'); }
  }
}

// ───────── Guía ─────────
let homeTourSeen = false;
function finishTour() { state.tourDone = true; persist(); }
function homeTour() {
  startTour([{ sel: '#muestrario .samples', title: t('t0T'), text: t('t0X') }], { lastLabel: t('t0Go'), onEnd: (fin) => { if (!fin) finishTour(); } });
}
function editorTour() {
  const form = () => { setMobile('form'); };
  const tab = (id) => () => { form(); if (app.tab !== id) setTab(id); };
  startTour([
    { sel: '#secs', title: t('t1T'), text: t('t1X'), before: tab('content') },
    { sel: '.sec-list .sec-card', title: t('t2T'), text: t('t2X'), before: () => { tab('content')(); if (app.open && app.open !== 'personal') { app.open = null; renderPanel(); } } },
    { sel: narrow() ? '#stage-scroll' : '#stage', title: t('t3T'), text: t('t3X'), before: () => setMobile('sheet') },
    { sel: '#tab-template', title: t('t4T'), text: t('t4X'), before: tab('template') },
    { sel: '#tab-design', title: t('t5T'), text: t('t5X'), before: tab('design') },
    { sel: '#tab-dest', title: t('t6T'), text: t('t6X'), before: tab('dest') },
    { sel: narrow() ? '#b-undo' : '#save-status', title: t('t7T'), text: t('t7X'), before: tab('content') },
    { sel: narrow() ? '#b-pdf-m' : '#b-pdf', title: t('t8T'), text: t('t8X'), before: form },
  ], { onEnd: finishTour });
}

// ───────── Textos fijos y arranque ─────────
function renderStatic() {
  $('#skip').textContent = t('skip');
  $('#f-local').textContent = t('footLocal');
  $('#f-offline').textContent = t('footOffline');
  document.title = getLang() === 'en' ? 'Curriculum · CV builder' : 'Currículum · creador de currículums';
}

load();
setLang(state.lang);
renderStatic();
route();
addEventListener('beforeunload', () => { if (app.view === 'edit') saveNow(); });
addEventListener('pagehide', () => { if (app.view === 'edit') persist(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Sin modo sin conexión:', e)); });
}
