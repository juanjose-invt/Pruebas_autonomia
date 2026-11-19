// Vitraluz — sonido sintetizado con Web Audio (no hay archivos de audio).
// Dos buses independientes: efectos y música generativa, cada uno con su silencio.

let ctx = null, busFx = null, busMus = null, ruido = null;
let fxOn = true, musOn = true, suspendido = false;
let relojMusica = 0, sigNota = 0, pasoMus = 0, raiz = 0;

const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];   // pentatónica mayor, dos octavas
const semi = (n) => Math.pow(2, n / 12);

export function iniciarAudio() {
  if (ctx) { if (ctx.state === 'suspended' && !suspendido) ctx.resume().catch(() => {}); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 6;
    master.connect(ctx.destination);
    busFx = ctx.createGain(); busFx.gain.value = fxOn ? 0.9 : 0; busFx.connect(master);
    busMus = ctx.createGain(); busMus.gain.value = musOn ? 0.5 : 0; busMus.connect(master);
    const n = ctx.sampleRate * 0.6;
    ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; return false; }
  return true;
}

export function ponerEfectos(on) { fxOn = on; if (busFx) busFx.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02); }
export function ponerMusica(on) { musOn = on; if (busMus) busMus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.1); }
export function pausarAudio(si) {
  suspendido = si;
  if (!ctx) return;
  try { if (si) ctx.suspend(); else ctx.resume(); } catch (e) { /* sin audio */ }
}

function tono(f, dur, o = {}) {
  if (!ctx || !fxOn && !o.mus) return;
  const t0 = ctx.currentTime + (o.en || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.tipo || 'sine';
  osc.frequency.setValueAtTime(f, t0);
  if (o.a) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.a), t0 + dur);
  const v = o.vol ?? 0.2, at = o.ataque ?? 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + at);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(o.mus ? busMus : busFx);
  osc.start(t0); osc.stop(t0 + dur + 0.03);
}
function soplo(dur, f0, f1, vol = 0.2, tipo = 'lowpass', en = 0) {
  if (!ctx || !fxOn) return;
  const t0 = ctx.currentTime + en;
  const s = ctx.createBufferSource(); s.buffer = ruido;
  const fl = ctx.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f0, t0);
  fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(busFx);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

// Con muchas bolas a la vez sonarían decenas de notas por fotograma: cada efecto tiene un intervalo mínimo.
const ultimo = {};
function pasa(nombre, ms) { const t = performance.now(); if (t - (ultimo[nombre] || 0) < ms) return false; ultimo[nombre] = t; return true; }
export const sfx = {
  // cristal que se rompe: la nota sube un semitono con cada golpe del combo (hasta 12)
  romper(combo, tipo) {
    if (!pasa('romper', 30)) return;
    const n = Math.min(12, Math.max(0, combo - 1));
    const f = 523.25 * semi(n);
    tono(f, 0.16, { tipo: 'triangle', vol: 0.2 });
    tono(f * 3.01, 0.09, { vol: 0.07 });
    soplo(0.07, 9000, 3000, 0.07, 'highpass');
    if (tipo === 'k') tono(f * 1.5, 0.3, { vol: 0.12, en: 0.05 });
    if (tipo === 'g') tono(f * 2, 0.25, { vol: 0.06, tipo: 'sine' });
  },
  grieta() { if (!pasa('grieta', 40)) return; tono(196, 0.09, { tipo: 'triangle', vol: 0.18, a: 150 }); soplo(0.05, 5000, 1500, 0.06, 'bandpass'); },
  plomo() { if (!pasa('plomo', 60)) return; tono(92, 0.12, { tipo: 'square', vol: 0.08, a: 70 }); tono(1380, 0.05, { vol: 0.03 }); },
  sellado() { if (!pasa('plomo', 60)) return; tono(140, 0.1, { tipo: 'square', vol: 0.06 }); tono(880, 0.08, { vol: 0.04 }); },
  pala() { if (!pasa('pala', 40)) return; tono(246.9, 0.08, { tipo: 'sine', vol: 0.22, a: 330 }); },
  pared() { if (!pasa('pared', 60)) return; tono(349, 0.04, { vol: 0.06 }); },
  lanzar() { tono(330, 0.14, { vol: 0.14, a: 660 }); },
  explosion() { if (!pasa('explosion', 90)) return; soplo(0.42, 1800, 60, 0.5); tono(120, 0.35, { vol: 0.3, a: 38 }); },
  laser() { if (!pasa('laser', 90)) return; tono(1400, 0.07, { tipo: 'sawtooth', vol: 0.045, a: 500 }); },
  escudo() { if (!pasa('escudo', 80)) return; tono(784, 0.18, { tipo: 'triangle', vol: 0.14 }); tono(1175, 0.22, { vol: 0.08 }); },
  capsula() { tono(988, 0.06, { vol: 0.05 }); },
  mejora(k, mala) {
    if (mala) { [0, -3, -7].forEach((s, i) => tono(392 * semi(s), 0.13, { tipo: 'sawtooth', vol: 0.07, en: i * 0.07 })); return; }
    const base = { multi: 0, ancha: 2, bomba: -5, lenta: -3, escudo: 4, laser: 7, perfora: 5, iman: -1, vida: 9 }[k] || 0;
    [0, 4, 7, 12].forEach((s, i) => tono(440 * semi(base + s), 0.14, { tipo: 'triangle', vol: 0.14, en: i * 0.055 }));
    if (k === 'vida') tono(880 * semi(base), 0.5, { vol: 0.08, en: 0.24 });
  },
  finEfecto() { tono(440, 0.08, { vol: 0.05, a: 330 }); },
  abrirSellos() { for (let i = 0; i < 8; i++) tono(660 * semi(ESCALA[i]), 0.2, { vol: 0.07, en: i * 0.04 }); },
  desciende() { tono(110, 0.3, { tipo: 'triangle', vol: 0.1, a: 82 }); },
  vida() { tono(392, 0.5, { tipo: 'triangle', vol: 0.2, a: 98 }); soplo(0.3, 900, 120, 0.12); },
  ganar() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tono(392 * semi(s), 0.34, { tipo: 'triangle', vol: 0.16, en: i * 0.09 })); tono(784, 1.1, { vol: 0.1, en: 0.66 }); },
  perder() { [7, 4, 0].forEach((s, i) => tono(261.6 * semi(s), 0.4, { tipo: 'sine', vol: 0.14, en: i * 0.22 })); },
  estrella(i) { tono(880 * semi([0, 4, 7][i] || 0), 0.3, { tipo: 'triangle', vol: 0.15 }); tono(1760 * semi([0, 4, 7][i] || 0), 0.2, { vol: 0.05 }); },
  boton() { tono(620, 0.05, { vol: 0.07 }); },
  logro() { [0, 7, 12].forEach((s, i) => tono(587 * semi(s), 0.3, { tipo: 'triangle', vol: 0.12, en: i * 0.1 })); },
  comboFin(n) { if (n >= 5) tono(1046, 0.25, { vol: 0.06, a: 1568 }); },
};

// ---------- música generativa ----------
// Notas largas y suaves sobre una escala pentatónica; cada tramo de niveles cambia de tonalidad.
export function musica(activa, tramo = 0) {
  clearInterval(relojMusica); relojMusica = 0;
  if (!activa || !ctx) return;
  raiz = [0, -2, 3, -4, 5, 1, -5, -3, 2, 0][tramo % 10];
  sigNota = ctx.currentTime + 0.2;
  relojMusica = setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !musOn) return;
    while (sigNota < ctx.currentTime + 0.6) {
      const en = sigNota - ctx.currentTime;
      const g = ESCALA[(pasoMus * 3 + (Math.random() < 0.4 ? 2 : 0) + Math.floor(Math.random() * 3)) % ESCALA.length];
      const f = 196 * semi(raiz + g);
      if (Math.random() < 0.8) tono(f, 1.6, { mus: true, vol: 0.05, ataque: 0.25, en });
      if (pasoMus % 4 === 0) tono(98 * semi(raiz + (pasoMus % 8 === 0 ? 0 : 7)), 3.2, { mus: true, vol: 0.06, ataque: 0.6, en, tipo: 'triangle' });
      if (Math.random() < 0.25) tono(f * 2, 0.9, { mus: true, vol: 0.02, ataque: 0.05, en: en + 0.3 });
      sigNota += 0.62; pasoMus++;
    }
  }, 200);
}

// ---------- vibración ----------
export function puedeVibrar() { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
export function vibrar(patron, permitido) {
  if (!permitido || !puedeVibrar()) return;
  try { navigator.vibrate(patron); } catch (e) { /* no disponible */ }
}
