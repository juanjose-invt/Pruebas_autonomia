// Generador de tableros a partir de una semilla. Determinista: misma semilla, mismo tablero.
import { FLOOR, BLOCK, PIT, FELT } from './engine.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** spec: { seed, n, k, walls, blocks, pits, felts } */
export function build(spec) {
  const { n, k } = spec;
  const r = rng(spec.seed);
  const ri = (m) => Math.floor(r() * m);
  const N = n * n;
  const type = new Uint8Array(N), wr = new Uint8Array(N), wd = new Uint8Array(N);
  const cup = new Int8Array(N).fill(-1);

  // Listones: tramos rectos de 1 a 3 casillas, como en un laberinto de carpintero.
  for (let w = 0; w < (spec.walls || 0); w++) {
    const horiz = r() < 0.5, len = 1 + ri(3);
    if (horiz) { // listón tumbado bajo una fila de casillas
      const y = ri(n - 1), x0 = ri(n);
      for (let i = 0; i < len && x0 + i < n; i++) wd[y * n + x0 + i] = 1;
    } else {
      const x = ri(n - 1), y0 = ri(n);
      for (let i = 0; i < len && y0 + i < n; i++) wr[(y0 + i) * n + x] = 1;
    }
  }
  const free = [];
  for (let c = 0; c < N; c++) free.push(c);
  const take = () => free.splice(ri(free.length), 1)[0];
  for (let i = 0; i < (spec.blocks || 0); i++) type[take()] = BLOCK;
  for (let i = 0; i < (spec.pits || 0); i++) type[take()] = PIT;
  for (let i = 0; i < (spec.felts || 0); i++) type[take()] = FELT;
  const start = [];
  for (let i = 0; i < k; i++) cup[take()] = i;
  for (let i = 0; i < k; i++) start.push(take());
  return { n, k, type, wr, wd, cup, start };
}
