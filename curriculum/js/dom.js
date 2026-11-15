// Utilidades de interfaz: crear nodos, iconos, avisos, confirmaciones y listas que se reordenan arrastrando.

import { t } from './i18n.js';

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open') e[k] = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k);
  return e;
}

const P = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  download: 'M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16',
  chevron: 'm6 9 6 6 6-6',
  back: 'm15 6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  check: 'm5 12 5 5 9-10',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  upload: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 20h16',
  help: 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  close: 'M6 6l12 12M18 6 6 18',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-4-4M11 8v6M8 11h6',
  photo: 'M4 7h3l2-3h6l2 3h3v13H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  sheet: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
};
export function icon(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', name === 'grip' || name === 'more' ? 3 : 2);
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.classList.add('ic');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || ''); s.append(p);
  return s;
}
export const btn = (cls, ic, label, on, attrs = {}) => h('button', { type: 'button', class: 'btn ' + cls, onclick: on, ...attrs }, ic ? icon(ic) : null, h('span', { text: label }));

// ── Aviso breve con acción opcional (p. ej. Deshacer) ──
let toastTimer;
export function toast(msg, action) {
  const box = document.getElementById('toast');
  box.replaceChildren(...[h('span', { text: msg }), action ? h('button', { type: 'button', class: 'toast-act', onclick: () => { hideToast(); action.run(); } }, action.label) : null,
    h('button', { type: 'button', class: 'toast-x', 'aria-label': t('close'), onclick: hideToast }, icon('close', 18))].filter(Boolean));
  box.hidden = false;
  requestAnimationFrame(() => box.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 9000 : 5000);
}
export function hideToast() {
  const box = document.getElementById('toast');
  box.classList.remove('on'); box.hidden = true;
}

// ── Diálogo de confirmación (antes de borrar) y diálogo genérico ──
export function dialog({ title, body, actions, wide }) {
  return new Promise((resolve) => {
    const d = h('dialog', { class: 'dlg' + (wide ? ' wide' : '') });
    const close = (v) => { d.close(); d.remove(); resolve(v); };
    d.append(h('h2', { text: title }), ...(typeof body === 'string' ? [h('p', { text: body })] : [].concat(body || [])),
      h('div', { class: 'dlg-acts' }, actions.map((a) => h('button', { type: 'button', class: 'btn ' + (a.cls || 'ghost'), onclick: () => close(a.value), autofocus: a.focus }, a.label))));
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    d.addEventListener('click', (e) => { if (e.target === d) close(null); });
    document.body.append(d);
    d.showModal();
  });
}
export const confirmDelete = (title, body) => dialog({
  title, body,
  actions: [{ label: t('cancel'), value: false, focus: true }, { label: t('delete'), value: true, cls: 'danger' }],
});

// ── Reordenar arrastrando por el asa (pointer events) ──
// La lista se reordena en vivo; al soltar se avisa con (desde, hasta).
export function sortable(list, itemSel, handleSel, onDone) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest(handleSel);
    if (!handle || e.button > 0) return;
    const item = handle.closest(itemSel);
    if (!item || item.parentNode !== list) return;
    e.preventDefault();
    const items = () => [...list.children].filter((c) => c.matches(itemSel));
    const from = items().indexOf(item);
    const startY = e.clientY;
    let shift = 0, moved = false;
    try { handle.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    item.classList.add('dragging');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flip = (sib, delta) => {
      if (reduce) return;
      sib.style.transition = 'none'; sib.style.transform = `translateY(${delta}px)`;
      sib.getBoundingClientRect();
      sib.style.transition = 'transform .18s cubic-bezier(.16,1,.3,1)'; sib.style.transform = '';
    };
    const move = (ev) => {
      moved = true;
      const mid = item.offsetTop + item.offsetHeight / 2 + (ev.clientY - startY - shift);
      const prev = item.previousElementSibling, next = item.nextElementSibling;
      const before = item.offsetTop;
      if (prev && prev.matches(itemSel) && mid < prev.offsetTop + prev.offsetHeight / 2) {
        const pt = prev.offsetTop; list.insertBefore(item, prev); flip(prev, pt - prev.offsetTop);
      } else if (next && next.matches(itemSel) && mid > next.offsetTop + next.offsetHeight / 2) {
        const nt = next.offsetTop; list.insertBefore(next, item); flip(next, nt - next.offsetTop);
      }
      shift += item.offsetTop - before;
      item.style.transform = `translateY(${ev.clientY - startY - shift}px)`;
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      item.classList.remove('dragging');
      item.style.transform = '';
      const to = items().indexOf(item);
      if (moved && to !== from) onDone(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}
