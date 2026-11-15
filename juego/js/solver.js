// Búsqueda en anchura sobre las inclinaciones: da el mínimo de movimientos y el camino.
import { tilt, DONE, isSolved } from './engine.js';

/**
 * @returns {null | {par:number, path:number[], states:number, traps:number}}
 * traps = movimientos desde estados alcanzables que acaban en un hoyo equivocado.
 */
export function solve(L, startPos, maxStates = 400000) {
  const k = startPos.length, base = L.n * L.n + 1;
  const enc = (p) => { let v = 0; for (let i = k - 1; i >= 0; i--) v = v * base + (p[i] + 1); return v; };
  const size = Math.pow(base, k);
  const prev = new Int32Array(size).fill(-2);
  const via = new Uint8Array(size);
  let frontier = [startPos.slice()];
  const s0 = enc(startPos);
  prev[s0] = -1;
  if (isSolved(startPos)) return { par: 0, path: [], states: 1, traps: 0 };
  let states = 1, traps = 0, depth = 0, goal = -1;
  while (frontier.length && goal < 0) {
    depth++;
    const next = [];
    for (const p of frontier) {
      const pe = enc(p);
      for (let d = 0; d < 4; d++) {
        const r = tilt(L, p, d, false);
        if (r.fail) { traps++; continue; }
        if (!r.moved) continue;
        const e = enc(r.pos);
        if (prev[e] !== -2) continue;
        prev[e] = pe; via[e] = d; states++;
        if (isSolved(r.pos)) { goal = e; break; }
        next.push(r.pos);
      }
      if (goal >= 0) break;
    }
    if (states > maxStates) return null;
    frontier = next;
  }
  if (goal < 0) return null;
  const path = [];
  for (let e = goal; prev[e] !== -1; e = prev[e]) path.push(via[e]);
  path.reverse();
  return { par: depth, path, states, traps };
}
