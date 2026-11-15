// Convierte un currículum en hojas (DOM). La misma salida sirve para la vista previa y para el PDF,
// que se dibuja midiendo este DOM (ver pdf.js). Reglas para que el PDF sea fiel:
//  - nada de pseudo-elementos con contenido ni iconos: todo lo visible es texto o cajas reales;
//  - cada bloque que no debe partirse entre páginas lleva data-u; data-keep = "no me separes del siguiente".

import { dl, fmtDate, fmtRange, levelRank } from './doc-i18n.js';
import { tplById, fontById, SECTION_DEFS, sectionEmpty } from './templates.js';
import { SAMPLE_PHOTO } from './samples.js';

export const SIZES = { s: 12.3, m: 13.4, l: 14.6, xl: 15.8 };
export const MARGINS = { narrow: 38, normal: 53, wide: 68 };
export const DENS = { tight: [1.27, 0.7], normal: [1.38, 1], loose: [1.5, 1.3] };
export const PAGES = { a4: { w: 793.7, h: 1122.5, pt: [595.28, 841.89] }, letter: { w: 816, h: 1056, pt: [612, 792] } };

function el(tag, cls, kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (kids != null) for (const k of [].concat(kids)) if (k != null && k !== false) e.append(k);
  return e;
}
const unit = (e, keep) => { e.setAttribute('data-u', ''); if (keep) e.setAttribute('data-keep', ''); return e; };

function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(hex, t) { // mezcla con blanco
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round(c + (255 - c) * t));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const tokens = (s) => String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export function contactItems(cv) {
  const p = cv.personal;
  return [['phone', p.phone], ['email', p.email], ['location', p.city], ['web', p.web], ['linkedin', p.linkedin],
    ['birth', p.birth], ['nationality', p.nationality], ['permit', p.permit]].filter((x) => (x[1] || '').trim());
}

export function sectionTitle(s, t, lang) {
  if (s.title && s.title.trim()) return s.title.trim();
  return dl((t.titleKeys && t.titleKeys[s.key]) || (s.key === 'custom' ? 'custom' : s.key), lang);
}

export function renderCV(cv, opts = {}) {
  const t = tplById(cv.template), d = cv.design, lang = cv.docLang || 'es';
  const font = fontById(d.font || t.font), accent = d.accent || t.accent;
  const two = !t.fixedCols && d.columns === 2;
  const pg = PAGES[d.page] || PAGES.a4;
  const [lh, gap] = DENS[d.density] || DENS.normal;
  const m = MARGINS[d.margins] || MARGINS.normal;
  const ghost = opts.ghost || null;

  const root = el('div', 'cvdoc');
  root.lang = lang;
  root.dataset.tpl = t.id;
  const lum = (([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255)(hexToRgb(accent));
  root.style.cssText = `--accent:${accent};--on-accent:${lum > 0.6 ? '#141414' : '#ffffff'};--tint:${mix(accent, 0.91)};--tint2:${mix(accent, 0.72)};` +
    `--fs:${((SIZES[d.size] || SIZES.m) * font.adj).toFixed(2)}px;--lh:${lh};--g:${gap};--m:${m}px;--pw:${pg.w}px;--ph:${pg.h}px;font-family:"${font.css}",sans-serif`;
  root.dataset.margin = m;

  const page = el('div', `page ${two ? 'two' : 'one'} side-${t.side || 'right'} ss-${t.sideStyle || 'plain'} h-${t.head} tt-${t.titles}` +
    (t.layout === 'label' ? ' lay-label' : '') + (t.plain ? ' is-plain' : ''));

  const showPhoto = d.photo && !t.noPhoto;
  const photoSrc = cv.personal.photo || (opts.samplePhoto ? SAMPLE_PHOTO : '');
  const photoInSide = two && t.photoIn === 'side', contactInSide = two && t.contactIn === 'side', headInMain = two && t.headIn === 'main';

  const photoEl = () => {
    if (!showPhoto) return null;
    if (photoSrc) { const i = el('img', 'cv-photo ph-' + (t.photoShape || 'rect')); i.src = photoSrc; i.alt = ''; return i; }
    return ghost ? el('div', 'cv-photo ph-empty ghost ph-' + (t.photoShape || 'rect'), ghost.photo) : null;
  };

  // ── Cabecera ──
  const p = cv.personal;
  const fullName = [p.firstName, p.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  const cts = contactItems(cv);
  const head = unit(el('header', 'cv-head'));
  const nameBox = el('div', 'cv-id');
  if (fullName) nameBox.append(el('h1', 'cv-name', fullName));
  else if (ghost) nameBox.append(el('h1', 'cv-name ghost', ghost.name));
  if ((p.title || '').trim()) nameBox.append(el('p', 'cv-title', p.title.trim()));
  else if (ghost && !fullName) nameBox.append(el('p', 'cv-title ghost', ghost.title));
  let ctBox = null;
  if (!contactInSide && cts.length) {
    if (t.head === 'euro') {
      ctBox = el('div', 'ct ct-rows', cts.map(([k, v]) => el('div', 'ct-row', [el('span', 'ct-l', dl(k, lang)), el('span', 'ct-v', v)])));
    } else if (t.head === 'plain') {
      ctBox = el('p', 'ct ct-line', cts.map(([k, v]) => dl(k, lang) + ': ' + v).join('  |  '));
    } else {
      ctBox = el('div', 'ct ct-flow', cts.map(([k, v]) => el('span', 'ct-i', t.contactLabels || k === 'birth' || k === 'nationality' || k === 'permit' ? [el('span', 'ct-l', dl(k, lang) + ': '), v] : v)));
    }
  }
  const ph = photoInSide ? null : photoEl();
  if (t.head === 'split') head.append(el('div', 'cv-head-in', [ph, nameBox, ctBox]));
  else if (t.head === 'euro') head.append(el('div', 'cv-head-in', [el('div', 'cv-head-txt', [nameBox, ctBox]), ph]));
  else if (t.head === 'center') head.append(el('div', 'cv-head-in', [ph, nameBox, ctBox]));
  else head.append(el('div', 'cv-head-in', [ph, el('div', 'cv-head-txt', [nameBox, ctBox])]));
  if (ph) head.classList.add('has-photo');

  // ── Franja de datos clave (disponibilidad, permisos…) ──
  const stripKeys = t.strip || [];
  const inStrip = (s) => stripKeys.includes(s.key) && s.on && !sectionEmpty(s);
  const stripSecs = stripKeys.map((k) => cv.sections.find((s) => s.key === k)).filter((s) => s && inStrip(s));
  let strip = null;
  if (stripSecs.length) {
    strip = unit(el('div', 'cv-strip'));
    for (const s of stripSecs) for (const it of s.items) {
      if (!(it.label || it.value)) continue;
      strip.append(el('span', 'chip', it.label && it.value ? [el('strong', null, it.label + ': '), it.value] : el('strong', null, it.label || it.value)));
    }
  }

  // ── Secciones ──
  const main = el('div', 'col col-main'), side = two ? el('div', 'col col-side') : null;
  if (headInMain) { main.append(head); if (strip) main.append(strip); }
  else { page.append(head); if (strip) page.append(strip); }

  if (side) {
    if (photoInSide) { const x = photoEl(); if (x) side.append(unit(el('div', 'side-photo', x))); }
    if (contactInSide && cts.length) {
      const sec = el('section', 'sec k-contact');
      sec.append(unit(el('h2', 'sec-t', dl('contact', lang)), true));
      for (const [k, v] of cts) sec.append(unit(el('div', 'ct-side', [el('span', 'ct-l', dl(k, lang)), el('span', 'ct-v', v)])));
      side.append(sec);
    }
  }

  for (const s of cv.sections) {
    if (!s.on || inStrip(s)) continue;
    const empty = sectionEmpty(s);
    if (empty && !ghost) continue;
    const def = SECTION_DEFS[s.key] || {};
    const toSide = side && (t.sideKeys || []).includes(s.key);
    const sec = el('section', `sec k-${s.key} kd-${s.kind}`);
    sec.dataset.sec = s.id;
    sec.append(unit(el('h2', 'sec-t', sectionTitle(s, t, lang)), true));
    const body = el('div', 'sec-b');
    if (empty) body.append(unit(el('p', 'ghost', ghost.empty)));
    else renderBody(body, s, def, { t, lang, d, toSide });
    sec.append(body);
    (toSide ? side : main).append(sec);
  }

  const cvBody = el('div', 'cv-body', [main, side]);
  page.append(cvBody);
  root.append(page);
  return root;
}

function bullet(text, cls = 'bul') {
  return unit(el('p', cls, [el('span', 'bu', '•'), el('span', 'bt', text)]));
}

function renderBody(body, s, def, { t, lang, d, toSide }) {
  if (s.kind === 'text') {
    for (const ln of lines(s.text)) body.append(unit(el('p', 'txt', ln)));
  } else if (s.kind === 'list') {
    const style = s.key === 'achievements' ? 'bullets' : (t.listStyle || (t.skills === 'tags' ? 'tags' : 'bullets'));
    if (style === 'tags') body.append(unit(el('div', 'tags', lines(s.text).map((x) => el('span', 'tag', x)))));
    else for (const ln of lines(s.text)) body.append(bullet(ln));
  } else if (s.kind === 'skills') {
    const style = toSide && t.skills === 'grid' ? 'inline' : t.skills;
    for (const g of s.items) {
      const tk = tokens(g.text); const label = (g.label || '').trim();
      if (!tk.length && !label) continue;
      if (style === 'tags') {
        if (label) body.append(unit(el('p', 'sk-l', label), true));
        body.append(unit(el('div', 'tags', tk.map((x) => el('span', 'tag', x)))));
      } else if (style === 'grid') {
        body.append(unit(el('div', 'sk-row', [el('span', 'sk-l', label), el('span', 'sk-v', tk.join(', '))])));
      } else if (style === 'list') {
        if (label) body.append(unit(el('p', 'sk-l', label), true));
        for (const x of tk) body.append(bullet(x));
      } else {
        body.append(unit(el('p', 'sk-in', label ? [el('strong', null, label + ': '), tk.join(', ')] : tk.join(', '))));
      }
    }
  } else if (s.kind === 'langs') {
    const style = t.langs;
    const lvText = (lv) => (lv === 'native' ? dl('native', lang) : lv ? `${lv} (${dl(lv, lang)})` : '');
    const items = s.items.filter((x) => (x.name || '').trim());
    if (style === 'table' && !toSide) {
      const tb = el('div', 'lg-table');
      tb.append(unit(el('div', 'lg-tr lg-th', [el('span', null, dl('thLang', lang)), el('span', null, dl('thLevel', lang)), el('span', null, dl('thCert', lang))]), true));
      for (const x of items) tb.append(unit(el('div', 'lg-tr', [el('strong', null, x.name), el('span', null, lvText(x.level)), el('span', null, x.note || '')])));
      body.append(tb);
    } else if (style === 'scale' && !toSide) {
      for (const x of items) {
        const row = unit(el('div', 'lg-s'));
        row.append(el('strong', 'lg-n', x.name));
        if (x.level === 'native' || !x.level) row.append(el('span', 'lg-nat', lvText(x.level)));
        else row.append(el('span', 'lg-cells', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((c) => el('span', 'lg-c' + (c === x.level ? ' on' : ''), c))), el('span', 'lg-lv', dl(x.level, lang)));
        if (x.note) row.append(el('span', 'lg-note', x.note));
        body.append(row);
      }
    } else if (style === 'dots') {
      for (const x of items) {
        const rank = levelRank(x.level);
        const row = unit(el('div', 'lg-d'));
        row.append(el('div', 'lg-d1', [el('strong', null, x.name), el('span', 'lg-code', x.level === 'native' ? dl('native', lang) : x.level || '')]));
        if (rank) row.append(el('div', 'dots', [1, 2, 3, 4, 5, 6].map((i) => el('span', 'dot' + (i <= rank ? ' on' : '')))));
        if (x.note) row.append(el('div', 'lg-note', x.note));
        body.append(row);
      }
    } else {
      for (const x of items) {
        const bits = [lvText(x.level), x.note].filter(Boolean).join(', ');
        body.append(unit(el('p', 'lg-t', [el('strong', null, x.name), bits ? ': ' + bits : ''])));
      }
    }
  } else if (s.kind === 'facts') {
    for (const it of s.items) {
      const a = (it.label || '').trim(), b = (it.value || '').trim();
      if (!a && !b) continue;
      body.append(unit(el('div', 'fact', a && b ? [el('span', 'f-l', a), el('span', 'f-v', b)] : el('span', 'f-l solo', a || b))));
    }
  } else if (s.kind === 'entries') {
    let style = t.entry;
    if (def.compact) style = 'compact';
    if (toSide) style = 'stack';
    if (s.key === 'courses' && t.courseTable && !toSide) style = 'ctable';
    const box = el('div', 'ents e-' + style);
    for (const it of s.items) {
      const title = (it.title || '').trim(), org = (it.org || '').trim(), place = (it.place || '').trim();
      const dates = def.noDates ? '' : def.single ? fmtDate(it.end || it.start, d.dateFormat === 'num' ? 'year' : d.dateFormat, lang) : fmtRange(it, d.dateFormat, lang);
      const desc = lines(it.desc);
      if (!title && !org && !desc.length) continue;
      const ent = el('div', 'ent');
      const sub = [org, place].filter(Boolean).join(', ');
      const hd = unit(el('div', 'ent-h'), desc.length > 0);
      if (style === 'left') {
        hd.append(el('span', 'ent-d', dates), el('div', 'ent-m', [el('strong', 'ent-t', title || org), title && sub ? el('div', 'ent-s', sub) : null]));
      } else if (style === 'inline') {
        hd.append(el('p', 'ent-t', el('strong', null, title || org)), el('p', 'ent-s', [title ? sub : place, dates].filter(Boolean).join('  |  ')));
      } else if (style === 'stack') {
        hd.append(el('strong', 'ent-t', title || org), title && sub ? el('div', 'ent-s', sub) : null, dates ? el('div', 'ent-d', dates) : null);
      } else if (style === 'compact') {
        hd.append(el('div', 'ent-r', [el('span', 'ent-c', [el('strong', 'ent-t', title || org), title && sub ? ', ' + sub : '']), dates ? el('span', 'ent-d', dates) : null]));
      } else if (style === 'ctable') {
        hd.append(el('strong', 'ent-t', title), el('span', 'ent-s', org), el('span', 'ent-x', place), el('span', 'ent-d', dates));
      } else {
        if (style === 'timeline') hd.append(el('span', 'tl-dot'));
        hd.append(el('div', 'ent-r', [el('strong', 'ent-t', title || org), dates ? el('span', 'ent-d', dates) : null]), title && sub ? el('div', 'ent-s', sub) : null);
      }
      ent.append(hd);
      if (desc.length === 1) ent.append(unit(el('p', 'ent-l', desc[0])));
      else for (const ln of desc) ent.append(bullet(ln.replace(/^[-•*]\s*/, ''), 'ent-l bul'));
      box.append(ent);
    }
    body.append(box);
  }
}

// ── Paginación: parte la hoja en páginas moviendo bloques enteros (data-u) ──
function findBreak(col, limit) {
  const units = [...col.querySelectorAll('[data-u]')];
  let i = units.findIndex((u) => u.getBoundingClientRect().bottom > limit);
  if (i < 0) return null;
  while (i > 0 && units[i - 1].hasAttribute('data-keep')) i--;
  if (i === 0) {
    i = units.findIndex((u, j) => j > 0 && !units[j - 1].hasAttribute('data-keep') && u.getBoundingClientRect().bottom > limit);
    if (i < 0) return null;
  }
  return units[i];
}

function splitAt(col, u, newCol) {
  const chain = [];
  for (let p = u.parentNode; p !== col; p = p.parentNode) chain.unshift(p);
  const clones = new Map();
  let dest = newCol;
  for (const a of chain) { const c = a.cloneNode(false); c.classList.add('cont'); dest.appendChild(c); clones.set(a, c); dest = c; }
  let node = u, moveSelf = true;
  for (;;) {
    const par = node.parentNode;
    const dst = par === col ? newCol : clones.get(par);
    let cur = moveSelf ? node : node.nextSibling;
    while (cur) { const nx = cur.nextSibling; dst.appendChild(cur); cur = nx; }
    if (!moveSelf && !node.hasChildNodes()) node.remove();
    if (par === col) break;
    node = par; moveSelf = false;
  }
}

export function paginate(root) {
  const m = parseFloat(root.dataset.margin) || 50;
  let page = root.querySelector('.page');
  for (let guard = 0; guard < 10; guard++) {
    const pr = page.getBoundingClientRect();
    const scale = pr.width / page.offsetWidth || 1;
    const limit = pr.bottom - m * scale + 0.5;
    const body = page.querySelector(':scope > .cv-body');
    const cols = [...body.children];
    const breaks = cols.map((c) => findBreak(c, limit));
    if (!breaks.some(Boolean)) break;
    const next = page.cloneNode(false); next.classList.add('cont');
    const nb = body.cloneNode(false); next.appendChild(nb);
    cols.forEach((c, i) => { const nc = c.cloneNode(false); nb.appendChild(nc); if (breaks[i]) splitAt(c, breaks[i], nc); });
    root.appendChild(next);
    page = next;
  }
  return root.querySelectorAll('.page').length;
}

const loaded = new Set();
export async function ensureFont(fontId) {
  const f = fontById(fontId);
  if (loaded.has(f.id) || !document.fonts) return;
  try {
    await Promise.all(['400', '700', 'italic 400'].map((w) => document.fonts.load(`${w} 16px "${f.css}"`, 'Añ')));
    loaded.add(f.id);
  } catch { /* se pinta con la fuente de reserva */ }
}
