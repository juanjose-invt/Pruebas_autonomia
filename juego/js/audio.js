// Sonido sintetizado con Web Audio: madera, cristal y rodadura. Sin archivos.
let ctx = null, master = null, rollGain = null, rollFilter = null, noiseBuf = null;
let muted = false;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = b * 0.96 + w * 0.04; d[i] = b * 6 + w * 0.15; } // ruido grave
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    rollFilter = ctx.createBiquadFilter(); rollFilter.type = 'bandpass'; rollFilter.frequency.value = 300; rollFilter.Q.value = 0.7;
    rollGain = ctx.createGain(); rollGain.gain.value = 0;
    src.connect(rollFilter); rollFilter.connect(rollGain); rollGain.connect(master);
    src.start();
  } catch (e) { ctx = null; return false; }
  return true;
}

export const audio = {
  /** Llamar desde un gesto del usuario. */
  unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02); },
  get muted() { return muted; },

  roll(speed) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, v = Math.min(1, speed / 11);
    rollGain.gain.setTargetAtTime(v * v * 0.5, t, 0.04);
    rollFilter.frequency.setTargetAtTime(220 + v * 520, t, 0.05);
  },
  knock(speed, pitch = 1) { // madera
    if (!ctx || muted) return;
    const t = ctx.currentTime, g = Math.min(1, speed / 11);
    tone('sine', 190 * pitch, 95 * pitch, 0.09, 0.5 * g + 0.05, t);
    tone('triangle', 560 * pitch, 380 * pitch, 0.04, 0.22 * g, t);
    burst(1500 * pitch, 0.03, 0.3 * g, t);
  },
  clink(speed) { // cristal contra cristal
    if (!ctx || muted) return;
    const t = ctx.currentTime, g = Math.min(1, speed / 9) * 0.22 + 0.03;
    [2650, 4170, 6230].forEach((f, i) => tone('sine', f, f * 0.995, 0.16 - i * 0.03, g / (i + 1), t));
    burst(5200, 0.012, g * 0.6, t);
  },
  drop(kind) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    tone('sine', 150, 62, 0.2, 0.55, t + 0.05);
    burst(700, 0.05, 0.25, t + 0.05);
    if (kind === 'cup') { tone('sine', 1318, 1318, 0.5, 0.12, t + 0.12); tone('sine', 1976, 1976, 0.4, 0.07, t + 0.12); }
    else { tone('triangle', 196, 98, 0.45, 0.22, t + 0.16); }
  },
  felt() { if (!ctx || muted) return; burst(380, 0.09, 0.22, ctx.currentTime); },
  flip() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.4); f.frequency.exponentialRampToValueAtTime(250, t + 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.85);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.9);
  },
  win(perfect) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.25;
    const notes = perfect ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99];
    notes.forEach((f, i) => { // lámina de madera: xilófono de juguete
      const at = t + i * 0.11;
      tone('sine', f, f, 0.5, 0.26, at); tone('sine', f * 4, f * 4, 0.08, 0.1, at); burst(f * 2, 0.015, 0.1, at);
    });
  },
  tap() { if (!ctx || muted) return; tone('sine', 320, 210, 0.05, 0.16, ctx.currentTime); burst(1900, 0.012, 0.08, ctx.currentTime); },
};

function tone(type, f0, f1, dur, gain, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function burst(freq, dur, gain, t) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(Math.max(0.0002, gain), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
