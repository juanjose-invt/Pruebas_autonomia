// Modo paso a paso: escena 3D del gesto, texto del paso, temporizador y pantalla encendida.
import { t, getLang, timeLabel, dayLabel } from './i18n.js';
import { h, put, icon, toast } from './ui.js';
import { store, getRecipe, scaled } from './store.js';
import { buildSteps, loc } from './steps.js';
import { fmtDuration } from './calc.js';
import { diagram } from './diagrams.js';
import * as T from './timer.js';

// La escena 3D (three.js) solo se descarga al entrar aquí y si el navegador tiene WebGL.
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export function cookView(id) {
  const r0 = getRecipe(id);
  if (!r0) return { title: t('nf.title'), el: h('div.page', h('h1', t('nf.title')), h('a.btn.primary', { href: '#/' }, t('nav.recipes'))) };
  const L = getLang();
  const r = scaled(r0);
  const steps = buildSteps(r, L, store.get('plan')?.[id]?.ov || {});
  let index = Math.min(steps.length - 1, Math.max(0, store.get('progress')?.[id] || 0));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let use3d = webglAvailable() && !store.get('no3d');
  let scene = null, sceneLoading = null, disposed = false;

  const stage = h('div.stage');
  const canvas = h('canvas.stage-canvas', { role: 'img' });
  const svgBox = h('div.stage-svg', { role: 'img' });
  const tag = h('span.stage-tag');
  const playBtn = h('button.iconbtn.on-stage', { type: 'button' }, icon('pause'));
  const scrub = h('input.scrub', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': t('cook.scrub') });
  const modeBtn = h('button.chip.on-stage', { type: 'button' });
  const stageBar = h('div.stage-bar', playBtn, scrub, modeBtn);
  const caption = h('p.stage-caption');
  stage.append(canvas, svgBox, tag, stageBar);

  const stepNo = h('p.cook-count');
  const title = h('h1.cook-title', { tabindex: '-1' });
  const meta = h('p.cook-meta');
  const text = h('p.cook-text');
  const timerBox = h('div.timer');
  const others = h('div.others');
  const dots = h('ol.dots', { 'aria-label': t('cook.steps') });
  const prevBtn = h('button.btn.big', { type: 'button' }, icon('back'), t('cook.prev'));
  const nextBtn = h('button.btn.primary.big', { type: 'button' });
  const soundBtn = h('button.iconbtn', { type: 'button' });
  const wakeChip = h('span.wake');

  const key = (i) => `${id}|${steps[i].id}`;
  const setPlayIcon = () => {
    const on = scene?.playing;
    put(playBtn, icon(on ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', on ? t('cook.pause3d') : t('cook.play3d'));
  };

  async function ensureScene() {
    if (scene || !use3d) return scene;
    if (!sceneLoading) {
      sceneLoading = import('./scene3d.js').then((m) => {
        if (disposed) return null;
        try {
          scene = m.createScene(canvas, { onProgress: (p) => { if (document.activeElement !== scrub) scrub.value = Math.round(p * 1000); } });
        } catch { use3d = false; scene = null; }
        return scene;
      }).catch(() => { use3d = false; return null; });
    }
    return sceneLoading;
  }

  async function showStage() {
    const s = steps[index];
    const desc = t('scene.' + s.type + (s.variant && t.has('scene.' + s.type + '.' + s.variant) ? '.' + s.variant : ''));
    caption.textContent = desc;
    const lapse = s.type === 'ferment' || s.type === 'autolyse' || s.type === 'bake';
    tag.textContent = lapse ? (s.cold ? t('cook.lapseCold') : t('cook.lapse')) : '';
    tag.hidden = !lapse;
    modeBtn.textContent = use3d ? t('cook.toDiagram') : t('cook.to3d');
    modeBtn.hidden = !webglAvailable();
    if (use3d) await ensureScene();
    if (disposed) return;
    stage.classList.toggle('is-3d', !!(use3d && scene));
    if (use3d && scene) {
      canvas.setAttribute('aria-label', desc);
      scene.setStep(s);
      if (reduced) { scene.pause(); scene.setProgress(0.62); scrub.value = 620; } else scene.play();
      playBtn.hidden = false; scrub.hidden = false;
    } else {
      scene?.pause();
      svgBox.innerHTML = diagram(s.type);
      svgBox.setAttribute('aria-label', desc);
      playBtn.hidden = true; scrub.hidden = true;
    }
    setPlayIcon();
  }

  function drawTimer() {
    const s = steps[index], k = key(index);
    const total = (s.timerMin ?? s.minutes) * 60;
    const tm = T.getTimer(k);
    const left = tm ? tm.left : total;
    const running = !!tm?.running, done = !!tm?.done;
    const endAt = running ? new Date(tm.end) : null;
    const big = h('p.timer-time', { role: 'timer', 'aria-live': 'off' }, T.fmtClock(left));
    const status = done ? t('timer.done')
      : running ? t('timer.endsAt', { time: timeLabel(endAt, L), day: dayLabel(endAt, L) })
        : s.rounds ? t('timer.rounds', { n: s.rounds, m: s.timerMin }) : s.wait ? t('timer.ready') : t('timer.optional');
    const round = s.rounds && tm?.round ? h('span.round', t('timer.round', { k: Math.min(tm.round, s.rounds), n: s.rounds })) : null;
    const add = total >= 3600 ? 15 : total >= 600 ? 5 : 1;
    timerBox.className = 'timer' + (running ? ' running' : '') + (done ? ' done' : '');
    put(timerBox, 
      h('div.timer-main', big, h('p.timer-status', { 'aria-live': 'polite' }, status, round)),
      h('div.timer-actions',
        running
          ? h('button.btn', { type: 'button', onclick: () => { T.pauseTimer(k); drawTimer(); } }, icon('pause'), t('timer.pause'))
          : h('button.btn.go', { type: 'button', onclick: () => { if (done) T.resetTimer(k); T.startTimer(k, total, `${index + 1}. ${loc(s.title, L)}`); drawTimer(); } }, icon('play'), done ? t('timer.again') : tm ? t('timer.resume') : t('timer.start')),
        h('button.btn', { type: 'button', disabled: !tm, onclick: () => { T.addTime(k, add * 60); drawTimer(); } }, icon('plus'), t('timer.add', { n: add })),
        h('button.btn.ghost', { type: 'button', disabled: !tm, onclick: () => { T.resetTimer(k); drawTimer(); } }, icon('reset'), t('timer.reset'))),
      total >= 3600 ? h('p.hint', t('timer.longHint')) : null);
    // Otros temporizadores de esta receta que siguen en marcha.
    const run = steps.map((st, i) => ({ st, i, tm: T.getTimer(key(i)) })).filter((x) => x.i !== index && x.tm && (x.tm.running || x.tm.done));
    put(others, ...run.map((x) => h('button.other', { type: 'button', onclick: () => goTo(x.i) },
      icon(x.tm.done ? 'bell' : 'clock'), h('span', `${x.i + 1}. ${loc(x.st.title, L)}`), h('b', x.tm.done ? t('timer.doneShort') : T.fmtClock(x.tm.left)))));
  }

  function tickTimer(finished) {
    if (finished?.length) {
      for (const f of finished) if (f.key.startsWith(id + '|')) toast(t('timer.toast', { s: f.label || '' }));
      drawTimer(); return;
    }
    const tm = T.getTimer(key(index));
    const el = timerBox.querySelector('.timer-time');
    if (tm?.running && el) el.textContent = T.fmtClock(tm.left);
    others.querySelectorAll('.other').forEach((b, i) => {
      const list = steps.map((st, j) => ({ j, tm: T.getTimer(key(j)) })).filter((x) => x.j !== index && x.tm && (x.tm.running || x.tm.done));
      if (list[i]?.tm.running) b.querySelector('b').textContent = T.fmtClock(list[i].tm.left);
    });
  }

  function drawStep(focus) {
    const s = steps[index];
    stepNo.textContent = t('cook.count', { i: index + 1, n: steps.length });
    title.textContent = loc(s.title, L);
    put(meta, icon('clock'), fmtDuration(s.minutes, L));
    text.textContent = loc(s.text, L);
    prevBtn.disabled = index === 0;
    put(nextBtn, index === steps.length - 1 ? t('cook.finish') : t('cook.next'), icon(index === steps.length - 1 ? 'check' : 'next'));
    put(dots, ...steps.map((st, i) => h('li', h('button', {
      type: 'button', 'aria-label': `${i + 1}. ${loc(st.title, L)}`, 'aria-current': i === index ? 'step' : null,
      class: i < index ? 'past' : '', onclick: () => goTo(i),
    }, i + 1))));
    drawTimer();
    showStage();
    store.patch('progress', id, index);
    if (focus) title.focus({ preventScroll: true });
  }
  function goTo(i) { index = Math.min(steps.length - 1, Math.max(0, i)); drawStep(true); }

  prevBtn.addEventListener('click', () => goTo(index - 1));
  nextBtn.addEventListener('click', () => {
    if (index < steps.length - 1) return goTo(index + 1);
    store.drop('progress', id);
    toast(t('cook.done'));
    location.hash = '#/receta/' + id;
  });
  playBtn.addEventListener('click', () => { if (!scene) return; if (scene.playing) scene.pause(); else scene.play(); setPlayIcon(); });
  scrub.addEventListener('input', () => { if (!scene) return; scene.pause(); scene.setProgress(scrub.value / 1000); setPlayIcon(); });
  modeBtn.addEventListener('click', () => { use3d = !use3d; store.set('no3d', !use3d); showStage(); });
  const drawSound = () => {
    const on = !!store.get('sound');
    put(soundBtn, icon(on ? 'bell' : 'bellOff'));
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? t('cook.soundOn') : t('cook.soundOff'));
  };
  soundBtn.addEventListener('click', () => { store.set('sound', !store.get('sound')); drawSound(); if (store.get('sound')) T.ring(1); toast(store.get('sound') ? t('cook.soundOn') : t('cook.soundOff')); });
  const drawWake = (on) => {
    put(wakeChip, icon('screen'), on ? t('cook.awake') : T.wakeSupported() ? t('cook.awakeOff') : t('cook.awakeNo'));
    wakeChip.classList.toggle('on', !!on);
  };

  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft' && index > 0) prevBtn.click();
  };
  const onVis = () => { if (!scene) return; if (document.hidden) scene.pause(); else if (!reduced && use3d) scene.play(); setPlayIcon(); };
  const ro = new ResizeObserver(() => scene?.resize());
  const offTimers = T.onTimers(tickTimer);
  const offWake = T.onWakeChange(drawWake);

  const el = h('div.cook',
    h('header.cook-top',
      h('a.iconbtn', { href: '#/receta/' + id, 'aria-label': t('cook.exit') }, icon('close')),
      h('div.cook-where', h('p.cook-recipe', loc(r.name, L)), stepNo),
      wakeChip, soundBtn),
    dots,
    h('div.cook-body',
      h('div.cook-stage', stage, caption),
      h('div.cook-panel', title, meta, text, timerBox, others)),
    h('footer.cook-nav', prevBtn, nextBtn));

  return {
    title: t('cook.title', { name: loc(r.name, L) }), el, cook: true,
    mounted() {
      drawSound(); drawWake(T.wakeActive());
      ro.observe(stage);
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVis);
      T.keepAwake(true);
      drawStep(false);
    },
    destroy() {
      disposed = true;
      offTimers(); offWake(); ro.disconnect();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      T.keepAwake(false);
      scene?.dispose(); scene = null;
    },
  };
}
