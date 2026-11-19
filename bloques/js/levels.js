// Vitraluz — los 100 niveles se generan por código, siempre iguales (semilla fija por nivel),
// y cada uno se valida: ningún cristal obligatorio puede quedar encerrado tras plomo irrompible.
// Módulo puro (sin DOM): también lo usa la verificación en Node.

import { TOTAL_NIVELES } from './config.js';

export const W = 720, H = 1000;            // campo lógico (todas las pantallas juegan el mismo campo)
export const COLS = 12, CW = 56, CH = 30;   // rejilla de cristales
export const OX = 24, OY = 84;              // origen de la rejilla
export const MAX_ROWS = 15;

// Tipos de bloque
// n normal · s resistente (2-3 golpes) · u plomo irrompible · x explosivo en cadena
// g fantasma (aparece y desaparece) · k llave · l sellado (irrompible mientras quede una llave)
// Cualquier bloque puede además ser móvil (mv) o soltar mejora (drop).

export function rngDe(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tramos de 10 niveles: nombre (clave i18n), paleta y mecánica que se estrena.
export const TRAMOS = [
  { id: 'alba',     mec: 'base' },
  { id: 'brasa',    mec: 'explosivo' },
  { id: 'claustro', mec: 'plomo' },
  { id: 'marea',    mec: 'movil' },
  { id: 'bosque',   mec: 'triple' },
  { id: 'niebla',   mec: 'fantasma' },
  { id: 'tormenta', mec: 'descenso' },
  { id: 'cripta',   mec: 'sello' },
  { id: 'aurora',   mec: 'guardian' },
  { id: 'roseton',  mec: 'todo' },
];

// ---------- patrones ----------
// Cada patrón recibe (c, r, R, p) y dice si hay cristal. m = distancia al borde lateral (simetría).
const cx = (COLS - 1) / 2;
const PATRONES = {
  hileras: (c, r, R, p) => r % p.k !== p.j,
  damero: (c, r) => (c + r) % 2 === 0,
  piramide: (c, r, R) => Math.min(c, COLS - 1 - c) >= Math.ceil((R - 1 - r) * (5.6 / Math.max(1, R - 1))),
  embudo: (c, r, R) => Math.min(c, COLS - 1 - c) >= Math.ceil(r * (5.2 / Math.max(1, R - 1))),
  rombo: (c, r, R) => Math.abs(c - cx) / 6.2 + Math.abs(r - (R - 1) / 2) / (R / 2 + 0.3) <= 1,
  arcos: (c, r, R, p) => {
    const x = c % p.per, d = Math.abs(x - (p.per - 1) / 2);
    const hueco = d < (p.per - 1) / 2 - 0.4 && r >= 2 + Math.round(d * 1.6);
    return !hueco;
  },
  roseton: (c, r, R, p) => {
    const dx = (c - cx) * CW, dy = (r - (R - 1) / 2) * CH * 1.25;
    const d = Math.hypot(dx, dy);
    return d <= R * CH * 0.72 + 30 && (p.lleno ? Math.floor(d / p.w) % 3 !== 2 : Math.floor(d / p.w) % 2 === p.j % 2);
  },
  lancetas: (c, r, R, p) => c % p.k < p.j || r < 1,
  cruz: (c, r, R, p) => Math.abs(c - cx) < p.a || Math.abs(r - (R - 1) / 2) < p.b,
  espiga: (c, r) => (r + Math.min(c, COLS - 1 - c)) % 3 !== 0,
  marcos: (c, r, R) => Math.min(Math.min(c, COLS - 1 - c), r, R - 1 - r) % 2 === 0,
  ola: (c, r, R, p) => Math.abs(r - ((R - 1) / 2 + Math.sin(c * 0.62 + p.ph) * (R / 3.4))) < p.g,
  mosaico: (c, r, R, p) => hash2(Math.min(c, COLS - 1 - c), r, p.s) < p.d,
  reloj: (c, r, R) => Math.min(c, COLS - 1 - c) >= Math.floor(5.4 - Math.abs(r - (R - 1) / 2) * (5.4 / ((R - 1) / 2 + 0.01))),
  diagonal: (c, r, R, p) => (c + r * p.k) % 4 < 2,
  torres: (c, r, R, p) => c % 3 !== 2 && (r >= (c % 6 < 3 ? p.a : 0)),
  corazonada: (c, r, R) => { // dos cúpulas y un vértice: figura de hito
    const m = Math.abs(c - cx);
    if (r <= 1) return m > 0.6 && m < 5.4 - (r === 0 ? 1 : 0);
    return m <= 5.6 - (r - 1) * (5.6 / Math.max(1, R - 2));
  },
};
function hash2(a, b, s) {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const LISTA_PATRONES = ['hileras', 'damero', 'piramide', 'embudo', 'rombo', 'arcos', 'roseton', 'lancetas', 'cruz',
  'espiga', 'marcos', 'ola', 'mosaico', 'reloj', 'diagonal', 'torres'];
// Figura fija de cada nivel hito (10, 20… 100)
const HITOS = ['roseton', 'rombo', 'arcos', 'ola', 'marcos', 'reloj', 'piramide', 'cruz', 'corazonada', 'roseton'];

function paramsDe(nombre, rng, R) {
  const e = (a, b) => a + Math.floor(rng() * (b - a + 1));
  switch (nombre) {
    case 'hileras': { const k = e(2, 4); return { k, j: e(0, k - 1) }; }
    case 'arcos': return { per: rng() < 0.5 ? 4 : 6 };
    case 'roseton': return { w: e(40, 58), j: e(0, 1) };
    case 'lancetas': { const k = e(3, 4); return { k, j: k - 1 }; }
    case 'cruz': return { a: e(1, 2) + 0.6, b: e(1, 2) - 0.4 };
    case 'ola': return { ph: rng() * 6.28, g: 1.2 + rng() * 0.9 };
    case 'mosaico': return { s: e(1, 9999), d: 0.5 + rng() * 0.25 };
    case 'diagonal': return { k: e(1, 3) };
    case 'torres': return { a: e(1, Math.max(1, R - 4)) };
    default: return {};
  }
}

const COLORES = {
  filas: (c, r) => r % 5,
  bandas: (c, r) => Math.floor(r / 2) % 5,
  columnas: (c) => Math.min(c, COLS - 1 - c) % 5,
  diagonal: (c, r) => (c + r) % 5,
  anillos: (c, r, R) => Math.floor(Math.hypot((c - cx) * CW, (r - (R - 1) / 2) * CH * 1.3) / 52) % 5,
  cuadros: (c, r) => (Math.floor(c / 2) + Math.floor(r / 2) * 2) % 5,
};
const LISTA_COLORES = Object.keys(COLORES);

// ---------- generación ----------
export function generarNivel(n) {
  const rng = rngDe(n * 7919 + 13);
  const e = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const elige = (arr) => arr[Math.floor(rng() * arr.length)];
  const t = (n - 1) / (TOTAL_NIVELES - 1);
  const tramo = Math.floor((n - 1) / 10);
  const pos = (n - 1) % 10;               // 0..9 dentro del tramo
  const hito = pos === 9;
  const respiro = pos === 0 && n > 1;     // primer nivel de cada tramo: presenta la mecánica con calma

  let R = Math.min(13, 5 + Math.floor(t * 7.5) + (hito ? 2 : 0) - (respiro ? 1 : 0));
  if (n <= 2) R = 4;
  const minBloques = Math.round(20 + t * 34) - (respiro ? 6 : 0) + (hito ? 14 : 0);
  const maxBloques = Math.round(44 + t * 56) + (hito ? 22 : 0);

  // 1) silueta
  let celdas = null, patron = '';
  for (let intento = 0; intento < 40 && !celdas; intento++) {
    patron = hito ? HITOS[tramo] : (n === 1 ? 'hileras' : n === 2 ? 'damero' : elige(LISTA_PATRONES));
    const p = n === 1 ? { k: 4, j: 3 } : paramsDe(patron, rng, R);
    if (hito && patron === 'roseton') { p.lleno = true; p.w = 44; }
    const f = PATRONES[patron];
    const lista = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) if (f(c, r, R, p)) lista.push({ c, r });
    if (lista.length >= minBloques && lista.length <= maxBloques) celdas = lista;
    else if (hito && intento < 12) R = Math.max(6, Math.min(13, R + (lista.length > maxBloques ? -1 : 1)));
    else if (intento > 30) { // último recurso: recorta o acepta
      if (lista.length > maxBloques) celdas = lista.filter((b) => b.r < R - 2);
      else if (lista.length >= 14) celdas = lista;
    }
  }
  if (!celdas) { // hileras simples, siempre válidas
    celdas = [];
    for (let r = 0; r < Math.min(R, 6); r++) for (let c = 0; c < COLS; c++) if (r % 2 === 0 || c % 2 === 0) celdas.push({ c, r });
    patron = 'hileras';
  }
  const esquemaColor = hito ? 'anillos' : elige(LISTA_COLORES);
  const fc = COLORES[esquemaColor];
  let bloques = celdas.map(({ c, r }) => ({ c, r, type: 'n', hp: 1, color: fc(c, r, R) }));
  const en = (c, r) => bloques.find((b) => b.c === c && b.r === r && !b.mv);

  // 2) qué mecánicas entran (las ya estrenadas; la del tramo casi siempre)
  const disponibles = [];
  if (n >= 11) disponibles.push('explosivo');
  if (n >= 21) disponibles.push('plomo');
  if (n >= 31) disponibles.push('movil');
  if (n >= 51) disponibles.push('fantasma');
  if (n >= 61) disponibles.push('descenso');
  if (n >= 71) disponibles.push('sello');
  if (n >= 81) disponibles.push('guardian');
  const propia = TRAMOS[tramo].mec;
  const usa = new Set();
  if (disponibles.includes(propia) && (hito || respiro || rng() < 0.75)) usa.add(propia);
  const extra = hito ? 2 : respiro ? 0 : (tramo >= 9 ? 3 : tramo >= 5 ? 2 : 1);
  for (let i = 0; i < extra && disponibles.length; i++) usa.add(elige(disponibles));
  if (tramo === 9) { usa.add(elige(['sello', 'guardian', 'movil'])); if (hito) ['explosivo', 'plomo', 'movil', 'fantasma', 'sello'].forEach((m) => usa.add(m)); }
  if (usa.has('guardian')) usa.delete('movil');

  const suave = respiro ? 0.5 : 1;

  // 3) resistentes
  if (n >= 4) {
    const f2 = Math.min(0.34, 0.06 + t * 0.34) * suave;
    const f3 = n >= 41 ? Math.min(0.2, (n === 41 ? 0.06 : 0.05 + (t - 0.4) * 0.26)) * suave : 0;
    // por filas enteras o salpicado, para que se lea como dibujo
    const porFilas = rng() < 0.5;
    const filasDuras = new Set();
    if (porFilas) { const k = Math.max(1, Math.round(R * (f2 + f3))); while (filasDuras.size < k) filasDuras.add(e(0, R - 1)); }
    for (const b of bloques) {
      const duro = porFilas ? filasDuras.has(b.r) : hash2(Math.min(b.c, COLS - 1 - b.c), b.r, n) < f2 + f3;
      if (!duro) continue;
      const triple = f3 > 0 && hash2(b.r, Math.min(b.c, COLS - 1 - b.c), n + 5) < f3 / (f2 + f3);
      b.type = 's'; b.hp = triple ? 3 : 2;
    }
  }

  // 4) móviles / guardianes: una o dos filas propias bajo la figura (o en hueco), que se deslizan en grupo
  const filasMoviles = [];
  if (usa.has('movil') || usa.has('guardian')) {
    const cuantas = (hito || tramo >= 6) && R <= 11 ? 2 : 1;
    for (let i = 0; i < cuantas; i++) {
      let r = R + 1 + i * 2;                       // deja una fila libre de aire
      if (r > MAX_ROWS - 1) break;
      const dibujo = elige([[2, 3, 4, 7, 8, 9], [2, 4, 6, 8], [3, 4, 5, 6, 7, 8], [2, 3, 6, 7], [2, 5, 6, 9]]);
      const guard = usa.has('guardian');
      const fila = { r, amp: 2 * CW - 6, vel: (0.55 + t * 0.5) * (i ? -1 : 1) * (respiro ? 0.7 : 1), fase: rng() * 6.28 };
      filasMoviles.push(fila);
      dibujo.forEach((c, k) => {
        const esPlomo = guard && (k % 3 === 1);
        bloques.push({ c, r, type: esPlomo ? 'u' : (n >= 41 && rng() < 0.3 ? 's' : 'n'), hp: esPlomo ? 1 : 1, color: (k + i) % 5, mv: true });
      });
      bloques.forEach((b) => { if (b.mv && b.type === 's') b.hp = 2; });
    }
  }

  // 5) plomo irrompible, en dibujos simétricos con pasos de al menos dos celdas
  if (usa.has('plomo')) {
    const modo = elige(['dintel', 'pilares', 'salpicado', 'copas']);
    const pon = (c, r) => {
      if (r < 0 || r >= MAX_ROWS || c < 0 || c >= COLS) return;
      if (filasMoviles.some((f) => f.r === r)) return;
      const b = en(c, r);
      if (b) { b.type = 'u'; b.hp = 1; } else bloques.push({ c, r, type: 'u', hp: 1, color: 0 });
    };
    const cant = Math.max(1, Math.round((1 + (tramo - 1) * 0.5 + (hito ? 1 : 0)) * suave));
    if (modo === 'dintel') {
      const r = Math.min(R, MAX_ROWS - 1);
      const tramosD = elige([[0, 1, 5, 6, 10, 11], [2, 3, 8, 9], [0, 1, 2, 9, 10, 11], [4, 5, 6, 7]]);
      if (!filasMoviles.some((f) => f.r === r + 1 || f.r === r)) tramosD.forEach((c) => pon(c, r));
      else tramosD.slice(0, 2).forEach((c) => pon(c, Math.max(0, R - 2)));
    } else if (modo === 'pilares') {
      const m = e(1, 4);
      for (let i = 0; i < Math.min(R, cant + 1); i++) { const r = e(0, R - 1); pon(m, r); pon(COLS - 1 - m, r); }
    } else if (modo === 'salpicado') {
      for (let i = 0; i < cant + 1; i++) { const m = e(0, 5), r = e(0, R - 1); pon(m, r); pon(COLS - 1 - m, r); }
    } else { // copas: cuencos abiertos hacia arriba
      const r = Math.min(R - 1, e(2, Math.max(2, R - 1)));
      const m = e(1, 3);
      [m, m + 1, m + 2].forEach((c) => { pon(c, r); pon(COLS - 1 - c, r); });
      pon(m, r - 1); pon(COLS - 1 - m, r - 1);
    }
  }

  // 6) explosivos
  if (usa.has('explosivo')) {
    const cant = Math.max(2, Math.round((2 + t * 5 + (hito ? 3 : 0)) * suave));
    const cand = bloques.filter((b) => !b.mv && b.type !== 'u');
    for (let i = 0; i < cant && cand.length; i++) {
      const b = cand[Math.floor(rng() * cand.length)];
      const espejo = en(COLS - 1 - b.c, b.r);
      for (const q of [b, espejo]) if (q && q.type !== 'u') { q.type = 'x'; q.hp = 1; }
    }
  }

  // 7) fantasmas
  if (usa.has('fantasma')) {
    const frac = Math.min(0.22, 0.1 + (t - 0.5) * 0.25) * suave;
    const grupo = e(0, 4);
    for (const b of bloques) {
      if (b.mv || b.type !== 'n') continue;
      if (b.color === grupo && hash2(b.c, b.r, n + 77) < frac * 4) { b.type = 'g'; b.fase = (Math.min(b.c, COLS - 1 - b.c) % 3) * 1.4; }
    }
  }

  // 8) llaves y sellos
  if (usa.has('sello')) {
    const cand = bloques.filter((b) => !b.mv && (b.type === 'n' || b.type === 's'));
    // sellados: un bloque central compacto
    const rMed = Math.floor(R / 2);
    const ancho = respiro ? 1 : 2, alto = hito ? 2 : 1;
    let sellados = 0;
    for (const b of cand) {
      if (Math.abs(b.c - cx) <= ancho + 0.6 && Math.abs(b.r - rMed) <= alto) { b.type = 'l'; b.hp = 1; sellados++; }
    }
    if (sellados) {
      const libres = cand.filter((b) => b.type !== 'l');
      const nLlaves = Math.min(libres.length, respiro ? 1 : hito ? 3 : 2);
      // llaves lejos del centro
      libres.sort((a, b2) => Math.abs(b2.c - cx) + Math.abs(b2.r - rMed) - (Math.abs(a.c - cx) + Math.abs(a.r - rMed)));
      for (let i = 0; i < nLlaves; i++) { const b = libres[Math.floor(i * 2.5) % libres.length]; b.type = 'k'; b.hp = 1; }
      if (!bloques.some((b) => b.type === 'k')) bloques.forEach((b) => { if (b.type === 'l') b.type = 'n'; });
    }
  }

  // 9) cristales con mejora dentro
  {
    const cand = bloques.filter((b) => b.type === 'n' || b.type === 's');
    const cant = Math.max(3, Math.round(cand.length * (0.15 - t * 0.05)) + (hito ? 2 : 0));
    for (let i = 0; i < cant && cand.length; i++) {
      const k = Math.floor(rng() * cand.length);
      cand[k].drop = true; cand.splice(k, 1);
    }
  }

  // 10) descenso de la vidriera
  let descenso = null;
  if (usa.has('descenso')) {
    const filaMax = bloques.reduce((m, b) => Math.max(m, b.r), 0);
    const margen = Math.min(4, 17 - filaMax - 1);   // nunca baja de la fila lógica 17 (queda aire sobre la pala)
    if (margen >= 2) descenso = { cada: respiro ? 16 : 13 - Math.min(4, (tramo - 6)), max: margen };
  }

  const nivel = {
    n, tramo, hito, patron, filas: R,
    bloques, filasMoviles, descenso,
    velocidad: Math.round(390 + 225 * t + (hito ? 10 : 0) - (respiro ? 20 : 0)),
    pala: Math.round(128 - 28 * t),
    malas: 0.12 + t * 0.2,                      // proporción de cápsulas con penalización
    mecanicas: [...usa],
  };
  reparar(nivel, rng);
  return nivel;
}

// ---------- validación ----------
// Inundación desde la zona de la pala. Paredes: plomo fijo (y sellos, en la primera fase).
// Los márgenes laterales (24 px) no cuentan como paso; el pasillo superior (84 px) sí.
// Las filas móviles se consideran abiertas: sus bloques se desplazan y dejan hueco.
export function validarNivel(nivel) {
  const filaMax = nivel.bloques.reduce((m, b) => Math.max(m, b.r), 0);
  const Rn = filaMax + 2;                         // fila virtual inferior
  const fijo = new Map();
  for (const b of nivel.bloques) if (!b.mv) fijo.set(b.r * COLS + b.c, b);
  const inundar = (sellosSonPared) => {
    const visto = new Set();
    const cola = [];
    for (let c = 0; c < COLS; c++) { cola.push([c, Rn - 1]); visto.add((Rn - 1) * 100 + c); }
    while (cola.length) {
      const [c, r] = cola.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 < 0 || c2 >= COLS || r2 < -1 || r2 >= Rn) continue;
        const k = r2 * 100 + c2;
        if (visto.has(k)) continue;
        const b = r2 >= 0 ? fijo.get(r2 * COLS + c2) : null;
        if (b && (b.type === 'u' || (sellosSonPared && b.type === 'l'))) continue;
        visto.add(k); cola.push([c2, r2]);
      }
    }
    return visto;
  };
  const fase1 = inundar(true), fase2 = inundar(false);
  const inalcanzables = [];
  for (const b of nivel.bloques) {
    if (b.type === 'u') continue;
    const k = b.r * 100 + b.c;
    if (b.mv) { if (!fase2.has(k)) inalcanzables.push(b); continue; }
    if (b.type === 'k') { if (!fase1.has(k)) inalcanzables.push(b); }
    else if (b.type === 'l') { // alcanzable si algún vecino lo es en fase 2
      if (!fase2.has(k)) inalcanzables.push(b);
    } else if (!fase2.has(k)) inalcanzables.push(b);
  }
  const hayLlaves = nivel.bloques.some((b) => b.type === 'k');
  const haySellos = nivel.bloques.some((b) => b.type === 'l');
  const obligatorios = nivel.bloques.filter((b) => b.type !== 'u').length;
  const ok = inalcanzables.length === 0 && obligatorios > 0 && (!haySellos || hayLlaves);
  return { ok, inalcanzables, obligatorios };
}

// Si algo queda encerrado, se va fundiendo plomo (pasa a cristal normal) hasta que todo es alcanzable.
function reparar(nivel, rng) {
  for (let i = 0; i < 80; i++) {
    const v = validarNivel(nivel);
    if (v.ok) return;
    const plomos = nivel.bloques.filter((b) => b.type === 'u' && !b.mv);
    if (plomos.length) { const b = plomos[Math.floor(rng() * plomos.length)]; b.type = 'n'; b.hp = 1; continue; }
    const sellos = nivel.bloques.filter((b) => b.type === 'l');
    if (sellos.length) { sellos.forEach((b) => { b.type = 'n'; }); continue; }
    break;
  }
}

// Medida de dificultad para comprobar que la curva sube sin saltos bruscos.
export function dificultad(nivel) {
  let hp = 0, plomo = 0, mov = 0, raros = 0;
  for (const b of nivel.bloques) {
    if (b.type === 'u') { plomo++; continue; }
    hp += b.hp; if (b.mv) mov++; if (b.type === 'g' || b.type === 'l') raros++;
  }
  const base = hp + plomo * 2.5 + mov * 1.2 + raros * 1.5 + (nivel.descenso ? 8 : 0);
  return Math.round(base * (nivel.velocidad / 390) * (128 / nivel.pala));
}

let cache = null;
export function todosLosNiveles() {
  if (!cache) { cache = []; for (let n = 1; n <= TOTAL_NIVELES; n++) cache.push(generarNivel(n)); }
  return cache;
}
export function nivel(n) { return todosLosNiveles()[n - 1]; }
