// Panel del editor: Contenido, Plantilla, Diseño y Destino.

import { h, icon, btn, toast, confirmDelete, dialog, sortable } from './dom.js';
import { t, tr, getLang } from './i18n.js';
import { dl, DOC_LANGS, LEVELS, fmtDate } from './doc-i18n.js';
import { TEMPLATES, GROUPS, FONTS, ACCENTS, SECTION_DEFS, BASE_KEYS, tplById, newSection, sectionEmpty, uid, applyTemplate } from './templates.js';
import { sectionTitle } from './render.js';
import { DESTS, destById } from './countries.js';
import { entryLabels, factLabels, listHint, sectorHint } from './hints.js';

// ── Piezas de formulario ──
function field(app, { id, label, hint, value, set, area, rows = 3, ph, type = 'text', mode, auto, flag }) {
  const fid = 'f-' + id;
  const input = h(area ? 'textarea' : 'input', {
    id: fid, class: 'in', type: area ? null : type, rows: area ? rows : null, placeholder: ph, inputmode: mode,
    autocomplete: auto || 'off', spellcheck: area ? 'true' : null, value: value || '',
    'aria-describedby': hint ? fid + '-h' : null,
    oninput: (e) => app.change(() => set(e.target.value), { coalesce: id }),
  });
  return h('div', { class: 'fld' }, h('label', { for: fid, text: label }),
    hint ? h('p', { class: 'hint', id: fid + '-h', text: hint }) : null,
    flag ? h('p', { class: 'flag', text: flag }) : null, input);
}

function seg(app, { label, value, options, set, id }) {
  return h('fieldset', { class: 'fld seg-f' }, h('legend', { text: label }),
    h('div', { class: 'seg', id: id || null }, options.map(([v, text, dis]) => h('button', {
      type: 'button', 'aria-pressed': String(v === value), disabled: dis,
      onclick: () => { if (v !== value) app.change(() => set(v), { structural: true }); },
    }, text))));
}

function dateField(app, { id, label, value, set, yearOnly }) {
  const [y, m] = String(value || '').split('-');
  const lang = getLang();
  const months = Array.from({ length: 12 }, (_, i) => fmtDate('2020-' + String(i + 1).padStart(2, '0'), 'long', lang).replace(' 2020', ''));
  let cy = y || '', cm = m || '';
  const emit = () => app.change(() => set(cy ? (cm ? cy + '-' + cm : cy) : ''), { coalesce: id });
  return h('fieldset', { class: 'fld date-f' }, h('legend', { text: label }),
    h('div', { class: 'date-row' },
      yearOnly ? null : h('label', { class: 'mini' }, h('span', { text: t('month') }),
        h('select', { class: 'in', onchange: (e) => { cm = e.target.value; emit(); } },
          h('option', { value: '', text: t('noMonth') }), months.map((n, i) => { const v = String(i + 1).padStart(2, '0'); return h('option', { value: v, text: n, selected: v === cm }); }))),
      h('label', { class: 'mini' }, h('span', { text: t('year') }),
        h('input', { class: 'in', type: 'text', inputmode: 'numeric', maxlength: '4', placeholder: '2021', value: cy, autocomplete: 'off',
          oninput: (e) => { cy = e.target.value.replace(/\D/g, '').slice(0, 4); if (cy !== e.target.value) e.target.value = cy; if (cy.length === 4 || cy === '') emit(); } }))));
}

function rowTools(app, list, i, name, after) {
  const mv = (d) => app.change(() => { const [x] = list.splice(i, 1); list.splice(i + d, 0, x); }, { structural: true });
  return h('div', { class: 'row-tools' },
    btn('tool', 'up', t('moveUp'), () => mv(-1), { disabled: i === 0 }),
    btn('tool', 'down', t('moveDown'), () => mv(1), { disabled: i === list.length - 1 }),
    btn('tool danger-t', 'trash', t('delete'), async () => {
      if (await confirmDelete(t('itemDelT'), t('itemDelB', name || t('untitled')))) app.change(() => { list.splice(i, 1); if (after) after(); }, { structural: true });
    }));
}

// ── Contenido ──
export function renderContent(app) {
  const cv = app.cv, tpl = tplById(cv.template), dest = destById(cv.country);
  const wrap = h('div', { class: 'tabpane' });
  const secs = h('div', { class: 'secs', id: 'secs' });

  // Datos personales (siempre la primera, no se mueve)
  const pOpen = app.open === 'personal';
  const p = cv.personal;
  const pers = h('section', { class: 'sec-card fixed' + (pOpen ? ' open' : '') },
    h('div', { class: 'sec-head' },
      h('button', { type: 'button', class: 'sec-toggle', 'aria-expanded': String(pOpen), onclick: () => app.toggleSec('personal') },
        h('span', { class: 'sec-name', text: t('secPersonal') }),
        h('span', { class: 'sec-state', text: [p.firstName, p.lastName].filter(Boolean).join(' ') || t('empty') }),
        h('span', { class: 'sec-chev' }, h('span', { text: pOpen ? t('closeSec') : t('openSec') }), icon('chevron')))));
  if (pOpen) pers.append(personalBody(app, tpl, dest));
  secs.append(pers);

  const list = h('div', { class: 'sec-list' });
  cv.sections.forEach((s, i) => list.append(sectionCard(app, s, i, tpl)));
  sortable(list, '.sec-card', '.grip', (from, to) => app.change((c) => { const [x] = c.sections.splice(from, 1); c.sections.splice(to, 0, x); }, { structural: true }));
  secs.append(list);
  wrap.append(secs, btn('add wide', 'plus', t('addSec'), () => addSectionDialog(app)));
  return wrap;
}

function personalBody(app, tpl, dest) {
  const cv = app.cv, p = cv.personal;
  const f = (k, o = {}) => field(app, { id: 'p-' + k, label: t(k), value: p[k], set: (v) => { p[k] = v; }, ...o });
  const omit = (k) => (dest.omit.includes(k) ? t('omitFlag', tr(dest.name)) : null);
  const more = ['web', 'linkedin', 'birth', 'nationality', 'permit'];
  const moreOpen = app.moreData || more.some((k) => p[k]);
  return h('div', { class: 'sec-body' },
    h('div', { class: 'two-f' }, f('firstName', { auto: 'given-name' }), f('lastName', { auto: 'family-name' })),
    field(app, { id: 'p-title', label: t('jobTitle'), hint: sectorHint(tpl.id, 'title'), value: p.title, set: (v) => { p.title = v; } }),
    h('div', { class: 'two-f' }, f('phone', { type: 'tel', mode: 'tel', auto: 'tel', hint: t('phoneHint') }), f('email', { type: 'email', mode: 'email', auto: 'email', hint: t('emailHint') })),
    f('city', { hint: t('cityHint'), auto: 'address-level2' }),
    photoBlock(app, tpl, omit('photo')),
    h('details', { class: 'more', open: moreOpen, ontoggle: (e) => { app.moreData = e.target.open; } },
      h('summary', null, h('span', { text: t('moreData') }), icon('chevron')),
      f('web', { hint: t('webHint'), mode: 'url' }), f('linkedin', { hint: t('linkedinHint'), mode: 'url' }),
      f('birth', { hint: t('birthHint'), flag: omit('birth') }), f('nationality', { hint: t('nationalityHint'), flag: omit('nationality') }),
      f('permit', { hint: t('permitHint') })));
}

function photoBlock(app, tpl, flag) {
  const cv = app.cv, p = cv.personal;
  if (tpl.noPhoto) return h('div', { class: 'fld photo-f' }, h('span', { class: 'lbl', text: t('photo') }), h('p', { class: 'hint', text: t('photoNoTpl') }));
  const on = cv.design.photo;
  return h('fieldset', { class: 'fld photo-f', id: 'photo-f' }, h('legend', { text: t('photo') }),
    h('p', { class: 'hint', text: t('photoHint') }), flag ? h('p', { class: 'flag', text: flag }) : null,
    h('div', { class: 'photo-row' },
      p.photo ? h('img', { class: 'photo-prev', src: p.photo, alt: t('photoAlt') }) : null,
      h('div', { class: 'photo-acts' },
        h('div', { class: 'seg' },
          h('button', { type: 'button', 'aria-pressed': String(on), onclick: () => !on && app.change((c) => { c.design.photo = true; }, { structural: true }) }, t('photoOn')),
          h('button', { type: 'button', 'aria-pressed': String(!on), onclick: () => on && app.change((c) => { c.design.photo = false; }, { structural: true }) }, t('photoOff'))),
        on ? h('div', { class: 'btn-row' },
          btn('ghost', 'photo', p.photo ? t('photoChange') : t('photoPick'), () => app.pickPhoto()),
          p.photo ? btn('ghost', 'trash', t('photoRemove'), () => app.change((c) => { c.personal.photo = ''; }, { structural: true })) : null) : null)));
}

function secState(s) {
  if (!s.on) return t('hidden');
  if (sectionEmpty(s)) return t('empty');
  if (s.kind === 'text' || s.kind === 'list') return t('filled');
  return s.items.length === 1 ? t('nItems1') : t('nItems', s.items.length);
}

function sectionCard(app, s, i, tpl) {
  const cv = app.cv, open = app.open === s.id;
  const title = sectionTitle(s, tpl, cv.docLang);
  const uiTitle = s.title && s.title.trim() ? s.title.trim() : dl((tpl.titleKeys && tpl.titleKeys[s.key]) || s.key, getLang());
  const sw = h('label', { class: 'switch', title: t('show') },
    h('input', { type: 'checkbox', checked: s.on, 'aria-label': t('show') + ': ' + uiTitle, onchange: (e) => app.change(() => { s.on = e.target.checked; }, { structural: true }) }),
    h('span', { class: 'sw-track' }, h('span', { class: 'sw-knob' })), h('span', { class: 'sw-txt', text: t('show') }));
  const card = h('section', { class: 'sec-card' + (open ? ' open' : '') + (s.on ? '' : ' off'), 'data-id': s.id },
    h('div', { class: 'sec-head' },
      h('button', { type: 'button', class: 'grip', 'aria-label': t('move') + ': ' + uiTitle, title: t('move'),
        onkeydown: (e) => {
          const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
          if (!d || i + d < 0 || i + d >= cv.sections.length) return;
          e.preventDefault();
          app.change((c) => { const [x] = c.sections.splice(i, 1); c.sections.splice(i + d, 0, x); }, { structural: true });
          requestAnimationFrame(() => document.querySelector(`.sec-card[data-id="${s.id}"] .grip`)?.focus());
        } }, icon('grip'), h('span', { text: t('move') })),
      h('button', { type: 'button', class: 'sec-toggle', 'aria-expanded': String(open), onclick: () => app.toggleSec(s.id) },
        h('span', { class: 'sec-name', text: uiTitle }),
        h('span', { class: 'sec-state', text: secState(s) }),
        h('span', { class: 'sec-chev' }, h('span', { text: open ? t('closeSec') : t('openSec') }), icon('chevron'))),
      sw));
  if (!open) return card;

  const def = SECTION_DEFS[s.key];
  const body = h('div', { class: 'sec-body' });
  if (def && def.sector) body.append(h('p', { class: 'tagline', text: t('sectorTag') }));
  body.append(sectionEditor(app, s, tpl));
  const mv = (d) => app.change((c) => { const [x] = c.sections.splice(i, 1); c.sections.splice(i + d, 0, x); }, { structural: true });
  body.append(h('details', { class: 'more sec-opts' },
    h('summary', null, h('span', { text: t('secTitle') + ' · ' + t('move') }), icon('chevron')),
    field(app, { id: 's-title-' + s.id, label: t('secTitle'), hint: t('secTitleHint', dl((tpl.titleKeys && tpl.titleKeys[s.key]) || s.key, cv.docLang)), value: s.title, set: (v) => { s.title = v; }, ph: title }),
    h('div', { class: 'btn-row' },
      btn('ghost', 'up', t('moveUp'), () => mv(-1), { disabled: i === 0 }),
      btn('ghost', 'down', t('moveDown'), () => mv(1), { disabled: i === cv.sections.length - 1 }),
      !BASE_KEYS.includes(s.key) ? btn('ghost danger-t', 'trash', t('removeSec'), async () => {
        if (await confirmDelete(t('delSecT', uiTitle), t('delSecB'))) { app.open = null; app.change((c) => { c.sections = c.sections.filter((x) => x !== s); }, { structural: true }); }
      }) : null)));
  card.append(body);
  return card;
}

function exampleBox(app, text, use) {
  return h('details', { class: 'ex' }, h('summary', null, h('span', { text: t('example') }), icon('chevron')),
    h('blockquote', { text }), h('p', { class: 'hint', text: t('exampleNote') }),
    use ? btn('ghost', 'pencil', t('useExample'), use) : null);
}

function sectionEditor(app, s, tpl) {
  const box = h('div', { class: 'sec-ed' });
  const sid = s.id;
  if (s.kind === 'text') {
    const isProfile = s.key === 'profile';
    box.append(field(app, { id: 't-' + sid, label: sectionTitle(s, tpl, getLang() === 'en' ? 'en' : 'es'), hint: isProfile ? sectorHint(tpl.id, 'profile') + ' ' + t('textHint') : t('textHint'), value: s.text, set: (v) => { s.text = v; }, area: true, rows: 5 }));
    if (isProfile) box.append(exampleBox(app, sectorHint(tpl.id, 'profileEx'), () => app.change(() => { s.text = sectorHint(tpl.id, 'profileEx'); }, { structural: true })));
  } else if (s.kind === 'list') {
    box.append(field(app, { id: 't-' + sid, label: sectionTitle(s, tpl, getLang()), hint: listHint(s.key), value: s.text, set: (v) => { s.text = v; }, area: true, rows: 5 }));
  } else if (s.kind === 'langs') {
    box.append(h('p', { class: 'hint', text: t('langHint') }));
    s.items.forEach((it, i) => box.append(h('div', { class: 'item-row' },
      h('div', { class: 'two-f' },
        field(app, { id: `l-${it.id}-n`, label: t('langName'), value: it.name, set: (v) => { it.name = v; }, ph: getLang() === 'en' ? 'English' : 'Inglés' }),
        h('div', { class: 'fld' }, h('label', { for: `l-${it.id}-lv`, text: t('langLevel') }),
          h('select', { id: `l-${it.id}-lv`, class: 'in', onchange: (e) => app.change(() => { it.level = e.target.value; }) },
            h('option', { value: '', text: t('langPick') }),
            LEVELS.map((lv) => h('option', { value: lv, selected: it.level === lv, text: lv === 'native' ? t('langNative') : `${lv} · ${dl(lv, getLang())}` }))))),
      field(app, { id: `l-${it.id}-c`, label: t('langNote'), value: it.note, set: (v) => { it.note = v; } }),
      rowTools(app, s.items, i, it.name))));
    box.append(btn('add', 'plus', t('addLang'), () => app.change(() => { s.items.push({ id: uid(), name: '', level: '', note: '' }); }, { structural: true, focus: '.sec-card.open .item-row:last-of-type input' })));
  } else if (s.kind === 'skills') {
    s.items.forEach((it, i) => box.append(h('div', { class: 'item-row' },
      field(app, { id: `k-${it.id}-l`, label: t('skGroup'), hint: i === 0 ? t('skGroupHint') : null, value: it.label, set: (v) => { it.label = v; } }),
      field(app, { id: `k-${it.id}-t`, label: t('skItems'), hint: t('skItemsHint') + ' ' + sectorHint(tpl.id, 'skills'), value: it.text, set: (v) => { it.text = v; }, area: true, rows: 2 }),
      rowTools(app, s.items, i, it.label || it.text))));
    box.append(btn('add', 'plus', t('addGroup'), () => app.change(() => { s.items.push({ id: uid(), label: '', text: '' }); }, { structural: true, focus: '.sec-card.open .item-row:last-of-type input' })));
  } else if (s.kind === 'facts') {
    const fl = factLabels(s.key);
    box.append(h('p', { class: 'hint', text: fl.hint }));
    s.items.forEach((it, i) => box.append(h('div', { class: 'item-row' },
      h('div', { class: 'two-f' },
        field(app, { id: `x-${it.id}-l`, label: fl.label, value: it.label, set: (v) => { it.label = v; } }),
        field(app, { id: `x-${it.id}-v`, label: fl.value, value: it.value, set: (v) => { it.value = v; } })),
      rowTools(app, s.items, i, it.label))));
    box.append(btn('add', 'plus', t('addFact'), () => app.change(() => { s.items.push({ id: uid(), label: '', value: '' }); }, { structural: true, focus: '.sec-card.open .item-row:last-of-type input' })));
  } else {
    const lb = entryLabels(SECTION_DEFS[s.key] ? s.key : 'custom');
    const isExp = s.key === 'experience';
    s.items.forEach((it, i) => {
      const open = app.openItem === it.id;
      const name = [it.title, it.org].filter(Boolean).join(', ');
      const row = h('div', { class: 'item-card' + (open ? ' open' : '') },
        h('button', { type: 'button', class: 'item-head', 'aria-expanded': String(open), onclick: () => { app.openItem = open ? null : it.id; app.renderPanel(); } },
          h('span', { class: 'item-name', text: name || t('untitled') }),
          h('span', { class: 'sec-chev' }, h('span', { text: open ? t('done') : t('edit') }), icon('chevron'))));
      if (open) {
        row.append(h('div', { class: 'item-body' },
          field(app, { id: `e-${it.id}-t`, label: lb.title, hint: lb.titleHint || (isExp ? sectorHint(tpl.id, 'job') : null), value: it.title, set: (v) => { it.title = v; } }),
          h('div', { class: 'two-f' },
            field(app, { id: `e-${it.id}-o`, label: lb.org, hint: lb.orgHint, value: it.org, set: (v) => { it.org = v; } }),
            field(app, { id: `e-${it.id}-p`, label: lb.place, hint: lb.placeHint, value: it.place, set: (v) => { it.place = v; } })),
          lb.noDates ? null : lb.single
            ? dateField(app, { id: `e-${it.id}-e`, label: t('year'), value: it.end, set: (v) => { it.end = v; }, yearOnly: true })
            : h('div', { class: 'dates' },
              dateField(app, { id: `e-${it.id}-s`, label: t('start'), value: it.start, set: (v) => { it.start = v; } }),
              it.current ? null : dateField(app, { id: `e-${it.id}-e`, label: t('end'), value: it.end, set: (v) => { it.end = v; } }),
              h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: it.current, onchange: (e) => app.change(() => { it.current = e.target.checked; }, { structural: true }) }), h('span', { text: t('current') }))),
          lb.desc ? field(app, { id: `e-${it.id}-d`, label: lb.desc, hint: lb.descHint, value: it.desc, set: (v) => { it.desc = v; }, area: true, rows: 4 }) : null,
          isExp ? exampleBox(app, sectorHint(tpl.id, 'descEx')) : null,
          rowTools(app, s.items, i, name, () => { app.openItem = null; })));
      }
      box.append(row);
    });
    box.append(btn('add', 'plus', lb.add, () => {
      const it = { id: uid(), title: '', org: '', place: '', start: '', end: '', current: false, desc: '' };
      app.openItem = it.id;
      app.change(() => { s.items.push(it); }, { structural: true, focus: '.item-card.open input' });
    }));
  }
  return box;
}

async function addSectionDialog(app) {
  const cv = app.cv, tpl = tplById(cv.template);
  const have = new Set(cv.sections.map((s) => s.key));
  const sector = Object.keys(SECTION_DEFS).filter((k) => SECTION_DEFS[k].sector && !have.has(k));
  const sectorFirst = sector.sort((a, b) => ((tpl.extra || []).includes(b) ? 1 : 0) - ((tpl.extra || []).includes(a) ? 1 : 0));
  const acts = [
    ...sectorFirst.map((k) => ({ label: dl(k, getLang()), value: { key: k } })),
    { label: t('customEntries'), value: { key: 'custom', kind: 'entries' } },
    { label: t('customList'), value: { key: 'custom', kind: 'list' } },
    { label: t('customText'), value: { key: 'custom', kind: 'text' } },
    { label: t('cancel'), value: null, cls: 'ghost quiet' },
  ];
  const hidden = cv.sections.filter((s) => !s.on);
  const pick = await dialog({
    title: t('addSec'), wide: true,
    body: [h('p', { text: t('addSecLead') }), hidden.length ? h('p', { class: 'hint', text: getLang() === 'en'
      ? 'Sections you have hidden (' + hidden.length + ') are still in the list: turn them on with their switch.'
      : 'Las secciones que tienes ocultas (' + hidden.length + ') siguen en la lista: actívalas con su interruptor.' }) : null,
    h('p', { class: 'dlg-sub', text: t('addCustom') + ':' })],
    actions: acts,
  });
  if (!pick) return;
  const sec = pick.key === 'custom' ? newSection('custom', { kind: pick.kind, title: t('customName') }) : newSection(pick.key);
  if (sec.kind === 'text' || sec.kind === 'list') { sec.text = ''; delete sec.items; } else { sec.items = []; delete sec.text; }
  app.open = sec.id;
  app.change((c) => { c.sections.push(sec); }, { structural: true, focus: `.sec-card[data-id="${sec.id}"] .sec-toggle` });
  toast(t('secAdded'));
}

// ── Plantilla ──
export function renderTemplates(app) {
  const cv = app.cv;
  const wrap = h('div', { class: 'tabpane' }, h('p', { class: 'lead', text: t('tplLead') }));
  for (const [gid, gname] of GROUPS) {
    wrap.append(h('h3', { class: 'grp', text: tr(gname) }));
    const grid = h('div', { class: 'tpl-grid' });
    for (const tp of TEMPLATES.filter((x) => x.group === gid)) {
      const cur = tp.id === cv.template;
      const b = h('button', { type: 'button', class: 'tpl-opt' + (cur ? ' cur' : ''), 'aria-pressed': String(cur), 'data-tpl': tp.id, onclick: () => !cur && app.applyTpl(tp.id) },
        app.thumb(tp.id), h('span', { class: 'tpl-name' }, h('strong', { text: tr(tp.name) }), cur ? h('span', { class: 'pill', text: t('inUse') }) : null),
        h('span', { class: 'tpl-desc', text: tr(tp.desc) }));
      grid.append(b);
    }
    wrap.append(grid);
  }
  return wrap;
}

// ── Diseño ──
export function renderDesign(app) {
  const cv = app.cv, d = cv.design, tpl = tplById(cv.template);
  const set = (k) => (v) => { d[k] = v; };
  const custom = !ACCENTS.some(([c]) => c.toLowerCase() === (d.accent || '').toLowerCase());
  const wrap = h('div', { class: 'tabpane' }, h('p', { class: 'lead', text: t('designLead') }),
    h('fieldset', { class: 'fld' }, h('legend', { text: t('dColor') }),
      h('div', { class: 'swatches' },
        ACCENTS.map(([c, name]) => h('button', { type: 'button', class: 'sw', style: `--c:${c}`, 'aria-pressed': String(c.toLowerCase() === (d.accent || '').toLowerCase()), 'aria-label': tr(name), title: tr(name),
          onclick: () => app.change(() => { d.accent = c; }, { structural: true }) }, icon('check', 18))),
        h('label', { class: 'sw-custom' + (custom ? ' on' : '') }, h('input', { type: 'color', value: d.accent || tpl.accent, oninput: (e) => app.change(() => { d.accent = e.target.value; }, { coalesce: 'accent' }), onchange: () => app.renderPanel() }), h('span', { text: t('dOther') })))),
    h('fieldset', { class: 'fld' }, h('legend', { text: t('dFont') }),
      h('div', { class: 'fonts' }, FONTS.map((f) => h('button', { type: 'button', class: 'font-opt', 'aria-pressed': String(f.id === d.font), onclick: () => f.id !== d.font && app.change(() => { d.font = f.id; }, { structural: true }) },
        h('span', { class: 'font-aa', style: `font-family:"${f.css}"`, text: 'Aa' }), h('span', { class: 'font-n' }, h('strong', { style: `font-family:"${f.css}"`, text: f.css }), h('span', { text: tr(f.kind) })))))),
    seg(app, { label: t('dSize'), value: d.size, set: set('size'), options: [['s', t('sizeS')], ['m', t('sizeM')], ['l', t('sizeL')], ['xl', t('sizeXl')]] }),
    seg(app, { label: t('dCols'), value: tpl.fixedCols ? 1 : d.columns, set: set('columns'), options: [[1, t('cols1'), tpl.fixedCols], [2, t('cols2'), tpl.fixedCols]] }),
    tpl.fixedCols ? h('p', { class: 'hint after', text: t('colsFixed') }) : null,
    tpl.noPhoto ? h('div', { class: 'fld' }, h('span', { class: 'lbl', text: t('photo') }), h('p', { class: 'hint', text: t('photoNoTpl') }))
      : seg(app, { label: t('photo'), value: d.photo, set: set('photo'), options: [[true, t('photoOn')], [false, t('photoOff')]] }),
    h('details', { class: 'more', open: app.moreDesign, ontoggle: (e) => { app.moreDesign = e.target.open; } },
      h('summary', null, h('span', { text: t('dMore') }), icon('chevron')),
      seg(app, { label: t('dMargins'), value: d.margins, set: set('margins'), options: [['narrow', t('mNarrow')], ['normal', t('mNormal')], ['wide', t('mWide')]] }),
      seg(app, { label: t('dDensity'), value: d.density, set: set('density'), options: [['tight', t('dTight')], ['normal', t('dNormal')], ['loose', t('dLoose')]] }),
      h('div', { class: 'fld' }, h('label', { for: 'd-dates', text: t('dDates') }),
        h('select', { id: 'd-dates', class: 'in', onchange: (e) => app.change(() => { d.dateFormat = e.target.value; }) },
          ['num', 'short', 'long', 'year'].map((f) => h('option', { value: f, selected: d.dateFormat === f, text: fmtDate('2021-03', f, cv.docLang) + ' – ' + fmtDate('2023-11', f, cv.docLang) })))),
      seg(app, { label: t('dPage'), value: d.page, set: set('page'), options: [['a4', t('pageA4')], ['letter', t('pageLetter')]] }),
      btn('ghost', 'undo', t('dReset'), () => { app.change((c) => { const keep = c.design.photo; applyTemplate(c, c.template); c.design.photo = keep; }, { structural: true }); toast(t('dResetDone')); })));
  return wrap;
}

// ── Destino ──
export function renderDest(app) {
  const cv = app.cv, dest = destById(cv.country);
  const ap = dest.apply;
  const what = [ap.photo === false ? t('apPhoto') : null, ap.page ? t('apPage') : null, ap.dateFormat ? t('apDates') : null, ap.docLang ? t('apLang') : null].filter(Boolean);
  const pending = (ap.photo === false && cv.design.photo) || (ap.page && cv.design.page !== ap.page) || (ap.dateFormat && cv.design.dateFormat !== ap.dateFormat) || (ap.docLang && cv.docLang !== ap.docLang);
  return h('div', { class: 'tabpane' },
    h('div', { class: 'fld' }, h('label', { for: 'dest-sel', text: t('destQ') }), h('p', { class: 'hint', text: t('destLead') }),
      h('select', { id: 'dest-sel', class: 'in big', onchange: (e) => app.change(() => { cv.country = e.target.value; }, { structural: true }) },
        DESTS.map((x) => h('option', { value: x.id, selected: x.id === dest.id, text: tr(x.name) })))),
    h('section', { class: 'recs', id: 'recs' },
      h('h3', { text: t('destRecsH', tr(dest.name)) }),
      h('dl', null, dest.recs.map(([k, txt]) => [h('dt', { text: t('rk_' + k) }), h('dd', { text: tr(txt) })])),
      h('p', { class: 'disc', text: t('destDisc') }),
      what.length ? h('div', { class: 'apply' },
        btn('primary', 'check', t('destApply'), () => {
          app.change((c) => {
            if (ap.photo === false) c.design.photo = false;
            if (ap.page) c.design.page = ap.page;
            if (ap.dateFormat) c.design.dateFormat = ap.dateFormat;
            if (ap.docLang) c.docLang = ap.docLang;
          }, { structural: true });
          toast(t('destApplied'), { label: t('undo'), run: () => app.undo() });
        }, { disabled: !pending, id: 'dest-apply' }),
        h('p', { class: 'hint', text: t('destApplyHint', what.join(', ')) })) : null),
    h('div', { class: 'fld' }, h('label', { for: 'doc-lang', text: t('docLang') }), h('p', { class: 'hint', text: t('docLangHint') }),
      h('select', { id: 'doc-lang', class: 'in big', onchange: (e) => app.change(() => { cv.docLang = e.target.value; }, { structural: true }) },
        DOC_LANGS.map(([id, name]) => h('option', { value: id, selected: id === cv.docLang, text: name })))));
}
