// Vitraluz — dibujo en Canvas 2D. "Vidriera de luz": cristales emplomados, bolas de luz y un gran
// rosetón de fondo que se enciende allí donde se rompe un cristal.
// Para que rinda en tablet: los cristales fijos, el fondo y los brillos se pintan una vez en lienzos
// auxiliares y cada fotograma solo se componen; lo único que se dibuja de nuevo es lo que se mueve.

import { W, H, CW, CH, OX, OY } from './levels.js';
import { RADIO, PALA_Y, PALA_ALTO, ESCUDO_Y, esSolido } from './engine.js';
import { ICONOS, COLOR_MEJORA } from './iconos.js';

export const PALETAS = [
  { fondo: '#17113a', luz: '#fff1c9', vidrios: ['#ff8fa3', '#ffc65c', '#fff3b0', '#7ad7f0', '#b69cff'] }, // alba
  { fondo: '#210d1a', luz: '#ffe2b0', vidrios: ['#ff4d4d', '#ff8a3c', '#ffc247', '#ffe9a8', '#d2416a'] }, // brasa
  { fondo: '#0b1f1f', luz: '#f1ffd6', vidrios: ['#3ecf8e', '#a7e36b', '#f2e86d', '#4fb8c9', '#e9f5d0'] }, // claustro
  { fondo: '#081633', luz: '#d9f4ff', vidrios: ['#2f8fff', '#3fd0e0', '#7df0d0', '#a6c8ff', '#6f7ff5'] }, // marea
  { fondo: '#0d1d13', luz: '#f6f0c4', vidrios: ['#2fbf71', '#8fd14f', '#e0b04a', '#d97b45', '#5fd6a8'] }, // bosque
  { fondo: '#18152c', luz: '#f4efff', vidrios: ['#c9b6ff', '#9fd8ff', '#f5c6ec', '#e8e4ff', '#8f9bff'] }, // niebla
  { fondo: '#0e0b28', luz: '#fff7b8', vidrios: ['#6a7dff', '#b05cff', '#ffe45c', '#4cc9f0', '#f15bb5'] }, // tormenta
  { fondo: '#171016', luz: '#ffe9c2', vidrios: ['#d4a24c', '#c2566a', '#7b6be0', '#3fa39a', '#e8d5a3'] }, // cripta
  { fondo: '#071c27', luz: '#eafff6', vidrios: ['#47f5b0', '#4cc9ff', '#b77dff', '#ff7ac8', '#f9f871'] }, // aurora
  { fondo: '#150b2b', luz: '#fff3d1', vidrios: ['#ff4f6d', '#ffb020', '#2fd27a', '#3a8dff', '#b35cff'] }, // rosetón mayor
];

const PLOMO = '#0a0810';

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mezcla(hex, hacia, k) { const a = rgb(hex), b = rgb(hacia); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; }
function alfa(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

// Gran rosetón del fondo. `lleno` pinta los vidrios encendidos; si no, solo se intuye el emplomado.
function pintarRosetonFondo(c, pal, lleno) {
  const cx = W / 2, cy = 350, paso = 92;
  if (lleno) {
    for (let anillo = 9; anillo >= 0; anillo--) {
      const r1 = (anillo + 1) * paso, r0 = anillo * paso;
      const sect = anillo === 0 ? 1 : 6 * Math.min(anillo, 4);
      for (let s = 0; s < sect; s++) {
        const a0 = (s / sect) * Math.PI * 2 + anillo * 0.26, a1 = ((s + 1) / sect) * Math.PI * 2 + anillo * 0.26;
        const col = anillo === 0 ? pal.luz : pal.vidrios[(s + anillo * 2) % 5];
        const g = c.createRadialGradient(cx, cy, r0, cx, cy, r1);
        g.addColorStop(0, mezcla(col, '#ffffff', 0.45)); g.addColorStop(1, mezcla(col, pal.fondo, 0.25));
        c.fillStyle = g;
        c.beginPath(); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath(); c.fill();
      }
    }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 300);
    g.addColorStop(0, alfa(pal.luz, 0.8)); g.addColorStop(1, alfa(pal.luz, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  c.strokeStyle = lleno ? 'rgba(10,8,16,0.85)' : 'rgba(255,255,255,0.05)';
  c.lineWidth = lleno ? 5 : 3;
  for (let anillo = 0; anillo < 10; anillo++) {
    const r1 = (anillo + 1) * paso, r0 = anillo * paso;
    c.beginPath(); c.arc(cx, cy, r1, 0, Math.PI * 2); c.stroke();
    if (anillo === 0) continue;
    const sect = 6 * Math.min(anillo, 4);
    for (let s = 0; s < sect; s++) {
      const a = (s / sect) * Math.PI * 2 + anillo * 0.26;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
  }
}

// Dibuja un cristal en una caja CW×CH con origen en 0,0.
function pintarCristal(c, tipo, color, hp, hpMax, variante, extra) {
  const m = 1.5, w = CW - 2 * m, h = CH - 2 * m;
  c.fillStyle = PLOMO; c.fillRect(0, 0, CW, CH);
  if (tipo === 'u') { // plomo irrompible
    const g = c.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, '#6b6a7c'); g.addColorStop(0.5, '#3d3c4a'); g.addColorStop(1, '#22212b');
    rr(c, m, m, w, h, 2); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1; c.beginPath(); c.moveTo(m + 2, m + 1.5); c.lineTo(CW - m - 2, m + 1.5); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(12, CH - 4); c.lineTo(26, 4); c.moveTo(30, CH - 4); c.lineTo(44, 4); c.stroke();
    c.fillStyle = '#9a99ab';
    for (const [x, y] of [[6, 6], [CW - 6, 6], [6, CH - 6], [CW - 6, CH - 6]]) { c.beginPath(); c.arc(x, y, 1.8, 0, 6.3); c.fill(); }
    return;
  }
  let base = color;
  if (tipo === 'x') base = '#ff5a2a';
  if (tipo === 'k') base = '#ffd257';
  const sellado = tipo === 'l' && extra === 'sellado';
  const g = c.createLinearGradient(0, 0, CW * 0.3, CH);
  g.addColorStop(0, mezcla(base, '#ffffff', 0.5)); g.addColorStop(0.45, base); g.addColorStop(1, mezcla(base, '#000000', sellado ? 0.6 : 0.3));
  rr(c, m, m, w, h, 3); c.fillStyle = g; c.fill();
  c.save(); rr(c, m, m, w, h, 3); c.clip();
  // facetas del vidrio cortado
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.beginPath();
  if (variante === 0) { c.moveTo(0, 0); c.lineTo(CW * 0.55, 0); c.lineTo(CW * 0.25, CH); c.lineTo(0, CH); }
  else if (variante === 1) { c.moveTo(CW * 0.4, 0); c.lineTo(CW, 0); c.lineTo(CW, CH * 0.5); c.lineTo(CW * 0.7, CH); }
  else { c.moveTo(0, CH * 0.45); c.lineTo(CW, 0); c.lineTo(CW, CH * 0.4); c.lineTo(0, CH); }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.5)'; rr(c, 5, 3.6, CW - 22, 2.6, 1.3); c.fill();
  if (sellado) { c.fillStyle = 'rgba(10,8,16,0.45)'; c.fillRect(0, 0, CW, CH); }
  c.restore();
  c.strokeStyle = PLOMO; c.lineCap = 'round';
  if (tipo === 's') { // resistente: doble emplomado
    c.lineWidth = 2.2; rr(c, 5.5, 5.5, CW - 11, CH - 11, 2); c.stroke();
    if (hpMax >= 3) { c.beginPath(); c.moveTo(CW / 2, 5.5); c.lineTo(CW / 2 + 9, CH / 2); c.lineTo(CW / 2, CH - 5.5); c.lineTo(CW / 2 - 9, CH / 2); c.closePath(); c.stroke(); }
    if (hp < hpMax) { // grietas
      c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(9, 6); c.lineTo(20, 14); c.lineTo(15, 20); c.lineTo(26, 25); c.moveTo(20, 14); c.lineTo(31, 11); c.stroke();
      if (hpMax - hp >= 2) { c.beginPath(); c.moveTo(CW - 8, 5); c.lineTo(CW - 19, 13); c.lineTo(CW - 13, 19); c.lineTo(CW - 24, 26); c.moveTo(CW - 19, 13); c.lineTo(CW - 29, 17); c.stroke(); }
    }
  } else if (tipo === 'x') { // explosivo: estrella de ascuas
    c.fillStyle = '#fff2a8'; c.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 4 : 10.5; c.lineTo(CW / 2 + Math.cos(a) * r, CH / 2 + Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(CW / 2, CH / 2, 3.2, 0, 6.3); c.fill();
  } else if (tipo === 'k') { // llave
    c.lineWidth = 2.6; c.strokeStyle = '#3a2606';
    c.beginPath(); c.arc(CW / 2 - 9, CH / 2, 5, 0, 6.3); c.moveTo(CW / 2 - 4, CH / 2); c.lineTo(CW / 2 + 15, CH / 2);
    c.moveTo(CW / 2 + 9, CH / 2); c.lineTo(CW / 2 + 9, CH / 2 + 6); c.moveTo(CW / 2 + 14, CH / 2); c.lineTo(CW / 2 + 14, CH / 2 + 5); c.stroke();
  } else if (sellado) { // celosía de plomo
    c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(m, m); c.lineTo(CW - m, CH - m); c.moveTo(CW - m, m); c.lineTo(m, CH - m); c.moveTo(CW / 2, m); c.lineTo(CW / 2, CH - m); c.stroke();
    c.fillStyle = PLOMO; c.beginPath(); c.arc(CW / 2, CH / 2, 4.5, 0, 6.3); c.fill();
  } else if (tipo === 'g') {
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.setLineDash([4, 4]); rr(c, 4.5, 4.5, CW - 9, CH - 9, 2); c.stroke(); c.setLineDash([]);
  }
  if (extra === 'drop') { // cristal con mejora dentro: destello de cuatro puntas
    c.fillStyle = 'rgba(255,255,255,0.96)'; c.beginPath();
    const x = CW / 2, y = CH / 2;
    c.moveTo(x, y - 10); c.quadraticCurveTo(x + 1.6, y - 1.6, x + 12, y); c.quadraticCurveTo(x + 1.6, y + 1.6, x, y + 10);
    c.quadraticCurveTo(x - 1.6, y + 1.6, x - 12, y); c.quadraticCurveTo(x - 1.6, y - 1.6, x, y - 10); c.fill();
    c.strokeStyle = 'rgba(10,8,16,0.55)'; c.lineWidth = 1; c.stroke();
  }
}

function pintarCapsula(c, k, mala) {
  const col = COLOR_MEJORA[k];
  c.save(); c.translate(24, 24);
  c.beginPath();
  if (mala) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; c.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); } }
  else { c.moveTo(0, -22); c.quadraticCurveTo(4, -4, 22, 0); c.quadraticCurveTo(4, 4, 0, 22); c.quadraticCurveTo(-4, 4, -22, 0); c.quadraticCurveTo(-4, -4, 0, -22); c.moveTo(16, 0); c.arc(0, 0, 16, 0, 6.3); }
  c.closePath();
  if (mala) { c.fillStyle = '#241018'; c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }
  else {
    const g = c.createRadialGradient(-5, -6, 2, 0, 0, 22);
    g.addColorStop(0, mezcla(col, '#ffffff', 0.7)); g.addColorStop(0.6, col); g.addColorStop(1, mezcla(col, '#000000', 0.35));
    c.fillStyle = g; c.fill(); c.strokeStyle = PLOMO; c.lineWidth = 2.5; c.stroke();
  }
  c.translate(-12 * 1.05, -12 * 1.05); c.scale(1.05, 1.05);
  const ic = ICONOS[k];
  c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = c.fillStyle = mala ? col : '#16101f';
  if (ic.f) c.fill(new Path2D(ic.f));
  if (ic.s) c.stroke(new Path2D(ic.s));
  c.restore();
}

function brilloSprite(color, r) {
  const c = lienzo(r * 2, r * 2), x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, alfa(color, 0.9)); g.addColorStop(0.25, alfa(color, 0.42)); g.addColorStop(1, alfa(color, 0));
  x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
  return c;
}

export function crearRender(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let esc = 1, pal = PALETAS[0], reducido = false;
  let atlas = new Map(), capsulas = new Map(), brillos = {};
  let capaFija = null, fijaSucia = true;
  const celdasSucias = [];            // cristales fijos que hay que repintar (solo su celda)
  let tFondo = 0;
  let fondoOsc = null, fondoLuz = null, mascara = null, tmp = null, fondo = null, fondoSucio = true;
  let partida = null, progreso = 0, ambienteGanar = 0;
  const parts = [], anillos = [], textos = [], haces = [];
  let sacudida = 0, pulsoPala = 0, tAnim = 0, filaMax = 14;

  function redimensionar(anchoCss, altoCss, dpr) {
    // nitidez sin disparar el coste: densidad real hasta 2, con tope de ~1,8 millones de píxeles
    let d = Math.min(dpr || 1, 2);
    const tope = 1.8e6;
    if (anchoCss * altoCss * d * d > tope) d = Math.sqrt(tope / (anchoCss * altoCss));
    const pw = Math.max(72, Math.round(anchoCss * d)), ph = Math.round(pw * H / W);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    esc = pw / W;
    reconstruir();
  }

  function reconstruir() {
    atlas = new Map(); capsulas = new Map();
    const eb = Math.min(esc, 1.6);
    brillos = { n: brilloSprite(pal.luz, 34 * eb), bomba: brilloSprite('#ff9a3c', 34 * eb), perfora: brilloSprite('#ffe14a', 34 * eb), lenta: brilloSprite('#a9c4ff', 34 * eb), rapida: brilloSprite('#ff6b5e', 34 * eb), x: brilloSprite('#ffb347', 40 * eb), blanco: brilloSprite('#ffffff', 34 * eb) };
    capaFija = lienzo(W * esc, (H) * esc); fijaSucia = true;
    fondoOsc = lienzo(W * esc, H * esc); fondo = lienzo(W * esc, H * esc);
    const ef = Math.min(esc, 1) * 0.5;                    // el rosetón encendido es luz difusa: basta media resolución
    fondoLuz = lienzo(W * ef, H * ef); tmp = lienzo(W * ef, H * ef);
    const mAnt = mascara; mascara = lienzo(W * 0.25, H * 0.25);
    if (mAnt) mascara.getContext('2d').drawImage(mAnt, 0, 0, mascara.width, mascara.height);
    let c = fondoOsc.getContext('2d'); c.setTransform(esc, 0, 0, esc, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mezcla(pal.fondo, '#ffffff', 0.05)); g.addColorStop(0.6, pal.fondo); g.addColorStop(1, mezcla(pal.fondo, '#000000', 0.45));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    pintarRosetonFondo(c, pal, false);
    c = fondoLuz.getContext('2d'); c.setTransform(ef, 0, 0, ef, 0, 0);
    c.fillStyle = pal.fondo; c.fillRect(0, 0, W, H);
    pintarRosetonFondo(c, pal, true);
    fondoSucio = true; fondoEntero = true; zonas.length = 0;
  }

  function sprite(b, sellado) {
    const variante = (b.c + b.r * 2) % 3;
    const tipo = b.type === 'l' && !sellado ? 'n' : b.type;
    const extra = b.type === 'l' && sellado ? 'sellado' : b.drop ? 'drop' : '';
    const k = tipo + '|' + b.color + '|' + b.hp + '|' + b.hpMax + '|' + variante + '|' + extra;
    let s = atlas.get(k);
    if (!s) {
      s = lienzo(CW * esc, CH * esc);
      const c = s.getContext('2d'); c.setTransform(s.width / CW, 0, 0, s.height / CH, 0, 0);
      pintarCristal(c, tipo, pal.vidrios[b.color % 5], b.hp, b.hpMax, variante, extra);
      atlas.set(k, s);
    }
    return s;
  }
  function spriteCapsula(k, mala) {
    let s = capsulas.get(k);
    if (!s) { s = lienzo(48 * esc, 48 * esc); const c = s.getContext('2d'); c.setTransform(esc, 0, 0, esc, 0, 0); pintarCapsula(c, k, mala); capsulas.set(k, s); }
    return s;
  }

  function nuevaPartida(g, paleta) {
    partida = g; pal = paleta;
    filaMax = g.bloques.reduce((m, b) => Math.max(m, b.r), 0);
    parts.length = anillos.length = textos.length = haces.length = 0;
    sacudida = 0; progreso = 0; ambienteGanar = 0;
    mascara = null;
    reconstruir();
  }

  function repintarFija(g) {
    const c = capaFija.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, capaFija.width, capaFija.height);
    const sellado = g.llaves > 0;
    for (const b of g.bloques) {
      if (!b.vivo || b.mv || b.type === 'g') continue;
      c.drawImage(sprite(b, sellado), Math.round((OX + b.c * CW) * esc), Math.round((OY + b.r * CH) * esc));
    }
    fijaSucia = false; celdasSucias.length = 0;
  }
  // Repinta solo las celdas que han cambiado (rotura o grieta), sin rehacer toda la capa.
  function repintarCeldas(g) {
    const c = capaFija.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    const sellado = g.llaves > 0;
    for (const b of celdasSucias) {
      const x = Math.round((OX + b.c * CW) * esc), y = Math.round((OY + b.r * CH) * esc);
      const s = sprite(b, sellado);
      c.clearRect(x, y, s.width, s.height);
      if (b.vivo) c.drawImage(s, x, y);
    }
    celdasSucias.length = 0;
  }

  // El fondo compuesto (oscuro + rosetón encendido donde hay luz) se guarda en un lienzo. Rehacerlo entero
  // cuesta varios volcados a pantalla completa, así que al romper un cristal solo se recompone su zona.
  const zonas = [];
  let ambActual = 0, fondoEntero = true;
  function componerZona(X0, Y0, X1, Y1) {
    const c = fondo.getContext('2d'), t = tmp.getContext('2d');
    const K = fondo.width / tmp.width, M = mascara.width / tmp.width;
    X0 = Math.max(0, Math.floor(X0)); Y0 = Math.max(0, Math.floor(Y0)); X1 = Math.min(fondo.width, Math.ceil(X1)); Y1 = Math.min(fondo.height, Math.ceil(Y1));
    const w = X1 - X0, h = Y1 - Y0; if (w <= 0 || h <= 0) return;
    const tx = Math.floor(X0 / K), ty = Math.floor(Y0 / K), tw = Math.min(tmp.width, Math.ceil(X1 / K)) - tx, th = Math.min(tmp.height, Math.ceil(Y1 / K)) - ty;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.drawImage(fondoOsc, X0, Y0, w, h, X0, Y0, w, h);
    t.save(); t.beginPath(); t.rect(tx, ty, tw, th); t.clip();
    t.globalCompositeOperation = 'source-over'; t.clearRect(tx, ty, tw, th);
    t.drawImage(mascara, tx * M, ty * M, tw * M, th * M, tx, ty, tw, th);
    t.globalCompositeOperation = 'source-in'; t.drawImage(fondoLuz, tx, ty, tw, th, tx, ty, tw, th);
    t.restore();
    c.save(); c.beginPath(); c.rect(X0, Y0, w, h); c.clip();
    c.drawImage(tmp, tx, ty, tw, th, tx * K, ty * K, tw * K, th * K);
    if (ambActual > 0.01) { c.globalAlpha = ambActual; c.drawImage(fondoLuz, tx, ty, tw, th, tx * K, ty * K, tw * K, th * K); }
    c.restore();
  }
  function recomponerFondo() {
    const amb = Math.min(1, Math.floor(progreso * 5) / 5 * 0.2 + ambienteGanar);   // la luz ambiente sube por escalones
    if (amb !== ambActual) { ambActual = amb; fondoEntero = true; }
    if (fondoEntero) { componerZona(0, 0, fondo.width, fondo.height); fondoEntero = false; }
    else for (const z of zonas) componerZona(z[0] * esc, z[1] * esc, z[2] * esc, z[3] * esc);
    zonas.length = 0;
    fondoSucio = false;
  }

  function luzEn(x, y, fuerza = 0.5) {
    const c = mascara.getContext('2d'), k = mascara.width / W, r = 100 * k;
    const g = c.createRadialGradient(x * k, y * k, 0, x * k, y * k, r);
    g.addColorStop(0, `rgba(255,255,255,${fuerza})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x * k - r, y * k - r, r * 2, r * 2);
    if (zonas.length < 24) zonas.push([x - 104, y - 104, x + 104, y + 104]); else fondoEntero = true;
    fondoSucio = true;
  }

  const MAXP = () => (reducido ? 60 : 260);
  function esquirlas(x, y, color, n, fuerza = 1) {
    if (reducido) n = Math.ceil(n / 3);
    for (let i = 0; i < n && parts.length < MAXP(); i++) {
      const a = Math.random() * 6.283, v = (60 + Math.random() * 220) * fuerza;
      parts.push({ x: x + (Math.random() - 0.5) * CW * 0.7, y: y + (Math.random() - 0.5) * CH * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 14, vida: 0, max: 0.5 + Math.random() * 0.55, tam: 4 + Math.random() * 7, color, tipo: 0 });
    }
  }
  function chispas(x, y, color, n, fuerza = 1) {
    if (reducido) n = Math.ceil(n / 3);
    for (let i = 0; i < n && parts.length < MAXP(); i++) {
      const a = Math.random() * 6.283, v = (80 + Math.random() * 260) * fuerza;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: 0, vr: 0, vida: 0, max: 0.25 + Math.random() * 0.35, tam: 2 + Math.random() * 2.5, color, tipo: 1 });
    }
  }
  function texto(x, y, t, color, tam = 22, dur = 1.1) {
    if (textos.length >= 8) textos.shift();
    textos.push({ x: Math.max(60, Math.min(W - 60, x)), y, t, color, tam, vida: 0, max: dur });
  }
  function sacudir(a) { if (!reducido) sacudida = Math.max(sacudida, a); }

  // Reacción visual a lo que cuenta el motor.
  function evento(ev, g) {
    const col = pal.vidrios[(ev.color || 0) % 5];
    switch (ev.e) {
      case 'romper': {
        const c2 = ev.tipo === 'x' ? '#ff8a3c' : ev.tipo === 'k' ? '#ffd257' : col;
        esquirlas(ev.x, ev.y, c2, parts.length > 140 ? 5 : 11);
        chispas(ev.x, ev.y, '#ffffff', 3, 0.6);
        luzEn(ev.x, ev.y, 0.55);
        if (!reducido && haces.length < 5) haces.push({ x: ev.x, y: ev.y, color: c2, vida: 0, max: 0.55 });
        if (ev.b && !ev.b.mv && ev.b.type !== 'g') celdasSucias.push(ev.b);
        progreso = 1 - g.restantes / g.total;
        if (ev.mult > 1 || ev.pts >= 20) texto(ev.x, ev.y, '+' + ev.pts, ev.mult >= 2 ? pal.luz : '#ffffff', ev.mult >= 3 ? 24 : 18, 0.9);
        sacudir(1.6);
        break;
      }
      case 'grieta': esquirlas(ev.x, ev.y, col, 4, 0.6); if (ev.b && !ev.b.mv && ev.b.type !== 'g') celdasSucias.push(ev.b); sacudir(1.2); break;
      case 'plomo': chispas(ev.x, ev.y, '#b9b8c9', 4, 0.5); break;
      case 'sellado': chispas(ev.x, ev.y, '#8d8c9c', 3, 0.5); break;
      case 'explosion':
        if (anillos.length < 6) anillos.push({ x: ev.x, y: ev.y, r: 10, rMax: 120, vida: 0, max: 0.38, color: '#ffb347' });
        chispas(ev.x, ev.y, '#ffd27a', parts.length > 120 ? 8 : 20, 1.3); luzEn(ev.x, ev.y, 0.5); sacudir(5.5);
        break;
      case 'pala': chispas(ev.x, PALA_Y, pal.luz, 4, 0.5); pulsoPala = 1; break;
      case 'pared': chispas(ev.x, ev.y, pal.luz, 2, 0.35); break;
      case 'escudo': anillos.push({ x: ev.x, y: ESCUDO_Y, r: 6, rMax: 46, vida: 0, max: 0.3, color: COLOR_MEJORA.escudo }); break;
      case 'mejora':
        anillos.push({ x: ev.x, y: PALA_Y, r: 14, rMax: 90, vida: 0, max: 0.45, color: COLOR_MEJORA[ev.k] });
        chispas(ev.x, PALA_Y, COLOR_MEJORA[ev.k], 12, 0.9);
        if (ev.texto) texto(ev.x, PALA_Y - 44, ev.texto, COLOR_MEJORA[ev.k], 24, 1.5);
        break;
      case 'vidaPerdida': sacudir(5); esquirlas(g.pala.x, PALA_Y, pal.luz, 14, 1.1); break;
      case 'abrirSellos':
        fijaSucia = true;
        for (const b of g.bloques) if (b.vivo && b.type === 'l') chispas(b.x + CW / 2, b.y + CH / 2, '#ffd257', 5, 0.7);
        break;
      case 'ganar':
        sacudir(8);
        for (let i = 0; i < 5; i++) esquirlas(W * (0.15 + 0.175 * i), 300 + Math.random() * 200, pal.vidrios[i], 16, 1.5);
        break;
      case 'aviso': texto(ev.x ?? W / 2, ev.y ?? 620, ev.texto, ev.color || pal.luz, ev.tam || 30, ev.dur || 1.6); break;
      default: break;
    }
  }

  function dibujar(g, dt) {
    tAnim += dt;
    if (g.estado === 'ganado' && ambienteGanar < 0.75) { ambienteGanar = Math.min(0.75, ambienteGanar + dt * 0.9); fondoSucio = true; }
    if (fijaSucia) repintarFija(g); else if (celdasSucias.length) repintarCeldas(g);
    tFondo += dt;                                      // el fondo iluminado se recompone como mucho ~12 veces por segundo
    if (fondoSucio && (tFondo > 0.08 || dt === 0)) { tFondo = 0; recomponerFondo(); }

    let sx = 0, sy = 0;
    if (sacudida > 0.05) { sx = (Math.random() - 0.5) * 2 * sacudida * esc; sy = (Math.random() - 0.5) * 2 * sacudida * esc; sacudida *= Math.pow(0.0009, dt); } else sacudida = 0;
    const T = (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) => ctx.setTransform(esc * a, esc * b, esc * c, esc * d, e * esc + sx, f * esc + sy);

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fondo, 0, 0);

    // haces de luz que dejan los cristales rotos
    if (haces.length) {
      T(); ctx.globalCompositeOperation = 'lighter';
      for (let i = haces.length - 1; i >= 0; i--) {
        const h = haces[i]; h.vida += dt;
        if (h.vida >= h.max) { haces.splice(i, 1); continue; }
        const k = 1 - h.vida / h.max;
        const gr = ctx.createLinearGradient(0, h.y, 0, h.y + 420);
        gr.addColorStop(0, alfa(h.color, 0.34 * k)); gr.addColorStop(1, alfa(h.color, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(h.x - CW / 2, h.y); ctx.lineTo(h.x + CW / 2, h.y); ctx.lineTo(h.x + CW * 1.1, h.y + 420); ctx.lineTo(h.x - CW * 1.1, h.y + 420); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // cristales fijos (una sola imagen) y los que cambian
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    { // solo la franja que ocupan los cristales
      const y0 = Math.floor(OY * esc), hh = Math.min(capaFija.height - y0, Math.ceil((filaMax + 1) * CH * esc) + 2);
      ctx.drawImage(capaFija, 0, y0, capaFija.width, hh, Math.round(sx), y0 + Math.round(g.offY * esc + sy), capaFija.width, hh);
    }
    const sellado = g.llaves > 0;
    for (const b of g.bloques) {
      if (!b.vivo) continue;
      const dx = Math.round(b.x * esc + sx), dy = Math.round(b.y * esc + sy);
      if (b.mv) ctx.drawImage(sprite(b, sellado), dx, dy);
      else if (b.type === 'g') {
        const p = (g.t + b.fase) % 4.2;
        let a = p < 2.9 ? 0.92 : 0.16;
        if (p > 2.65 && p < 2.9) a = 0.92 - (p - 2.65) / 0.25 * 0.76; else if (p > 3.95) a = 0.16 + (p - 3.95) / 0.25 * 0.76;
        ctx.globalAlpha = a; ctx.drawImage(sprite(b, sellado), dx, dy); ctx.globalAlpha = 1;
      }
      if (b.type === 'x') {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 + 0.22 * Math.sin(tAnim * 5 + b.c);
        const s = brillos.x; ctx.drawImage(s, dx + CW * esc / 2 - s.width / 2, dy + CH * esc / 2 - s.height / 2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      const dg = g.t - b.golpeT;
      if (dg >= 0 && dg < 0.075) { ctx.globalAlpha = 0.55 * (1 - dg / 0.075); ctx.fillStyle = '#fff'; ctx.fillRect(dx, dy, Math.round(CW * esc), Math.round(CH * esc)); ctx.globalAlpha = 1; }
    }

    T();
    // escudo
    if (g.ef.escudo > 0) {
      const a = g.ef.escudo < 2.5 ? 0.35 + 0.35 * Math.abs(Math.sin(g.ef.escudo * 2.4)) : 0.8;
      ctx.globalAlpha = a; ctx.strokeStyle = COLOR_MEJORA.escudo; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(8, ESCUDO_Y + 3); ctx.lineTo(W - 8, ESCUDO_Y + 3); ctx.stroke();
      ctx.globalAlpha = a * 0.3; ctx.lineWidth = 13; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // cápsulas
    for (const c of g.capsulas) {
      const s = spriteCapsula(c.k, c.k === 'estrecha' || c.k === 'rapida');
      const bal = reducido ? 0 : Math.sin(c.giro * 3.2) * 0.16;
      const co = Math.cos(bal), si = Math.sin(bal);
      ctx.setTransform(co, si, -si, co, c.x * esc + sx, c.y * esc + sy);
      ctx.drawImage(s, -s.width / 2, -s.height / 2);
    }
    T();

    // disparos de láser
    if (g.disparos.length) {
      ctx.strokeStyle = COLOR_MEJORA.laser; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); for (const s of g.disparos) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + 22); } ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // pala
    {
      const p = g.pala, w = p.w, x = p.x - w / 2;
      if (pulsoPala > 0) pulsoPala = Math.max(0, pulsoPala - dt * 6);
      const y = PALA_Y + pulsoPala * 2.5;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 + pulsoPala * 0.3;
      const sb = brillos.n, bw = w * 1.7, bh = 76;      // halo elíptico: el mismo brillo de las bolas, estirado
      ctx.drawImage(sb, p.x - bw / 2, y + 8 - bh / 2, bw, bh);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      rr(ctx, x - 2, y - 2, w + 4, PALA_ALTO + 4, 10); ctx.fillStyle = PLOMO; ctx.fill();
      const gr = ctx.createLinearGradient(0, y, 0, y + PALA_ALTO);
      const cuerpo = g.ef.iman > 0 ? COLOR_MEJORA.iman : g.ef.estrecha > 0 ? '#ff9a8f' : pal.luz;
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, cuerpo); gr.addColorStop(1, mezcla(cuerpo, '#000000', 0.35));
      rr(ctx, x, y, w, PALA_ALTO, 8); ctx.fillStyle = gr; ctx.fill();
      const cab = g.ef.laser > 0 ? COLOR_MEJORA.laser : pal.vidrios[0];
      ctx.fillStyle = cab; rr(ctx, x, y, 15, PALA_ALTO, 8); ctx.fill(); rr(ctx, x + w - 15, y, 15, PALA_ALTO, 8); ctx.fill();
      ctx.fillStyle = PLOMO; ctx.fillRect(x + 15, y, 2, PALA_ALTO); ctx.fillRect(x + w - 17, y, 2, PALA_ALTO);
    }

    // bolas: estela y punto de luz
    {
      const clave = g.ef.bomba > 0 ? 'bomba' : g.ef.perfora > 0 ? 'perfora' : g.ef.rapida > 0 ? 'rapida' : g.ef.lenta > 0 ? 'lenta' : 'n';
      const s = brillos[clave], k = 1 / esc;
      ctx.globalCompositeOperation = 'lighter';
      const largas = g.bolas.length <= 8 && !reducido;
      for (const b of g.bolas) {
        if (!b.tr) b.tr = [];
        if (largas) { b.tr.push(b.x, b.y); if (b.tr.length > 12) b.tr.splice(0, 2); } else b.tr.length = 0;
        for (let i = 0; i < b.tr.length; i += 2) {
          const f = (i + 2) / (b.tr.length + 2);
          ctx.globalAlpha = f * 0.3;
          const sw = s.width * k * (0.35 + f * 0.4);
          ctx.drawImage(s, b.tr[i] - sw / 2, b.tr[i + 1] - sw / 2, sw, sw);
        }
        ctx.globalAlpha = 1;
        const sw = s.width * k;
        ctx.drawImage(s, b.x - sw / 2, b.y - sw / 2, sw, sw);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); for (const b of g.bolas) { ctx.moveTo(b.x + RADIO, b.y); ctx.arc(b.x, b.y, RADIO, 0, 6.3); } ctx.fill();
      if (clave !== 'n') { ctx.strokeStyle = { bomba: '#ff9a3c', perfora: '#ffd43f', rapida: '#ff6b5e', lenta: '#8fa8ff' }[clave]; ctx.lineWidth = 3; ctx.beginPath(); for (const b of g.bolas) { ctx.moveTo(b.x + RADIO - 1.5, b.y); ctx.arc(b.x, b.y, RADIO - 1.5, 0, 6.3); } ctx.stroke(); }
    }

    // anillos
    for (let i = anillos.length - 1; i >= 0; i--) {
      const a = anillos[i]; a.vida += dt;
      if (a.vida >= a.max) { anillos.splice(i, 1); continue; }
      const k = a.vida / a.max, e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = a.color; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r + (a.rMax - a.r) * e, 0, 6.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // esquirlas y chispas
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.vida += dt;
      if (p.vida >= p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.tipo ? 300 : 620) * dt; p.rot += p.vr * dt;
      const k = 1 - p.vida / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      if (p.tipo) { ctx.setTransform(esc, 0, 0, esc, sx, sy); ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam * k + 0.6, p.tam * k + 0.6); }
      else {
        const co = Math.cos(p.rot) * esc, si = Math.sin(p.rot) * esc;
        ctx.setTransform(co, si, -si, co, p.x * esc + sx, p.y * esc + sy);
        ctx.beginPath(); ctx.moveTo(-p.tam, -p.tam * 0.5); ctx.lineTo(p.tam, 0); ctx.lineTo(-p.tam * 0.4, p.tam * 0.8); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; T();

    // textos flotantes
    if (textos.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (let i = textos.length - 1; i >= 0; i--) {
        const t = textos[i]; t.vida += dt;
        if (t.vida >= t.max) { textos.splice(i, 1); continue; }
        const k = t.vida / t.max, entra = Math.min(1, t.vida / 0.12);
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `600 ${Math.round(t.tam * (reducido ? 1 : 0.7 + 0.3 * entra))}px "Fredoka Variable", sans-serif`;
        const y = t.y - (reducido ? 0 : k * 34);
        ctx.strokeStyle = 'rgba(10,8,16,0.85)'; ctx.lineWidth = 5; ctx.strokeText(t.t, t.x, y);
        ctx.fillStyle = t.color; ctx.fillText(t.t, t.x, y);
      }
      ctx.globalAlpha = 1;
    }
  }

  return {
    redimensionar, nuevaPartida, evento, dibujar,
    set reducido(v) { reducido = v; }, get reducido() { return reducido; },
    get escala() { return esc; },
    cuentaParticulas: () => parts.length,
  };
}

// Vidriera decorativa de la portada (se pinta una vez).
export function pintarPortada(canvas, pal, lado) {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(lado * d); canvas.height = Math.round(lado * d);
  const c = canvas.getContext('2d');
  const k = canvas.width / 700;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.translate(350 - W / 2, 0);
  c.beginPath(); c.arc(W / 2, 350, 348, 0, 6.3); c.clip();
  pintarRosetonFondo(c, pal, true);
  c.strokeStyle = '#0a0810'; c.lineWidth = 10; c.beginPath(); c.arc(W / 2, 350, 344, 0, 6.3); c.stroke();
}
