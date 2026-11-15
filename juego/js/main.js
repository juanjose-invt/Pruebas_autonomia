// Ladea — arranque, estado de la partida e interfaz.
import { tilt, isSolved, DONE } from './engine.js';
import { solve } from './solver.js';
import { build } from './generator.js';
import { LEVELS } from './levels.js';
import { createScene } from './scene.js';
import { audio } from './audio.js';
import { STR } from './i18n.js';
import { load, save } from './store.js';

const $ = (id) => document.getElementById(id);
const data = load();
if (!STR[data.lang]) data.lang = 'es';
data.unlocked = Math.max(0, Math.min(LEVELS.length - 1, data.unlocked | 0));
data.current = Math.max(0, Math.min(data.unlocked, data.current | 0));
let saveWarned = false;
const persist = () => { if (!save(data) && !saveWarned) { saveWarned = true; say(t().saveFail, 6000); } };

const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
const t = () => STR[data.lang];

const canvas = $('gl');
let scene;
try {
  scene = createScene(canvas, {
    reducedMotion: () => reducedMQ.matches,
    onImpact(kind, speed) {
      if (kind === 'marble') audio.clink(speed);
      else if (kind === 'rattle') audio.knock(speed * 0.8, 1.5);
      else if (kind === 'land') audio.knock(speed * 0.55, 1.2);
      else audio.knock(speed);
    },
    onDrop(kind) { audio.drop(kind); },
    onFelt() { audio.felt(); },
    onRoll(v) { audio.roll(v); },
    onFlip() { audio.flip(); },
  });
} catch (e) {
  $('caption').textContent = 'Este navegador no puede mostrar el tablero en 3D (WebGL no disponible). / This browser cannot show the 3D board (WebGL unavailable).';
  throw e;
}
document.documentElement.style.setProperty('--wood', `url(${scene.woodURL('light')})`);

// ---------- estado ----------
const G = { idx: 0, L: null, pos: [], history: [], moves: 0, busy: true, failed: null, queued: -1, won: false, touched: false };

async function loadLevel(idx, mode) {
  G.idx = idx; G.L = build(LEVELS[idx]); G.pos = G.L.start.slice();
  G.history = []; G.moves = 0; G.failed = null; G.queued = -1; G.won = false; G.busy = true;
  data.current = idx; persist();
  hidePlaque(); hideArrow();
  renderHud(); showCaption();
  await scene.setLevel(G.L, G.pos, mode);
  G.busy = false;
  if (idx === 0 && !G.touched) showGhost();
  if (G.queued >= 0) { const d = G.queued; G.queued = -1; doTilt(d); }
}

async function doTilt(d) {
  if ($('tray').open) return;
  if (G.busy) { if (!G.won) G.queued = d; return; }
  if (G.won) return;
  hideArrow(); hideGhost(); G.touched = true;
  if (G.failed) { say(G.failed === 'pit' ? t().failPit : t().failWrong); callUndo(); scene.nudge(d, 0.15, 0.1); return; }
  const r = tilt(G.L, G.pos, d, true);
  if (!r.moved) { audio.tap(); scene.nudge(d, 0.3, 0.14); return; }
  G.history.push({ pos: G.pos, moves: G.moves });
  G.pos = r.pos; G.moves++; G.busy = true;
  renderHud();
  await scene.animateMove(d, r.paths);
  G.busy = false;
  if (r.fail) {
    const bad = r.paths.find((p) => p.end === 'pit' || p.end === 'wrong');
    G.failed = bad.end; G.queued = -1;
    say(bad.end === 'pit' ? t().failPit : t().failWrong, 0);
    callUndo(); renderHud();
    return;
  }
  if (isSolved(G.pos)) { win(); return; }
  if (G.queued >= 0) { const q = G.queued; G.queued = -1; doTilt(q); }
}

function win() {
  G.won = true; G.queued = -1;
  const par = LEVELS[G.idx].par, prev = data.best[G.idx];
  const record = prev === undefined || G.moves < prev;
  if (record) data.best[G.idx] = G.moves;
  if (G.idx + 1 < LEVELS.length) data.unlocked = Math.max(data.unlocked, G.idx + 1);
  persist();
  const perfect = G.moves <= par;
  audio.win(perfect);
  renderHud();
  const last = G.idx === LEVELS.length - 1;
  let msg = perfect ? t().winPerfect(G.moves) : t().win(G.moves, par);
  if (record && prev !== undefined) msg += ' ' + t().winRecord;
  if (last) msg += ' ' + t().allDone;
  G.winMsg = { perfect, record: record && prev !== undefined, moves: G.moves };
  setTimeout(() => { if (G.won) showPlaque(msg); }, reducedMQ.matches ? 150 : 650);
}

async function undo() {
  if (G.busy || !G.history.length || G.won) return;
  const h = G.history.pop();
  G.pos = h.pos; G.moves = h.moves; G.failed = null; G.queued = -1;
  audio.tap(); hideArrow(); showCaption(); renderHud();
  G.busy = true; await scene.moveMarblesTo(G.pos); G.busy = false;
}
async function restart() {
  if (G.busy && !G.won) return;
  if (!G.history.length && !G.won) return;
  G.pos = G.L.start.slice(); G.history = []; G.moves = 0; G.failed = null; G.queued = -1; G.won = false;
  audio.tap(); hidePlaque(); hideArrow(); showCaption(); renderHud();
  G.busy = true; await scene.moveMarblesTo(G.pos); G.busy = false;
}
function hint() {
  if (G.busy || G.won) return;
  if (G.failed) { say(G.failed === 'pit' ? t().failPit : t().failWrong, 0); callUndo(); return; }
  const r = solve(G.L, G.pos);
  if (!r) { say(t().stuck, 0); callUndo(); return; }
  const d = r.path[0];
  hideGhost(); showArrow(d); say(t().hintGo[d], 5000);
  scene.nudge(d, 0.38, 0.3);
}

// ---------- interfaz ----------
let sayTimer = 0;
function levelCaption() {
  if (G.idx === 0) return fineMQ.matches ? t().helpMouse : t().helpTouch;
  return t().cap[G.idx] || '';
}
function showCaption() { clearTimeout(sayTimer); $('caption').classList.remove('flash'); $('caption').textContent = levelCaption(); }
function say(msg, ms = 4500) {
  clearTimeout(sayTimer);
  const c = $('caption');
  c.textContent = msg;
  c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
  if (ms) sayTimer = setTimeout(showCaption, ms);
}
function callUndo() {
  const b = $('btnUndo');
  b.classList.remove('call'); void b.offsetWidth; b.classList.add('call');
}
function renderHud() {
  const s = t(), par = LEVELS[G.idx].par, best = data.best[G.idx];
  $('lvlLabel').textContent = s.level; $('lvlNum').textContent = G.idx + 1;
  $('lvlOf').textContent = s.of; $('lvlTotal').textContent = LEVELS.length;
  $('moves').textContent = G.moves; $('movesLabel').textContent = s.moves(G.moves);
  $('parTxt').textContent = `${s.min} ${par}`;
  $('bestTxt').textContent = best === undefined ? s.noBest : `${s.best} ${best}`;
  $('btnUndo').disabled = !G.history.length || G.won;
  $('btnRestart').disabled = !G.history.length && !G.won;
  $('btnHint').disabled = G.won;
}
function applyLang() {
  const s = t();
  document.documentElement.lang = data.lang;
  document.title = s.docTitle;
  $('langGroup').setAttribute('aria-label', s.lang);
  $('langGroup').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === data.lang)));
  $('btnUndo').querySelector('.lbl').textContent = s.undo;
  $('btnRestart').querySelector('.lbl').textContent = s.restart;
  $('btnHint').querySelector('.lbl').textContent = s.hint;
  $('btnLevels').querySelector('.lbl').textContent = s.levels;
  $('btnClose').setAttribute('aria-label', s.close);
  $('trayTitle').textContent = s.levelsTitle; $('legend').textContent = s.legend;
  $('btnReplay').textContent = s.replay;
  canvas.setAttribute('aria-label', s.board);
  applySound();
  renderHud();
  if (G.L) {
    if (G.failed) say(G.failed === 'pit' ? s.failPit : s.failWrong, 0); else showCaption();
    if (!$('plaque').hidden && G.winMsg) {
      const par = LEVELS[G.idx].par, m = G.winMsg;
      showPlaque((m.perfect ? s.winPerfect(m.moves) : s.win(m.moves, par)) + (m.record ? ' ' + s.winRecord : '') + (G.idx === LEVELS.length - 1 ? ' ' + s.allDone : ''));
    }
  }
  if ($('tray').open) renderTray();
}
function applySound() {
  const b = $('btnSound');
  b.setAttribute('aria-pressed', String(data.muted));
  b.setAttribute('aria-label', data.muted ? t().soundOff : t().soundOn);
  audio.setMuted(data.muted);
}

function showPlaque(msg) {
  const last = G.idx === LEVELS.length - 1;
  $('winText').textContent = msg;
  $('btnNext').textContent = last ? t().backToFirst : t().next;
  const was = $('plaque').hidden;
  $('plaque').hidden = false;
  if (was) $('btnNext').focus({ preventScroll: true });
}
function hidePlaque() { $('plaque').hidden = true; }

function stageRect() { const r = $('stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function showArrow(d) {
  const a = $('arrow'), r = stageRect(), reach = Math.min(r.w, r.h) * 0.5 - 30;
  const v = [[1, 0], [0, 1], [-1, 0], [0, -1]][d];
  a.style.setProperty('--ax', v[0] * reach); a.style.setProperty('--ay', v[1] * reach); a.style.setProperty('--rot', d);
  a.hidden = false;
}
function hideArrow() { $('arrow').hidden = true; }
function showGhost() {
  const r = solve(G.L, G.pos);
  if (!r) return;
  const v = [[1, 0], [0, 1], [-1, 0], [0, -1]][r.path[0]];
  const g = $('ghost');
  g.style.setProperty('--gx', v[0]); g.style.setProperty('--gy', v[1]);
  g.hidden = false;
}
function hideGhost() { $('ghost').hidden = true; }

function renderTray() {
  const s = t(), ol = $('pegs');
  ol.textContent = '';
  LEVELS.forEach((lv, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    const best = data.best[i], open = i <= data.unlocked;
    b.type = 'button'; b.className = 'peg';
    if (best !== undefined) b.classList.add(best <= lv.par ? 'gold' : 'clear');
    if (i === G.idx) { b.classList.add('now'); b.setAttribute('aria-current', 'true'); }
    b.disabled = !open;
    b.setAttribute('aria-label', !open ? s.lvlLocked(i + 1) : best !== undefined ? s.lvlDone(i + 1, best) : s.lvlOpen(i + 1));
    const hole = document.createElement('span'); hole.className = 'hole';
    if (best !== undefined) { const gl = document.createElement('span'); gl.className = 'glass'; hole.appendChild(gl); }
    const num = document.createElement('span'); num.textContent = i + 1;
    b.append(hole, num);
    b.addEventListener('click', () => { $('tray').close(); audio.tap(); if (i !== G.idx || G.won || G.history.length) loadLevel(i, i === G.idx ? 'drop' : 'flip'); });
    li.appendChild(b); ol.appendChild(li);
  });
}
function openTray() {
  renderTray();
  $('tray').showModal();
  const cur = $('pegs').querySelector('.now');
  if (cur) cur.focus({ preventScroll: false });
}

// ---------- entradas ----------
let drag = null;
const TH = 26;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura no pasa nada */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || drag.fired) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= TH) {
    drag.fired = true; scene.setPreview(0, 0);
    doTilt(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
  } else if (!G.busy && !G.won && !reducedMQ.matches) {
    scene.setPreview(dx / (TH * 1.6), dy / (TH * 1.6));
  }
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) { drag = null; scene.setPreview(0, 0); } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3 };
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  audio.unlock();
  if ($('tray').open) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in KEYS) { e.preventDefault(); if (!e.repeat) doTilt(KEYS[k]); }
  else if (k === 'z' || k === 'u' || k === 'Backspace') { e.preventDefault(); undo(); }
  else if (k === 'r') restart();
  else if (k === 'h') hint();
  else if (k === 'm') toggleSound();
  else if (k === 'l') openTray();
});

function toggleSound() { data.muted = !data.muted; persist(); applySound(); if (!data.muted) { audio.unlock(); audio.tap(); } }
$('btnUndo').addEventListener('click', undo);
$('btnRestart').addEventListener('click', restart);
$('btnHint').addEventListener('click', hint);
$('btnLevels').addEventListener('click', () => { audio.tap(); openTray(); });
$('btnClose').addEventListener('click', () => $('tray').close());
$('tray').addEventListener('click', (e) => { if (e.target === $('tray')) $('tray').close(); }); // toque fuera de la bandeja
$('btnSound').addEventListener('click', toggleSound);
$('btnReplay').addEventListener('click', restart);
$('btnNext').addEventListener('click', () => { audio.tap(); loadLevel(G.idx === LEVELS.length - 1 ? 0 : G.idx + 1, 'flip'); });
$('langGroup').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-lang]');
  if (!b || b.dataset.lang === data.lang) return;
  data.lang = b.dataset.lang; persist(); applyLang();
});
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.roll(0); });

const fit = () => { scene.resize(); scene.setStage(stageRect()); };
new ResizeObserver(fit).observe($('stage'));
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

applyLang();
fit();
loadLevel(data.current, 'drop');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// Asa mínima para pruebas automáticas (solo lectura).
window.__ladea = { get state() { return { idx: G.idx, pos: G.pos.slice(), moves: G.moves, busy: G.busy, won: G.won, failed: G.failed }; }, perf: () => scene.perf() };
