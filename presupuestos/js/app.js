// Generador de presupuestos: vistas, editor, registro y pantalla de límite.
import * as S from './store.js';
import { t, getLang, setLang, money, num, date } from './i18n.js';
import { totals, lineAmount, parseNum } from './calc.js';
import { icon } from './icons.js';
import { enviarContacto } from './integraciones.js';

const OFIZA_URL = 'https://ofiza.es';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hero = $('#hero');
const main = $('#main');
const dlg = $('#dlg');

let route = { name: 'list' };
let editor = null; // { draft, snapshot, isNew, pane }
let ignoreHash = false;

// ================= Utilidades de interfaz =================
function toast(msg, opts = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-ic">${icon(opts.icon || 'check', 18)}</span><span>${esc(msg)}${opts.ofiza ? ` <a class="toast-link" href="${OFIZA_URL}" target="_blank" rel="noopener">${esc(t('ofiza.nudgeLink'))}</a>` : ''}</span>`;
  box.appendChild(el);
  const life = opts.ofiza ? 6500 : 2800;
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, life);
}

function openDialog(html, { onOpen, labelledBy = 'dlg-title' } = {}) {
  dlg.innerHTML = html;
  dlg.setAttribute('aria-labelledby', labelledBy);
  if (!dlg.open) dlg.showModal();
  onOpen && onOpen(dlg);
}
function closeDialog() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); }); // tocar fuera cierra
dlg.addEventListener('close', () => { dlg.innerHTML = ''; });

function confirmDialog({ title, text, ok, cancel = t('c.cancel'), danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openDialog(`
      <form method="dialog" class="dlg-body dlg-sm">
        <h2 id="dlg-title" class="dlg-title">${esc(title)}</h2>
        ${text ? `<p class="dlg-text">${esc(text)}</p>` : ''}
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" data-ans="0">${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ans="1">${esc(ok)}</button>
        </div>
      </form>`, {
      onOpen(d) {
        $$('[data-ans]', d).forEach((b) => b.addEventListener('click', () => { answered = true; closeDialog(); resolve(b.dataset.ans === '1'); }));
        d.addEventListener('close', () => { if (!answered) resolve(false); }, { once: true });
        $('[data-ans="0"]', d).focus();
      },
    });
  });
}

// ================= Navegación =================
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  if (a === 'clientes') return { name: 'clients' };
  if (a === 'nuevo') return { name: 'new' };
  if (a === 'editar' && b) return { name: 'edit', id: decodeURIComponent(b) };
  if (a === 'limite') return { name: 'limit' };
  return { name: 'list' };
}

function isDirty() {
  return editor && JSON.stringify(editor.draft) !== editor.snapshot;
}

async function go(hash) {
  if (location.hash === hash) { render(); return; }
  if (isDirty()) {
    const leave = await confirmDialog({ title: t('ed.unsaved'), text: t('ed.unsavedText'), ok: t('ed.leave'), cancel: t('ed.stay'), danger: true });
    if (!leave) return;
    editor.snapshot = JSON.stringify(editor.draft);
  }
  location.hash = hash;
}

window.addEventListener('hashchange', async () => {
  if (ignoreHash) { ignoreHash = false; return; }
  const next = parseHash();
  if (isDirty() && !(next.name === route.name && next.id === route.id)) {
    // Atrás del navegador con cambios sin guardar: volvemos al editor y preguntamos.
    const target = location.hash;
    ignoreHash = true;
    history.pushState(null, '', route.name === 'new' ? '#/nuevo' : `#/editar/${encodeURIComponent(route.id)}`);
    ignoreHash = false;
    const leave = await confirmDialog({ title: t('ed.unsaved'), text: t('ed.unsavedText'), ok: t('ed.leave'), cancel: t('ed.stay'), danger: true });
    if (leave) { editor.snapshot = JSON.stringify(editor.draft); location.hash = target; }
    return;
  }
  render();
});

window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-go]');
  if (a) { e.preventDefault(); go(a.getAttribute('href')); }
});

/** Punto de entrada para crear: pide registro si falta y respeta el límite gratuito. */
function startNew() {
  if (!S.getLead()) { openRegistration(() => startNew()); return; }
  if (!S.canCreate()) { go('#/limite'); return; }
  go('#/nuevo');
}

// ================= Pieza común: estado del plan =================
function planHTML({ compact = false } = {}) {
  const lead = S.getLead();
  const used = S.getCreated();
  const left = Math.max(0, S.FREE_LIMIT - used);
  const pips = Array.from({ length: S.FREE_LIMIT }, (_, i) => `<span class="pip ${i < used ? 'on' : ''}"></span>`).join('');
  const leftTxt = left === 0 ? t('plan.none') : left === 1 ? t('plan.left1') : t('plan.left', { n: left });
  return `
    <div class="plan ${compact ? 'plan-compact' : ''}">
      <div class="plan-head">
        <span class="plan-title">${esc(t('plan.title'))}</span>
        <span class="plan-left">${esc(lead ? leftTxt : t('plan.left', { n: S.FREE_LIMIT }))}</span>
      </div>
      <div class="pips" role="img" aria-label="${esc(t('plan.used', { n: used }))}">${pips}</div>
      <p class="plan-note">${esc(lead ? t('plan.used', { n: used }) + '. ' + t('plan.note') : t('plan.unregistered'))}</p>
      <p class="plan-ofiza">${esc(t('ofiza.nudge'))} <a href="${OFIZA_URL}" target="_blank" rel="noopener">${esc(t('ofiza.nudgeLink'))}</a></p>
    </div>`;
}

// ================= Vista: lista de presupuestos =================
function quoteRow(q) {
  const sum = totals(q);
  const kind = q.kind === 'proforma' ? t('kind.proforma') : t('kind.quote');
  return `
    <li class="row" data-id="${esc(q.id)}">
      <a class="row-main" href="#/editar/${encodeURIComponent(q.id)}" data-go>
        <span class="tile">${icon('file-text', 20)}</span>
        <span class="row-text">
          <span class="row-title"><span class="row-num">${esc(q.number)}</span> ${esc(q.client?.name || t('row.noClient'))}</span>
          <span class="row-sub">${esc(kind)}, ${esc(date(q.date))}, ${esc(t('row.validUntil', { d: date(S.addDaysISO(q.date, q.validDays)) }))}</span>
        </span>
        <span class="row-amount tnum">${esc(money(sum.total))}</span>
      </a>
      <span class="row-actions">
        <button type="button" class="icon-btn" data-act="pdf" aria-label="${esc(t('row.pdf'))} ${esc(q.number)}" title="${esc(t('row.pdf'))}">${icon('download')}</button>
        <button type="button" class="icon-btn" data-act="dup" aria-label="${esc(t('row.duplicate'))} ${esc(q.number)}" title="${esc(t('row.duplicate'))}">${icon('copy')}</button>
        <button type="button" class="icon-btn danger" data-act="del" aria-label="${esc(t('row.delete'))} ${esc(q.number)}" title="${esc(t('row.delete'))}">${icon('trash-2')}</button>
      </span>
    </li>`;
}

function quotesListHTML() {
  const qs = S.listQuotes();
  if (!qs.length) {
    return `
      <div class="empty">
        <span class="empty-ic">${icon('file-text', 28)}</span>
        <h2 class="h3">${esc(t('home.empty.title'))}</h2>
        <p>${esc(t('home.empty.text'))}</p>
        <button type="button" class="btn btn-primary" data-act="new">${icon('plus')}${esc(t('home.empty.cta'))}</button>
      </div>`;
  }
  return `
    <div class="list-head">
      <h2 class="h3">${esc(t('nav.quotes'))}</h2>
      <span class="muted">${esc(qs.length === 1 ? t('home.count1') : t('home.count', { n: qs.length }))}</span>
    </div>
    <ul class="list panel" id="quote-list">${qs.map(quoteRow).join('')}</ul>`;
}

function renderList() {
  const lead = S.getLead();
  hero.innerHTML = `
    <section class="wrap hero-grid">
      <div>
        <h1 class="display">${esc(t('home.title'))}</h1>
        <p class="lead">${esc(t('home.lead'))}</p>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-act="new">${icon('plus')}${esc(t('home.new'))}</button>
        </div>
        ${lead ? `<p class="hello">${icon(lead.freelancer ? 'user' : 'building-2', 16)}<span>${esc(lead.freelancer ? lead.name : lead.company)}, ${esc(lead.email)}</span></p>` : ''}
      </div>
      <aside class="glass">${planHTML()}</aside>
    </section>`;
  main.innerHTML = `<div class="section">${quotesListHTML()}</div>`;
}

async function onListAction(act, id) {
  if (act === 'new') { startNew(); return; }
  const q = S.getQuote(id);
  if (!q) return;
  if (act === 'pdf') { await exportPdf(q); return; }
  if (act === 'dup') {
    if (!S.canCreate()) { go('#/limite'); return; }
    const copy = JSON.parse(JSON.stringify(q));
    copy.id = S.uid();
    copy.number = S.nextNumber();
    copy.date = S.todayISO();
    copy.lines.forEach((l) => { l.id = S.uid(); });
    if (S.upsertQuote(copy)) { toast(t('q.duplicated'), { icon: 'copy' }); render(); flashRow(copy.id); }
    return;
  }
  if (act === 'del') {
    const ok = await confirmDialog({ title: t('q.confirmDelete', { num: q.number }), text: t('q.confirmDeleteText'), ok: t('c.delete'), danger: true });
    if (!ok) return;
    const row = $(`.row[data-id="${CSS.escape(id)}"]`);
    const finish = () => { S.deleteQuote(id); toast(t('q.deleted'), { icon: 'trash-2' }); render(); };
    if (row && !reduceMotion()) { row.classList.add('leaving'); setTimeout(finish, 200); } else finish();
  }
}

function flashRow(id) {
  const row = $(`.row[data-id="${CSS.escape(id)}"]`);
  if (row) { row.classList.add('arrived'); setTimeout(() => row.classList.remove('arrived'), 900); }
}

// ================= Vista: pantalla de límite =================
function renderLimit() {
  hero.innerHTML = `
    <section class="wrap limit">
      <div class="limit-copy">
        <p class="limit-brand">Ofiza</p>
        <h1 class="display">${esc(t('limit.title'))}</h1>
        <p class="lead">${esc(t('limit.lead'))}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${OFIZA_URL}" target="_blank" rel="noopener">${esc(t('limit.cta'))}${icon('external-link', 18)}</a>
          <a class="btn btn-ghost" href="#/" data-go>${esc(t('limit.back'))}</a>
        </div>
      </div>
      <ol class="limit-steps glass">
        <li><span class="step-ic">${icon('file-text')}</span><span><b>${esc(t('limit.p1t'))}</b><span>${esc(t('limit.p1'))}</span></span></li>
        <li><span class="step-ic">${icon('receipt-euro')}</span><span><b>${esc(t('limit.p2t'))}</b><span>${esc(t('limit.p2'))}</span></span></li>
        <li><span class="step-ic">${icon('smartphone')}</span><span><b>${esc(t('limit.p3t'))}</b><span>${esc(t('limit.p3'))}</span></span></li>
      </ol>
    </section>`;
  main.innerHTML = `
    <div class="section">
      <p class="keep">${icon('shield-check', 18)}<span>${esc(t('limit.keep'))}</span></p>
      ${S.listQuotes().length ? quotesListHTML() : ''}
    </div>`;
}

// ================= Vista: clientes =================
function renderClients() {
  const clients = S.listClients();
  const quotes = S.listQuotes();
  const countFor = (c) => quotes.filter((q) => q.clientId === c.id).length;
  hero.innerHTML = `
    <section class="wrap hero-grid hero-slim">
      <div>
        <h1 class="display">${esc(t('clients.title'))}</h1>
        <p class="lead">${esc(t('clients.lead'))}</p>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-act="client-new">${icon('plus')}${esc(t('clients.new'))}</button>
        </div>
      </div>
    </section>`;
  main.innerHTML = `<div class="section">${clients.length ? `
    <ul class="list panel">${clients.map((c) => {
      const n = countFor(c);
      return `
      <li class="row" data-cid="${esc(c.id)}">
        <button type="button" class="row-main" data-act="client-edit">
          <span class="tile tile-av">${esc((c.name || '?').trim().slice(0, 1).toUpperCase())}</span>
          <span class="row-text">
            <span class="row-title">${esc(c.name)}</span>
            <span class="row-sub">${esc([c.nif, c.email].filter(Boolean).join(', ') || (n === 0 ? t('clients.quotes0') : ''))}</span>
          </span>
          <span class="row-amount muted">${esc(n === 0 ? '' : n === 1 ? t('clients.quotes1') : t('clients.quotes', { n }))}</span>
        </button>
        <span class="row-actions">
          <button type="button" class="icon-btn" data-act="client-edit" aria-label="${esc(t('clients.edit'))} ${esc(c.name)}" title="${esc(t('clients.edit'))}">${icon('pencil')}</button>
          <button type="button" class="icon-btn danger" data-act="client-del" aria-label="${esc(t('clients.delete'))} ${esc(c.name)}" title="${esc(t('clients.delete'))}">${icon('trash-2')}</button>
        </span>
      </li>`;
    }).join('')}</ul>` : `
    <div class="empty">
      <span class="empty-ic">${icon('users', 28)}</span>
      <h2 class="h3">${esc(t('clients.empty.title'))}</h2>
      <p>${esc(t('clients.empty.text'))}</p>
    </div>`}</div>`;
}

function openClientDialog(client) {
  const c = client || { id: S.uid(), name: '', nif: '', address: '', email: '' };
  openDialog(`
    <form class="dlg-body" novalidate>
      <div class="dlg-headrow">
        <h2 id="dlg-title" class="dlg-title">${esc(client ? t('clients.edit') : t('clients.new'))}</h2>
        <button type="button" class="icon-btn" data-close aria-label="${esc(t('c.close'))}">${icon('x')}</button>
      </div>
      ${field({ id: 'c-name', label: t('f.clientName'), value: c.name, required: true, autocomplete: 'organization' })}
      ${field({ id: 'c-nif', label: t('f.nif'), value: c.nif })}
      ${field({ id: 'c-address', label: t('f.address'), value: c.address, textarea: true })}
      ${field({ id: 'c-email', label: t('f.email'), value: c.email, type: 'email' })}
      <div class="dlg-actions">
        <button type="button" class="btn btn-ghost" data-close>${esc(t('c.cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('clients.save'))}</button>
      </div>
    </form>`, {
    onOpen(d) {
      $$('[data-close]', d).forEach((b) => b.addEventListener('click', closeDialog));
      $('form', d).addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#c-name', d).value.trim();
        if (!name) { setError($('#c-name', d), t('f.required')); $('#c-name', d).focus(); return; }
        S.upsertClient({ ...c, name, nif: $('#c-nif', d).value.trim(), address: $('#c-address', d).value.trim(), email: $('#c-email', d).value.trim() });
        closeDialog(); toast(t('clients.saved')); render();
      });
      $('#c-name', d).focus();
    },
  });
}

function field({ id, label, value = '', type = 'text', required = false, textarea = false, placeholder = '', autocomplete = '', inputmode = '', data = '', cls = '' }) {
  const attrs = `id="${id}" name="${id}" ${data ? `data-f="${data}"` : ''} ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${required ? 'aria-required="true"' : ''} aria-describedby="${id}-err"`;
  return `
    <div class="field ${cls}">
      <label for="${id}">${esc(label)}${required ? '<span class="req" aria-hidden="true"> *</span>' : ''}</label>
      ${textarea ? `<textarea ${attrs} rows="2">${esc(value)}</textarea>` : `<input ${attrs} type="${type}" value="${esc(value)}">`}
      <p class="err" id="${id}-err" hidden></p>
    </div>`;
}

function setError(input, msg) {
  const err = $(`#${input.id}-err`);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) { err.textContent = msg || ''; err.hidden = !msg; }
}

// ================= Registro =================
function openRegistration(onDone) {
  const lang = getLang();
  openDialog(`
    <form class="dlg-body" novalidate>
      <div class="dlg-headrow">
        <h2 id="dlg-title" class="dlg-title display-sm">${esc(t('reg.title'))}</h2>
        <button type="button" class="icon-btn" data-close aria-label="${esc(t('c.close'))}">${icon('x')}</button>
      </div>
      <p class="dlg-text">${esc(t('reg.lead'))}</p>
      ${field({ id: 'r-email', label: t('reg.email'), type: 'email', required: true, autocomplete: 'email', inputmode: 'email' })}
      <div class="switch-row">
        <span id="r-free-label" class="switch-label">${esc(t('reg.freelancer'))}<span class="switch-hint">${esc(t('reg.freelancerHint'))}</span></span>
        <button type="button" class="switch" role="switch" id="r-free" aria-checked="false" aria-labelledby="r-free-label"></button>
      </div>
      <div id="r-namebox">${field({ id: 'r-name', label: t('reg.company'), required: true, autocomplete: 'organization' })}</div>
      <p class="privacy">${icon('lock', 18)}<span>${esc(t('reg.privacy'))}</span></p>
      <div class="dlg-actions">
        <button type="button" class="btn btn-ghost" data-close>${esc(t('reg.cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('reg.submit'))}</button>
      </div>
    </form>`, {
    onOpen(d) {
      let freelancer = false;
      const sw = $('#r-free', d);
      const nameInput = () => $('#r-name', d);
      $$('[data-close]', d).forEach((b) => b.addEventListener('click', closeDialog));
      sw.addEventListener('click', () => {
        freelancer = !freelancer;
        sw.setAttribute('aria-checked', String(freelancer));
        const v = nameInput().value;
        $('#r-namebox', d).innerHTML = field({ id: 'r-name', label: freelancer ? t('reg.name') : t('reg.company'), value: v, required: true, autocomplete: freelancer ? 'name' : 'organization' });
      });
      $('form', d).addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#r-email', d).value.trim();
        const name = nameInput().value.trim();
        const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
        setError($('#r-email', d), okEmail ? '' : t('reg.errEmail'));
        setError(nameInput(), name ? '' : (freelancer ? t('reg.errName') : t('reg.errCompany')));
        if (!okEmail) { $('#r-email', d).focus(); return; }
        if (!name) { nameInput().focus(); return; }
        const lead = { email, freelancer, name: freelancer ? name : '', company: freelancer ? '' : name, lang, registeredAt: new Date().toISOString() };
        S.setLead(lead);
        enviarContacto(lead); // Hoy no envía nada: ver js/integraciones.js
        closeDialog();
        onDone && onDone();
      });
      $('#r-email', d).focus();
    },
  });
}

// ================= Editor =================
function blankQuote() {
  const lead = S.getLead() || {};
  const iss = S.getIssuer() || { name: lead.freelancer ? lead.name : lead.company, nif: '', address: '', email: lead.email || '', phone: '', logo: null };
  return {
    id: S.uid(),
    kind: 'quote',
    number: S.nextNumber(),
    date: S.todayISO(),
    validDays: 30,
    issuer: { ...iss },
    rememberIssuer: true,
    clientId: '',
    client: { name: '', nif: '', address: '', email: '' },
    lines: [{ id: S.uid(), desc: '', qty: '1', price: '', disc: '' }],
    vatRate: '21',
    irpfOn: false,
    irpfRate: '15',
    notes: '',
    terms: '',
  };
}

function openEditor(r) {
  if (r.name === 'new') {
    if (!S.getLead()) { location.replace('#/'); setTimeout(startNew, 0); return; }
    if (!S.canCreate()) { location.replace('#/limite'); return; }
    if (!editor || !editor.isNew) editor = { draft: blankQuote(), isNew: true, pane: 'edit' };
  } else {
    const q = S.getQuote(r.id);
    if (!q) { toast(t('ed.notFound'), { icon: 'circle-alert' }); location.replace('#/'); return; }
    if (!editor || editor.draft.id !== q.id || editor.isNew) {
      const draft = JSON.parse(JSON.stringify(q));
      if (draft.rememberIssuer === undefined) draft.rememberIssuer = true;
      editor = { draft, isNew: false, pane: 'edit' };
    }
  }
  if (!editor.snapshot) editor.snapshot = JSON.stringify(editor.draft);
  renderEditor();
}

function renderEditor() {
  const q = editor.draft;
  const vatPresets = ['21', '10', '4', '0'];
  const vatIsPreset = vatPresets.includes(String(q.vatRate));
  hero.innerHTML = `
    <div class="wrap edbar">
      <a class="back" href="#/" data-go>${icon('arrow-left')}<span>${esc(t('ed.back'))}</span></a>
      <h1 class="edbar-title display">${esc(editor.isNew ? t('ed.newTitle') : `${q.kind === 'proforma' ? t('kind.proforma') : t('kind.quote')} ${q.number}`)}</h1>
      <div class="edbar-actions">
        <button type="button" class="btn btn-ghost" data-act="save">${icon('save')}<span>${esc(t('ed.save'))}</span></button>
        <button type="button" class="btn btn-primary" data-act="pdf">${icon('download')}<span>${esc(t('ed.pdf'))}</span></button>
      </div>
    </div>`;

  main.innerHTML = `
    <div class="seg" role="tablist" aria-label="${esc(t('ed.tabEdit'))} / ${esc(t('ed.tabPreview'))}">
      <button type="button" role="tab" id="tab-edit" aria-controls="pane-form" aria-selected="${editor.pane === 'edit'}" data-pane="edit">${icon('pencil', 18)}${esc(t('ed.tabEdit'))}</button>
      <button type="button" role="tab" id="tab-prev" aria-controls="pane-preview" aria-selected="${editor.pane === 'preview'}" data-pane="preview">${icon('eye', 18)}${esc(t('ed.tabPreview'))}</button>
    </div>
    <div class="editor" data-pane="${editor.pane}">
      <form class="ed-form" id="pane-form" novalidate autocomplete="off">
        <section class="card" aria-labelledby="s-doc">
          <h2 class="card-title" id="s-doc">${esc(t('sec.doc'))}</h2>
          <div class="kind" role="radiogroup" aria-label="${esc(t('f.kind'))}">
            <label class="kind-opt"><input type="radio" name="kind" value="quote" ${q.kind !== 'proforma' ? 'checked' : ''}><span>${esc(t('kind.quote'))}</span></label>
            <label class="kind-opt"><input type="radio" name="kind" value="proforma" ${q.kind === 'proforma' ? 'checked' : ''}><span>${esc(t('kind.proforma'))}</span></label>
          </div>
          <div class="grid3">
            ${field({ id: 'q-number', label: t('f.number'), value: q.number, data: 'number', required: true })}
            ${field({ id: 'q-date', label: t('f.date'), value: q.date, type: 'date', data: 'date', required: true })}
            <div class="field">
              <label for="q-valid">${esc(t('f.valid'))}</label>
              <div class="select"><select id="q-valid" data-f="validDays">
                ${[7, 15, 30, 60, 90].map((n) => `<option value="${n}" ${Number(q.validDays) === n ? 'selected' : ''}>${esc(t('f.validDays', { n }))}</option>`).join('')}
              </select>${icon('chevron-down', 18)}</div>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="s-iss">
          <h2 class="card-title" id="s-iss">${esc(t('sec.issuer'))}</h2>
          <div class="logo-row">
            <div class="logo-box" id="logo-box">${q.issuer.logo?.data ? `<img src="${q.issuer.logo.data}" alt="${esc(t('f.logo'))}">` : icon('image-up', 26)}</div>
            <div class="logo-ctl">
              <span class="label">${esc(t('f.logo'))}</span>
              <div class="logo-btns">
                <button type="button" class="btn btn-ghost btn-sm" data-act="logo">${esc(q.issuer.logo?.data ? t('f.logoChange') : t('f.logoAdd'))}</button>
                ${q.issuer.logo?.data ? `<button type="button" class="btn btn-text btn-sm" data-act="logo-rm">${esc(t('f.logoRemove'))}</button>` : ''}
              </div>
              <p class="hint" id="logo-hint">${esc(t('f.logoHint'))}</p>
              <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
            </div>
          </div>
          <div class="grid2">
            ${field({ id: 'i-name', label: t('f.issuerName'), value: q.issuer.name, data: 'issuer.name', required: true, cls: 'span2' })}
            ${field({ id: 'i-nif', label: t('f.nif'), value: q.issuer.nif, data: 'issuer.nif' })}
            ${field({ id: 'i-phone', label: t('f.phone'), value: q.issuer.phone, data: 'issuer.phone', type: 'tel', inputmode: 'tel' })}
            ${field({ id: 'i-address', label: t('f.address'), value: q.issuer.address, data: 'issuer.address', textarea: true, cls: 'span2' })}
            ${field({ id: 'i-email', label: t('f.email'), value: q.issuer.email, data: 'issuer.email', type: 'email', cls: 'span2' })}
          </div>
          <label class="check"><input type="checkbox" data-f="rememberIssuer" ${q.rememberIssuer ? 'checked' : ''}><span>${esc(t('f.remember'))}</span></label>
        </section>

        <section class="card" aria-labelledby="s-cli">
          <h2 class="card-title" id="s-cli">${esc(t('sec.client'))}</h2>
          ${S.listClients().length ? `
          <div class="field">
            <label for="q-client">${esc(t('f.savedClient'))}</label>
            <div class="select"><select id="q-client" data-act-change="pick-client">
              <option value="">${esc(t('f.savedClientNone'))}</option>
              ${S.listClients().map((c) => `<option value="${esc(c.id)}" ${q.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>${icon('chevron-down', 18)}</div>
          </div>` : ''}
          <div class="grid2" id="client-fields">${clientFieldsHTML(q)}</div>
        </section>

        <section class="card" id="s-lines-card" aria-labelledby="s-lines">
          <h2 class="card-title" id="s-lines">${esc(t('sec.lines'))}</h2>
          <div class="lines-head" aria-hidden="true">
            <span>${esc(t('f.desc'))}</span><span>${esc(t('f.qty'))}</span><span>${esc(t('f.price'))}</span><span>${esc(t('f.disc'))}</span><span>${esc(t('f.amount'))}</span><span></span>
          </div>
          <ol class="lines" id="lines">${q.lines.map(lineHTML).join('')}</ol>
          <p class="err" id="lines-err" hidden></p>
          <button type="button" class="btn btn-ghost btn-add" data-act="add-line">${icon('plus')}${esc(t('f.addLine'))}</button>
        </section>

        <section class="card" aria-labelledby="s-tax">
          <h2 class="card-title" id="s-tax">${esc(t('sec.taxes'))}</h2>
          <div class="tax-row">
            <span class="label" id="vat-label">${esc(t('f.vat'))}</span>
            <div class="chips" role="radiogroup" aria-labelledby="vat-label">
              ${vatPresets.map((v) => `<label class="chip-opt"><input type="radio" name="vat" value="${v}" ${String(q.vatRate) === v ? 'checked' : ''}><span>${v} %</span></label>`).join('')}
              <label class="chip-opt"><input type="radio" name="vat" value="other" ${vatIsPreset ? '' : 'checked'}><span>${esc(t('f.vatOther'))}</span></label>
              <span class="pct ${vatIsPreset ? 'is-hidden' : ''}" id="vat-other-box"><input id="vat-other" aria-label="${esc(t('f.vat'))} %" inputmode="decimal" value="${vatIsPreset ? '' : esc(q.vatRate)}"><span>%</span></span>
            </div>
          </div>
          <div class="tax-row">
            <span class="switch-label" id="irpf-label">${esc(t('f.irpf'))}</span>
            <button type="button" class="switch" role="switch" id="irpf-sw" aria-checked="${!!q.irpfOn}" aria-labelledby="irpf-label"></button>
            <span class="pct ${q.irpfOn ? '' : 'is-hidden'}" id="irpf-box"><input id="irpf-rate" data-f="irpfRate" aria-label="${esc(t('f.irpfRate'))} %" inputmode="decimal" value="${esc(q.irpfRate)}"><span>%</span></span>
          </div>
          <dl class="totals" id="form-totals"></dl>
        </section>

        <section class="card" aria-labelledby="s-notes">
          <h2 class="card-title" id="s-notes">${esc(t('sec.notes'))}</h2>
          ${field({ id: 'q-notes', label: t('f.notes'), value: q.notes, data: 'notes', textarea: true, placeholder: t('f.notesPh') })}
          ${field({ id: 'q-terms', label: t('f.terms'), value: q.terms, data: 'terms', textarea: true, placeholder: t('f.termsPh') })}
        </section>
      </form>

      <aside class="ed-preview" id="pane-preview" aria-label="${esc(t('ed.tabPreview'))}">
        <div class="sheet-wrap"><div class="sheet" id="sheet"></div></div>
        <p class="side-ofiza">${esc(t('ofiza.side'))} <a href="${OFIZA_URL}" target="_blank" rel="noopener">${esc(t('ofiza.nudgeLink'))}</a></p>
      </aside>
    </div>
    <div class="dock" id="dock">
      <div class="dock-total"><span>${esc(t('t.total'))}</span><strong class="tnum" id="dock-total"></strong></div>
      <button type="button" class="btn btn-primary" data-act="pdf">${icon('download')}<span>${esc(t('ed.pdf'))}</span></button>
    </div>`;
  $$('#pane-form textarea').forEach(autosize);
  refreshLive(false);
}

function clientFieldsHTML(q) {
  return `
    ${field({ id: 'c-name', label: t('f.clientName'), value: q.client.name, data: 'client.name', required: true, cls: 'span2' })}
    ${field({ id: 'c-nif', label: t('f.nif'), value: q.client.nif, data: 'client.nif' })}
    ${field({ id: 'c-email', label: t('f.email'), value: q.client.email, data: 'client.email', type: 'email' })}
    ${field({ id: 'c-address', label: t('f.address'), value: q.client.address, data: 'client.address', textarea: true, cls: 'span2' })}`;
}

function lineHTML(l, i) {
  const id = esc(l.id);
  return `
    <li class="line" data-line="${id}">
      <div class="field l-desc">
        <label for="d-${id}" class="l-label">${esc(t('f.desc'))} ${i + 1}</label>
        <textarea id="d-${id}" data-l="desc" rows="1" placeholder="${esc(t('f.descPh'))}">${esc(l.desc)}</textarea>
      </div>
      <div class="field l-qty"><label for="q-${id}" class="l-label">${esc(t('f.qty'))}</label><input id="q-${id}" data-l="qty" inputmode="decimal" value="${esc(l.qty)}"></div>
      <div class="field l-price"><label for="p-${id}" class="l-label">${esc(t('f.price'))}</label><input id="p-${id}" data-l="price" inputmode="decimal" value="${esc(l.price)}" placeholder="0"></div>
      <div class="field l-disc"><label for="x-${id}" class="l-label">${esc(t('f.disc'))}</label><input id="x-${id}" data-l="disc" inputmode="decimal" value="${esc(l.disc)}" placeholder="0"></div>
      <output class="l-amount tnum" data-amount>${esc(money(lineAmount(l)))}</output>
      <button type="button" class="icon-btn l-rm" data-act="rm-line" aria-label="${esc(t('f.removeLine'))} ${i + 1}" title="${esc(t('f.removeLine'))}">${icon('x')}</button>
    </li>`;
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  while (parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = value;
}

let lastTotal = null;
function refreshLive(animate = true) {
  const q = editor.draft;
  const sum = totals(q);
  // Totales del formulario
  const rows = [[t('t.base'), money(sum.base)], [t('t.vat', { r: num(sum.vatRate) }), money(sum.vat)]];
  if (q.irpfOn) rows.push([t('t.irpf', { r: num(sum.irpfRate) }), money(-sum.irpf)]);
  const ft = $('#form-totals');
  if (ft) ft.innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="tnum">${esc(v)}</dd></div>`).join('') +
    `<div class="grand"><dt>${esc(t('t.total'))}</dt><dd class="tnum" id="grand-total">${esc(money(sum.total))}</dd></div>`;
  const dock = $('#dock-total');
  if (dock) dock.textContent = money(sum.total);
  // Importes por línea
  for (const l of q.lines) {
    const out = $(`[data-line="${CSS.escape(l.id)}"] [data-amount]`);
    if (out) out.textContent = money(lineAmount(l));
  }
  const sheet = $('#sheet');
  if (sheet) sheet.innerHTML = sheetHTML(q);
  if (animate && lastTotal !== null && lastTotal !== sum.total) {
    for (const el of [$('#grand-total'), $('#dock-total'), $('#sheet .s-total-amt')]) {
      if (!el) continue;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }
  lastTotal = sum.total;
}

// Vista previa: misma composición que el PDF (js/pdf.js), medida en milímetros de A4.
function sheetHTML(q) {
  const sum = totals(q);
  const iss = q.issuer || {};
  const cli = q.client || {};
  const kind = q.kind === 'proforma' ? t('kind.proforma') : t('kind.quote');
  const issRows = [iss.nif && `${t('doc.nif')} ${iss.nif}`, iss.address, iss.email, iss.phone].filter(Boolean);
  const cliRows = [cli.nif && `${t('doc.nif')} ${cli.nif}`, cli.address, cli.email].filter(Boolean);
  const lines = q.lines.filter((l) => String(l.desc || '').trim() || parseNum(l.price));
  return `
    <div class="s-head">
      <div class="s-from">
        ${iss.logo?.data ? `<img class="s-logo" src="${iss.logo.data}" alt="">` : ''}
        <div class="s-name">${esc(iss.name) || '&nbsp;'}</div>
        ${issRows.map((r) => `<div class="s-small">${nl2br(r)}</div>`).join('')}
      </div>
      <div class="s-meta">
        <div class="s-kind">${esc(kind)}</div>
        <div><span>${esc(t('doc.number'))}</span> <b>${esc(q.number)}</b></div>
        <div><span>${esc(t('doc.date'))}</span> <b>${esc(date(q.date))}</b></div>
        <div><span>${esc(t('doc.validUntil'))}</span> <b>${esc(date(S.addDaysISO(q.date, q.validDays)))}</b></div>
      </div>
    </div>
    <div class="s-client">
      <div class="s-label">${esc(t('doc.to'))}</div>
      <div class="s-cname">${esc(cli.name) || '&nbsp;'}</div>
      ${cliRows.map((r) => `<div class="s-small">${nl2br(r)}</div>`).join('')}
    </div>
    <table class="s-table">
      <thead><tr><th>${esc(t('f.desc'))}</th><th>${esc(t('f.qty'))}</th><th>${esc(t('f.price'))}</th><th>${esc(t('f.disc'))}</th><th>${esc(t('f.amount'))}</th></tr></thead>
      <tbody>${lines.length ? lines.map((l) => `
        <tr><td>${nl2br(l.desc)}</td><td>${esc(num(parseNum(l.qty)))}</td><td>${esc(money(parseNum(l.price)))}</td><td>${parseNum(l.disc) ? esc(num(parseNum(l.disc))) + ' %' : ''}</td><td><b>${esc(money(lineAmount(l)))}</b></td></tr>`).join('')
        : `<tr class="s-empty"><td colspan="5">${esc(t('doc.empty'))}</td></tr>`}
      </tbody>
    </table>
    <div class="s-totals">
      <div><span>${esc(t('t.base'))}</span><span>${esc(money(sum.base))}</span></div>
      <div><span>${esc(t('t.vat', { r: num(sum.vatRate) }))}</span><span>${esc(money(sum.vat))}</span></div>
      ${q.irpfOn ? `<div><span>${esc(t('t.irpf', { r: num(sum.irpfRate) }))}</span><span>${esc(money(-sum.irpf))}</span></div>` : ''}
      <div class="s-grand"><span>${esc(t('t.total'))}</span><span class="s-total-amt">${esc(money(sum.total))}</span></div>
    </div>
    ${String(q.notes || '').trim() ? `<div class="s-block"><div class="s-label">${esc(t('doc.notes'))}</div><div class="s-small">${nl2br(q.notes)}</div></div>` : ''}
    ${String(q.terms || '').trim() ? `<div class="s-block"><div class="s-label">${esc(t('doc.terms'))}</div><div class="s-small">${nl2br(q.terms)}</div></div>` : ''}
    <div class="s-foot"><span>${esc(kind)} ${esc(q.number)}</span><span>${esc(t('doc.madeWith'))}</span></div>`;
}

function validate() {
  const q = editor.draft;
  const bad = [];
  const req = [['i-name', q.issuer.name], ['c-name', q.client.name], ['q-number', q.number], ['q-date', q.date]];
  for (const [id, v] of req) {
    const el = $('#' + id);
    const ok = String(v || '').trim();
    if (el) setError(el, ok ? '' : t('f.required'));
    if (!ok) bad.push(id);
  }
  const hasLine = q.lines.some((l) => String(l.desc || '').trim());
  const le = $('#lines-err');
  if (le) { le.textContent = hasLine ? '' : t('f.lineRequired'); le.hidden = hasLine; }
  if (!hasLine) bad.push(q.lines[0] ? `d-${q.lines[0].id}` : 'lines-err');
  if (bad.length) {
    if (editor.pane !== 'edit') setPane('edit');
    const first = $('#' + bad[0]);
    if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
    toast(t('ed.fix'), { icon: 'circle-alert' });
    return false;
  }
  return true;
}

/** Guarda el borrador. Devuelve el presupuesto guardado o null. */
function saveDraft() {
  if (!validate()) return null;
  const q = editor.draft;
  // Cliente: se reutiliza el elegido o uno igual, o se crea.
  const cdata = { name: q.client.name.trim(), nif: (q.client.nif || '').trim(), address: (q.client.address || '').trim(), email: (q.client.email || '').trim() };
  let client = (q.clientId && S.getClient(q.clientId)) || S.findSameClient(cdata);
  client = S.upsertClient({ ...(client || { id: S.uid() }), ...cdata });
  q.clientId = client.id;
  if (q.rememberIssuer) S.setIssuer({ ...q.issuer });
  const toSave = JSON.parse(JSON.stringify(q));
  toSave.lines = toSave.lines.filter((l) => String(l.desc || '').trim() || parseNum(l.price));
  if (!S.upsertQuote(toSave)) { go('#/limite'); return null; }
  const wasNew = editor.isNew;
  editor.isNew = false;
  editor.draft = toSave;
  if (!editor.draft.lines.length) editor.draft.lines.push({ id: S.uid(), desc: '', qty: '1', price: '', disc: '' });
  editor.snapshot = JSON.stringify(editor.draft);
  if (wasNew) {
    ignoreHash = true;
    history.replaceState(null, '', `#/editar/${encodeURIComponent(toSave.id)}`);
    ignoreHash = false;
    route = { name: 'edit', id: toSave.id };
    const title = $('.edbar-title');
    if (title) title.textContent = `${toSave.kind === 'proforma' ? t('kind.proforma') : t('kind.quote')} ${toSave.number}`;
  }
  return toSave;
}

async function exportPdf(q) {
  try {
    const { buildPdf, pdfFileName, downloadBlob } = await import('./pdf.js');
    const blob = await buildPdf(q);
    downloadBlob(blob, pdfFileName(q));
    toast(`${t('ed.pdfDone')}. ${t('ofiza.nudge')}`, { icon: 'download', ofiza: true });
  } catch (err) {
    console.warn(err);
    toast(t('ed.pdfFail'), { icon: 'circle-alert' });
  }
}

function setPane(p) {
  editor.pane = p;
  const ed = $('.editor');
  if (ed) ed.dataset.pane = p;
  $$('.seg [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pane === p)));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function handleLogo(file) {
  const hint = $('#logo-hint');
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const max = 600;
    const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 150;
    const k = Math.min(1, max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    let data = cv.toDataURL('image/png');
    if (data.length > 400000) {
      const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
      const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(cv, 0, 0);
      data = c2.toDataURL('image/jpeg', 0.86);
    }
    editor.draft.issuer.logo = { data, w, h };
    renderEditorKeepScroll();
  } catch {
    if (hint) { hint.textContent = t('f.logoErr'); hint.classList.add('err-text'); }
  }
}

function renderEditorKeepScroll() {
  const y = window.scrollY;
  renderEditor();
  window.scrollTo(0, y);
}

// ---------- Eventos del editor (delegados) ----------
main.addEventListener('input', (e) => {
  if (!editor || !['new', 'edit'].includes(route.name)) return;
  const el = e.target;
  const q = editor.draft;
  if (el.matches('textarea')) autosize(el);
  if (el.dataset.f) {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    setPath(q, el.dataset.f, el.dataset.f === 'validDays' ? Number(v) : v);
    if (el.getAttribute('aria-invalid') === 'true' && String(v).trim()) setError(el, '');
    if (el.dataset.f.startsWith('client.') && q.clientId) {
      // Al cambiar los datos se sigue asociado al mismo cliente guardado (se actualizará al guardar).
    }
  } else if (el.dataset.l) {
    const li = el.closest('[data-line]');
    const line = q.lines.find((l) => l.id === li.dataset.line);
    if (line) line[el.dataset.l] = el.value;
    if (el.dataset.l === 'desc' && el.value.trim()) { const le = $('#lines-err'); if (le) le.hidden = true; }
  } else if (el.name === 'kind') {
    q.kind = el.value;
  } else if (el.name === 'vat') {
    const box = $('#vat-other-box');
    if (el.value === 'other') { box.classList.remove('is-hidden'); q.vatRate = $('#vat-other').value || '0'; }
    else { box.classList.add('is-hidden'); q.vatRate = el.value; }
  } else if (el.id === 'vat-other') {
    q.vatRate = el.value || '0';
  }
  refreshLive();
});

main.addEventListener('change', (e) => {
  if (!editor || !['new', 'edit'].includes(route.name)) return;
  const el = e.target;
  if (el.dataset.f === 'validDays' || el.dataset.f === 'date' || el.dataset.f === 'rememberIssuer') {
    setPath(editor.draft, el.dataset.f, el.type === 'checkbox' ? el.checked : el.dataset.f === 'validDays' ? Number(el.value) : el.value);
    refreshLive();
  }
  // Algunos navegadores antiguos no lanzan 'input' en los radios: se repite aquí (es idempotente).
  if (el.type === 'radio') {
    if (el.name === 'kind') editor.draft.kind = el.value;
    if (el.name === 'vat') {
      $('#vat-other-box').classList.toggle('is-hidden', el.value !== 'other');
      editor.draft.vatRate = el.value === 'other' ? ($('#vat-other').value || '0') : el.value;
    }
    refreshLive();
  }
  if (el.id === 'logo-file' && el.files && el.files[0]) handleLogo(el.files[0]);
  if (el.dataset.actChange === 'pick-client') {
    const c = S.getClient(el.value);
    const q = editor.draft;
    if (c) { q.clientId = c.id; q.client = { name: c.name || '', nif: c.nif || '', address: c.address || '', email: c.email || '' }; }
    else { q.clientId = ''; q.client = { name: '', nif: '', address: '', email: '' }; }
    $('#client-fields').innerHTML = clientFieldsHTML(q);
    $$('#client-fields textarea').forEach(autosize);
    refreshLive();
  }
});

main.addEventListener('click', async (e) => {
  const tab = e.target.closest('.seg [data-pane]');
  if (tab) { setPane(tab.dataset.pane); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  // Acciones de listas
  if (['new', 'pdf', 'dup', 'del'].includes(act) && !editor) {
    const row = btn.closest('[data-id]');
    onListAction(act, row && row.dataset.id);
    return;
  }
  if (act === 'client-new') { openClientDialog(null); return; }
  if (act === 'client-edit') { openClientDialog(S.getClient(btn.closest('[data-cid]').dataset.cid)); return; }
  if (act === 'client-del') {
    const c = S.getClient(btn.closest('[data-cid]').dataset.cid);
    if (c && await confirmDialog({ title: t('clients.confirmDelete', { name: c.name }), text: t('clients.confirmDeleteText'), ok: t('c.delete'), danger: true })) {
      S.deleteClient(c.id); toast(t('clients.deleted'), { icon: 'trash-2' }); render();
    }
    return;
  }
  if (!editor) return;
  const q = editor.draft;
  if (act === 'add-line') {
    const l = { id: S.uid(), desc: '', qty: '1', price: '', disc: '' };
    q.lines.push(l);
    const ol = $('#lines');
    ol.insertAdjacentHTML('beforeend', lineHTML(l, q.lines.length - 1));
    const li = ol.lastElementChild;
    li.classList.add('arrived');
    $('textarea', li).focus();
    refreshLive();
  } else if (act === 'rm-line') {
    const li = btn.closest('[data-line]');
    q.lines = q.lines.filter((l) => l.id !== li.dataset.line);
    if (!q.lines.length) q.lines.push({ id: S.uid(), desc: '', qty: '1', price: '', disc: '' });
    $('#lines').innerHTML = q.lines.map(lineHTML).join('');
    $$('#lines textarea').forEach(autosize);
    refreshLive();
  } else if (act === 'logo') {
    $('#logo-file').click();
  } else if (act === 'logo-rm') {
    q.issuer.logo = null; renderEditorKeepScroll();
  }
});

// Interruptor de IRPF (fuera del flujo 'input')
main.addEventListener('click', (e) => {
  const sw = e.target.closest('#irpf-sw');
  if (!sw || !editor) return;
  const on = sw.getAttribute('aria-checked') !== 'true';
  sw.setAttribute('aria-checked', String(on));
  editor.draft.irpfOn = on;
  $('#irpf-box').classList.toggle('is-hidden', !on);
  if (on) $('#irpf-rate').focus();
  refreshLive();
});

hero.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'new') { startNew(); return; }
  if (act === 'client-new') { openClientDialog(null); return; }
  if (!editor) return;
  if (act === 'save') {
    if (saveDraft()) toast(t('ed.saved'));
  } else if (act === 'pdf') {
    const saved = saveDraft();
    if (saved) await exportPdf(saved);
  }
});

// El botón de PDF del panel inferior está en main
main.addEventListener('click', async (e) => {
  const btn = e.target.closest('#dock [data-act="pdf"]');
  if (!btn || !editor) return;
  e.stopPropagation();
  const saved = saveDraft();
  if (saved) await exportPdf(saved);
}, true);

// ================= Render general =================
function renderChrome() {
  document.documentElement.lang = getLang();
  document.title = `${t('app.name')} ${t('app.by')}`;
  $('#brand-name').textContent = t('app.name');
  $('#brand-by').textContent = t('app.by');
  $('#nav').setAttribute('aria-label', t('nav.main'));
  $('#nav-quotes').textContent = t('nav.quotes');
  $('#nav-clients').textContent = t('nav.clients');
  $('#lang').setAttribute('aria-label', t('lang.label'));
  $$('#lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  const clientsActive = route.name === 'clients';
  $('#nav-quotes').removeAttribute('aria-current');
  $('#nav-clients').removeAttribute('aria-current');
  $(clientsActive ? '#nav-clients' : '#nav-quotes').setAttribute('aria-current', 'page');
  $('#f-local').textContent = t('foot.local');
  $('#f-invoice').textContent = t('foot.notInvoice');
  $('#f-ofiza-q').textContent = t('ofiza.nudge');
  $('#f-ofiza').textContent = t('ofiza.nudgeLink');
  $('#f-by').textContent = t('foot.by');
  document.body.dataset.view = route.name;
}

function render() {
  const prev = route;
  route = parseHash();
  if (!['new', 'edit'].includes(route.name)) { editor = null; lastTotal = null; }
  renderChrome();
  if (route.name === 'clients') renderClients();
  else if (route.name === 'limit') renderLimit();
  else if (route.name === 'new' || route.name === 'edit') openEditor(route);
  else renderList();
  if (prev.name !== route.name) window.scrollTo(0, 0);
}

$('#lang').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === getLang()) return;
  setLang(b.dataset.lang);
  if (editor) { renderChrome(); renderEditorKeepScroll(); } else render();
});

window.addEventListener('offline', () => toast(t('offline'), { icon: 'circle-alert' }));

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
