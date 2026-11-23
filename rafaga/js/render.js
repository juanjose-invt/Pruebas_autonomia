// Caramboleta — dibujo en canvas 2D. Mundo «gominolas»: luminoso, pastel, translúcido.
// Las gominolas se pintan una vez por tono y forma en lienzos pequeños (sprites) y luego solo se copian,
// con su temblor aplicado como transformación: así aguantan cientos de bolas por fotograma.

import { COLS, CELL, W, SUELO, FILA_LIMITE, HUECO, R_BOLA } from './levels.js';
import { R_ITEM } from './engine.js';
import { pathsIconos, COLOR_MEJORA } from './iconos.js';

const FUENTE = '"Baloo 2 Variable", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const TINTA = '#3d1638';

// Fondo pastel distinto en cada tramo (claro arriba, un punto más vivo abajo) y su acento.
export const PALETAS = [
  { fondo: '#ffe3ec', claro: '#fff6f9', acento: '#ff4f7b', canica: '#ffd0de' },   // fresa y nata
  { fondo: '#fff1c4', claro: '#fffbea', acento: '#e0a400', canica: '#fff0a8' },   // limonada
  { fondo: '#efe3f1', claro: '#fbf6fc', acento: '#b01f5a', canica: '#f3c9dc' },   // regaliz
  { fondo: '#ffe4d2', claro: '#fff6ef', acento: '#f06a1f', canica: '#ffd5b8' },   // chispas
  { fondo: '#e2edff', claro: '#f6f9ff', acento: '#5868d8', canica: '#d6dcff' },   // azúcar cande
  { fondo: '#ffdfe6', claro: '#fff4f6', acento: '#d02c58', canica: '#ffc6d3' },   // mermelada
  { fondo: '#d9f4e8', claro: '#f2fcf7', acento: '#14a37b', canica: '#c6f0dd' },   // tiovivo
  { fondo: '#f4e6da', claro: '#fcf7f2', acento: '#9a5a33', canica: '#efd6c2' },   // bombonería
  { fondo: '#e6f5d3', claro: '#f7fcf0', acento: '#5a9e2a', canica: '#d9f0bd' },   // huerto dulce
  { fondo: '#f9e1f6', claro: '#fef5fd', acento: '#a43fd6', canica: '#efcdf8' },   // gran confitería
];

// Tonos de gominola según los golpes que quedan: limón → naranja → fresa → frambuesa → mora → uva.
export const RAMPA = ['#ffe15a', '#ffc845', '#ffad45', '#ff9150', '#ff7562', '#ff5c79', '#f2468e', '#da40a6', '#c445bd', '#ad41c4', '#9439bd', '#7d32aa'];

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mezcla(a, b, t) { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
const aclarar = (c, t) => mezcla(c, '#ffffff', t);
const oscurecer = (c, t) => mezcla(c, '#2a0b24', t);

function camino(c, b) {
  // forma de la gominola en coordenadas locales (0..s), esquinas redondeadas
  const s = CELL - HUECO;
  c.beginPath();
  if (b.forma === 'tri') {
    const P = [[[0, 0], [0, s], [s, s]], [[0, s], [s, s], [s, 0]], [[s, s], [s, 0], [0, 0]], [[s, 0], [0, 0], [0, s]]][b.o];
    const rr = 9;
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const ini = m(P[2], P[0]);
    c.moveTo(ini[0], ini[1]);
    for (let i = 0; i < 3; i++) { const p = P[i], q = P[(i + 1) % 3]; c.arcTo(p[0], p[1], q[0], q[1], rr); }
    c.closePath();
  } else {
    const r = b.tipo === 'irrompible' ? 9 : 20;
    c.roundRect(0, 0, s, s, r);
  }
}

function crearSprite(b, color, k, blanco) {
  const s = CELL - HUECO, pad = 4;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((s + pad * 2) * k); cv.height = cv.width;
  const c = cv.getContext('2d');
  c.setTransform(k, 0, 0, k, pad * k, pad * k);
  camino(c, b);
  if (blanco) { c.fillStyle = '#fff'; c.fill(); return cv; }
  if (b.tipo === 'irrompible') {
    const g = c.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#fbf9ff'); g.addColorStop(0.5, '#ddd5fa'); g.addColorStop(1, '#bfb2ee');
    c.fillStyle = g; c.fill();
    c.save(); camino(c, b); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(s * 0.5, s * 0.5); c.lineTo(0, 0); c.moveTo(s * 0.5, s * 0.5); c.lineTo(s, s * 0.15); c.moveTo(s * 0.5, s * 0.5); c.lineTo(s * 0.8, s); c.moveTo(s * 0.5, s * 0.5); c.lineTo(0, s * 0.7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.moveTo(s * 0.5, s * 0.5); c.lineTo(0, 0); c.lineTo(s, s * 0.15); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = '#8d7bd6'; c.lineWidth = 3; camino(c, b); c.stroke();
    return cv;
  }
  // cuerpo translúcido
  const g = c.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, aclarar(color, 0.42)); g.addColorStop(0.45, color); g.addColorStop(1, oscurecer(color, 0.14));
  c.globalAlpha = 0.9; c.fillStyle = g; c.fill(); c.globalAlpha = 1;
  c.save(); camino(c, b); c.clip();
  // luz interior que atraviesa la gominola
  const rg = c.createRadialGradient(s * 0.55, s * 0.62, 2, s * 0.55, s * 0.62, s * 0.6);
  rg.addColorStop(0, 'rgba(255,255,255,0.34)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(0, 0, s, s);
  if (b.tipo === 'duro') {          // regaliz: espiral de franjas oscuras
    c.strokeStyle = oscurecer(color, 0.55); c.globalAlpha = 0.42; c.lineWidth = 9;
    for (let x = -s; x < s * 2; x += 24) { c.beginPath(); c.moveTo(x, s + 4); c.lineTo(x + s, -4); c.stroke(); }
    c.globalAlpha = 1;
  }
  if (b.tipo === 'explosivo') {     // chispas: estrellitas de pica-pica y un aro de azúcar dorado
    c.strokeStyle = '#ffe14d'; c.lineWidth = 4; c.setLineDash([7, 6]);
    c.beginPath(); c.roundRect(7, 7, s - 14, s - 14, 14); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#fff6b8';
    for (const [x, y, r] of [[20, 24, 9], [70, 20, 7], [24, 70, 7], [72, 70, 9]]) {
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill();
    }
  }
  if (b.tipo === 'cascara') {       // bombón: cáscara de chocolate en un lado
    const ch = c.createLinearGradient(0, 0, s, s); ch.addColorStop(0, '#8a5233'); ch.addColorStop(1, '#5c311c');
    c.fillStyle = ch;
    const t = 17;
    if (b.lado === 0) c.fillRect(-2, -2, s + 4, t); else if (b.lado === 2) c.fillRect(-2, s - t, s + 4, t + 2);
    else if (b.lado === 1) c.fillRect(s - t, -2, t + 2, s + 4); else c.fillRect(-2, -2, t, s + 4);
    c.strokeStyle = 'rgba(255,230,200,0.55)'; c.lineWidth = 2; c.beginPath();
    if (b.lado === 0) { c.moveTo(10, t - 4); c.lineTo(s - 10, t - 4); } else if (b.lado === 2) { c.moveTo(10, s - t + 4); c.lineTo(s - 10, s - t + 4); }
    else if (b.lado === 1) { c.moveTo(s - t + 4, 10); c.lineTo(s - t + 4, s - 10); } else { c.moveTo(t - 4, 10); c.lineTo(t - 4, s - 10); }
    c.stroke();
  }
  // brillo húmedo arriba a la izquierda
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath(); c.ellipse(s * 0.3, s * 0.2, s * 0.2, s * 0.085, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(s * 0.15, s * 0.36, 3, 0, Math.PI * 2); c.fill();
  // granitos de azúcar
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y] of [[0.72, 0.2], [0.82, 0.48], [0.28, 0.8], [0.6, 0.86], [0.9, 0.82]]) c.fillRect(x * s, y * s, 2.6, 2.6);
  c.restore();
  // borde
  c.strokeStyle = oscurecer(color, b.tipo === 'duro' ? 0.6 : 0.3); c.globalAlpha = b.tipo === 'duro' ? 0.85 : 0.6; c.lineWidth = b.tipo === 'duro' ? 4.5 : 3;
  camino(c, b); c.stroke(); c.globalAlpha = 1;
  if (b.tipo === 'brote') {         // hojita encima
    c.fillStyle = '#4f9a23';
    c.beginPath(); c.ellipse(s * 0.5 - 9, 12, 11, 5.5, -0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(s * 0.5 + 9, 12, 11, 5.5, 0.6, 0, Math.PI * 2); c.fill();
  }
  if (b.tipo === 'regen') {         // gota de mermelada
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.moveTo(16, 8); c.quadraticCurveTo(24, 20, 16, 24); c.quadraticCurveTo(8, 20, 16, 8); c.fill();
  }
  return cv;
}

function crearCanica(k, tinte, tipo) {
  const r = R_BOLA, pad = 3;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((r + pad) * 2 * k); cv.height = cv.width;
  const c = cv.getContext('2d');
  c.setTransform(k, 0, 0, k, (r + pad) * k, (r + pad) * k);
  const base = tipo === 'bomba' ? '#e0324a' : tipo === 'aguja' ? '#18a3a8' : tipo === 'temp' ? '#f3e6ff' : '#ffffff';
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, base); g.addColorStop(1, tipo ? oscurecer(base, 0.25) : tinte);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  // remolino de color dentro de la canica
  c.strokeStyle = tipo ? 'rgba(255,255,255,0.6)' : oscurecer(tinte, 0.2); c.globalAlpha = 0.65; c.lineWidth = 2.2;
  c.beginPath(); c.arc(0, 0, r * 0.55, 0.4, 2.6); c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = 'rgba(61,22,56,0.8)'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 0, r - 0.6, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.38, -r * 0.42, r * 0.22, 0, Math.PI * 2); c.fill();
  return cv;
}

export function crearRender(cv) {
  const c = cv.getContext('2d');
  let k = 1, dpr = 1, pal = PALETAS[0], fondo = null, T = 0, sacudida = 0, flash = 0, flashColor = '#fff';
  let sprites = new Map(), canicas = {}, hpRef = 1;
  const parts = [], flotantes = [], rayos = [], anillos = [], vueltas = [];
  const R = { reducido: false };
  const iconos = pathsIconos();

  function redimensionar(cssW, cssH, d) {
    dpr = Math.min(2, d || 1);
    cv.width = Math.max(10, Math.round(cssW * dpr)); cv.height = Math.max(10, Math.round(cssH * dpr));
    k = cv.width / W;
    sprites = new Map(); canicas = {}; fondo = null;
  }

  function hacerFondo() {
    fondo = document.createElement('canvas'); fondo.width = cv.width; fondo.height = cv.height;
    const f = fondo.getContext('2d');
    f.setTransform(k, 0, 0, k, 0, 0);
    const g = f.createLinearGradient(0, 0, 0, SUELO);
    g.addColorStop(0, pal.claro); g.addColorStop(1, pal.fondo);
    f.fillStyle = g; f.fillRect(0, 0, W, SUELO);
    // motas de azúcar glas, siempre en el mismo sitio
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * SUELO, r = 1.5 + rnd() * 3.5;
      f.fillStyle = i % 4 === 0 ? pal.acento : '#ffffff';
      f.globalAlpha = i % 4 === 0 ? 0.1 : 0.7;
      f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
    }
    f.globalAlpha = 1;
    // banda del suelo
    f.fillStyle = 'rgba(61,22,56,0.05)'; f.fillRect(0, FILA_LIMITE * CELL, W, SUELO - FILA_LIMITE * CELL);
  }

  // 1 golpe = limón; cuantos más golpes, más hacia la uva. En niveles con números pequeños la rampa
  // no llega al final, para que un 3 no parezca tan duro como un 300.
  function tono(b) {
    const hp = Math.max(1, b.hp), ref = Math.max(2, hpRef);
    const tope = Math.min(RAMPA.length - 1, Math.round(4 + 1.6 * Math.log2(ref)));
    const t = Math.log(hp) / Math.log(ref);
    return Math.max(0, Math.min(tope, Math.round(t * tope)));
  }
  function sprite(b, ti, blanco) {
    const clave = `${b.forma}${b.o}|${blanco ? 'w' : b.tipo === 'irrompible' ? 'i' : ti}|${b.tipo}|${b.lado ?? ''}`;
    let s = sprites.get(clave);
    if (!s) { s = crearSprite(b, RAMPA[ti] || RAMPA[0], k, blanco); sprites.set(clave, s); }
    return s;
  }
  function canica(tipo) {
    if (!canicas[tipo]) canicas[tipo] = crearCanica(k, pal.canica, tipo);
    return canicas[tipo];
  }

  function nuevaPartida(g, paleta) {
    pal = paleta; fondo = null; sprites = new Map(); canicas = {};
    parts.length = flotantes.length = rayos.length = anillos.length = vueltas.length = 0;
    hpRef = 1;
    for (const b of g.bloques) { if (b.max > hpRef) hpRef = b.max; b.ry = b.r; }
    sacudida = 0; flash = 0;
  }

  // ---------- partículas y efectos ----------
  function chispas(x, y, color, n, fuerza = 1) {
    if (R.reducido) n = Math.ceil(n / 3);
    for (let i = 0; i < n && parts.length < 700; i++) {
      const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 380) * fuerza * (R.reducido ? 0.4 : 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0, vida: 0.5 + Math.random() * 0.45, tam: 4 + Math.random() * 6, color: Math.random() < 0.3 ? '#ffffff' : color, giro: Math.random() * 6 });
    }
  }
  function aviso(texto, y, tam = 34, dur = 1.4, color = TINTA) {
    flotantes.push({ texto, x: W / 2, y, tam, t: 0, dur, color });
    if (flotantes.length > 6) flotantes.shift();
  }

  function evento(ev, g) {
    switch (ev.e) {
      case 'golpe': {
        const b = ev.b;
        if (parts.length < 500) chispas(b.cx, b.cy, RAMPA[tono(b)], 2, 0.5);
        break;
      }
      case 'romper': {
        const b = ev.b, col = b.tipo === 'irrompible' ? '#ddd5fa' : RAMPA[Math.min(RAMPA.length - 1, tono({ hp: b.max }))];
        chispas(b.cx, b.cy, col, 14, 1);
        anillos.push({ x: b.cx, y: b.cy, r0: 20, r1: 80, t: 0, dur: 0.32, color: '#ffffff', ancho: 6 });
        break;
      }
      case 'explosion': {
        const x = (ev.c + 0.5) * CELL, y = (ev.r + 0.5) * CELL;
        anillos.push({ x, y, r0: 30, r1: 170, t: 0, dur: 0.4, color: ev.bomba ? '#ff5468' : '#ffb13d', ancho: 14 });
        chispas(x, y, ev.bomba ? '#ff5468' : '#ffc83d', 18, 1.4);
        if (!R.reducido) { sacudida = Math.max(sacudida, 7); flash = Math.max(flash, 0.22); flashColor = '#fff3d6'; }
        else flash = Math.max(flash, 0.06);
        break;
      }
      case 'mejora': {
        const col = COLOR_MEJORA[ev.k];
        anillos.push({ x: ev.x, y: ev.y, r0: 10, r1: 60, t: 0, dur: 0.35, color: col, ancho: 6 });
        if (ev.k === 'rayoH' && ev.it) rayos.push({ h: true, p: (ev.it.r + 0.5) * CELL, t: 0, color: col });
        if (ev.k === 'rayoV' && ev.it) rayos.push({ h: false, p: (ev.it.c + 0.5) * CELL, t: 0, color: col });
        if (ev.k === 'extra' || ev.k === 'congela') chispas(ev.x, ev.y, col, 8, 0.6);
        if (ev.k === 'congela' && !R.reducido) { flash = Math.max(flash, 0.12); flashColor = '#e3f1ff'; }
        if (rayos.length > 12) rayos.shift();
        break;
      }
      case 'vuelve':
        if (vueltas.length < 160) vueltas.push({ x: ev.x, t: 0 });
        break;
      case 'brote': chispas(ev.b.cx, ev.b.cy, '#6bb33a', 8, 0.5); break;
      case 'regenera': anillos.push({ x: ev.b.cx, y: ev.b.cy, r0: 50, r1: 20, t: 0, dur: 0.4, color: '#ff6f94', ancho: 5 }); break;
      case 'derrite': chispas(ev.b.cx, (FILA_LIMITE - 0.5) * CELL, '#ddd5fa', 10, 0.6); break;
      case 'ganar':
        for (let i = 0; i < (R.reducido ? 2 : 6); i++) chispas(W * (0.15 + i * 0.14), 520, RAMPA[(i * 2) % RAMPA.length], 16, 1.5);
        break;
      case 'aviso': aviso(ev.texto, ev.y, ev.tam, ev.dur, ev.color); break;
      default: break;
    }
  }

  // ---------- dibujo ----------
  function dibujar(g, dt, guia) {
    T += dt;
    if (!fondo) hacerFondo();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(fondo, 0, 0);
    let ox = 0, oy = 0;
    if (sacudida > 0) { sacudida = Math.max(0, sacudida - dt * 40); ox = (Math.random() - 0.5) * sacudida; oy = (Math.random() - 0.5) * sacudida; }
    c.setTransform(k, 0, 0, k, ox * k, oy * k);

    // línea límite (regaliz de cordón); late si hay peligro
    let peligro = false;
    for (const b of g.bloques) if (b.vivo && b.tipo !== 'irrompible' && b.r === FILA_LIMITE - 1) { peligro = true; break; }
    const yl = FILA_LIMITE * CELL;
    c.save();
    c.lineWidth = 5; c.setLineDash([18, 12]); c.lineCap = 'round';
    c.strokeStyle = peligro ? `rgba(214,40,84,${R.reducido ? 0.85 : 0.55 + 0.35 * Math.sin(T * 7)})` : 'rgba(61,22,56,0.28)';
    c.beginPath(); c.moveTo(10, yl); c.lineTo(W - 10, yl); c.stroke();
    c.restore();

    // mejoras (caramelos redondos)
    for (const it of g.items) {
      if (!it.vivo || it.r < 0 || it.r >= FILA_LIMITE) continue;
      if (it.nace > 0) it.nace = Math.max(0, it.nace - dt * 4);
      const x = (it.c + 0.5) * CELL, y = (it.r + 0.5) * CELL;
      const pul = R.reducido ? 1 : 1 + 0.06 * Math.sin(T * 4 + it.c);
      const s = pul * (1 - (it.nace || 0) * 0.8);
      c.save(); c.translate(x, y); c.scale(s, s);
      if (it.usado) c.globalAlpha = 0.55 + 0.25 * Math.sin(T * 10);
      if (it.k === 'extra') {
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, R_ITEM, 0, Math.PI * 2); c.fill();
        c.lineWidth = 5; c.strokeStyle = COLOR_MEJORA.extra; c.stroke();
        c.fillStyle = COLOR_MEJORA.extra; c.font = `800 25px ${FUENTE}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('+1', 0, 2);
      } else {
        c.fillStyle = COLOR_MEJORA[it.k]; c.beginPath(); c.arc(0, 0, R_ITEM, 0, Math.PI * 2); c.fill();
        c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
        if (iconos && iconos[it.k]) {
          c.save(); c.translate(-14, -14); c.scale(28 / 24, 28 / 24);
          c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
          if (iconos[it.k].f) c.fill(iconos[it.k].f);
          if (iconos[it.k].s) c.stroke(iconos[it.k].s);
          c.restore();
        }
      }
      c.restore();
    }

    // gominolas
    const s0 = CELL - HUECO, pad = 4;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const b of g.bloques) {
      if (!b.vivo || b.r < -1 || b.r > FILA_LIMITE) continue;
      if (b.ry === undefined) b.ry = b.r - (b.nace ? 0 : 1);
      if (b.ry !== b.r) { const d = b.r - b.ry; b.ry += Math.sign(d) * Math.min(Math.abs(d), dt * (R.reducido ? 12 : 6)); }
      if (b.rx === undefined) b.rx = b.c;
      if (b.rx !== b.c) { const d = b.c - b.rx; b.rx += Math.sign(d) * Math.min(Math.abs(d), dt * 5); }
      const x = b.rx * CELL + HUECO / 2, y = b.ry * CELL + HUECO / 2;
      if (y + s0 < 0) continue;
      const ti = tono(b);
      const spr = sprite(b, ti, false);
      let sx = 1, sy = 1;
      if (b.w > 0 && !R.reducido) { const o = Math.sin(T * 34) * 0.11 * b.w; sx = 1 + o; sy = 1 - o; }
      const cx = x + s0 / 2, cy = y + s0 / 2;
      c.save();
      c.translate(cx, cy); c.scale(sx, sy);
      c.drawImage(spr, -s0 / 2 - pad, -s0 / 2 - pad, s0 + pad * 2, s0 + pad * 2);
      if (b.f > 0) { c.globalAlpha = Math.min(1, b.f) * (R.reducido ? 0.18 : 0.42); c.drawImage(sprite(b, 0, true), -s0 / 2 - pad, -s0 / 2 - pad, s0 + pad * 2, s0 + pad * 2); c.globalAlpha = 1; }
      c.restore();
      if (b.tipo === 'irrompible') continue;
      // capa de mermelada: nivel de relleno
      if (b.tipo === 'regen' && b.hp < b.max) {
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(x + 8, y + 8, s0 - 16, (s0 - 16) * (1 - b.hp / b.max));
      }
      // número legible: grueso, con contorno
      const txt = String(b.hp);
      const tam = (txt.length <= 2 ? 40 : txt.length === 3 ? 33 : 27) * (b.forma === 'tri' ? 0.78 : 1);
      let tx = cx, ty = cy;
      if (b.forma === 'tri') { tx = b.cx + (b.rx - b.c) * CELL; ty = b.cy + (b.ry - b.r) * CELL; }
      c.font = `800 ${tam}px ${FUENTE}`;
      const claro = ti <= 5;
      c.lineJoin = 'round';
      c.lineWidth = tam * 0.2; c.strokeStyle = claro ? 'rgba(255,255,255,0.9)' : TINTA;
      c.strokeText(txt, tx, ty + tam * 0.07);
      c.fillStyle = claro ? TINTA : '#ffffff';
      c.fillText(txt, tx, ty + tam * 0.07);
      // marcas pequeñas: dirección del tiovivo, mejora dentro, cargas de brote
      if (b.tipo === 'movil') {
        c.fillStyle = claro ? TINTA : '#fff';
        const ax = b.dir > 0 ? x + s0 - 12 : x + 12, ay = y + s0 - 14;
        c.beginPath(); c.moveTo(ax + b.dir * 7, ay); c.lineTo(ax - b.dir * 5, ay - 7); c.lineTo(ax - b.dir * 5, ay + 7); c.closePath(); c.fill();
      }
      if (b.mej) {
        c.fillStyle = COLOR_MEJORA[b.mej]; c.beginPath(); c.arc(x + s0 - 15, y + 15, 10, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        if (iconos && iconos[b.mej]) {
          c.save(); c.translate(x + s0 - 22, y + 8); c.scale(14 / 24, 14 / 24); c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
          if (iconos[b.mej].f) c.fill(iconos[b.mej].f); if (iconos[b.mej].s) c.stroke(iconos[b.mej].s); c.restore();
        }
      }
    }

    // rayos de fila / columna
    for (let i = rayos.length - 1; i >= 0; i--) {
      const r = rayos[i]; r.t += dt;
      const a = 1 - r.t / 0.3; if (a <= 0) { rayos.splice(i, 1); continue; }
      c.globalAlpha = a * (R.reducido ? 0.4 : 0.85); c.fillStyle = r.color;
      if (r.h) c.fillRect(0, r.p - 7, W, 14); else c.fillRect(r.p - 7, 0, 14, FILA_LIMITE * CELL);
      c.fillStyle = '#fff'; if (r.h) c.fillRect(0, r.p - 2, W, 4); else c.fillRect(r.p - 2, 0, 4, FILA_LIMITE * CELL);
      c.globalAlpha = 1;
    }

    // guía de puntería: puntos hasta el primer rebote y canica fantasma en el contacto
    if (guia && g.estado === 'apuntar') {
      const dx = guia.x1 - guia.x0, dy = guia.y1 - guia.y0, L = Math.hypot(dx, dy);
      const paso = 26, desf = R.reducido ? 0 : (T * 60) % paso;
      c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(61,22,56,0.75)'; c.lineWidth = 2;
      for (let d = paso - desf + 14; d < L - 6; d += paso) {
        const px = guia.x0 + dx * d / L, py = guia.y0 + dy * d / L;
        c.beginPath(); c.arc(px, py, 5.2, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.globalAlpha = 0.75; c.lineWidth = 2.5; c.setLineDash([5, 5]);
      c.beginPath(); c.arc(guia.x1, guia.y1, R_BOLA, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }

    // bolas en vuelo
    const cn = canica(''), r2 = (R_BOLA + 3);
    for (const b of g.activas) {
      if (!b.vivo) continue;
      const spr = b.bomba > 0 ? canica('bomba') : b.pierce > 0 ? canica('aguja') : b.temp ? canica('temp') : cn;
      c.drawImage(spr, b.x - r2, b.y - r2, r2 * 2, r2 * 2);
    }
    // bolas que ruedan de vuelta al punto de lanzamiento
    const destino = g.primeraX ?? g.lanzX;
    for (let i = vueltas.length - 1; i >= 0; i--) {
      const v = vueltas[i]; v.t += dt;
      const p = Math.min(1, v.t / 0.28);
      if (p >= 1) { vueltas.splice(i, 1); continue; }
      const x = v.x + (destino - v.x) * (1 - (1 - p) * (1 - p));
      c.drawImage(cn, x - r2, SUELO - R_BOLA - r2, r2 * 2, r2 * 2);
    }

    // lanzador: canica y contador de la ráfaga
    const enMano = g.estado === 'apuntar' ? g.bolas : g.porLanzar;
    if (enMano > 0 || g.estado === 'vuelo') {
      const lx = g.lanzX;
      if (enMano > 0) c.drawImage(cn, lx - r2, SUELO - R_BOLA - r2, r2 * 2, r2 * 2);
      if (g.estado === 'vuelo' && g.primeraX !== null && g.primeraX !== lx) {
        c.globalAlpha = 0.85; c.drawImage(cn, g.primeraX - r2, SUELO - R_BOLA - r2, r2 * 2, r2 * 2); c.globalAlpha = 1;
      }
      if (enMano > 0) {
        const txt = `×${enMano}`;
        c.font = `800 30px ${FUENTE}`;
        const ancho = c.measureText(txt).width;
        const der = lx + 22 + ancho < W - 6;
        c.textAlign = der ? 'left' : 'right';
        const tx = der ? lx + 22 : lx - 22, ty = SUELO - R_BOLA - 2;
        c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.strokeText(txt, tx, ty);
        c.fillStyle = TINTA; c.fillText(txt, tx, ty);
        c.textAlign = 'center';
      }
    }

    // anillos (destellos breves) y partículas de azúcar
    for (let i = anillos.length - 1; i >= 0; i--) {
      const a = anillos[i]; a.t += dt;
      const p = a.t / a.dur; if (p >= 1) { anillos.splice(i, 1); continue; }
      c.globalAlpha = (1 - p) * (R.reducido ? 0.4 : 0.8); c.strokeStyle = a.color; c.lineWidth = a.ancho * (1 - p * 0.6);
      c.beginPath(); c.arc(a.x, a.y, a.r0 + (a.r1 - a.r0) * (1 - (1 - p) * (1 - p)), 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.vida) continue;
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
      const a = 1 - p.t / p.vida;
      c.globalAlpha = a; c.fillStyle = p.color;
      c.save(); c.translate(p.x, p.y); c.rotate(p.giro + p.t * 8); c.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam); c.restore();
      parts[j++] = p;
    }
    parts.length = j;
    c.globalAlpha = 1;

    // textos flotantes
    for (let i = flotantes.length - 1; i >= 0; i--) {
      const f = flotantes[i]; f.t += dt;
      const p = f.t / f.dur; if (p >= 1) { flotantes.splice(i, 1); continue; }
      const a = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
      const yy = f.y - (R.reducido ? 0 : p * 40);
      c.globalAlpha = a; c.font = `800 ${f.tam}px ${FUENTE}`;
      c.lineWidth = f.tam * 0.24; c.strokeStyle = '#ffffff'; c.strokeText(f.texto, f.x, yy);
      c.fillStyle = f.color || TINTA; c.fillText(f.texto, f.x, yy);
    }
    c.globalAlpha = 1;

    if (flash > 0) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = flash; c.fillStyle = flashColor; c.fillRect(0, 0, cv.width, cv.height); c.globalAlpha = 1;
      flash = Math.max(0, flash - dt * 1.6);
    }
  }

  R.redimensionar = redimensionar; R.nuevaPartida = nuevaPartida; R.evento = evento; R.dibujar = dibujar; R.aviso = aviso;
  R.particulas = () => parts.length;
  return R;
}
