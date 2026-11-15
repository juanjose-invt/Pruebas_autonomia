import { t, setLang, getLang, locale, applyI18n } from './i18n.js';
import * as img from './imaging.js';
import { recognize } from './ocr.js';
import { extractFields, buildRows, parseForField, parseAmount, formatAmount, statusOf, fold, datesIn, FIELDS } from './extract.js';
import * as db from './db.js';
import { readHuchas, addExpense, stillThere, huchasCSV } from './huchas.js';

const $ = (s, el = document) => el.querySelector(s);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const HL = { vendor: 'var(--hl-vendor)', date: 'var(--hl-date)', total: 'var(--hl-total)', tax: 'var(--hl-tax)' };
const CUR = { EUR: '€', USD: '$', GBP: '£' };

const el = {
  glass: $('#glass'), empty: $('#empty'), cam: $('#cam'), video: $('#camVideo'),
  doc: $('#doc'), canvas: $('#docCanvas'), marks: $('#marks'), shade: $('#shade'), lamp: $('#lamp'),
  crop: $('#crop'), cropRect: $('#cropRect'), dropHint: $('#dropHint'),
  readout: $('#readout'), readoutText: $('#readoutText'), meter: $('#meter'),
  tools: $('#tools'), tScan: $('#tScan'), tScanLabel: $('#tScanLabel'),
  pCrop: $('#pCrop'), pStraight: $('#pStraight'), pContrast: $('#pContrast'), pPdf: $('#pPdf'),
  angle: $('#angle'), angleOut: $('#angleOut'), boost: $('#boost'), boostOut: $('#boostOut'), bw: $('#bw'),
  ticket: $('#ticket'),
  assign: $('#assign'), assignTitle: $('#assignTitle'), assignOpts: $('#assignOpts'),
  pointing: $('#pointing'), pointingText: $('#pointingText'),
  history: $('#history'), historyBack: $('#historyBack'), stubs: $('#stubs'), historySearch: $('#historySearch'),
  historyCount: $('#historyCount'), historyEmpty: $('#historyEmpty'),
  hu: $('#huDialog'),
  toast: $('#toast'), toastMsg: $('#toastMsg'), toastAct: $('#toastAct'), toastLink: $('#toastLink'),
  fileInput: $('#fileInput'), camInput: $('#camInput'),
};

// ---------- estado ----------
const S = {
  src: null,              // canvas original (ya reducido)
  pdf: null, pdfPage: 1,
  params: { rot: 0, angle: 0, crop: null, boost: 60, bw: false },
  rot: null, rotKey: '',  // caché del giro
  out: null,              // imagen tratada que se ve y se reconoce
  doc: null,              // documento actual (ver newDoc)
  imageBlob: null,        // JPEG de S.out ya codificado
  stale: false,           // la imagen cambió después de reconocer
  busy: false,
  tool: null,
  pointField: null,
  cropDraft: null,
  rows: [],
};

function newDoc() {
  return {
    id: db.uid(), created: Date.now(), updated: Date.now(),
    text: '', words: [], width: 0, height: 0,
    fields: Object.fromEntries(FIELDS.map((f) => [f, { value: null, conf: 0, status: 'doubt', bbox: null, source: 'auto' }])),
    notes: [], english: false, currency: null, sent: null, scanned: false, thumb: '',
  };
}

// ---------- avisos ----------
let toastTimer = 0;
function toast(msg, { action, label, href, ms = 3600 } = {}) {
  clearTimeout(toastTimer);
  el.toastMsg.textContent = msg;
  el.toastAct.hidden = !action;
  el.toastLink.hidden = !href;
  if (action) { el.toastAct.textContent = label; el.toastAct.onclick = () => { el.toast.hidden = true; action(); }; }
  if (href) { el.toastLink.textContent = label; el.toastLink.href = href; }
  el.toast.hidden = false;
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms);
}

function readout(msg, busy = false) {
  el.readoutText.textContent = msg || '';
  el.readout.classList.toggle('busy', busy);
}

// ---------- carga ----------
async function openFile(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf && file.type && !file.type.startsWith('image/')) { toast(t('err.file')); return; }
  readout(t('bed.loading'), true);
  try {
    if (isPdf) {
      try {
        S.pdf = await img.openPdf(file);
      } catch (e) {
        toast(t('err.pdf', { e: e.message || e }), { ms: 6000 });
        readout('');
        return;
      }
      S.pdfPage = 1;
      await setSource(await img.renderPdfPage(S.pdf, 1));
    } else {
      S.pdf = null;
      await setSource(await img.canvasFromBlob(file));
    }
  } catch (e) {
    console.warn(e);
    toast(t('err.file'));
    readout('');
  }
}

async function setSource(canvas, { keepDoc = false, params } = {}) {
  closeTool();
  stopPointing();
  S.src = canvas;
  S.rot = null;
  S.rotKey = '';
  if (params) S.params = params;
  else S.params = { rot: 0, ...autoAdjust(canvas, 0), boost: 60, bw: false };
  if (!keepDoc) { S.doc = newDoc(); S.imageBlob = null; }
  S.stale = false;
  syncPanels();
  render();
  showBed('doc');
  el.pPdf.hidden = !S.pdf || S.pdf.numPages < 2;
  if (S.pdf) $('#pdfLabel').textContent = t('pdf.page', { p: S.pdfPage, n: S.pdf.numPages });
  readout(S.doc.scanned ? t('bed.tapHint') : t('bed.ready'));
  renderTicket();
}

function showBed(which) {
  el.empty.hidden = which !== 'empty';
  el.cam.hidden = which !== 'cam';
  el.doc.hidden = which !== 'doc';
  el.tools.hidden = which !== 'doc';
  if (which !== 'doc') { closeTool(); el.pPdf.hidden = true; }
}

// ---------- tratamiento ----------
// Enderezado y recorte automáticos para una orientación dada. Deja el giro en caché.
function autoAdjust(src, rot) {
  let angle = 0, crop = null;
  try {
    const a = img.detectSkew(rot ? img.rotated(src, rot, 0) : src);
    angle = Math.abs(a) >= 0.3 ? a : 0;
  } catch (e) { angle = 0; }
  try {
    // Foto de un ticket sobre una mesa: se recorta al papel (se deshace con «Recortar → Todo»).
    S.src = src;
    S.rot = rotatedSrcFor(src, { rot, angle });
    S.rotKey = `${rot}|${angle}`;
    const r = img.detectPaper(S.rot);
    if (r && r.w * r.h < 0.85 && r.w * r.h > 0.15) crop = r;
  } catch (e) { crop = null; }
  return { angle, crop };
}
function rotatedSrcFor(src, p) {
  return (p.rot || p.angle) ? img.rotated(src, p.rot, p.angle) : src;
}
function rotatedSrc() {
  const key = `${S.params.rot}|${S.params.angle}`;
  if (!S.rot || S.rotKey !== key) {
    S.rot = (S.params.rot || S.params.angle) ? img.rotated(S.src, S.params.rot, S.params.angle) : S.src;
    S.rotKey = key;
  }
  return S.rot;
}

function render({ preview = false } = {}) {
  if (!S.src) return;
  const base = preview ? rotatedSrc() : img.cropped(rotatedSrc(), S.params.crop);
  S.out = preview ? base : img.enhanced(base, S.params.boost, S.params.bw);
  const c = el.canvas;
  c.width = S.out.width;
  c.height = S.out.height;
  c.getContext('2d').drawImage(S.out, 0, 0);
  el.canvas.style.transform = '';
  layoutDoc();
  if (!preview) {
    S.imageBlob = null;
    if (S.doc && S.doc.scanned) {
      // Las zonas reconocidas ya no corresponden a esta imagen.
      S.stale = true;
      readout(t('bed.changed'));
    }
    drawMarks();
  } else el.marks.innerHTML = '';
}

function layoutDoc() {
  if (!S.out || el.doc.hidden && !S.out) return;
  const gw = el.glass.clientWidth, gh = el.glass.clientHeight;
  const pad = gw < 500 ? 16 : 32;
  const k = Math.min((gw - pad * 2) / S.out.width, (gh - pad * 2) / S.out.height);
  const w = Math.max(1, Math.floor(S.out.width * k)), h = Math.max(1, Math.floor(S.out.height * k));
  el.doc.style.width = `${w}px`;
  el.doc.style.height = `${h}px`;
  el.glass.style.setProperty('--doc-top', `${(gh - h) / 2}px`);
  el.glass.style.setProperty('--doc-h', `${h}px`);
}
new ResizeObserver(() => layoutDoc()).observe(el.glass);

// ---------- marcas sobre la imagen ----------
const pct = (v, total) => `${(v / total) * 100}%`;
function boxStyle(b, W, H, padX = 0, padY = 0) {
  return `left:${pct(b.x0 - padX, W)};top:${pct(b.y0 - padY, H)};width:${pct(b.x1 - b.x0 + padX * 2, W)};height:${pct(b.y1 - b.y0 + padY * 2, H)}`;
}

function drawMarks({ swipe = false } = {}) {
  const d = S.doc;
  el.marks.innerHTML = '';
  if (!d || !d.scanned || S.stale || !d.width) return;
  const W = d.width, H = d.height;
  const frag = document.createDocumentFragment();
  d.words.forEach((w, i) => {
    const e = document.createElement('div');
    e.className = 'w';
    e.dataset.i = i;
    e.setAttribute('style', boxStyle(w.bbox, W, H, 2, 2));
    frag.appendChild(e);
  });
  let n = 0;
  for (const f of FIELDS) {
    const fd = d.fields[f];
    if (!fd.bbox || fd.value == null) continue;
    const doubt = fd.status === 'doubt';
    const hl = document.createElement('div');
    hl.className = `hl${swipe && !reduced.matches ? ' swipe' : ''}${doubt ? ' doubt' : ''}`;
    const padY = (fd.bbox.y1 - fd.bbox.y0) * 0.22;
    hl.setAttribute('style', `${boxStyle(fd.bbox, W, H, 6, padY)};--c:${HL[f]};--d:${n * 140}ms`);
    const tag = document.createElement('span');
    tag.className = `hl-tag${doubt ? ' doubt' : ''}`;
    tag.textContent = t(`field.${f}`) + (doubt ? ' ?' : '');
    // La etiqueta va al lado libre del trazo (izquierda si el dato está a la derecha).
    const right = (fd.bbox.x0 + fd.bbox.x1) / 2 > W * 0.5;
    const cy = pct((fd.bbox.y0 + fd.bbox.y1) / 2, H);
    tag.className += right ? ' at-left' : ' above';
    tag.setAttribute('style', right
      ? `right:${pct(W - fd.bbox.x0 + 10, W)};top:${cy};--c:${HL[f]}`
      : `left:${pct(fd.bbox.x0 - 6, W)};top:${pct(fd.bbox.y0 - padY, H)};--c:${HL[f]}`);
    frag.append(hl, tag);
    n++;
  }
  el.marks.appendChild(frag);
}

// ---------- reconocimiento ----------
let lastP = 0;
function setProgress(p) {
  lastP = p;
  el.glass.style.setProperty('--p', p);
  el.doc.style.setProperty('--p', p);
  el.meter.style.setProperty('--p', p);
}

async function scan() {
  if (!S.out || S.busy) return;
  closeTool();
  stopPointing();
  S.busy = true;
  setBusyUI(true);
  setProgress(0);
  el.lamp.hidden = false;
  el.lamp.classList.add('warming');
  el.shade.hidden = false;
  el.marks.innerHTML = '';
  el.meter.hidden = !reduced.matches;
  readout(t('ocr.warm'), true);
  const target = S.out;
  try {
    const res = await recognize(target, ({ stage, progress }) => {
      if (stage === 'reading') {
        el.lamp.classList.remove('warming');
        setProgress(Math.max(lastP, Math.min(1, progress)));
        readout(t('ocr.reading', { p: Math.round(progress * 100) }), true);
      } else {
        const key = { warm: 'ocr.warm', core: 'ocr.core', lang: 'ocr.lang', init: 'ocr.init' }[stage] || 'ocr.init';
        readout(t(key) + (stage === 'lang' || stage === 'core' ? ` ${Math.round(progress * 100)} %` : ''), true);
      }
    });
    setProgress(1);
    const d = S.doc && !S.doc.scanned ? S.doc : { ...newDoc(), id: S.doc ? S.doc.id : db.uid(), created: S.doc ? S.doc.created : Date.now(), sent: S.doc ? S.doc.sent : null };
    d.text = res.text;
    d.words = res.words;
    d.width = target.width;
    d.height = target.height;
    d.scanned = true;
    d.updated = Date.now();
    const ex = extractFields(res.words, { width: target.width, height: target.height, lang: getLang() });
    // Lo que la persona ya había corregido a mano se respeta al volver a reconocer.
    for (const f of FIELDS) {
      if (S.doc && S.doc.fields[f] && S.doc.fields[f].source !== 'auto' && S.doc.scanned) d.fields[f] = { ...S.doc.fields[f], bbox: null };
      else d.fields[f] = ex.fields[f];
    }
    d.notes = ex.notes;
    d.english = ex.english;
    d.currency = ex.currency;
    S.doc = d;
    S.rows = buildRows(d.words);
    S.stale = false;
    await finishLamp();
    drawMarks({ swipe: true });
    renderTicket({ print: true });
    readout(res.words.length ? `${t('ocr.done', { n: res.words.length })} ${t('bed.tapHint')}` : t('ocr.nothing'));
    if (!res.words.length) toast(t('ocr.nothing'), { ms: 6000 });
    await saveDoc({ image: true });
  } catch (e) {
    console.error(e);
    el.lamp.hidden = true;
    el.shade.hidden = true;
    readout('');
    toast(t('ocr.fail', { e: (e && e.message) || String(e) }), { ms: 7000 });
  } finally {
    S.busy = false;
    setBusyUI(false);
    el.meter.hidden = true;
  }
}

function finishLamp() {
  return new Promise((res) => {
    const done = () => { el.lamp.hidden = true; el.shade.hidden = true; el.lamp.classList.remove('warming'); res(); };
    if (reduced.matches) { done(); return; }
    setTimeout(done, 380);
  });
}

function setBusyUI(b) {
  for (const btn of el.tools.querySelectorAll('button')) btn.disabled = b;
  el.tScan.setAttribute('aria-busy', String(b));
  if (b) el.tScanLabel.textContent = t('ocr.busy');
  else el.tScanLabel.textContent = t(S.doc && S.doc.scanned ? 'tool.rescan' : 'tool.scan');
}

// ---------- guardado ----------
let saveTimer = 0;
async function saveDoc({ image = false } = {}) {
  const d = S.doc;
  if (!d || !d.scanned) return;
  if (image || !S.imageBlob) {
    S.imageBlob = await img.toBlob(S.out, 'image/jpeg', 0.85);
    d.thumb = img.thumbnail(S.out, 240, 0.7);
  }
  d.updated = Date.now();
  const ok = await db.put({ ...d, image: S.imageBlob });
  const saveEl = $('#tSave');
  if (saveEl) saveEl.textContent = ok ? t('ticket.saved') : t('err.storage');
  if (!ok) toast(t('err.storage'), { ms: 6000 });
  if (!el.history.hidden) renderHistory();
}
function saveSoon() {
  clearTimeout(saveTimer);
  const saveEl = $('#tSave');
  if (saveEl) saveEl.textContent = t('ticket.unsaved');
  saveTimer = setTimeout(() => saveDoc(), 600);
}

// ---------- ticket ----------
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDateTime = (ms) => new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
};

const isoToDMY = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');
function fieldValueText(f, v) {
  if (v == null) return '';
  if (f === 'date') return isoToDMY(v);
  if (f === 'total' || f === 'tax') return formatAmount(v, getLang());
  return String(v);
}

function dots(conf) {
  const n = Math.round(conf * 10);
  return Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
}

function fieldHTML(f) {
  const fd = S.doc.fields[f];
  const big = f === 'total';
  const st = fd.source === 'manual' ? 'manual' : fd.status;
  const isAmt = f === 'total' || f === 'tax';
  const cur = isAmt ? (CUR[S.doc.currency] || '€') : '';
  const input = f === 'date'
    ? `<input id="f-${f}" type="text" inputmode="numeric" value="${h(isoToDMY(fd.value))}" placeholder="${h(t('field.ph.date'))}" aria-label="${h(t('field.' + f))}" autocomplete="off" spellcheck="false">`
    : `<input id="f-${f}" type="text" value="${h(fieldValueText(f, fd.value))}" ${isAmt ? 'inputmode="decimal"' : ''} placeholder="${h(t(isAmt ? 'field.ph.amount' : 'field.ph.vendor'))}" aria-label="${h(t('field.' + f))}" autocomplete="off" spellcheck="false">`;
  return `<div class="f st-${st}${big ? ' big' : ''}" data-field="${f}" style="--c:${HL[f]}">
    <div class="f-top"><span class="f-label">${h(t('field.' + f))}</span><span class="f-state st-${st}">${h(t('status.' + st))}</span></div>
    <div class="f-val">${input}${cur ? `<span class="f-cur">${h(cur)}</span>` : ''}
      <button type="button" class="pt-btn" data-point="${f}" aria-pressed="${S.pointField === f}" aria-label="${h(t('field.point'))}" title="${h(t('field.point'))}"><svg class="ico" aria-hidden="true"><use href="#i-point"/></svg></button></div>
    <div class="f-conf"><span class="dots" aria-hidden="true">${dots(st === 'manual' ? 1 : fd.conf)}</span><span>${fd.value == null && st !== 'manual' ? h(t('field.none')) : st === 'manual' ? h(t('status.manual')) : h(t('field.conf', { p: Math.round(fd.conf * 100) }))}</span></div>
    ${fd.source === 'picked' ? `<p class="f-note">${h(t('field.picked'))}</p>` : ''}
    ${st === 'doubt' ? `<p class="f-note warn">${h(t('status.doubt.long'))}</p>` : ''}
  </div>`;
}

function doubtCount() {
  if (!S.doc) return 0;
  return FIELDS.filter((f) => S.doc.fields[f].source !== 'manual' && S.doc.fields[f].status === 'doubt').length;
}

function notesHTML() {
  const d = S.doc;
  const NOTE_FIELD = { 'total-guess': 'total', 'tax-sum': 'tax', 'tax-derived': 'tax', 'sum-ok': 'tax', 'sum-mismatch': 'total', 'date-ambiguous': 'date', 'date-swapped': 'date', 'date-future': 'date' };
  // Una nota sobre un campo deja de mostrarse cuando la persona lo ha señalado o corregido.
  return (d.notes || []).filter((n) => !NOTE_FIELD[n] || d.fields[NOTE_FIELD[n]].source === 'auto').map((n) => `<p class="f-note">${h(t('note.' + n))}</p>`).join('');
}

function renderTicket({ print = false } = {}) {
  const d = S.doc;
  const foot = `<hr class="cut"><footer class="t-foot"><p>${h(t('ticket.thanks'))}</p>
    ${d && d.scanned ? `<p class="t-save" id="tSave">${h(db.available ? t('ticket.saved') : t('err.storage'))}</p>` : ''}
    <a class="sign" href="../">${h(t('sign'))}</a></footer>`;
  if (!d || !d.scanned) {
    el.ticket.innerHTML = `<header class="t-head"><h2>${h(t('ticket.head'))}</h2></header><hr class="cut"><p class="t-empty">${h(t('ticket.empty'))}</p>${foot}`;
    return;
  }
  const dc = doubtCount();
  const sentInfo = d.sent ? `<p class="t-sent">${h(t('ticket.sentTo', { d: fmtDateTime(d.sent.at) }))}</p>` : '';
  el.ticket.innerHTML = `
    <header class="t-head"><h2>${h(t('ticket.head'))}</h2>
      <p class="t-meta">${h(t('ticket.scanned', { d: fmtDateTime(d.created) }))}</p>
      <p class="t-sum ${dc ? 'bad' : ''}" id="tSum">${h(dc ? (dc === 1 ? t('ticket.doubtCount1') : t('ticket.doubtCount', { n: dc })) : t('ticket.allChecked'))}</p>
    </header>
    <hr class="cut">
    <div class="t-fields">${FIELDS.map(fieldHTML).join('')}</div>
    <div id="tNotes">${notesHTML()}</div>
    <hr class="cut">
    <div class="t-actions">
      <button type="button" class="paper-btn" id="copyText"><svg class="ico" aria-hidden="true"><use href="#i-copy"/></svg>${h(t('ticket.copy'))}</button>
      <button type="button" class="paper-btn" id="txtText"><svg class="ico" aria-hidden="true"><use href="#i-download"/></svg>${h(t('ticket.txt'))}</button>
      <button type="button" class="paper-btn ink wide" id="sendHuchas"><svg class="ico" aria-hidden="true"><use href="#i-send"/></svg>${h(t('ticket.huchas'))}</button>
    </div>
    ${sentInfo}
    <hr class="cut">
    <section class="t-text"><h3><label for="fullText">${h(t('ticket.text'))}</label></h3>
      <textarea id="fullText" spellcheck="false">${h(d.text)}</textarea></section>
    ${foot}`;
  if (print && !reduced.matches) {
    el.ticket.classList.remove('printing');
    void el.ticket.offsetWidth;
    el.ticket.classList.add('printing');
  }
}

function refreshField(f) {
  const row = el.ticket.querySelector(`.f[data-field="${f}"]`);
  if (!row) return;
  const focused = document.activeElement && row.contains(document.activeElement) ? document.activeElement.id || document.activeElement.dataset.point : null;
  const tmp = document.createElement('div');
  tmp.innerHTML = fieldHTML(f);
  row.replaceWith(tmp.firstElementChild);
  if (focused) {
    const again = el.ticket.querySelector(`#${CSS.escape(focused)}`) || el.ticket.querySelector(`[data-point="${focused}"]`);
    if (again) again.focus();
  }
  const tn = $('#tNotes');
  if (tn) tn.innerHTML = notesHTML();
  const dc = doubtCount();
  const sum = $('#tSum');
  if (sum) {
    sum.textContent = dc ? (dc === 1 ? t('ticket.doubtCount1') : t('ticket.doubtCount', { n: dc })) : t('ticket.allChecked');
    sum.classList.toggle('bad', !!dc);
  }
}

// edición a mano de un campo
el.ticket.addEventListener('change', (e) => {
  const inp = e.target;
  if (inp.id === 'fullText') return;
  const m = /^f-(\w+)$/.exec(inp.id || '');
  if (!m || !S.doc) return;
  const f = m[1];
  const raw = inp.value.trim();
  const fd = S.doc.fields[f];
  if (!raw) {
    S.doc.fields[f] = { value: null, conf: 0, status: 'doubt', bbox: null, source: 'auto' };
  } else {
    let v = raw;
    if (f === 'total' || f === 'tax') {
      v = parseAmount(raw.replace(/\s/g, '').replace(/^(\d+)[.,](\d)$/, '$1,$20'));
      if (v == null && /^\d+$/.test(raw)) v = Number(raw);
      if (v == null) { toast(t('field.unparsable', { t: raw, what: t('field.what.amount') })); inp.value = fieldValueText(f, fd.value); return; }
    }
    if (f === 'vendor') v = raw.slice(0, 80);
    if (f === 'date') {
      v = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseForField('date', raw, false);
      if (!v) { toast(t('field.unparsable', { t: raw, what: t('field.what.date') })); inp.value = fieldValueText(f, fd.value); return; }
    }
    S.doc.fields[f] = { value: v, conf: 1, status: 'manual', bbox: fd.bbox, source: 'manual' };
  }
  refreshField(f);
  drawMarks();
  saveSoon();
});
el.ticket.addEventListener('input', (e) => {
  if (e.target.id === 'fullText' && S.doc) { S.doc.text = e.target.value; saveSoon(); }
});
el.ticket.addEventListener('click', async (e) => {
  const pt = e.target.closest('[data-point]');
  if (pt) { togglePointing(pt.dataset.point); return; }
  if (e.target.closest('#copyText')) copyText();
  else if (e.target.closest('#txtText')) download(`${fileBase()}.txt`, S.doc.text + '\n', 'text/plain;charset=utf-8');
  else if (e.target.closest('#sendHuchas')) openHuchas();
});

async function copyText() {
  const text = S.doc ? S.doc.text : '';
  try {
    await navigator.clipboard.writeText(text);
    toast(t('ticket.copied'));
  } catch (err) {
    const ta = $('#fullText');
    if (ta) { ta.focus(); ta.select(); }
    try { if (document.execCommand('copy')) { toast(t('ticket.copied')); return; } } catch (e2) { /* nada */ }
    toast(t('ticket.copyFail'));
  }
}

function fileBase(d = S.doc) {
  const v = (d.fields.vendor.value || 'documento').toString();
  const slug = fold(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'documento';
  return `${slug}-${d.fields.date.value || new Date(d.created).toISOString().slice(0, 10)}`;
}

function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ---------- señalar en la imagen ----------
function togglePointing(f) {
  if (S.pointField === f) { stopPointing(); return; }
  if (!S.doc || !S.doc.scanned || S.stale) { toast(t('bed.changed')); return; }
  closeTool();
  S.pointField = f;
  el.marks.classList.add('picking');
  el.pointingText.textContent = t('field.pointing', { f: t('field.' + f) });
  el.pointing.hidden = false;
  for (const b of el.ticket.querySelectorAll('[data-point]')) b.setAttribute('aria-pressed', String(b.dataset.point === f));
  if (window.matchMedia('(max-width: 899px), (orientation: portrait)').matches) el.glass.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
}
function stopPointing() {
  S.pointField = null;
  el.marks.classList.remove('picking');
  el.pointing.hidden = true;
  for (const b of el.ticket.querySelectorAll('[data-point]')) b.setAttribute('aria-pressed', 'false');
}
$('#pointingCancel').addEventListener('click', stopPointing);

function wordAt(clientX, clientY) {
  const d = S.doc;
  if (!d || !d.words.length) return -1;
  const r = el.doc.getBoundingClientRect();
  const kx = d.width / r.width, ky = d.height / r.height;
  const x = (clientX - r.left) * kx, y = (clientY - r.top) * ky;
  const tol = 22 * kx;
  let best = -1, bestD = Infinity;
  d.words.forEach((w, i) => {
    const b = w.bbox;
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1);
    const dist = Math.hypot(dx, dy * 1.5);
    if (dist < tol && dist < bestD) { bestD = dist; best = i; }
  });
  return best;
}

function rowOf(word) {
  return S.rows.find((r) => r.words.some((w) => w.bbox === word.bbox)) || null;
}

function assign(f, wi) {
  const d = S.doc;
  const w = d.words[wi];
  const row = rowOf(w);
  let value = null, used = [w];
  if (f === 'vendor') {
    value = parseForField(f, row ? row.text : w.text);
    used = row ? row.words : [w];
  } else {
    value = parseForField(f, w.text, d.english);
    if (value == null && row) {
      // número partido en dos palabras o fecha con espacios: probar con vecinas y con la fila
      const i = row.words.findIndex((x) => x.bbox === w.bbox);
      for (const [a, b] of [[i - 1, i + 1], [i, i + 1], [i - 1, i], [i - 2, i + 2]]) {
        const ws = row.words.slice(Math.max(0, a), Math.min(row.words.length, b + 1));
        const v = parseForField(f, ws.map((x) => x.text).join(' '), d.english);
        if (v != null) { value = v; used = ws; break; }
      }
      if (value == null) { value = parseForField(f, row.text, d.english); used = row.words; }
    }
  }
  if (value == null) {
    toast(t('field.unparsable', { t: w.text, what: t(f === 'date' ? 'field.what.date' : 'field.what.amount') }), { ms: 5000 });
    return false;
  }
  const bbox = used.reduce((u, x) => ({ x0: Math.min(u.x0, x.bbox.x0), y0: Math.min(u.y0, x.bbox.y0), x1: Math.max(u.x1, x.bbox.x1), y1: Math.max(u.y1, x.bbox.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  // Señalar elige la zona, pero la lectura de esa zona sigue siendo del OCR: conserva su
  // confianza (y una fecha que solo cuadra al revés sigue siendo dudosa).
  let conf = used.reduce((s, x) => s + x.conf, 0) / used.length / 100;
  if (f === 'date') {
    const ds = datesIn(used.map((x) => x.text).join(' '), d.english)[0];
    if (ds && ((ds.swapped && !d.english) || ds.iso > new Date().toISOString().slice(0, 10))) conf *= 0.6;
  }
  d.fields[f] = { value, conf, status: statusOf(conf), bbox, source: 'picked' };
  refreshField(f);
  drawMarks({ swipe: true });
  toast(t('field.assigned', { f: t('field.' + f) }));
  saveSoon();
  return true;
}

let hotTimer = 0;
function flashWord(i) {
  const e = el.marks.querySelector(`.w[data-i="${i}"]`);
  if (!e) return;
  e.classList.add('hot');
  clearTimeout(hotTimer);
  hotTimer = setTimeout(() => e.classList.remove('hot'), 900);
}

el.marks.addEventListener('pointerup', (e) => {
  if (S.busy || S.tool || !S.doc || !S.doc.scanned || S.stale) return;
  const i = wordAt(e.clientX, e.clientY);
  if (i < 0) { hideAssign(); return; }
  flashWord(i);
  if (S.pointField) {
    if (assign(S.pointField, i)) stopPointing();
    return;
  }
  showAssign(i, e.clientX, e.clientY);
});

function showAssign(i, x, y) {
  const w = S.doc.words[i];
  const row = rowOf(w);
  el.assignTitle.textContent = t('field.assignTo', { t: (row ? row.text : w.text).slice(0, 60) });
  el.assignOpts.innerHTML = FIELDS.map((f) => `<button type="button" data-f="${f}" style="--c:${HL[f]}"><span>${h(t('field.' + f))}</span></button>`).join('');
  el.assign.hidden = false;
  el.assign.dataset.i = i;
  const r = el.assign.getBoundingClientRect();
  el.assign.style.left = `${Math.max(12, Math.min(window.innerWidth - r.width - 12, x - r.width / 2))}px`;
  el.assign.style.top = `${Math.max(12, Math.min(window.innerHeight - r.height - 12, y + 16))}px`;
  el.assignOpts.querySelector('button').focus({ preventScroll: true });
}
function hideAssign() { el.assign.hidden = true; }
el.assignOpts.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  assign(b.dataset.f, Number(el.assign.dataset.i));
  hideAssign();
});
document.addEventListener('pointerdown', (e) => {
  if (!el.assign.hidden && !el.assign.contains(e.target) && !el.marks.contains(e.target)) hideAssign();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.assign.hidden) hideAssign();
  else if (S.pointField) stopPointing();
  else if (!el.history.hidden) closeHistory();
  else if (S.tool) closeTool(true);
});

// ---------- herramientas ----------
function syncPanels() {
  el.angle.value = S.params.angle;
  el.angleOut.textContent = `${Number(S.params.angle).toFixed(1)}°`;
  el.boost.value = S.params.boost;
  el.boostOut.textContent = S.params.boost;
  el.bw.checked = S.params.bw;
}

function openTool(name) {
  if (S.busy) return;
  if (S.tool === name) { closeTool(true); return; }
  closeTool(true);
  stopPointing();
  S.tool = name;
  $('#tCrop').setAttribute('aria-pressed', String(name === 'crop'));
  $('#tStraight').setAttribute('aria-pressed', String(name === 'straight'));
  $('#tContrast').setAttribute('aria-pressed', String(name === 'contrast'));
  el.pCrop.hidden = name !== 'crop';
  el.pStraight.hidden = name !== 'straight';
  el.pContrast.hidden = name !== 'contrast';
  if (name === 'crop') {
    S.cropDraft = S.params.crop ? { ...S.params.crop } : { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };
    render({ preview: true });
    el.crop.hidden = false;
    placeCrop();
  }
}

function closeTool(cancel = false) {
  if (!S.tool) return;
  const was = S.tool;
  S.tool = null;
  for (const id of ['#tCrop', '#tStraight', '#tContrast']) $(id).setAttribute('aria-pressed', 'false');
  el.pCrop.hidden = el.pStraight.hidden = el.pContrast.hidden = true;
  if (was === 'crop') {
    el.crop.hidden = true;
    if (cancel) render();
  }
}

$('#tCrop').addEventListener('click', () => openTool('crop'));
$('#tStraight').addEventListener('click', () => openTool('straight'));
$('#tContrast').addEventListener('click', () => openTool('contrast'));
$('#tRotate').addEventListener('click', () => {
  if (S.busy) return;
  const wasCrop = S.tool === 'crop';
  closeTool();
  S.params.rot = (S.params.rot + 90) % 360;
  // La inclinación y el recorte se vuelven a calcular para la nueva orientación.
  Object.assign(S.params, autoAdjust(S.src, S.params.rot));
  syncPanels();
  render();
  if (wasCrop) openTool('crop');
});
$('#tNew').addEventListener('click', () => {
  if (S.busy) return;
  closeTool();
  stopPointing();
  S.src = null; S.out = null; S.doc = null; S.pdf = null;
  showBed('empty');
  readout('');
  renderTicket();
});
el.tScan.addEventListener('click', scan);

// enderezar
let anglePreview = 0;
el.angle.addEventListener('input', () => {
  const a = Number(el.angle.value);
  el.angleOut.textContent = `${a.toFixed(1)}°`;
  // vista previa barata con CSS; el giro real al soltar
  el.canvas.style.transform = `rotate(${a - S.params.angle}deg)`;
  anglePreview = a;
});
el.angle.addEventListener('change', () => { S.params.angle = Number(el.angle.value); render(); });
$('#angleAuto').addEventListener('click', () => {
  // Se mide sobre la imagen sin enderezar (solo con el giro de 90°).
  const base = S.params.rot ? img.rotated(S.src, S.params.rot, 0) : S.src;
  const a = img.detectSkew(base);
  S.params.angle = Math.abs(a) >= 0.3 ? a : 0;
  syncPanels();
  render();
});
$('#angleZero').addEventListener('click', () => { S.params.angle = 0; syncPanels(); render(); });

// contraste
el.boost.addEventListener('input', () => { el.boostOut.textContent = el.boost.value; });
el.boost.addEventListener('change', () => { S.params.boost = Number(el.boost.value); render(); });
el.bw.addEventListener('change', () => { S.params.bw = el.bw.checked; render(); });
$('#boostOff').addEventListener('click', () => { S.params.boost = 0; S.params.bw = false; syncPanels(); render(); });

// recorte
function placeCrop() {
  const c = S.cropDraft;
  el.cropRect.style.left = `${c.x * 100}%`;
  el.cropRect.style.top = `${c.y * 100}%`;
  el.cropRect.style.width = `${c.w * 100}%`;
  el.cropRect.style.height = `${c.h * 100}%`;
}
let drag = null;
el.crop.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.h');
  if (!handle && !e.target.closest('.crop-rect')) return;
  e.preventDefault();
  el.crop.setPointerCapture(e.pointerId);
  const r = el.doc.getBoundingClientRect();
  drag = { id: e.pointerId, h: handle ? handle.dataset.h : 'move', x: e.clientX, y: e.clientY, r, start: { ...S.cropDraft } };
});
el.crop.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.x) / drag.r.width, dy = (e.clientY - drag.y) / drag.r.height;
  const s = drag.start, MIN = 0.06;
  let { x, y, w, h: hh } = s;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  if (drag.h === 'move') {
    x = clamp(s.x + dx, 0, 1 - s.w);
    y = clamp(s.y + dy, 0, 1 - s.h);
  } else {
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (drag.h.includes('w')) x0 = clamp(x0 + dx, 0, x1 - MIN);
    if (drag.h.includes('e')) x1 = clamp(x1 + dx, x0 + MIN, 1);
    if (drag.h.includes('n')) y0 = clamp(y0 + dy, 0, y1 - MIN);
    if (drag.h.includes('s')) y1 = clamp(y1 + dy, y0 + MIN, 1);
    x = x0; y = y0; w = x1 - x0; hh = y1 - y0;
  }
  S.cropDraft = { x, y, w, h: hh };
  placeCrop();
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
el.crop.addEventListener('pointerup', endDrag);
el.crop.addEventListener('pointercancel', endDrag);
// Teclado: flechas mueven el recorte
el.cropRect.tabIndex = 0;
el.cropRect.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 0.05 : 0.01;
  const c = S.cropDraft;
  const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (!map[e.key]) return;
  e.preventDefault();
  c.x = Math.min(1 - c.w, Math.max(0, c.x + map[e.key][0]));
  c.y = Math.min(1 - c.h, Math.max(0, c.y + map[e.key][1]));
  placeCrop();
});
$('#cropAll').addEventListener('click', () => { S.cropDraft = { x: 0, y: 0, w: 1, h: 1 }; placeCrop(); });
$('#cropAuto').addEventListener('click', () => {
  const r = img.detectPaper(rotatedSrc());
  if (r) { S.cropDraft = r; placeCrop(); } else toast(t('crop.hint'));
});
$('#cropCancel').addEventListener('click', () => closeTool(true));
$('#cropApply').addEventListener('click', () => {
  const c = S.cropDraft;
  S.params.crop = c.w > 0.995 && c.h > 0.995 ? null : { ...c };
  closeTool();
  render();
});

// páginas de PDF
async function pdfGo(delta) {
  if (!S.pdf) return;
  const p = Math.min(S.pdf.numPages, Math.max(1, S.pdfPage + delta));
  if (p === S.pdfPage) return;
  S.pdfPage = p;
  readout(t('bed.loading'), true);
  await setSource(await img.renderPdfPage(S.pdf, p));
}
$('#pdfPrev').addEventListener('click', () => pdfGo(-1));
$('#pdfNext').addEventListener('click', () => pdfGo(1));

// ---------- entrada: archivo, cámara, arrastrar, pegar ----------
$('#fileBtn').addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => { openFile(el.fileInput.files[0]); el.fileInput.value = ''; });
el.camInput.addEventListener('change', () => { openFile(el.camInput.files[0]); el.camInput.value = ''; });

let stream = null;
$('#camBtn').addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { el.camInput.click(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false });
    el.video.srcObject = stream;
    showBed('cam');
    await el.video.play();
    $('#camShoot').focus();
  } catch (e) {
    stopCam();
    showBed(S.out ? 'doc' : 'empty');
    toast(t('cam.denied'));
    el.camInput.click();
  }
});
function stopCam() {
  if (stream) for (const tr of stream.getTracks()) tr.stop();
  stream = null;
  el.video.srcObject = null;
}
$('#camCancel').addEventListener('click', () => { stopCam(); showBed(S.out ? 'doc' : 'empty'); });
$('#camShoot').addEventListener('click', async () => {
  const v = el.video;
  if (!v.videoWidth) return;
  const c = img.makeCanvas(v.videoWidth, v.videoHeight);
  c.getContext('2d').drawImage(v, 0, 0);
  stopCam();
  S.pdf = null;
  const blob = await img.toBlob(c, 'image/jpeg', 0.92);
  await setSource(await img.canvasFromBlob(blob));
});

el.glass.addEventListener('dragover', (e) => { e.preventDefault(); el.glass.classList.add('dragover'); el.dropHint.hidden = false; });
el.glass.addEventListener('dragleave', () => { el.glass.classList.remove('dragover'); el.dropHint.hidden = true; });
el.glass.addEventListener('drop', (e) => {
  e.preventDefault();
  el.glass.classList.remove('dragover');
  el.dropHint.hidden = true;
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) openFile(f);
});
window.addEventListener('paste', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/') || x.type === 'application/pdf');
  if (f) openFile(f);
});

// ---------- historial ----------
let histDocs = [];
async function openHistory() {
  el.history.hidden = false;
  el.historyBack.hidden = false;
  document.body.style.overflow = 'hidden';
  await renderHistory();
  el.historySearch.focus();
}
function closeHistory() {
  el.history.hidden = true;
  el.historyBack.hidden = true;
  document.body.style.overflow = '';
  $('#historyBtn').focus();
}
$('#historyBtn').addEventListener('click', openHistory);
$('#historyClose').addEventListener('click', closeHistory);
el.historyBack.addEventListener('click', closeHistory);
el.history.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...el.history.querySelectorAll('button, input, a[href]')].filter((x) => !x.disabled && x.offsetParent);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

function docSearchText(d) {
  const f = d.fields;
  return fold([f.vendor.value, f.date.value, fmtDate(f.date.value), formatAmount(f.total.value, 'es'), formatAmount(f.total.value, 'en'), f.total.value, f.tax.value, d.text].filter((x) => x != null).join(' \n '));
}

function filtered() {
  const q = fold(el.historySearch.value.trim());
  if (!q) return histDocs;
  const terms = q.split(/\s+/);
  return histDocs.filter((d) => { const s = docSearchText(d); return terms.every((x) => s.includes(x)); });
}

async function renderHistory() {
  histDocs = await db.list();
  const list = filtered();
  const q = el.historySearch.value.trim();
  el.historyCount.textContent = list.length === 1 ? t('history.count1') : t('history.count', { n: list.length });
  el.historyEmpty.hidden = list.length > 0;
  el.historyEmpty.textContent = !db.available ? t('err.storage') : histDocs.length ? t('history.nomatch', { q }) : t('history.empty');
  $('#exportCsv').disabled = $('#exportJson').disabled = !list.length;
  el.stubs.innerHTML = list.map((d) => {
    const f = d.fields;
    const doubts = FIELDS.filter((k) => f[k].source !== 'manual' && f[k].status === 'doubt').length;
    const vendor = f.vendor.value || '—';
    return `<li class="stub">
      <img src="${h(d.thumb)}" alt="" loading="lazy">
      <div class="stub-main">
        <p class="stub-vendor">${hi(vendor, q)}</p>
        <p class="stub-line">${h(f.date.value ? fmtDate(f.date.value) : '—')} <span class="stub-total">${f.total.value != null ? h(formatAmount(f.total.value, getLang()) + ' ' + (CUR[d.currency] || '€')) : ''}</span></p>
        ${doubts ? `<span class="stub-flag doubt">${h(doubts === 1 ? t('ticket.doubtCount1') : t('ticket.doubtCount', { n: doubts }))}</span>` : ''}
        ${d.sent ? `<span class="stub-flag sent">${h(t('history.sent'))}</span>` : ''}
      </div>
      <div class="stub-acts">
        <button type="button" class="paper-btn" data-open="${h(d.id)}">${h(t('history.openDoc'))}</button>
        <button type="button" class="paper-btn" data-del="${h(d.id)}" aria-label="${h(t('history.delete'))}: ${h(vendor)}"><svg class="ico" aria-hidden="true"><use href="#i-trash"/></svg></button>
      </div>
    </li>`;
  }).join('');
}
function hi(text, q) {
  const s = h(text);
  if (!q) return s;
  const i = fold(text).indexOf(fold(q));
  if (i < 0) return s;
  return h(text.slice(0, i)) + '<mark>' + h(text.slice(i, i + q.length)) + '</mark>' + h(text.slice(i + q.length));
}
el.historySearch.addEventListener('input', () => renderHistory());
el.stubs.addEventListener('click', async (e) => {
  const o = e.target.closest('[data-open]');
  const del = e.target.closest('[data-del]');
  if (o) {
    const d = await db.get(o.dataset.open);
    if (!d) return;
    const { image, ...rest } = d;
    S.pdf = null;
    S.doc = rest;
    S.rows = buildRows(rest.words || []);
    closeHistory();
    await setSource(await img.canvasFromBlob(image), { keepDoc: true, params: { rot: 0, angle: 0, crop: null, boost: 0, bw: false } });
    S.imageBlob = image;
    S.stale = false;
    drawMarks();
    readout(t('bed.tapHint'));
    setBusyUI(false);
  } else if (del) {
    const id = del.dataset.del;
    const full = await db.get(id);
    await db.remove(id);
    await renderHistory();
    toast(t('history.deleted'), { action: async () => { if (full) { await db.put(full); renderHistory(); } }, label: t('history.undo'), ms: 6000 });
  }
});

// exportaciones
function exportRows(list) {
  return list.map((d) => ({
    id: d.id,
    scanned: new Date(d.created).toISOString(),
    vendor: d.fields.vendor.value,
    date: d.fields.date.value,
    total: d.fields.total.value,
    tax: d.fields.tax.value,
    currency: d.currency || null,
    fields: Object.fromEntries(FIELDS.map((f) => [f, {
      value: d.fields[f].value, confidence: Math.round(d.fields[f].conf * 100) / 100,
      status: d.fields[f].source === 'manual' ? 'manual' : d.fields[f].status,
    }])),
    notes: d.notes || [],
    sentToHuchas: d.sent ? new Date(d.sent.at).toISOString() : null,
    text: d.text,
  }));
}
$('#exportJson').addEventListener('click', () => {
  const rows = exportRows(filtered());
  download(`escaner-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'escaner', version: 1, exported: new Date().toISOString(), documents: rows }, null, 2), 'application/json');
});
$('#exportCsv').addEventListener('click', () => {
  const es = getLang() === 'es';
  const sep = es ? ';' : ',';
  const num = (v) => (v == null ? '' : Number(v).toFixed(2).replace('.', es ? ',' : '.'));
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n\r;,]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [t('exp.id'), t('exp.scanned'), t('exp.vendor'), t('exp.date'), t('exp.total'), t('exp.tax'), t('exp.currency'),
    ...FIELDS.map((f) => t('exp.status', { f: t('field.' + f) })), ...FIELDS.map((f) => t('exp.conf', { f: t('field.' + f) })), t('exp.text')];
  const lines = [head.map(esc).join(sep)];
  for (const r of exportRows(filtered())) {
    lines.push([esc(r.id), esc(r.scanned), esc(r.vendor), esc(r.date), num(r.total), num(r.tax), esc(r.currency),
      ...FIELDS.map((f) => esc(t('status.' + r.fields[f].status))), ...FIELDS.map((f) => num(r.fields[f].confidence)), esc(r.text)].join(sep));
  }
  download(`escaner-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
});

// ---------- Enviar a Huchas ----------
const CAT_GUESS = [
  ['food', /super|mercad|carrefour|lidl|aldi|\bdia\b|eroski|alcampo|consum|fruter|panader|carnic|grocery|market|restaur|\bbar\b|cafe|cafeter|pizz|burger/],
  ['transport', /gasolin|repsol|cepsa|\bbp\b|shell|galp|taxi|renfe|metro|parking|aparcam|uber|cabify|fuel|petrol/],
  ['health', /farmac|pharma|clinic|dental|optic/],
  ['clothes', /zara|primark|h&m|ropa|moda|zapat|calzad|clothing/],
  ['home', /ikea|leroy|ferreter|bricomart|iberdrola|endesa|naturgy|agua|electric/],
  ['leisure', /cine|teatro|museo|cinema|libreri|bookshop|concierto/],
];
let huRead = null;
function openHuchas() {
  const d = S.doc;
  if (!d) return;
  huRead = readHuchas();
  const err = $('#huErr');
  err.hidden = true;
  const sel = $('#huCat');
  const cats = huRead.ok ? huRead.categories : [];
  sel.innerHTML = cats.map((c) => `<option value="${h(c.id)}">${h(c.name ?? (t('hu.cat.' + c.id) !== 'hu.cat.' + c.id ? t('hu.cat.' + c.id) : c.id))}</option>`).join('');
  const v = fold(String(d.fields.vendor.value || '') + ' ' + d.text.slice(0, 400));
  const guess = (CAT_GUESS.find(([, re]) => re.test(v)) || ['other'])[0];
  sel.value = cats.some((c) => c.id === guess) ? guess : (cats.some((c) => c.id === 'other') ? 'other' : (cats[0] || {}).id || '');
  $('#huAmount').value = d.fields.total.value != null ? formatAmount(d.fields.total.value, getLang()).replace(/\s/g, '') : '';
  $('#huDate').value = d.fields.date.value || '';
  $('#huNote').value = (d.fields.vendor.value || '').slice(0, 120);
  const hc = huRead.ok ? huRead.currency : 'EUR';
  $('#huCurrency').textContent = d.currency && d.currency !== hc ? t('hu.currencyMismatch', { d: d.currency, c: hc }) : t('hu.currency', { c: hc });
  const risky = ['total', 'date'].some((f) => d.fields[f].source !== 'manual' && d.fields[f].status !== 'ok');
  $('#huDoubt').hidden = !risky;
  $('#huConfirm').checked = false;
  $('#huDup').hidden = !(d.sent && stillThere(d.sent.txId));
  $('#huSend').disabled = !huRead.ok;
  if (!huRead.ok) { err.textContent = huRead.reason === 'corrupt' ? t('hu.err.corrupt') : t('hu.err.storage', { e: huRead.error?.message || huRead.reason }); err.hidden = false; }
  el.hu.showModal();
}
$('#huCancel').addEventListener('click', () => el.hu.close());
function huValues() {
  const raw = $('#huAmount').value.trim();
  let amount = parseAmount(raw.replace(/\s/g, '').replace(/^(\d+)[.,](\d)$/, '$1,$20'));
  if (amount == null && /^\d+$/.test(raw)) amount = Number(raw);
  const cat = $('#huCat').value;
  const opt = $('#huCat').selectedOptions[0];
  return { amount, date: $('#huDate').value, cat, catName: opt ? opt.textContent : cat, note: $('#huNote').value.trim() };
}
$('#huSend').addEventListener('click', () => {
  const v = huValues();
  const err = $('#huErr');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (!(v.amount > 0)) return fail(t('hu.err.amount'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return fail(t('hu.err.date'));
  if (!$('#huDoubt').hidden && !$('#huConfirm').checked) return fail(t('hu.err.confirm'));
  const r = addExpense({ amount: v.amount, date: v.date, cat: v.cat, note: v.note, lang: getLang() });
  if (!r.ok) {
    if (r.reason === 'amount') return fail(t('hu.err.amount'));
    if (r.reason === 'date') return fail(t('hu.err.date'));
    if (r.reason === 'corrupt') return fail(t('hu.err.corrupt'));
    return fail(t('hu.err.storage', { e: r.error?.message || r.reason }));
  }
  S.doc.sent = { txId: r.tx.id, at: Date.now() };
  el.hu.close();
  renderTicket();
  saveDoc();
  toast(t('hu.done'), { href: '../gastos/', label: t('hu.goto'), ms: 7000 });
  // sendToExternalService(S.doc);  // ver más abajo
});
$('#huCsv').addEventListener('click', () => {
  const v = huValues();
  const csv = huchasCSV({ amount: v.amount || 0, date: v.date, catName: v.catName, currency: huRead && huRead.ok ? huRead.currency : 'EUR', note: v.note }, t, getLang());
  download(`huchas-${fileBase()}.csv`, csv, 'text/csv;charset=utf-8');
});

/* ---------------------------------------------------------------------------------
 * PUNTO DE INTEGRACIÓN FUTURO — envío del documento a un servicio externo.
 *
 * Hoy la app no habla con ningún servidor: todo (imagen, OCR, historial) se queda en el
 * dispositivo. Cuando exista un servicio (gestoría, ERP, contabilidad, almacenamiento en
 * la nube…), este es el sitio para conectarlo. Lo que habría que hacer:
 *   1. Definir el endpoint y la autenticación (p. ej. OAuth con el backend propio; NUNCA
 *      una clave fija en este código, que es público).
 *   2. Enviar los campos confirmados por la persona (no los «dudosos» sin revisar), el
 *      texto y, si el servicio lo necesita, la imagen (S.imageBlob, JPEG).
 *   3. Si no hay conexión, guardar el envío en una cola (IndexedDB) y reintentarlo con
 *      Background Sync desde sw.js o al volver la conexión ('online').
 *   4. Guardar en el documento la referencia devuelta (p. ej. doc.remote = { id, at }) y
 *      mostrarla en el ticket como se hace con «Enviado a Huchas».
 *   5. Añadir el dominio del servicio a la lista de orígenes que el service worker deja
 *      pasar a la red (ahora solo atiende al propio origen).
 *
 * async function sendToExternalService(doc) {
 *   const body = new FormData();
 *   body.append('meta', JSON.stringify(exportRows([doc])[0]));
 *   if (S.imageBlob) body.append('image', S.imageBlob, `${fileBase(doc)}.jpg`);
 *   const res = await fetch('https://api.ejemplo.invalid/v1/documents', {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${await getAccessToken()}` },
 *     body,
 *   });
 *   if (!res.ok) throw new Error(`HTTP ${res.status}`);
 *   const { id } = await res.json();
 *   doc.remote = { id, at: Date.now() };
 *   await saveDoc();
 * }
 * ------------------------------------------------------------------------------- */

// ---------- idioma ----------
function applyLang() {
  applyI18n();
  document.title = getLang() === 'en' ? 'Receipt scanner' : 'Escáner de tickets';
  for (const b of document.querySelectorAll('.lang [data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  renderTicket();
  drawMarks();
  setBusyUI(S.busy);
  if (S.pdf) $('#pdfLabel').textContent = t('pdf.page', { p: S.pdfPage, n: S.pdf.numPages });
  if (!S.busy) readout(S.out ? (S.stale ? t('bed.changed') : S.doc && S.doc.scanned ? t('bed.tapHint') : t('bed.ready')) : '');
  if (!el.history.hidden) renderHistory();
  if (S.pointField) el.pointingText.textContent = t('field.pointing', { f: t('field.' + S.pointField) });
}
for (const b of document.querySelectorAll('.lang [data-lang]')) {
  b.addEventListener('click', () => { setLang(b.dataset.lang); applyLang(); });
}

// ---------- arranque ----------
setLang(getLang());
applyLang();
showBed('empty');
try { db.list().then(() => { if (!db.available) toast(t('err.storage'), { ms: 6000 }); }); } catch (e) { /* sin IndexedDB */ }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const fresh = !navigator.serviceWorker.controller;
      const sw = reg.installing;
      if (fresh && sw) sw.addEventListener('statechange', () => { if (sw.state === 'activated') toast(t('offline.ready')); });
    }).catch(() => { /* sin service worker: funciona igual mientras haya conexión */ });
  });
}

// Para las pruebas automáticas: acceso de solo lectura al estado.
window.__escaner = { get doc() { return S.doc; }, get params() { return S.params; }, get busy() { return S.busy; } };
