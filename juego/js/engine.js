// Reglas del juego: puras, sin DOM. Las usan el juego, el solver y el generador.
// Tablero de n×n casillas. Al inclinar, cada canica rueda en línea recta hasta chocar.

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // derecha, abajo, izquierda, arriba
export const DONE = -1;                                  // canica ya metida en su hoyo
export const FLOOR = 0, BLOCK = 1, PIT = 2, FELT = 3;

/** Casilla vecina en la dirección d, o -1 si lo impide el borde, un listón o un taco. */
export function stepCell(L, c, d) {
  const n = L.n, x = c % n, y = (c / n) | 0;
  let nc;
  if (d === 0) { if (x === n - 1 || L.wr[c]) return -1; nc = c + 1; }
  else if (d === 2) { if (x === 0 || L.wr[c - 1]) return -1; nc = c - 1; }
  else if (d === 1) { if (y === n - 1 || L.wd[c]) return -1; nc = c + n; }
  else { if (y === 0 || L.wd[c - n]) return -1; nc = c - n; }
  return L.type[nc] === BLOCK ? -1 : nc;
}

/**
 * Aplica una inclinación. pos[i] = casilla de la canica i (o DONE).
 * Devuelve { pos, moved, fail, paths } — paths solo si wantPaths.
 * end: 'wall' | 'marble' | 'cup' | 'wrong' | 'pit' | 'felt' | 'stay'
 */
export function tilt(L, pos, d, wantPaths) {
  const n = L.n, k = pos.length;
  const out = pos.slice();
  const order = [];
  for (let i = 0; i < k; i++) if (pos[i] !== DONE) order.push(i);
  const key = (c) => {
    const x = c % n, y = (c / n) | 0;
    return d === 0 ? x : d === 2 ? -x : d === 1 ? y : -y;
  };
  order.sort((a, b) => key(pos[b]) - key(pos[a]));
  let moved = false, fail = false;
  const paths = wantPaths ? [] : null;
  const gone = new Array(k).fill(false); // caídas en un hoyo equivocado durante este movimiento
  for (const i of order) {
    let c = pos[i], end = 'wall', steps = 0, blocker = -1;
    for (;;) {
      const nc = stepCell(L, c, d);
      if (nc < 0) { end = 'wall'; break; }
      let occ = -1;
      for (let j = 0; j < k; j++) if (j !== i && !gone[j] && out[j] === nc) { occ = j; break; }
      if (occ >= 0) { end = 'marble'; blocker = occ; break; }
      c = nc; steps++;
      const owner = L.cup[c];
      if (owner >= 0 && out[owner] !== DONE) {
        end = owner === i ? 'cup' : 'wrong';
        break;
      }
      const t = L.type[c];
      if (t === PIT) { end = 'pit'; break; }
      if (t === FELT) { end = 'felt'; break; }
    }
    if (steps > 0) moved = true; else end = 'stay';
    if (paths) paths.push({ id: i, from: pos[i], to: c, steps, end, blocker });
    if (end === 'cup') out[i] = DONE;
    else if (end === 'wrong' || end === 'pit') { fail = true; gone[i] = true; out[i] = c; }
    else out[i] = c;
  }
  return { pos: out, moved, fail, paths };
}

export function isSolved(pos) {
  for (let i = 0; i < pos.length; i++) if (pos[i] !== DONE) return false;
  return true;
}
