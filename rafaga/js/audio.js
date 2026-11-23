// Caramboleta — sonido sintetizado con Web Audio (no hay archivos de audio).
// Estructura adaptada de bloques/js/audio.js; los timbres son propios: gominola blanda, caramelo duro, azúcar.
// Dos buses independientes: efectos y música (cajita de música generativa), cada uno con su silencio.
// La música arranca DESACTIVADA (lo decide store.js).

let ctx = null, busFx = null, busMus = null, ruido = null;
let fxOn = true, musOn = false, suspendido = false;
let relojMusica = 0, sigNota = 0, pasoMus = 0, raiz = 0;

const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];   // pentatónica mayor, tres octavas
const semi = (n) => Math.pow(2, n / 12);

export function iniciarAudio() {
  if (ctx) { if (ctx.state === 'suspended' && !suspendido) ctx.resume().catch(() => {}); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -16; master.ratio.value = 5;
    master.connect(ctx.destination);
    busFx = ctx.createGain(); busFx.gain.value = fxOn ? 0.85 : 0; busFx.connect(master);
    busMus = ctx.createGain(); busMus.gain.value = musOn ? 0.45 : 0; busMus.connect(master);
    const n = Math.floor(ctx.sampleRate * 0.5);
    ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; return false; }
  return true;
}

export function ponerEfectos(on) { fxOn = on; if (busFx) busFx.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.02); }
export function ponerMusica(on) { musOn = on; if (busMus) busMus.gain.setTargetAtTime(on ? 0.45 : 0, ctx.currentTime, 0.1); }
export function pausarAudio(si) {
  suspendido = si;
  if (!ctx) return;
  try { if (si) ctx.suspend(); else ctx.resume(); } catch (e) { /* sin audio */ }
}

function tono(f, dur, o = {}) {
  if (!ctx || (!fxOn && !o.mus)) return;
  const t0 = ctx.currentTime + (o.en || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.tipo || 'sine';
  osc.frequency.setValueAtTime(f, t0);
  if (o.a) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.a), t0 + (o.aDur || dur));
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

// Con cientos de bolas sonarían decenas de notas por fotograma: cada efecto tiene un intervalo mínimo.
const ultimo = {};
function pasa(nombre, ms) { const t = performance.now(); if (t - (ultimo[nombre] || 0) < ms) return false; ultimo[nombre] = t; return true; }
const notaCadena = (c) => 330 * semi(ESCALA[Math.min(ESCALA.length - 1, Math.floor(c / 3))]);

export const sfx = {
  // gominola golpeada: «boing» corto; la nota sube por la escala con la cadena de golpes de la tirada
  golpe(cadena) {
    if (!pasa('golpe', 34)) return;
    const f = notaCadena(cadena);
    tono(f * 1.25, 0.12, { tipo: 'sine', vol: 0.16, a: f, aDur: 0.08 });
    tono(f * 2.5, 0.05, { tipo: 'triangle', vol: 0.035 });
  },
  romper(cadena) {
    if (!pasa('romper', 45)) return;
    const f = notaCadena(cadena) * 1.5;
    tono(f, 0.2, { tipo: 'triangle', vol: 0.15, a: f * 1.9, aDur: 0.12 });
    soplo(0.11, 7000, 2500, 0.06, 'highpass');          // azúcar que cruje
    tono(f * 0.5, 0.16, { vol: 0.08, a: f * 0.3 });
  },
  duro() { if (!pasa('duro', 70)) return; tono(1568, 0.06, { tipo: 'triangle', vol: 0.06 }); tono(2350, 0.04, { vol: 0.03 }); },
  blindado() { if (!pasa('blindado', 70)) return; tono(180, 0.08, { tipo: 'square', vol: 0.04, a: 140 }); },
  pared() { if (!pasa('pared', 70)) return; tono(560, 0.03, { vol: 0.03 }); },
  lanzar() { if (!pasa('lanzar', 40)) return; tono(700, 0.05, { vol: 0.05, a: 980 }); },
  suelo() { if (!pasa('suelo', 60)) return; tono(240, 0.05, { vol: 0.04, a: 190 }); },
  explosion() { if (!pasa('explosion', 90)) return; soplo(0.35, 2400, 90, 0.4); tono(150, 0.3, { vol: 0.24, a: 45 }); },
  rayo() { if (!pasa('rayo', 80)) return; tono(1900, 0.12, { tipo: 'sawtooth', vol: 0.035, a: 600 }); soplo(0.1, 9000, 4000, 0.04, 'highpass'); },
  regenera() { if (!pasa('regenera', 200)) return; [0, 4, 7].forEach((s, i) => tono(523 * semi(s), 0.12, { vol: 0.04, en: i * 0.04 })); },
  brote() { if (!pasa('brote', 200)) return; tono(300, 0.2, { tipo: 'triangle', vol: 0.08, a: 620 }); },
  mueve() { if (!pasa('mueve', 200)) return; tono(392, 0.1, { vol: 0.05, a: 440 }); },
  mejora(k) {
    const base = { extra: 0, bomba: -5, divide: 4, rayoH: 7, rayoV: 9, perfora: 2, rebote: 5, congela: 12 }[k] ?? 0;
    const tipo = { bomba: 'square', rayoH: 'sawtooth', rayoV: 'sawtooth', congela: 'sine' }[k] || 'triangle';
    [0, 4, 7, 12].forEach((s, i) => tono(523 * semi(base + s), 0.13, { tipo, vol: tipo === 'triangle' || tipo === 'sine' ? 0.12 : 0.04, en: i * 0.05 }));
    if (k === 'congela') tono(2093, 0.4, { vol: 0.04, en: 0.2 });
  },
  recoger() { [7, 4, 0].forEach((s, i) => tono(660 * semi(s), 0.08, { vol: 0.07, en: i * 0.04 })); },
  acelerar(n) { tono(440 * (n > 2 ? 1.5 : 1.2), 0.08, { vol: 0.06, a: 880 }); },
  desciende() { tono(196, 0.25, { tipo: 'triangle', vol: 0.08, a: 147 }); },
  congelado() { tono(1760, 0.3, { vol: 0.05 }); tono(2637, 0.3, { vol: 0.03, en: 0.06 }); },
  peligro() { if (!pasa('peligro', 1500)) return; tono(330, 0.18, { tipo: 'triangle', vol: 0.07 }); tono(311, 0.18, { tipo: 'triangle', vol: 0.07, en: 0.2 }); },
  ganar() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tono(392 * semi(s), 0.32, { tipo: 'triangle', vol: 0.15, en: i * 0.08 })); tono(1568, 1.0, { vol: 0.06, en: 0.6 }); },
  perder() { [7, 4, 0].forEach((s, i) => tono(261.6 * semi(s), 0.38, { tipo: 'sine', vol: 0.13, en: i * 0.2 })); },
  estrella(i) { const s = [0, 4, 7][i] || 0; tono(880 * semi(s), 0.3, { tipo: 'triangle', vol: 0.14 }); tono(1760 * semi(s), 0.2, { vol: 0.05 }); },
  boton() { tono(660, 0.05, { vol: 0.06, a: 760 }); },
  logro() { [0, 7, 12].forEach((s, i) => tono(587 * semi(s), 0.28, { tipo: 'triangle', vol: 0.11, en: i * 0.1 })); },
};

// ---------- música (cajita de música) ----------
// Notas cortas y suaves sobre la pentatónica; cada tramo cambia de tonalidad. Apagada por defecto.
export function musica(activa, tramo = 0) {
  clearInterval(relojMusica); relojMusica = 0;
  if (!activa || !ctx) return;
  raiz = [0, 2, -3, 5, -1, 3, -5, 1, 4, 0][tramo % 10];
  sigNota = ctx.currentTime + 0.2;
  relojMusica = setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !musOn) return;
    while (sigNota < ctx.currentTime + 0.6) {
      const en = sigNota - ctx.currentTime;
      const g = ESCALA[(pasoMus * 2 + (pasoMus % 3 === 0 ? 3 : 0) + Math.floor(Math.random() * 2)) % 10];
      const f = 523 * semi(raiz + g);
      if (Math.random() < 0.75) tono(f, 0.7, { mus: true, vol: 0.04, ataque: 0.005, en });
      if (pasoMus % 4 === 0) tono(131 * semi(raiz + (pasoMus % 8 === 0 ? 0 : 7)), 1.6, { mus: true, vol: 0.05, ataque: 0.05, en, tipo: 'triangle' });
      sigNota += 0.36; pasoMus++;
    }
  }, 200);
}

// ---------- vibración ----------
export function puedeVibrar() { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
export function vibrar(patron, permitido) {
  if (!permitido || !puedeVibrar()) return;
  try { navigator.vibrate(patron); } catch (e) { /* no disponible */ }
}
