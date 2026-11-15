// Guía interactiva: va señalando zonas reales de la interfaz, paso a paso.
// Se puede saltar en cualquier momento y repetir desde el menú «Más».

import { h } from './dom.js';
import { t } from './i18n.js';

let active = null;

export function tourActive() { return !!active; }

export function endTour(finished = false) {
  if (!active) return;
  const a = active; active = null;
  removeEventListener('resize', a.place);
  removeEventListener('scroll', a.place, true);
  removeEventListener('keydown', a.key, true);
  a.root.remove();
  if (a.prevFocus && document.contains(a.prevFocus)) a.prevFocus.focus({ preventScroll: true });
  a.onEnd && a.onEnd(finished);
}

// steps: [{ sel, title, text, before }]. before() prepara la pantalla (cambiar de pestaña o de vista).
export function startTour(steps, { onEnd, lastLabel } = {}) {
  endTour();
  let i = 0;
  const hole = h('div', { class: 'tour-hole' });
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-t' });
  const root = h('div', { class: 'tour' }, h('div', { class: 'tour-shield' }), hole, card);
  document.body.append(root);

  const place = () => {
    const s = steps[i];
    const target = s.sel ? document.querySelector(s.sel) : null;
    const vw = innerWidth, vh = innerHeight;
    if (!target || !target.getClientRects().length) {
      hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      hole.classList.add('none');
      card.style.left = Math.max(12, (vw - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(12, (vh - card.offsetHeight) / 2) + 'px';
      return;
    }
    hole.classList.remove('none');
    const r = target.getBoundingClientRect();
    const pad = 6;
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    const w = Math.min(vw - 4, r.right + pad) - x, hh = Math.min(vh - 4, r.bottom + pad) - y;
    hole.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let top;
    if (vh - (y + hh) >= ch + gap + 8) top = y + hh + gap;
    else if (y >= ch + gap + 8) top = y - ch - gap;
    else top = vh - ch - 16; // no cabe fuera: se apoya abajo, encima de la zona señalada
    let left = Math.min(Math.max(12, x + w / 2 - cw / 2), vw - cw - 12);
    // Si la zona es alta y hay sitio a un lado, mejor al lado que encima.
    if (top === vh - ch - 16) {
      if (vw - (x + w) >= cw + gap + 12) { left = x + w + gap; top = Math.max(16, Math.min(y + 24, vh - ch - 16)); }
      else if (x >= cw + gap + 12) { left = x - cw - gap; top = Math.max(16, Math.min(y + 24, vh - ch - 16)); }
    }
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  };

  const show = (focus = true) => {
    const s = steps[i];
    if (s.before) s.before();
    const last = i === steps.length - 1;
    card.replaceChildren(
      h('p', { class: 'tour-n', text: t('tourStep', i + 1, steps.length) }),
      h('h2', { id: 'tour-t', text: s.title }),
      h('p', { class: 'tour-x', text: s.text }),
      h('div', { class: 'tour-acts' },
        h('button', { type: 'button', class: 'btn ghost tour-skip', onclick: () => endTour(false) }, t('tourSkip')),
        h('span', { class: 'grow' }),
        i > 0 ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { i--; show(); } }, t('tourBack')) : null,
        h('button', { type: 'button', class: 'btn primary tour-next', onclick: () => { if (last) endTour(true); else { i++; show(); } } }, last ? (lastLabel || t('tourDone')) : t('tourNext'))),
    );
    const target = s.sel ? document.querySelector(s.sel) : null;
    if (target) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Dos pasadas: la pantalla puede acabar de recolocarse al cambiar de pestaña.
    place();
    requestAnimationFrame(() => { place(); if (focus) card.querySelector('.tour-next').focus({ preventScroll: true }); });
    setTimeout(place, 260);
  };

  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); endTour(false); }
    else if (e.key === 'Tab') {
      const f = [...card.querySelectorAll('button')];
      const idx = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(idx + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  };

  active = { root, place, key, onEnd, prevFocus: document.activeElement };
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  addEventListener('keydown', key, true);
  show();
}
