// Temporizadores por paso (sobreviven a recargas porque guardan la hora de fin),
// aviso sonoro sintetizado con Web Audio y bloqueo de pantalla con la Screen Wake Lock API.
import { store } from './store.js';

// ---------- sonido ----------
let ctx = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

// Campana de horno: tres golpes, cada uno con dos parciales y caída exponencial.
export function ring(times = 3) {
  const ac = unlockAudio();
  if (!ac) return false;
  const t0 = ac.currentTime + 0.03;
  for (let i = 0; i < times; i++) {
    const at = t0 + i * 0.55;
    [[880, 0.5], [1318.5, 0.28], [2637, 0.1]].forEach(([freq, gain]) => {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain * 0.5, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
      osc.connect(g).connect(ac.destination);
      osc.start(at); osc.stop(at + 1.15);
    });
  }
  return true;
}

// ---------- pantalla encendida ----------
let lock = null, wantLock = false;
const lockListeners = new Set();
export const wakeSupported = () => 'wakeLock' in navigator;
export const wakeActive = () => !!lock;
export function onWakeChange(fn) { lockListeners.add(fn); return () => lockListeners.delete(fn); }
const emitLock = () => lockListeners.forEach((fn) => fn(!!lock));

async function acquire() {
  if (!wakeSupported() || lock || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; emitLock(); });
  } catch { lock = null; /* batería baja, permiso denegado o pestaña oculta */ }
  emitLock();
}
export async function keepAwake(on) {
  wantLock = on;
  if (on) await acquire();
  else if (lock) { try { await lock.release(); } catch { /* ya liberado */ } lock = null; emitLock(); }
}
// El navegador suelta el bloqueo al ocultar la pestaña: se vuelve a pedir al regresar.
document.addEventListener('visibilitychange', () => { if (wantLock && document.visibilityState === 'visible') acquire(); });

// ---------- temporizadores ----------
// timers[key] = { total (s), end (ms, si corre), left (s, si está en pausa), running, done }
const subs = new Set();
let tick = 0;
const all = () => store.get('timers') || {};
const save = (key, v) => (v ? store.patch('timers', key, v) : store.drop('timers', key));

export function getTimer(key) {
  const tm = all()[key];
  if (!tm) return null;
  const left = tm.running ? Math.max(0, (tm.end - Date.now()) / 1000) : tm.left;
  return { ...tm, left };
}
export function startTimer(key, seconds, label) {
  const cur = getTimer(key);
  const left = cur && !cur.done && cur.left > 0 ? cur.left : seconds;
  save(key, { total: cur?.total || seconds, end: Date.now() + left * 1000, left, running: true, done: false, label, round: (cur?.round || 0) + (cur && !cur.done && cur.left > 0 ? 0 : 1) });
  unlockAudio();
  ensureTick();
}
export function pauseTimer(key) {
  const cur = getTimer(key);
  if (cur?.running) save(key, { ...cur, running: false, left: cur.left });
}
export function resetTimer(key) { save(key, null); notify(); }
export function addTime(key, seconds) {
  const cur = getTimer(key);
  if (!cur) return;
  if (cur.running) save(key, { ...cur, end: cur.end + seconds * 1000, total: cur.total + seconds });
  else save(key, { ...cur, left: cur.left + seconds, total: cur.total + seconds, done: false });
  notify();
}
export function onTimers(fn) { subs.add(fn); ensureTick(); return () => subs.delete(fn); }
const notify = (finished) => subs.forEach((fn) => fn(finished));

function ensureTick() {
  if (tick) return;
  tick = setInterval(() => {
    const timers = all();
    let running = false;
    const finished = [];
    for (const [key, tm] of Object.entries(timers)) {
      if (!tm.running) continue;
      if (tm.end <= Date.now()) {
        save(key, { ...tm, running: false, left: 0, done: true });
        finished.push({ key, label: tm.label });
      } else running = true;
    }
    if (finished.length) {
      if (store.get('sound')) ring();
      try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 120, 200, 120, 400]); } catch { /* sin vibración */ }
      // PUNTO DE INTEGRACIÓN (futuro): aviso con la app cerrada.
      // Un temporizador de 48 h solo suena si la app está abierta. Para avisar con la app
      // cerrada haría falta un servidor de notificaciones push (Push API + VAPID): aquí se
      // registraría la hora de fin en ese servidor y el service worker mostraría el aviso.
    }
    notify(finished);
    if (!running && !subs.size) { clearInterval(tick); tick = 0; }
  }, 250);
}
if (Object.values(all()).some((tm) => tm.running)) ensureTick();

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), s2 = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(s2)}` : `${p(mm)}:${p(s2)}`;
}
