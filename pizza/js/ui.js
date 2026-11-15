// Utilidades de interfaz: creación de nodos, iconos, avisos, diálogo y campo numérico.
import { t } from './i18n.js';

export function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// Iconos propios, trazo único de 1,75 sobre rejilla de 24.
const PATHS = {
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-5 5-8 9-10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M14 6l-6 6 6 6"/>',
  next: '<path d="M10 6l6 6-6 6"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.2-5.1"/><path d="M5 4.5V8h3.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5l3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  pdf: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20h4"/>',
  bellOff: '<path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l1.5 2H8"/><path d="M10 20h4M4 4l16 16"/>',
  screen: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h0M16 12h0M8 16h2M12 16h0M16 16h0"/>',
  up: '<path d="M6 14l6-6 6 6"/>',
  down: '<path d="M6 10l6 6 6-6"/>',
  oven: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M8 6.5h0M12 6.5h0"/><rect x="8" y="12" width="8" height="5" rx="1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>',
};
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'ico ' + cls;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return span;
}

let toastTimer = 0;
export function toast(msg, action) {
  const box = document.getElementById('toast');
  box.replaceChildren(h('span', msg));
  if (action) box.append(h('button.toast-act', { type: 'button', onclick: () => { action.fn(); box.classList.remove('on'); } }, action.label));
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('on'), action ? 7000 : 3200);
}

// Confirmación para acciones que destruyen datos.
export function confirmDialog({ title, body, ok, danger = true }) {
  return new Promise((resolve) => {
    const dlg = h('dialog.dialog', { 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      body ? h('p', body) : null,
      h('div.dialog-actions',
        h('button.btn.ghost', { type: 'button', onclick: () => dlg.close('no') }, t('cancel')),
        h(`button.btn.${danger ? 'danger' : 'primary'}`, { type: 'button', onclick: () => dlg.close('yes') }, ok)));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Campo numérico con botones grandes de menos y más.
export function numField({ label, value, min = 0, max = 100, step = 1, unit = '', hint, onChange, id, slider = false, decimals }) {
  const dec = decimals ?? (String(step).split('.')[1] || '').length;
  const fmt = (v) => String(Number(v.toFixed(dec)));
  const clampV = (v) => Math.min(max, Math.max(min, v));
  const input = h('input', { type: 'number', inputmode: 'decimal', min, max, step, value: fmt(value), id, 'aria-describedby': hint ? id + '-h' : null });
  const range = slider ? h('input.range', { type: 'range', min, max, step, value, 'aria-label': label, tabindex: '-1' }) : null;
  let cur = value;
  const set = (v, fromInput) => {
    v = clampV(Number.isFinite(v) ? v : cur);
    v = Number(v.toFixed(dec));
    cur = v;
    if (!fromInput) input.value = fmt(v);
    if (range) range.value = v;
    onChange(v);
  };
  input.addEventListener('input', () => { const v = parseFloat(input.value.replace(',', '.')); if (Number.isFinite(v) && v >= min && v <= max) set(v, true); });
  input.addEventListener('change', () => set(parseFloat(input.value.replace(',', '.'))));
  if (range) range.addEventListener('input', () => set(parseFloat(range.value)));
  const btn = (dir, name) => {
    const b = h('button.step', { type: 'button', 'aria-label': `${dir < 0 ? t('less') : t('more')}: ${label}` }, icon(name));
    b.addEventListener('click', () => set(cur + dir * step));
    return b;
  };
  return h('div.field' + (slider ? '.has-range' : ''),
    h('label', { for: id }, label),
    h('div.stepper', btn(-1, 'minus'), h('span.num', input, unit ? h('span.unit', unit) : null), btn(1, 'plus')),
    range,
    hint ? h('p.hint', { id: id + '-h' }, hint) : null);
}

export function segmented({ label, options, value, onChange, name }) {
  const wrap = h('fieldset.seg', h('legend', label));
  const row = h('div.seg-row');
  options.forEach(([val, text]) => {
    const id = `${name}-${val}`;
    row.append(h('input', { type: 'radio', name, id, value: val, checked: val === value, onchange: () => onChange(val) }), h('label', { for: id }, text));
  });
  wrap.append(row);
  return wrap;
}
