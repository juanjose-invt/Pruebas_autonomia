import { t, getLang, setLang, applyI18n } from './i18n.js';
import { loadBoard, saveBoard, seedBoard, normalizeBoard, uid, isoDate, NOTE_COLORS } from './store.js';
import { initDrag } from './drag.js';

const $ = (sel, root = document) => root.querySelector(sel);
const boardEl = $('#board');
const columnsEl = $('#columns');
const titleInput = $('#board-title');
const toastEl = $('#toast');
const liveEl = $('#live');

let state = loadBoard() || seedBoard(getLang());
let addingNoteIn = null;   // id de la columna con la nota en blanco abierta
let renamingCol = null;    // id de la columna cuyo nombre se está editando
let addingColumn = false;
let kb = null;             // movimiento con teclado en curso
let menu = null;
let scrollToEnd = false;

// ---------- utilidades ----------
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const ICONS = {
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};

const PIN_COLORS = ['#d8342c', '#2463c9', '#1f8a4c', '#e9a60c', '#f4f1ea'];
function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
function pin(seed) {
  const el = h('span', { class: 'pin', 'aria-hidden': 'true' });
  el.style.setProperty('--pin', PIN_COLORS[hash(seed + 'p') % PIN_COLORS.length]);
  return el;
}
const rotationFor = (id) => (((hash(id) % 1000) / 1000) * 5 - 2.5).toFixed(2);

function findCard(cardId) {
  for (const col of state.columns) {
    const index = col.cards.findIndex((c) => c.id === cardId);
    if (index >= 0) return { col, index, card: col.cards[index] };
  }
  return null;
}
const findCol = (id) => state.columns.find((c) => c.id === id);

function persist() {
  if (!saveBoard(state)) toast(t('saveError'));
}

function announce(msg) {
  liveEl.textContent = '';
  requestAnimationFrame(() => { liveEl.textContent = msg; });
}

// ---------- fechas ----------
function dueInfo(due) {
  if (!due) return null;
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date - today) / 864e5);
  const fmt = new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'short' });
  const fmtDay = new Intl.DateTimeFormat(getLang(), { weekday: 'long' });
  if (days < 0) return { status: 'overdue', text: t('dueOverdue', { date: fmt.format(date) }) };
  if (days === 0) return { status: 'soon', text: t('dueToday') };
  if (days === 1) return { status: 'soon', text: t('dueTomorrow') };
  if (days <= 3) return { status: 'soon', text: t('dueSoon', { date: fmtDay.format(date) }) };
  return { status: 'later', text: t('dueLater', { date: fmt.format(date) }) };
}

// ---------- pintado ----------
// Al salir de un campo en línea con un toque o un clic, repintar en el acto quitaría de debajo
// el botón que se estaba pulsando. Se espera a que el clic termine.
let pointerIsDown = false;
let renderTimer = 0;
window.addEventListener('pointerdown', () => { pointerIsDown = true; }, true);
const pointerReleased = () => {
  pointerIsDown = false;
  if (renderTimer === -1) renderTimer = setTimeout(flushRender, 120);
};
window.addEventListener('pointerup', pointerReleased, true);
window.addEventListener('pointercancel', pointerReleased, true);
function renderSoon() {
  clearTimeout(renderTimer);
  renderTimer = pointerIsDown ? -1 : setTimeout(flushRender, 120);
}
function flushRender() {
  renderTimer = 0;
  if (!dragApi.isActive()) render();
}

function render(opts = {}) {
  clearTimeout(renderTimer);
  renderTimer = 0;
  const scrolls = new Map();
  columnsEl.querySelectorAll('.column').forEach((c) => scrolls.set(c.dataset.col, $('.cards', c).scrollTop));

  titleInput.value = state.title;
  sizeTitle();
  const nodes = state.columns.map(renderColumn);
  nodes.push(renderAddColumn());
  columnsEl.replaceChildren(...nodes);
  columnsEl.classList.toggle('is-empty', state.columns.length === 0);

  columnsEl.querySelectorAll('.column').forEach((c) => {
    const top = scrolls.get(c.dataset.col);
    if (top) $('.cards', c).scrollTop = top;
  });

  if (opts.focusCard) {
    const el = columnsEl.querySelector(`.note[data-card="${opts.focusCard}"]`);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  if (opts.pinned) {
    const el = columnsEl.querySelector(`.note[data-card="${opts.pinned}"]`);
    if (el) el.classList.add('just-pinned');
  }
  if (opts.added) {
    const el = columnsEl.querySelector(`.note[data-card="${opts.added}"]`);
    if (el) el.classList.add('just-added');
  }
  if (scrollToEnd) { scrollToEnd = false; boardEl.scrollLeft = boardEl.scrollWidth; }
  const auto = columnsEl.querySelector('[data-autofocus]');
  if (auto) {
    auto.focus({ preventScroll: true });
    if (auto.select && auto.dataset.autofocus === 'select') auto.select();
    auto.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function renderColumn(col) {
  const count = col.cards.length;
  const countText = count === 1 ? t('noteCountOne') : t('noteCount', { n: count });
  const name = col.title || t('untitled');

  let titleNode;
  if (renamingCol === col.id) {
    titleNode = h('input', {
      class: 'col-title-input', type: 'text', value: col.title, maxlength: '80', 'aria-label': t('columnName'),
      'data-autofocus': 'select', autocomplete: 'off',
      onkeydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
        if (e.key === 'Escape') { e.target.value = col.title; e.target.blur(); }
      },
      onblur: (e) => {
        const v = e.target.value.trim();
        renamingCol = null;
        if (v && v !== col.title) { col.title = v; persist(); }
        renderSoon();
      },
    });
  } else {
    titleNode = h('h2', { class: 'col-title', text: name, title: t('rename') });
  }

  const head = h('header', { class: 'col-head' },
    pin(col.id),
    titleNode,
    h('span', { class: 'col-count', 'aria-label': countText, text: String(count) }),
    h('button', {
      type: 'button', class: 'icon-btn col-menu-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      'aria-label': t('columnOptions', { name }), html: ICONS.dots,
      onclick: (e) => openColumnMenu(col.id, e.currentTarget),
    }),
  );
  head.style.setProperty('--rot', (rotationFor(col.id) * 0.35).toFixed(2) + 'deg');

  const cards = h('div', { class: 'cards', role: 'list' }, col.cards.map(renderNote));
  if (!count && addingNoteIn !== col.id) cards.append(h('p', { class: 'empty-hint', text: t('emptyColumn') }));
  if (addingNoteIn === col.id) cards.append(renderNewNote(col));

  return h('section', { class: 'column', 'data-col': col.id, 'aria-label': name },
    head,
    cards,
    h('button', {
      type: 'button', class: 'add-note', html: ICONS.plus,
      onclick: () => { addingNoteIn = col.id; render(); },
    }, h('span', { text: t('addNote') })),
  );
}

function renderNote(card) {
  const due = dueInfo(card.due);
  const tags = state.labels.filter((l) => card.labels.includes(l.id));
  const el = h('div', {
    class: 'note', 'data-card': card.id, 'data-color': card.color, role: 'button', tabindex: '0',
    'aria-describedby': 'note-hint',
  },
    pin(card.id),
    h('p', { class: 'note-title', text: card.title || t('untitled') }),
    card.notes ? h('p', { class: 'note-body', text: card.notes }) : null,
    (tags.length || due) ? h('div', { class: 'note-foot' },
      tags.length ? h('ul', { class: 'flags' }, tags.map((l) => h('li', {
        class: 'flag' + (l.name ? '' : ' unnamed'), 'data-tag': l.color, text: l.name,
        'aria-label': l.name || t('tagColors.' + l.color),
      }))) : null,
      due ? h('span', { class: 'due', 'data-status': due.status, html: ICONS.clock }, h('span', { text: due.text })) : null,
    ) : null,
  );
  el.style.setProperty('--rot', rotationFor(card.id) + 'deg');
  if (kb && kb.cardId === card.id) el.classList.add('kb-grabbed');
  return el;
}

function renderNewNote(col) {
  const commit = (ta, keepOpen) => {
    const text = ta.value.trim();
    let added = null;
    if (text) {
      const card = { id: uid(), title: text, notes: '', color: nextColor(col), labels: [], due: '' };
      col.cards.push(card);
      persist();
      added = card.id;
    }
    if (!keepOpen || !text) addingNoteIn = null;
    if (keepOpen) render({ added }); else renderSoon();
  };
  const ta = h('textarea', {
    class: 'new-note-input', rows: '2', maxlength: '300', placeholder: t('newNotePlaceholder'),
    'aria-label': t('addNote'), 'data-autofocus': 'focus',
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ta.dataset.done = '1'; commit(ta, true); }
      if (e.key === 'Escape') { ta.dataset.done = '1'; addingNoteIn = null; render(); }
    },
    onblur: () => { if (!ta.dataset.done && ta.isConnected) commit(ta, false); },
  });
  const el = h('div', { class: 'note note-new', 'data-color': nextColor(col) }, pin('new' + col.id), ta);
  el.style.setProperty('--rot', '-1deg');
  return el;
}

function nextColor(col) {
  const last = col.cards[col.cards.length - 1];
  const i = last ? NOTE_COLORS.indexOf(last.color) : -1;
  return NOTE_COLORS[(i + 1) % NOTE_COLORS.length];
}

function renderAddColumn() {
  if (addingColumn) {
    const input = h('input', {
      class: 'col-title-input', type: 'text', maxlength: '80', placeholder: t('newColumnPlaceholder'),
      'aria-label': t('columnName'), 'data-autofocus': 'focus', autocomplete: 'off',
      onkeydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = ''; input.blur(); }
      },
      onblur: () => {
        const v = input.value.trim();
        addingColumn = false;
        if (v) { state.columns.push({ id: uid(), title: v, cards: [] }); persist(); scrollToEnd = true; }
        renderSoon();
      },
    });
    return h('div', { class: 'add-col' }, h('div', { class: 'col-head' }, pin('newcol'), input));
  }
  return h('div', { class: 'add-col' },
    state.columns.length === 0 ? h('p', { class: 'empty-hint board-empty', text: t('emptyBoard') }) : null,
    h('button', {
      type: 'button', class: 'add-col-btn', html: ICONS.plus,
      onclick: () => { addingColumn = true; render(); },
    }, h('span', { text: t('addColumnLong') })),
  );
}

function sizeTitle() {
  titleInput.style.width = Math.max(4, titleInput.value.length) + 2 + 'ch';
}

// ---------- arrastre ----------
const dragApi = initDrag(boardEl, columnsEl, {
  onCardDrop(cardId, colId, index) {
    const found = findCard(cardId);
    const target = findCol(colId);
    if (!found || !target) { render(); return; }
    found.col.cards.splice(found.index, 1);
    target.cards.splice(Math.min(index, target.cards.length), 0, found.card);
    persist();
    render({ pinned: cardId });
  },
  onColumnDrop(order) {
    const byId = new Map(state.columns.map((c) => [c.id, c]));
    const next = order.map((id) => byId.get(id)).filter(Boolean);
    if (next.length === state.columns.length) { state.columns = next; persist(); }
    render();
  },
  onAbort() { render(); },
});

// ---------- clics y teclado sobre el tablero ----------
columnsEl.addEventListener('click', (e) => {
  if (dragApi.justDragged()) return;
  const note = e.target.closest('.note[data-card]');
  if (note) { openEditor(note.dataset.card); return; }
  const title = e.target.closest('.col-title');
  if (title) { renamingCol = title.closest('.column').dataset.col; render(); }
});

columnsEl.addEventListener('keydown', (e) => {
  const note = e.target.closest('.note[data-card]');
  if (!note || e.target !== note) return;
  const id = note.dataset.card;

  if (!kb) {
    if (e.key === 'Enter') { e.preventDefault(); openEditor(id); }
    else if (e.key === ' ') {
      e.preventDefault();
      const f = findCard(id);
      kb = { cardId: id, colId: f.col.id, index: f.index };
      note.classList.add('kb-grabbed');
      announce(t('kbGrabbed'));
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    moveCard(id, kb.colId, kb.index);
    kb = null;
    render({ focusCard: id });
    announce(t('kbCancelled'));
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const col = findCard(id).col;
    kb = null;
    persist();
    render({ focusCard: id, pinned: id });
    announce(t('kbDropped', { column: col.title }));
    return;
  }
  const f = findCard(id);
  const ci = state.columns.indexOf(f.col);
  let target = null;
  if (e.key === 'ArrowUp' && f.index > 0) target = [f.col.id, f.index - 1];
  if (e.key === 'ArrowDown' && f.index < f.col.cards.length - 1) target = [f.col.id, f.index + 1];
  if (e.key === 'ArrowLeft' && ci > 0) target = [state.columns[ci - 1].id, Math.min(f.index, state.columns[ci - 1].cards.length)];
  if (e.key === 'ArrowRight' && ci < state.columns.length - 1) target = [state.columns[ci + 1].id, Math.min(f.index, state.columns[ci + 1].cards.length)];
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (target) {
    moveCard(id, target[0], target[1]);
    render({ focusCard: id });
    const now = findCard(id);
    announce(t('kbMoved', { column: now.col.title, pos: now.index + 1, total: now.col.cards.length }));
  }
});

// Si el foco sale de la nota cogida, el movimiento se da por bueno.
columnsEl.addEventListener('focusout', (e) => {
  if (!kb || !e.target.matches || !e.target.matches('.note.kb-grabbed')) return;
  setTimeout(() => {
    if (!kb) return;
    const el = document.activeElement;
    if (el && el.matches && el.matches(`.note[data-card="${kb.cardId}"]`)) return;
    kb = null;
    persist();
    render();
  }, 0);
});

function moveCard(cardId, colId, index) {
  const f = findCard(cardId);
  const target = findCol(colId);
  if (!f || !target) return;
  f.col.cards.splice(f.index, 1);
  target.cards.splice(Math.max(0, Math.min(index, target.cards.length)), 0, f.card);
}

// ---------- menú de columna ----------
function openColumnMenu(colId, button) {
  closeMenu();
  const idx = state.columns.findIndex((c) => c.id === colId);
  const item = (label, fn, opts = {}) => h('button', {
    type: 'button', role: 'menuitem', class: 'menu-item' + (opts.danger ? ' danger' : ''), disabled: opts.disabled, text: label,
    onclick: () => { closeMenu(false); fn(); },
  });
  const el = h('div', { class: 'menu', role: 'menu' },
    item(t('rename'), () => { renamingCol = colId; render(); }),
    item(t('moveLeft'), () => shiftColumn(colId, -1), { disabled: idx === 0 }),
    item(t('moveRight'), () => shiftColumn(colId, 1), { disabled: idx === state.columns.length - 1 }),
    item(t('deleteColumn'), () => deleteColumn(colId), { danger: true }),
  );
  document.body.append(el);
  const r = button.getBoundingClientRect();
  const w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  el.style.top = Math.min(window.innerHeight - el.offsetHeight - 8, r.bottom + 6) + 'px';
  button.setAttribute('aria-expanded', 'true');
  menu = { el, button, colId };
  const first = el.querySelector('button:not([disabled])');
  if (first) first.focus();

  el.addEventListener('keydown', (e) => {
    const items = [...el.querySelectorAll('button:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
  });
}

function closeMenu(refocus = true) {
  if (!menu) return;
  menu.el.remove();
  if (menu.button.isConnected) {
    menu.button.setAttribute('aria-expanded', 'false');
    if (refocus) menu.button.focus();
  }
  menu = null;
}
document.addEventListener('pointerdown', (e) => {
  if (menu && !menu.el.contains(e.target) && !menu.button.contains(e.target)) closeMenu(false);
}, true);
window.addEventListener('resize', () => closeMenu(false));
boardEl.addEventListener('scroll', () => closeMenu(false), { passive: true });

function shiftColumn(colId, delta) {
  const i = state.columns.findIndex((c) => c.id === colId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.columns.length) return;
  const [col] = state.columns.splice(i, 1);
  state.columns.splice(j, 0, col);
  persist();
  render();
  const btn = columnsEl.querySelector(`.column[data-col="${colId}"] .col-menu-btn`);
  if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  announce(`${col.title}: ${j + 1} / ${state.columns.length}`);
}

function deleteColumn(colId) {
  const snapshot = JSON.stringify(state);
  state.columns = state.columns.filter((c) => c.id !== colId);
  persist();
  render();
  toast(t('columnDeleted'), snapshot);
}

// ---------- editor de nota ----------
const editor = $('#editor');
const edForm = $('#editor-form');
const edTitle = $('#ed-title');
const edNotes = $('#ed-notes');
const edColors = $('#ed-colors');
const edLabels = $('#ed-labels');
const edDue = $('#ed-due');
const edColumn = $('#ed-column');
const edPos = $('#ed-pos');
const edRename = $('#ed-rename-labels');
let draft = null;

function openEditor(cardId) {
  const f = findCard(cardId);
  if (!f) return;
  draft = {
    id: cardId, color: f.card.color, labels: new Set(f.card.labels), colId: f.col.id, index: f.index,
    names: Object.fromEntries(state.labels.map((l) => [l.id, l.name])), renaming: false,
  };
  edTitle.value = f.card.title;
  edNotes.value = f.card.notes;
  edDue.value = f.card.due;
  $('.editor-pin', editor).style.setProperty('--pin', PIN_COLORS[hash(cardId + 'p') % PIN_COLORS.length]);
  paintEditor();
  editor.showModal();
  autoGrow(edTitle);
  autoGrow(edNotes);
}

function paintEditor() {
  editor.dataset.color = draft.color;

  edColors.replaceChildren(...NOTE_COLORS.map((c) => h('label', { class: 'swatch', 'data-color': c },
    h('input', {
      type: 'radio', name: 'note-color', value: c, checked: c === draft.color, 'aria-label': t('colors.' + c),
      onchange: () => { draft.color = c; editor.dataset.color = c; },
    }),
    h('span', { 'aria-hidden': 'true' }),
  )));

  edLabels.replaceChildren(...state.labels.map((l) => {
    if (draft.renaming) {
      return h('span', { class: 'tag-edit', 'data-tag': l.color },
        h('input', {
          type: 'text', maxlength: '40', value: draft.names[l.id], 'aria-label': t('labelName', { color: t('tagColors.' + l.color) }),
          oninput: (e) => { draft.names[l.id] = e.target.value; },
          onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); toggleRename(); } },
        }),
      );
    }
    const name = draft.names[l.id].trim();
    return h('label', { class: 'tag-toggle', 'data-tag': l.color },
      h('input', {
        type: 'checkbox', checked: draft.labels.has(l.id), 'aria-label': name || t('tagColors.' + l.color),
        onchange: (e) => { if (e.target.checked) draft.labels.add(l.id); else draft.labels.delete(l.id); },
      }),
      h('span', { class: name ? '' : 'unnamed', text: name }),
    );
  }));
  edRename.textContent = draft.renaming ? t('doneRenaming') : t('renameLabels');
  edRename.setAttribute('aria-pressed', String(draft.renaming));

  edColumn.replaceChildren(...state.columns.map((c) => h('option', { value: c.id, selected: c.id === draft.colId, text: c.title || t('untitled') })));
  paintPosition();
}

function slotsIn(colId) {
  const col = findCol(colId);
  return col.cards.filter((c) => c.id !== draft.id).length + 1;
}
function paintPosition() {
  const total = slotsIn(draft.colId);
  draft.index = Math.max(0, Math.min(draft.index, total - 1));
  edPos.textContent = `${draft.index + 1} / ${total}`;
  $('#ed-up').disabled = draft.index === 0;
  $('#ed-down').disabled = draft.index >= total - 1;
}

function toggleRename() {
  draft.renaming = !draft.renaming;
  paintEditor();
  const target = draft.renaming ? edLabels.querySelector('input') : edRename;
  if (target) target.focus();
}
edRename.addEventListener('click', toggleRename);
edColumn.addEventListener('change', () => { draft.colId = edColumn.value; draft.index = slotsIn(draft.colId) - 1; paintPosition(); });
$('#ed-up').addEventListener('click', () => { draft.index--; paintPosition(); if ($('#ed-up').disabled) $('#ed-down').focus(); });
$('#ed-down').addEventListener('click', () => { draft.index++; paintPosition(); if ($('#ed-down').disabled) $('#ed-up').focus(); });
$('#ed-due-clear').addEventListener('click', () => { edDue.value = ''; edDue.focus(); });
$('#ed-cancel').addEventListener('click', () => editor.close('cancel'));

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
}
edTitle.addEventListener('input', () => autoGrow(edTitle));
edNotes.addEventListener('input', () => autoGrow(edNotes));
edTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); edForm.requestSubmit(); }
});

edForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = findCard(draft.id);
  if (f) {
    f.card.title = edTitle.value.trim();
    f.card.notes = edNotes.value.trim();
    f.card.color = draft.color;
    f.card.labels = state.labels.filter((l) => draft.labels.has(l.id)).map((l) => l.id);
    f.card.due = /^\d{4}-\d{2}-\d{2}$/.test(edDue.value) ? edDue.value : '';
    state.labels.forEach((l) => { l.name = draft.names[l.id].trim().slice(0, 40); });
    const moved = draft.colId !== f.col.id || draft.index !== f.index;
    if (moved) moveCard(draft.id, draft.colId, draft.index);
    persist();
    editor.close('save');
    render({ focusCard: draft.id, pinned: moved ? draft.id : null });
  } else {
    editor.close('cancel');
  }
});

$('#ed-delete').addEventListener('click', () => {
  const f = findCard(draft.id);
  editor.close('delete');
  if (!f) return;
  const snapshot = JSON.stringify(state);
  f.col.cards.splice(f.index, 1);
  persist();
  render();
  toast(t('noteDeleted'), snapshot);
});

editor.addEventListener('close', () => {
  if (editor.returnValue === 'cancel' || editor.returnValue === '') {
    const el = draft && columnsEl.querySelector(`.note[data-card="${draft.id}"]`);
    if (el) el.focus({ preventScroll: true });
  }
  editor.returnValue = '';
});
// Clic en el fondo oscuro: cierra sin guardar.
editor.addEventListener('pointerdown', (e) => { editor._downOnBackdrop = e.target === editor; });
editor.addEventListener('click', (e) => { if (e.target === editor && editor._downOnBackdrop) editor.close('cancel'); });

// ---------- avisos con deshacer ----------
let toastTimer = 0;
function toast(message, snapshot) {
  clearTimeout(toastTimer);
  toastEl.replaceChildren(h('span', { text: message }));
  if (snapshot) {
    toastEl.append(h('button', {
      type: 'button', class: 'toast-undo', text: t('undo'),
      onclick: () => {
        const prev = normalizeBoard(JSON.parse(snapshot));
        if (prev) { state = prev; persist(); render(); }
        hideToast();
      },
    }));
  }
  toastEl.hidden = false;
  toastTimer = setTimeout(hideToast, snapshot ? 8000 : 5000);
}
function hideToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
  toastEl.replaceChildren();
}

// ---------- barra superior ----------
titleInput.addEventListener('input', sizeTitle);
titleInput.addEventListener('change', () => {
  state.title = titleInput.value.trim() || state.title;
  persist();
  titleInput.value = state.title;
  sizeTitle();
});
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') titleInput.blur();
  if (e.key === 'Escape') { titleInput.value = state.title; titleInput.blur(); }
});

$('#btn-add-col').addEventListener('click', () => {
  addingColumn = true;
  render();
});

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'corcho-kanban', exported: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `corcho-${isoDate(new Date())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('boardExported'));
});

const importFile = $('#import-file');
$('#btn-import').addEventListener('click', () => { importFile.value = ''; importFile.click(); });
importFile.addEventListener('change', async () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  let next = null;
  try { next = normalizeBoard(JSON.parse(await file.text())); } catch { next = null; }
  if (!next) { toast(t('importError')); return; }
  const snapshot = JSON.stringify(state);
  state = next;
  if (!state.title) state.title = t('appName');
  addingNoteIn = renamingCol = null;
  persist();
  render();
  boardEl.scrollLeft = 0;
  toast(t('boardImported'), snapshot);
});

document.querySelectorAll('.lang button').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    paintLang();
    hideToast();
    render();
  });
});
function paintLang() {
  applyI18n();
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  document.title = getLang() === 'es' ? 'Corcho, tablero kanban personal' : 'Corkboard, a personal kanban board';
}

// ---------- arranque ----------
paintLang();
render();
persist();

// Las fechas cambian de estado al pasar la medianoche o al volver a la pestaña.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !dragApi.isActive() && !editor.open && !addingNoteIn && !renamingCol && !addingColumn && !kb) render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin service worker la app sigue funcionando en línea */ });
  });
}
