// Impasto: recetario, calculadora, planificador y configurador de masas de pizza.
import { t, getLang, setLang, applyStatic, dayLabel, timeLabel } from './i18n.js';
import { h, icon, toast, confirmDialog, numField, segmented } from './ui.js';
import { store, allRecipes, getRecipe, scaled, saveRecipe, deleteRecipe, duplicateRecipe, isFav, toggleFav } from './store.js';
import { compute, warnings, fmtG, fmtPct, fmtDuration, convertYeast, YEAST_FACTOR } from './calc.js';
import { buildSteps, totalMinutes, schedule, loc, STEP_TYPES, TOKENS, isPan } from './steps.js';
import { BUILTIN, STYLES, METHODS, SHAPES, blankRecipe } from './recipes.js';
import { ingredientRows } from './tables.js';
import { cookView } from './cook.js';

const view = document.getElementById('view');
let destroy = null;
const lang = () => getLang();
const go = (hash) => { location.hash = hash; };
const clone = (o) => structuredClone(o);

// ---------- piezas compartidas ----------
function ingredientTable(r, c) {
  const rows = ingredientRows(r, c, lang());
  const tbody = h('tbody');
  for (const row of rows) {
    if (row.kind === 'group') tbody.append(h('tr.group', h('th', { colspan: 3, scope: 'colgroup' }, row.label)));
    else tbody.append(h('tr' + (row.kind === 'total' ? '.total' : ''), { 'data-g': row.kind === 'total' ? null : row.value, 'data-total': row.kind === 'total' ? row.value : null },
      h('th', { scope: 'row' }, row.label), h('td.g', row.g), h('td.p', row.pct)));
  }
  const tiny = [c.g.mainYeast, c.g.prefYeast].some((v) => v > 0 && v < 1);
  return h('div.ing',
    h('table.ing-table',
      h('caption.sr', t('ingredients')),
      h('thead', h('tr', h('th', { scope: 'col' }, t('col.ing')), h('th.g', { scope: 'col' }, t('col.grams')), h('th.p', { scope: 'col' }, t('col.pct')))),
      tbody),
    h('p.ing-foot', t('perBall', { n: c.pizzas, g: fmtG(Math.round(c.total / c.pizzas), lang()) })),
    tiny ? h('p.tip', t('tip.tiny')) : null);
}

function warningList(r) {
  const ws = warnings(r);
  if (!ws.length) return h('p.ok-line', icon('check'), t('warn.none'));
  return h('ul.warns', ws.map((w) => h('li', t('warn.' + w.key, { lo: fmtPct(w.lo ?? 0, lang()), hi: fmtPct(w.hi ?? 0, lang()) }))));
}

function leavenText(r, c) {
  if (r.leaven === 'none') return t('leaven.none');
  return `${t('leaven.' + r.leaven)}, ${fmtPct(c.pct.yeast, lang())}`;
}

// Formulario de la fórmula: lo usan la calculadora y el configurador.
function paramsForm(rec, onChange, idp = 'p') {
  const wrap = h('div.params');
  const fire = () => onChange(rec);
  const build = () => {
    const yeastTypes = Object.keys(YEAST_FACTOR);
    const hasYeast = rec.leaven !== 'none';
    const canPref = yeastTypes.includes(rec.leaven);
    const leavenSel = h('select', { id: idp + '-leaven', onchange: (e) => {
      const to = e.target.value, from = rec.leaven;
      if (yeastTypes.includes(from) && yeastTypes.includes(to)) {
        rec.yeast = +convertYeast(rec.yeast, from, to).toFixed(2);
        rec.prefYeast = +convertYeast(rec.prefYeast || 0, from, to).toFixed(2);
      } else if (to === 'powder') { rec.yeast = 4; rec.pref = 'none'; }
      else if (to === 'none') { rec.yeast = 0; rec.pref = 'none'; }
      else { rec.yeast = +convertYeast(0.3, 'fresh', to).toFixed(2); }
      rec.leaven = to; build(); fire();
    } }, ['fresh', 'dry', 'instant', 'powder', 'none'].map((k) => h('option', { value: k, selected: rec.leaven === k }, t('leaven.' + k))));
    wrap.replaceChildren(
      h('div.grid2',
        numField({ id: idp + '-pizzas', label: t('f.pizzas'), value: rec.pizzas, min: 1, max: 60, step: 1, onChange: (v) => { rec.pizzas = v; fire(); } }),
        numField({ id: idp + '-ball', label: t('f.ball'), value: rec.ball, min: 60, max: 2000, step: 5, unit: 'g', onChange: (v) => { rec.ball = v; fire(); } })),
      numField({ id: idp + '-hyd', label: t('f.hydration'), value: rec.hydration, min: 40, max: 95, step: 0.5, unit: '%', slider: true, hint: t('h.hydration'), onChange: (v) => { rec.hydration = v; fire(); } }),
      h('div.grid2',
        numField({ id: idp + '-salt', label: t('f.salt'), value: rec.salt, min: 0, max: 5, step: 0.1, unit: '%', onChange: (v) => { rec.salt = v; fire(); } }),
        numField({ id: idp + '-oil', label: t('f.oil'), value: rec.oil || 0, min: 0, max: 15, step: 0.5, unit: '%', onChange: (v) => { rec.oil = v; fire(); } }),
        numField({ id: idp + '-sugar', label: t('f.sugar'), value: rec.sugar || 0, min: 0, max: 6, step: 0.5, unit: '%', onChange: (v) => { rec.sugar = v; fire(); } })),
      h('div.grid2',
        h('div.field', h('label', { for: idp + '-leaven' }, t('f.leaven')), leavenSel),
        hasYeast ? numField({ id: idp + '-yeast', label: canPref && rec.pref !== 'none' ? t('f.yeastMain') : t('f.yeast'), value: rec.yeast, min: 0, max: 8, step: rec.leaven === 'powder' ? 0.5 : 0.05, decimals: 2, unit: '%', onChange: (v) => { rec.yeast = v; fire(); } }) : null),
      hasYeast && rec.leaven !== 'powder' ? h('p.hint', t('h.yeast')) : null,
      canPref ? segmented({ name: idp + '-pref', label: t('f.pref'), value: rec.pref || 'none', options: [['none', t('pref.none')], ['biga', 'Biga'], ['poolish', 'Poolish']], onChange: (v) => {
        rec.pref = v;
        if (v === 'biga') Object.assign(rec, { prefFlour: 40, prefHyd: 45, prefYeast: +convertYeast(1, 'fresh', rec.leaven).toFixed(2) });
        if (v === 'poolish') Object.assign(rec, { prefFlour: 30, prefHyd: 100, prefYeast: +convertYeast(0.2, 'fresh', rec.leaven).toFixed(2) });
        if (v !== 'none') { rec.plan = { ...rec.plan, prefMin: rec.plan?.prefMin || (v === 'biga' ? 960 : 720) }; if (!(rec.yeast > 0)) rec.yeast = 0; }
        build(); fire();
      } }) : null,
      canPref && rec.pref !== 'none' ? h('div.grid2',
        numField({ id: idp + '-pf', label: t('f.prefFlour'), value: rec.prefFlour, min: 5, max: 100, step: 5, unit: '%', onChange: (v) => { rec.prefFlour = v; fire(); } }),
        numField({ id: idp + '-ph', label: t('f.prefHyd'), value: rec.prefHyd, min: 40, max: 125, step: 1, unit: '%', onChange: (v) => { rec.prefHyd = v; fire(); } }),
        numField({ id: idp + '-py', label: t('f.prefYeast'), value: rec.prefYeast, min: 0, max: 3, step: 0.05, decimals: 2, unit: '%', onChange: (v) => { rec.prefYeast = v; fire(); } })) : null);
  };
  build();
  return wrap;
}

function favButton(r) {
  const b = h('button.fav', { type: 'button', 'aria-pressed': String(isFav(r.id)), 'aria-label': t('fav.toggle', { name: loc(r.name, lang()) }) }, icon('leaf'));
  b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const on = toggleFav(r.id);
    b.setAttribute('aria-pressed', String(on));
    toast(on ? t('fav.added') : t('fav.removed'));
  });
  return b;
}

// ---------- recetario ----------
let filter = 'all';
function listView() {
  const list = h('ul.menu');
  const chips = h('div.chips', { role: 'group', 'aria-label': t('filter.label') });
  const draw = () => {
    const recipes = allRecipes().filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'fav') return isFav(r.id);
      if (filter === 'mine') return !r.builtin || r.modified;
      return r.method === filter || (filter === 'biga' && r.pref === 'biga') || (filter === 'poolish' && r.pref === 'poolish');
    });
    list.replaceChildren();
    if (!recipes.length) {
      list.append(h('li.empty', h('p', t(filter === 'fav' ? 'empty.fav' : filter === 'mine' ? 'empty.mine' : 'empty.filter')),
        filter === 'mine' ? h('a.btn.primary', { href: '#/nueva' }, icon('plus'), t('create')) : null));
    }
    for (const r of recipes) {
      const rs = scaled(r), c = compute(rs), steps = buildSteps(rs, lang());
      list.append(h('li.menu-item',
        h('a.menu-link', { href: '#/receta/' + r.id },
          h('span.menu-main',
            h('span.menu-name', loc(r.name, lang())),
            h('span.menu-blurb', loc(r.blurb, lang()) || `${t('style.' + r.style)}, ${t('method.' + r.method).toLowerCase()}`)),
          h('span.menu-figs',
            h('span.fig', h('b', fmtPct(r.hydration, lang())), h('small', t('f.hydration.short'))),
            h('span.fig', h('b', fmtDuration(totalMinutes(steps), lang())), h('small', t('f.total.short'))),
            h('span.fig', h('b', `${c.pizzas} × ${Math.round(c.total / c.pizzas)} g`), h('small', !r.builtin ? t('tag.mine') : r.modified ? t('tag.modified') : t('style.' + r.style))))),
        favButton(r)));
    }
    chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
  };
  for (const f of ['all', 'directa', 'biga', 'poolish', 'fria', 'rapida', 'sin', 'fav', 'mine']) {
    chips.append(h('button.chip', { type: 'button', 'data-f': f, onclick: () => { filter = f; draw(); } }, f === 'fav' ? icon('leaf') : null, t('filter.' + f)));
  }
  draw();
  return { title: t('nav.recipes'), el: h('div.page',
    h('header.page-head',
      h('div', h('h1', t('list.title')), h('p.lead', t('list.lead'))),
      h('a.btn.primary', { href: '#/nueva' }, icon('plus'), t('create'))),
    chips, h('div.slab', list)) };
}

// ---------- ficha de receta ----------
function recipeView(id) {
  const r0 = getRecipe(id);
  if (!r0) return notFound();
  const name = loc(r0.name, lang());
  const body = h('div.recipe-body');
  const draw = () => {
    const r = scaled(r0), c = compute(r), steps = buildSteps(r, lang(), store.get('plan')?.[id]?.ov || {});
    const setScale = (k, v) => { store.patch('scale', id, { pizzas: r.pizzas, ball: r.ball, [k]: v }); drawKeep(); };
    const isScaled = r.pizzas !== r0.pizzas || r.ball !== r0.ball;
    body.replaceChildren(
      h('section.col-ing', { 'aria-labelledby': 'h-ing' },
        h('h2', { id: 'h-ing' }, t('ingredients')),
        h('div.scaler',
          numField({ id: 'sc-pizzas', label: t('f.pizzas'), value: r.pizzas, min: 1, max: 60, step: 1, onChange: (v) => setScale('pizzas', v) }),
          numField({ id: 'sc-ball', label: t('f.ball'), value: r.ball, min: 60, max: 2000, step: 5, unit: 'g', onChange: (v) => setScale('ball', v) })),
        isScaled ? h('button.link', { type: 'button', onclick: () => { store.drop('scale', id); draw(); } }, t('scale.reset', { n: r0.pizzas, g: r0.ball })) : null,
        ingredientTable(r, c),
        loc(r.flour, lang()) ? h('p.note', h('b', t('flour') + ': '), loc(r.flour, lang())) : null),
      h('section.col-steps', { 'aria-labelledby': 'h-steps' },
        h('dl.facts',
          h('div', h('dt', t('f.hydration')), h('dd', fmtPct(r.hydration, lang()))),
          h('div', h('dt', t('f.salt')), h('dd', fmtPct(r.salt, lang()))),
          h('div', h('dt', t('f.leaven')), h('dd', leavenText(r, c))),
          c.hasPref ? h('div', h('dt', t('f.pref')), h('dd', t('pref.detail', { name: t('pref.' + r.pref), pct: fmtPct(r.prefFlour, lang()), hyd: fmtPct(r.prefHyd, lang()) }))) : null,
          h('div', h('dt', t('f.total')), h('dd', fmtDuration(totalMinutes(steps), lang()))),
          h('div', h('dt', t('f.size')), h('dd', loc(r.size, lang()) || '-')),
          h('div.wide', h('dt', t('oven')), h('dd', `${loc(r.bakeTemp, lang())}. ${loc(r.bakeTime, lang())}. ${t('oven.on', { s: loc(r.surface, lang()) })}`))),
        h('h2', { id: 'h-steps' }, t('steps')),
        h('ol.steps', steps.map((s, i) => h('li',
          h('span.step-n', { 'aria-hidden': 'true' }, i + 1),
          h('div', h('h3', loc(s.title, lang()), h('span.dur', fmtDuration(s.minutes, lang()))), h('p', loc(s.text, lang())))))),
        loc(r.notes, lang()) ? h('div.notes', h('h2', t('notes')), h('p', loc(r.notes, lang()))) : null));
  };
  // Redibuja sin perder el foco del campo que se está tocando.
  const drawKeep = () => {
    const act = document.activeElement, fid = act?.id, isBtn = act?.classList?.contains('step'), lbl = act?.getAttribute?.('aria-label');
    draw();
    if (fid) document.getElementById(fid)?.focus({ preventScroll: true });
    else if (isBtn && lbl) body.querySelector(`button.step[aria-label="${CSS.escape(lbl)}"]`)?.focus({ preventScroll: true });
  };
  draw();

  const pdfBtn = h('button.btn', { type: 'button' }, icon('pdf'), t('act.pdf'));
  pdfBtn.addEventListener('click', async () => {
    pdfBtn.disabled = true;
    try {
      const { exportPdf } = await import('./pdf.js');
      const file = await exportPdf(scaled(r0), store.get('plan')?.[id]?.ov || {});
      toast(t('pdf.done', { file }));
    } catch { toast(t('pdf.error')); }
    pdfBtn.disabled = false;
  });
  const del = async () => {
    const restoring = r0.builtin;
    const ok = await confirmDialog({
      title: restoring ? t('restore.title', { name }) : t('delete.title', { name }),
      body: restoring ? t('restore.body') : t('delete.body'),
      ok: restoring ? t('act.restore') : t('act.delete'),
    });
    if (!ok) return;
    deleteRecipe(id);
    toast(restoring ? t('restore.done') : t('delete.done'));
    if (restoring) render(); else go('#/');
  };
  const dup = () => {
    const copy = duplicateRecipe(r0, t('copyOf', { name }));
    toast(t('dup.done'));
    go('#/editar/' + copy.id);
  };
  return { title: name, el: h('article.page.recipe',
    h('a.backlink', { href: '#/' }, icon('back'), t('nav.recipes')),
    h('header.recipe-head',
      h('div.recipe-title',
        h('h1', name),
        h('p.tags', `${t('style.' + r0.style)}, ${t('method.' + r0.method).toLowerCase()}`, !r0.builtin ? h('span.badge', t('tag.mine')) : r0.modified ? h('span.badge', t('tag.modified')) : null),
        loc(r0.blurb, lang()) ? h('p.lead', loc(r0.blurb, lang())) : null),
      favButton(r0)),
    h('div.actions',
      h('a.btn.primary.big', { href: '#/cocinar/' + id }, icon('play'), t('act.cook')),
      h('a.btn', { href: '#/plan/' + id }, icon('clock'), t('act.plan')),
      pdfBtn,
      h('a.btn', { href: '#/calculadora/' + id }, icon('calc'), t('act.calc')),
      h('a.btn', { href: '#/editar/' + id }, icon('edit'), t('act.edit')),
      h('button.btn', { type: 'button', onclick: dup }, icon('copy'), t('act.duplicate')),
      !r0.builtin ? h('button.btn.danger-ghost', { type: 'button', onclick: del }, icon('trash'), t('act.delete'))
        : r0.modified ? h('button.btn', { type: 'button', onclick: del }, icon('restore'), t('act.restore')) : null),
    body) };
}

// ---------- calculadora ----------
function calcView(fromId) {
  let rec;
  const src = fromId && getRecipe(fromId);
  if (src) rec = clone(scaled(src));
  else rec = store.get('calc') ? clone(store.get('calc')) : clone(BUILTIN[0]);
  const result = h('div.result', { 'aria-live': 'polite' });
  const nameInput = h('input', { type: 'text', id: 'calc-name', maxlength: 60, value: src ? t('copyOf', { name: loc(src.name, lang()) }) : t('calc.defaultName') });
  const update = () => {
    const c = compute(rec);
    result.replaceChildren(
      h('h2', t('calc.result')),
      h('p.result-total', h('b', fmtG(c.total, lang())), ' ', t('calc.ofDough')),
      ingredientTable(rec, c),
      h('h3', t('calc.check')), warningList(rec));
    store.set('calc', rec);
  };
  const formHost = h('div');
  const mount = () => formHost.replaceChildren(paramsForm(rec, update, 'c'));
  const select = h('select', { id: 'calc-from', onchange: (e) => {
    const r = getRecipe(e.target.value);
    if (r) { rec = clone(scaled(r)); nameInput.value = t('copyOf', { name: loc(r.name, lang()) }); mount(); update(); }
  } }, h('option', { value: '' }, t('calc.pick')), allRecipes().map((r) => h('option', { value: r.id, selected: r.id === fromId }, loc(r.name, lang()))));
  mount(); update();
  const save = () => {
    const nm = nameInput.value.trim();
    if (!nm) { nameInput.focus(); toast(t('err.name')); return; }
    const saved = saveRecipe({ ...clone(rec), id: '', builtin: false, modified: undefined, name: nm, created: undefined, steps: undefined });
    toast(t('saved', { name: nm }));
    go('#/receta/' + saved.id);
  };
  return { title: t('nav.calc'), el: h('div.page',
    h('header.page-head', h('div', h('h1', t('calc.title')), h('p.lead', t('calc.lead')))),
    h('div.two',
      h('section.panel',
        h('div.field', h('label', { for: 'calc-from' }, t('calc.from')), select),
        formHost),
      h('aside.slab.sticky', result,
        h('div.save-box',
          h('div.field', h('label', { for: 'calc-name' }, t('calc.saveAs')), nameInput),
          h('button.btn.primary', { type: 'button', onclick: save }, t('calc.save')))))) };
}

// ---------- configurador ----------
function editorView(id) {
  const orig = id ? getRecipe(id) : null;
  if (id && !orig) return notFound();
  const d = orig ? clone(orig) : blankRecipe(lang());
  d.plan = { ...d.plan };
  const L = lang();
  const preview = h('div.result', { 'aria-live': 'polite' });
  const stepsHost = h('div');
  const text = (key, label, o = {}) => {
    const idf = 'e-' + key;
    const el = o.area ? h('textarea', { id: idf, rows: o.rows || 3, maxlength: 600 }) : h('input', { type: 'text', id: idf, maxlength: o.max || 120 });
    el.value = loc(d[key], L);
    el.addEventListener('input', () => { d[key] = el.value; if (key === 'name') updatePreview(); });
    return h('div.field' + (o.wide ? '.wide' : ''), h('label', { for: idf }, label), el, o.hint ? h('p.hint', o.hint) : null);
  };
  const sel = (key, label, opts, prefix, after) => {
    const idf = 'e-' + key;
    return h('div.field', h('label', { for: idf }, label),
      h('select', { id: idf, onchange: (e) => { d[key] = e.target.value; after?.(); refresh(); } }, opts.map((o) => h('option', { value: o, selected: d[key] === o }, t(prefix + o)))));
  };
  const planNum = (key, label, o = {}) => {
    const hours = o.hours;
    return numField({ id: 'e-pl-' + key, label, value: hours ? (d.plan[key] || 0) / 60 : d.plan[key] || 0, min: 0, max: o.max ?? 600, step: o.step ?? 5, unit: hours ? 'h' : o.unit ?? 'min',
      onChange: (v) => { d.plan[key] = hours ? v * 60 : v; delete d.plan[key + 'Range']; if (o.rebuild) drawTimes(); refresh(); } });
  };
  const timesHost = h('div.grid2');
  const drawTimes = () => {
    const leavened = d.leaven !== 'none' && d.leaven !== 'powder';
    timesHost.replaceChildren(...(leavened ? [
      d.pref && d.pref !== 'none' ? planNum('prefMin', t('pl.pref'), { hours: true, max: 48, step: 1 }) : null,
      planNum('autolyse', t('pl.autolyse'), { max: 120 }),
      planNum('knead', t('pl.knead'), { max: 40, step: 1 }),
      planNum('folds', t('pl.folds'), { max: 8, step: 1, unit: '', rebuild: true }),
      d.plan.folds > 0 ? planNum('foldEvery', t('pl.foldEvery'), { max: 60 }) : null,
      planNum('bulk', t('pl.bulk'), { max: 720, step: 15 }),
      planNum('cold', t('pl.cold'), { hours: true, max: 120, step: 6, rebuild: true }),
      d.plan.cold > 0 && !isPan(d) ? h('div.field', h('label', { for: 'e-coldStage' }, t('pl.coldStage')),
        h('select', { id: 'e-coldStage', onchange: (e) => { d.plan.coldStage = e.target.value; refresh(); } },
          ['balls', 'bulk'].map((o) => h('option', { value: o, selected: d.plan.coldStage === o }, t('pl.coldStage.' + o))))) : null,
      planNum('proof', isPan(d) ? t('pl.proofPan') : t('pl.proof'), { max: 720, step: 15 }),
    ] : [
      planNum('knead', t('pl.knead'), { max: 40, step: 1 }),
      planNum('rest', t('pl.rest'), { max: 180 }),
    ]).filter(Boolean));
  };
  const updatePreview = () => {
    const c = compute(d), steps = buildSteps(d, L);
    preview.replaceChildren(
      h('h2', loc(d.name, L) || t('untitled')),
      h('p.result-total', h('b', fmtG(c.total, L)), ' ', t('calc.ofDough'), ', ', fmtDuration(totalMinutes(steps), L)),
      ingredientTable(d, c), warningList(d));
  };
  const drawSteps = () => {
    const custom = Array.isArray(d.steps) && d.steps.length;
    if (!custom) {
      const steps = buildSteps(d, L);
      stepsHost.replaceChildren(
        h('p.hint', t('ed.stepsAuto')),
        h('ol.steps.compact', steps.map((s, i) => h('li', h('span.step-n', { 'aria-hidden': 'true' }, i + 1), h('div', h('h3', s.title, h('span.dur', fmtDuration(s.minutes, L))), h('p', s.text))))),
        h('button.btn', { type: 'button', onclick: () => {
          d.steps = buildSteps(d, L, {}, { tokens: true }).map((s, i) => ({ id: 'c' + i + Date.now().toString(36), type: s.type, variant: s.variant, cold: s.cold, title: s.title, text: s.text, minutes: s.minutes, timerMin: s.timerMin, wait: s.wait }));
          drawSteps(); updatePreview();
        } }, icon('edit'), t('ed.customize')));
      return;
    }
    const tokenList = Object.values(TOKENS[L] || TOKENS.es).slice(0, 6).map((k) => `{${k}}`).join(', ');
    const list = h('ol.step-edit');
    d.steps.forEach((s, i) => {
      const idp = 'st' + i;
      const move = (dir) => { const j = i + dir; if (j < 0 || j >= d.steps.length) return; [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]]; drawSteps(); updatePreview(); stepsHost.querySelector(`#st${j}-title`)?.focus(); };
      const ti = h('input', { type: 'text', id: idp + '-title', value: s.title, maxlength: 80, oninput: (e) => { s.title = e.target.value; } });
      const tx = h('textarea', { id: idp + '-text', rows: 4, maxlength: 900, oninput: (e) => { s.text = e.target.value; } });
      tx.value = s.text;
      list.append(h('li',
        h('div.step-edit-head', h('span.step-n', { 'aria-hidden': 'true' }, i + 1),
          h('div.field.grow', h('label', { for: idp + '-title' }, t('ed.stepTitle')), ti),
          h('div.step-tools',
            h('button.iconbtn', { type: 'button', 'aria-label': t('ed.up'), disabled: i === 0, onclick: () => move(-1) }, icon('up')),
            h('button.iconbtn', { type: 'button', 'aria-label': t('ed.down'), disabled: i === d.steps.length - 1, onclick: () => move(1) }, icon('down')),
            h('button.iconbtn', { type: 'button', 'aria-label': t('ed.removeStep'), onclick: () => { d.steps.splice(i, 1); if (!d.steps.length) delete d.steps; drawSteps(); updatePreview(); } }, icon('trash')))),
        h('div.grid2',
          h('div.field', h('label', { for: idp + '-type' }, t('ed.stepType')),
            h('select', { id: idp + '-type', onchange: (e) => { s.type = e.target.value; delete s.variant; } }, STEP_TYPES.map((k) => h('option', { value: k, selected: s.type === k }, t('type.' + k))))),
          numField({ id: idp + '-min', label: t('ed.stepMin'), value: s.minutes, min: 1, max: 7200, step: s.minutes >= 240 ? 30 : 5, unit: 'min', onChange: (v) => { s.minutes = v; if (s.timerMin && !s.rounds) s.timerMin = Math.min(s.timerMin, v); updatePreview(); } })),
        h('div.field', h('label', { for: idp + '-text' }, t('ed.stepText')), tx)));
    });
    stepsHost.replaceChildren(
      h('p.hint', t('ed.tokens', { list: tokenList })),
      list,
      h('div.row-actions',
        h('button.btn', { type: 'button', onclick: () => { d.steps.push({ id: 'c' + Date.now().toString(36), type: 'ferment', title: t('ed.newStep'), text: '', minutes: 30, wait: true }); drawSteps(); updatePreview(); stepsHost.querySelector(`#st${d.steps.length - 1}-title`)?.focus(); } }, icon('plus'), t('ed.addStep')),
        h('button.btn.ghost', { type: 'button', onclick: async () => {
          if (await confirmDialog({ title: t('ed.autoTitle'), body: t('ed.autoBody'), ok: t('ed.autoOk') })) { delete d.steps; drawSteps(); updatePreview(); }
        } }, icon('restore'), t('ed.backAuto'))));
  };
  const refresh = () => { updatePreview(); if (!(Array.isArray(d.steps) && d.steps.length)) drawSteps(); };
  const formula = paramsForm(d, () => { drawTimes(); refresh(); }, 'e');
  drawTimes(); drawSteps(); updatePreview();

  const save = (e) => {
    e.preventDefault();
    const nm = loc(d.name, L).trim();
    if (!nm) { document.getElementById('e-name').focus(); toast(t('err.name')); return; }
    if (typeof d.name === 'string') d.name = nm;
    const saved = saveRecipe({ ...d, builtin: orig ? !!orig.builtin : false });
    toast(t('saved', { name: nm }));
    go('#/receta/' + saved.id);
  };
  const section = (title, ...kids) => h('fieldset.panel', h('legend', title), ...kids);
  return { title: orig ? t('ed.titleEdit') : t('ed.titleNew'), el: h('div.page',
    h('a.backlink', { href: orig ? '#/receta/' + orig.id : '#/' }, icon('back'), orig ? loc(orig.name, L) : t('nav.recipes')),
    h('header.page-head', h('div', h('h1', orig ? t('ed.titleEdit') : t('ed.titleNew')),
      h('p.lead', orig?.builtin ? t('ed.leadBuiltin') : t('ed.lead')))),
    h('form.two.editor', { onsubmit: save, novalidate: true },
      h('div.stack',
        section(t('ed.identity'),
          text('name', t('ed.name'), { max: 60 }),
          text('blurb', t('ed.blurb'), { area: true, rows: 2 }),
          h('div.grid2',
            sel('style', t('ed.style'), STYLES, 'style.'),
            sel('method', t('ed.method'), METHODS, 'method.'),
            sel('shape', t('ed.shape'), SHAPES, 'shape.', drawTimes),
            text('size', t('f.size'), { max: 60 })),
          text('flour', t('flour'), { area: true, rows: 2 })),
        section(t('ed.formula'), formula),
        section(t('ed.times'), timesHost,
          h('div.field', h('label', { for: 'e-waterTemp' }, t('ed.water')),
            h('select', { id: 'e-waterTemp', onchange: (e) => { d.waterTemp = e.target.value; refresh(); } }, ['cool', 'warm'].map((o) => h('option', { value: o, selected: (d.waterTemp || 'cool') === o }, t('water.' + o)))))),
        section(t('oven'),
          text('bakeTemp', t('oven.temp')), text('bakeTime', t('oven.time')), text('surface', t('oven.surface')),
          h('div.grid2',
            numField({ id: 'e-bakeMin', label: t('ed.bakeMin'), value: d.bakeMin || 8, min: 1, max: 90, step: 1, unit: 'min', onChange: (v) => { d.bakeMin = v; refresh(); } }),
            numField({ id: 'e-preheat', label: t('ed.preheat'), value: d.preheat || 30, min: 0, max: 120, step: 5, unit: 'min', onChange: (v) => { d.preheat = v; refresh(); } }))),
        section(t('steps'), stepsHost),
        section(t('notes'), text('notes', t('ed.notes'), { area: true, rows: 3 }))),
      h('aside.slab.sticky', preview,
        h('div.save-box',
          h('button.btn.primary.big', { type: 'submit' }, t('ed.save')),
          h('a.btn.ghost', { href: orig ? '#/receta/' + orig.id : '#/' }, t('cancel')))))) };
}

// ---------- planificador ----------
function planView(idArg) {
  const recipes = allRecipes();
  let id = idArg && getRecipe(idArg) ? idArg : store.get('lastPlan') && getRecipe(store.get('lastPlan')) ? store.get('lastPlan') : recipes[0].id;
  const out = h('div.plan-out', { 'aria-live': 'polite' });
  const pad = (n) => String(n).padStart(2, '0');
  const defaultEat = () => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d.getTime() - Date.now() < 3600e3) d.setDate(d.getDate() + 1); return d; };
  const saved = () => store.get('plan')?.[id] || {};
  let eat = saved().eat && new Date(saved().eat) > new Date(Date.now() - 12 * 3600e3) ? new Date(saved().eat) : defaultEat();
  const dateIn = h('input', { type: 'date', id: 'plan-date' });
  const timeIn = h('input', { type: 'time', id: 'plan-time', step: 300 });
  const syncInputs = () => {
    dateIn.value = `${eat.getFullYear()}-${pad(eat.getMonth() + 1)}-${pad(eat.getDate())}`;
    timeIn.value = `${pad(eat.getHours())}:${pad(eat.getMinutes())}`;
  };
  const persist = (ov) => store.patch('plan', id, { eat: eat.toISOString(), ov: ov ?? saved().ov ?? {} });
  const fromInputs = () => {
    const [y, m, dd] = dateIn.value.split('-').map(Number), [hh, mm] = timeIn.value.split(':').map(Number);
    if (!y || Number.isNaN(hh)) return;
    eat = new Date(y, m - 1, dd, hh, mm); persist(); draw();
  };
  dateIn.addEventListener('change', fromInputs); timeIn.addEventListener('change', fromInputs);
  const draw = () => {
    const r = scaled(getRecipe(id)), L = lang();
    const ov = saved().ov || {};
    const steps = buildSteps(r, L, ov);
    const sch = schedule(steps, eat, r.preheat || 0);
    const now = new Date();
    const late = sch.start < now;
    const total = totalMinutes(steps);
    const items = sch.oven ? [...sch.items, { oven: true, at: sch.oven }] : [...sch.items];
    items.sort((a, b) => (a.at || a.start) - (b.at || b.start) || (a.oven ? -1 : 1));
    const adjust = (s, dir) => {
      const span = s.range[1] - s.range[0];
      const stepM = span >= 1440 ? 360 : span >= 240 ? 30 : span >= 90 ? 15 : 5;
      const v = Math.min(s.range[1], Math.max(s.range[0], s.minutes + dir * stepM));
      persist({ ...ov, [s.id]: v }); draw();
      out.querySelector(`[data-adj="${s.id}${dir}"]`)?.focus();
    };
    const fits = late ? recipes.filter((x) => x.id !== id && totalMinutes(buildSteps(scaled(x), L)) * 60000 <= eat - now).slice(0, 4) : [];
    out.replaceChildren(
      h('div.plan-summary' + (late ? '.late' : ''),
        h('p.plan-start', late ? t('plan.late') : t('plan.startAt')),
        h('p.plan-big', h('span.clock', timeLabel(sch.start, L)), ' ', h('span.day', dayLabel(sch.start, L))),
        h('p.plan-meta', t('plan.total', { d: fmtDuration(total, L) }), Object.keys(ov).length ? h('button.link', { type: 'button', onclick: () => { persist({}); draw(); } }, t('plan.resetTimes')) : null),
        late ? h('div.plan-late',
          h('p', t('plan.lateBody', { d: fmtDuration(Math.max(0, (eat - now) / 60000), L) })),
          fits.length ? h('div', h('p', t('plan.fits')), h('ul.fit-list', fits.map((x) => h('li', h('a', { href: '#/plan/' + x.id }, loc(x.name, L)), ' ', h('span.dur', fmtDuration(totalMinutes(buildSteps(scaled(x), L)), L)))))) : null,
          h('button.btn', { type: 'button', onclick: () => { eat = new Date(Math.ceil((Date.now() + total * 60000) / 300000) * 300000); syncInputs(); persist(); draw(); } }, t('plan.fromNow'))) : null),
      h('ol.timeline', items.map((it) => it.oven
        ? h('li.tl-oven', h('span.tl-time', h('b', timeLabel(it.at, L)), h('small', dayLabel(it.at, L))), h('div.tl-body', h('h3', icon('oven'), t('plan.oven')), h('p', t('plan.ovenBody', { n: r.preheat }))))
        : h('li' + (it.step.wait ? '.tl-wait' : ''),
          h('span.tl-time', h('b', timeLabel(it.start, L)), h('small', dayLabel(it.start, L))),
          h('div.tl-body',
            h('h3', loc(it.step.title, L)),
            h('p.tl-dur', fmtDuration(it.step.minutes, L),
              it.step.range ? h('span.tl-adj',
                h('button.iconbtn', { type: 'button', 'data-adj': it.step.id + '-1', 'aria-label': t('plan.shorter', { s: loc(it.step.title, L) }), disabled: it.step.minutes <= it.step.range[0], onclick: () => adjust(it.step, -1) }, icon('minus')),
                h('button.iconbtn', { type: 'button', 'data-adj': it.step.id + '1', 'aria-label': t('plan.longer', { s: loc(it.step.title, L) }), disabled: it.step.minutes >= it.step.range[1], onclick: () => adjust(it.step, 1) }, icon('plus')),
                h('small', t('plan.range', { a: fmtDuration(it.step.range[0], L), b: fmtDuration(it.step.range[1], L) }))) : null)))),
        h('li.tl-end', h('span.tl-time', h('b', timeLabel(eat, L)), h('small', dayLabel(eat, L))), h('div.tl-body', h('h3', t('plan.table'))))),
      Object.keys(ov).length ? h('p.hint', t('plan.ovHint')) : null,
      h('div.actions',
        h('a.btn.primary', { href: '#/cocinar/' + id }, icon('play'), t('act.cook')),
        h('a.btn', { href: '#/receta/' + id }, t('plan.see'))));
  };
  const select = h('select', { id: 'plan-recipe', onchange: (e) => { id = e.target.value; store.set('lastPlan', id); if (saved().eat) { /* se conserva la hora elegida */ } persist(); draw(); } },
    recipes.map((r) => h('option', { value: r.id, selected: r.id === id }, loc(r.name, lang()))));
  const quick = (label, days, hh) => h('button.chip', { type: 'button', onclick: () => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hh, 0, 0, 0); eat = d; syncInputs(); persist(); draw(); } }, label);
  store.set('lastPlan', id);
  syncInputs(); draw();
  return { title: t('nav.plan'), el: h('div.page',
    h('header.page-head', h('div', h('h1', t('plan.title')), h('p.lead', t('plan.lead')))),
    h('div.two.plan',
      h('section.panel',
        h('div.field', h('label', { for: 'plan-recipe' }, t('plan.recipe')), select),
        h('fieldset.when', h('legend', t('plan.when')),
          h('div.grid2',
            h('div.field', h('label', { for: 'plan-date' }, t('plan.date')), dateIn),
            h('div.field', h('label', { for: 'plan-time' }, t('plan.time')), timeIn)),
          h('div.chips', quick(t('plan.q.tonight'), 0, 21), quick(t('plan.q.lunch'), 1, 14), quick(t('plan.q.dinner'), 1, 21), quick(t('plan.q.sat'), ((6 - new Date().getDay() + 7) % 7) || 7, 21)))),
      h('section.slab', out))) };
}

function notFound() {
  return { title: t('nf.title'), el: h('div.page', h('h1', t('nf.title')), h('p.lead', t('nf.body')), h('a.btn.primary', { href: '#/' }, t('nav.recipes'))) };
}

// ---------- router ----------
function render() {
  if (destroy) { try { destroy(); } catch { /* nada que limpiar */ } destroy = null; }
  const [, route = '', arg] = (location.hash || '#/').split('/');
  const param = arg ? decodeURIComponent(arg) : null;
  const routes = { '': listView, receta: recipeView, calculadora: calcView, editar: editorView, nueva: () => editorView(null), plan: planView, cocinar: cookView };
  const res = (routes[route] || notFound)(param);
  document.body.classList.toggle('cooking', route === 'cocinar' && !!res.cook);
  view.replaceChildren(res.el);
  destroy = res.destroy || null;
  res.mounted?.();
  document.title = `${res.title} | Impasto`;
  document.querySelectorAll('.nav a').forEach((a) => {
    const key = a.dataset.route;
    const on = key === route || (key === '' && ['receta', 'editar', 'nueva'].includes(route));
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function initLang() {
  document.querySelectorAll('[data-lang]').forEach((b) => {
    b.addEventListener('click', () => { setLang(b.dataset.lang); applyStatic(); render(); });
  });
  applyStatic();
}

window.addEventListener('hashchange', render);
initLang();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW la app funciona igual, pero no sin conexión */ }); });
}
store.onChange(() => { if (store.saveFailed) toast(t('err.save')); });
