// Caramboleta — los 100 niveles se generan por código, siempre iguales (semilla fija por nivel).
// El ajuste fino de cada nivel (dureza y umbrales de estrellas) sale de tools/verificar-niveles.mjs,
// que juega TODOS los niveles con un bot y escribe js/umbrales.js. Módulo puro (sin DOM).

import { TOTAL_NIVELES } from './config.js';
import { UMBRALES } from './umbrales.js';

// ---------- campo lógico (igual en todas las pantallas) ----------
export const COLS = 7, CELL = 100;
export const W = COLS * CELL;          // 700
export const SUELO = 1000;             // y del suelo: las bolas vuelven aquí
export const FILA_LIMITE = 9;          // un bloque rompible que entra en la fila 9 (y 900–1000) hace perder
export const HUECO = 8;                // separación entre gominolas
export const R_BOLA = 9;

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

// Tramos de 10 niveles: nombre (clave i18n) y mecánica que se estrena en cada uno.
export const TRAMOS = [
  { id: 'fresa',    mec: 'base' },        // cuadrados de gominola
  { id: 'limon',    mec: 'tri' },         // triángulos: cambian el rebote
  { id: 'regaliz',  mec: 'duro' },        // gominolas muy resistentes
  { id: 'chispas',  mec: 'explosivo' },   // estallan en cadena
  { id: 'cande',    mec: 'irrompible' },  // azúcar cande: no se rompe, hay que rodearlo
  { id: 'mermelada', mec: 'regen' },      // se rellenan si no las tocas
  { id: 'tiovivo',  mec: 'movil' },       // se desplazan cada tirada
  { id: 'bombon',   mec: 'cascara' },     // cáscara de chocolate por un lado
  { id: 'huerto',   mec: 'brote' },       // brotan gominolas nuevas
  { id: 'confiteria', mec: 'todo' },      // todo a la vez
];

// Mejoras y nivel en que aparece cada una por primera vez (se estrenan de una en una).
export const ORDEN_MEJORAS = ['extra', 'divide', 'rayoH', 'rayoV', 'bomba', 'perfora', 'rebote', 'congela'];
export const ESTRENO_MEJORA = { extra: 1, divide: 3, rayoH: 5, rayoV: 7, bomba: 9, perfora: 12, rebote: 15, congela: 18 };

// Figuras de los niveles hito (7 columnas; de arriba abajo). Números = golpes relativos.
const HITOS = [
  ['.#.#.', '#####', '#####', '.###.', '..#..'].map((f) => ' ' + f + ' '),                       // corazón
  [' ##### ', '#######', '##.#.##', '#######', ' #.#.# ', '  ###  '],                             // pastel
  ['#..#..#', '##.#.##', '#######', '.#####.', '..###..', '...#...'],                             // tulipán
  ['.##.##.', '#######', '###.###', '.#####.', '#.###.#', '...#...'],                             // mariposa
  ['..###..', '.#####.', '##.#.##', '#######', '.#.#.#.', '#.#.#.#'],                             // pulpo
  ['#######', '#.....#', '#.###.#', '#.#.#.#', '#.###.#', '#.....#', '#######'],                  // caja
  ['...#...', '..###..', '.#####.', '#######', '..#.#..', '.##.##.', '##...##'],                  // abeto
  ['.#####.', '#######', '##...##', '##.#.##', '##...##', '#######', '.#####.'],                  // donut
  ['#.#.#.#', '.#####.', '#######', '#######', '.#####.', '..###..', '...#...'],                  // corona
  ['.##.##.', '#######', '#######', '.#####.', '#######', '##.#.##', '.##.##.', '..###..'],       // gran tarta
];

function tramoDe(n) { return Math.floor((n - 1) / 10); }

// Dificultad en dientes de sierra: sube dentro de cada tramo y baja un poco al empezar el siguiente.
export function dificultad(n) {
  const tr = tramoDe(n), k = (n - 1) % 10 + 1;
  const saw = [0, 0.18, 0.32, 0.12, 0.42, 0.55, 0.3, 0.65, 0.8, 1.0][k - 1];
  return tr * 0.5 + saw * 1.1;
}

export function bolasIniciales(n) { return 3 + Math.round((n - 1) * 0.36) + (n % 10 === 0 ? 2 : 0); }

// Fracción de cada tipo especial según el nivel (la mecánica nueva entra poco a poco en su tramo).
function fracciones(n) {
  const tr = tramoDe(n), k = (n - 1) % 10 + 1;
  const entra = (t, max) => (tr < t ? 0 : tr === t ? max * (0.35 + 0.65 * (k - 1) / 9) : max * (tr === 9 ? 1.1 : 0.75));
  return {
    tri: entra(1, 0.26), duro: entra(2, 0.14), explosivo: entra(3, 0.1), irrompible: entra(4, 0.09),
    regen: entra(5, 0.12), movil: entra(6, 0.14), cascara: entra(7, 0.13), brote: entra(8, 0.06),
  };
}

export function nivel(n, forzar = null) {
  n = Math.max(1, Math.min(TOTAL_NIVELES, n | 0));
  const rnd = rngDe(n * 9973 + 4049);
  const tr = tramoDe(n), k = (n - 1) % 10 + 1, hito = k === 10;
  const dif = dificultad(n);
  const u = (forzar || UMBRALES[n]) || {};
  const aj = u.a || 1;
  const bolas0 = bolasIniciales(n);
  const fr = fracciones(n);
  const elige = (arr) => arr[Math.floor(rnd() * arr.length)];

  // Mapa de celdas ocupadas: filas de contenido, j = 0 la de abajo.
  let filas = [];
  if (hito) {
    const fig = HITOS[tr];
    for (let i = fig.length - 1; i >= 0; i--) filas.push([...fig[i]].map((ch) => ch === '#'));
  } else {
    const R = Math.min(10, 5 + Math.floor(k / 3) + (tr >= 3 ? 1 : 0) + (tr >= 6 ? 1 : 0));
    const densidad = Math.min(0.82, 0.5 + dif * 0.06);
    const simetrico = rnd() < 0.55;
    for (let j = 0; j < R; j++) {
      const f = new Array(COLS).fill(false);
      for (let c = 0; c < COLS; c++) {
        if (simetrico && c > 3) { f[c] = f[COLS - 1 - c]; continue; }
        f[c] = rnd() < densidad;
      }
      let ocupadas = f.filter(Boolean).length;
      while (ocupadas < 2) { const c = Math.floor(rnd() * COLS); if (!f[c]) { f[c] = true; ocupadas++; } }
      if (ocupadas === COLS) f[Math.floor(rnd() * COLS)] = false;   // siempre queda un hueco para una mejora
      filas.push(f);
    }
  }

  const R = filas.length;
  const filaBase = hito ? 4 : 4;            // la fila de abajo empieza en la fila visible 4
  const bloques = [], items = [];
  const libres = [];                        // celdas vacías por fila, para mejoras
  const factor = (0.55 + 0.08 * dif) * aj;

  for (let j = 0; j < R; j++) {
    const r = filaBase - j;
    const bj = bolas0 + j * 0.75;
    const libresFila = [];
    for (let c = 0; c < COLS; c++) {
      if (!filas[j][c]) { libresFila.push(c); continue; }
      let hp = Math.max(1, Math.round(bj * factor * (0.65 + rnd() * 0.75) * (hito ? 1.15 : 1)));
      const b = { c, r, hp, tipo: 'base', forma: 'cuad', o: 0 };
      const x = rnd();
      let acc = 0;
      const tocaTipo = (p) => { acc += p; return x < acc; };
      if (tocaTipo(fr.irrompible) && j > 0) { b.tipo = 'irrompible'; b.hp = 0; }
      else if (tocaTipo(fr.duro)) { b.tipo = 'duro'; b.hp = Math.round(hp * 2.4) + 2; }
      else if (tocaTipo(fr.explosivo)) { b.tipo = 'explosivo'; b.hp = Math.max(1, Math.round(hp * 0.7)); }
      else if (tocaTipo(fr.regen)) { b.tipo = 'regen'; }
      else if (tocaTipo(fr.movil)) { b.tipo = 'movil'; b.dir = rnd() < 0.5 ? -1 : 1; }
      else if (tocaTipo(fr.cascara)) { b.tipo = 'cascara'; b.lado = elige([2, 2, 2, 1, 3, 0]); }
      else if (tocaTipo(fr.brote)) { b.tipo = 'brote'; b.cargas = 2; }
      if (fr.tri && b.tipo !== 'cascara' && b.tipo !== 'irrompible' && rnd() < fr.tri) { b.forma = 'tri'; b.o = Math.floor(rnd() * 4); }
      bloques.push(b);
    }
    libres.push(libresFila);
  }

  // +1 bola: una en casi todas las filas
  const pExtra = n <= 10 ? 0.95 : 0.8;
  for (let j = 0; j < R; j++) {
    if (!libres[j].length || rnd() > pExtra) continue;
    const i = Math.floor(rnd() * libres[j].length);
    items.push({ c: libres[j][i], r: filaBase - j, k: 'extra' });
    libres[j].splice(i, 1);
  }

  // otras mejoras disponibles en este nivel
  const disp = ORDEN_MEJORAS.filter((m) => m !== 'extra' && ESTRENO_MEJORA[m] <= n);
  const estreno = ORDEN_MEJORAS.find((m) => ESTRENO_MEJORA[m] === n);
  const cuantas = disp.length ? Math.min(4, 1 + Math.floor(k / 4) + (tr >= 2 ? 1 : 0)) : 0;
  const pedidas = [];
  if (estreno && estreno !== 'extra') pedidas.push(estreno);
  while (pedidas.length < cuantas) pedidas.push(elige(disp));
  pedidas.forEach((m, idx) => {
    const jMax = idx === 0 && estreno ? Math.min(2, R - 1) : R - 1;    // la recién estrenada, abajo y a la vista
    const enBloque = rnd() < 0.45 && !(idx === 0 && estreno);
    if (enBloque) {
      const cand = bloques.filter((b) => b.tipo !== 'irrompible' && !b.mej && filaBase - b.r <= jMax);
      if (cand.length) { elige(cand).mej = m; return; }
    }
    for (let intento = 0; intento < 12; intento++) {
      const j = Math.floor(rnd() * (jMax + 1));
      if (libres[j].length) { const i = Math.floor(rnd() * libres[j].length); items.push({ c: libres[j][i], r: filaBase - j, k: m }); libres[j].splice(i, 1); return; }
    }
    const cand = bloques.filter((b) => b.tipo !== 'irrompible' && !b.mej);
    if (cand.length) elige(cand).mej = m;
  });

  return {
    n, tramo: tr, k, hito, bolas: bolas0 + (u.b || 0), bloques, items, filas: R,
    mec: TRAMOS[tr].mec,
    t3: u.t3 || R + 2, t2: u.t2 || R + 5,
  };
}
