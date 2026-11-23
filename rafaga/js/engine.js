// Caramboleta — física y reglas de la partida. Módulo puro y determinista (sin DOM ni Math.random):
// lo usan el juego, la demo de la portada y el bot de tools/verificar-niveles.mjs.
//
// Colisiones exactas: cada bola avanza por barrido continuo contra paredes y contra cada gominola
// (polígono convexo inflado con el radio de la bola: aristas desplazadas + círculos en los vértices).
// Se busca el primer contacto del tramo, se rebota y se sigue con el tiempo que queda. Así ninguna bola
// atraviesa esquinas ni bloques aunque haya cientos a la vez.

import { COLS, CELL, W, SUELO, FILA_LIMITE, HUECO, R_BOLA } from './levels.js';
import { MAX_BOLAS_EN_VUELO } from './config.js';

export const PASO = 1 / 120;
export const VEL = 1500;                 // unidades lógicas por segundo
export const INTERVALO = 0.06;           // segundos entre bola y bola de la ráfaga
export const ANG_MIN = 8 * Math.PI / 180;  // nada sale ni rebota más plano que esto
export const R_ITEM = 24;
const OFF = 48;                          // filas ocultas por encima del campo que caben en la rejilla
const FILAS_REJ = OFF + FILA_LIMITE + 2;
const SIN_MIN = Math.sin(ANG_MIN);

export const MEJORAS = {
  extra:   { persiste: false },   // +1 bola para el resto del nivel
  divide:  { persiste: true },    // la bola se divide en tres (las nuevas desaparecen al tocar el suelo)
  rayoH:   { persiste: true },    // rayo de fila: golpea toda la fila
  rayoV:   { persiste: true },    // rayo de columna
  bomba:   { persiste: false },   // la bola que la toca estalla en sus 3 próximos choques
  perfora: { persiste: false },   // la bola atraviesa los 5 próximos bloques
  rebote:  { persiste: false },   // las bolas de esta tirada rebotan una vez en el suelo
  congela: { persiste: false },   // los bloques no bajan al terminar esta tirada
};

// ---------- geometría de cada gominola ----------
function poligono(b) {
  const h = HUECO / 2, x0 = b.c * CELL + h, y0 = b.r * CELL + h, x1 = (b.c + 1) * CELL - h, y1 = (b.r + 1) * CELL - h;
  let v;
  if (b.forma === 'tri') {
    // o = esquina del ángulo recto: 0 abajo-izq, 1 abajo-der, 2 arriba-der, 3 arriba-izq
    v = [[x0, y0, x0, y1, x1, y1], [x0, y1, x1, y1, x1, y0], [x1, y1, x1, y0, x0, y0], [x1, y0, x0, y0, x0, y1]][b.o];
  } else v = [x0, y0, x1, y0, x1, y1, x0, y1];
  const m = v.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < m; i++) { cx += v[2 * i]; cy += v[2 * i + 1]; }
  cx /= m; cy /= m;
  const n = new Array(v.length);
  for (let i = 0; i < m; i++) {
    const ax = v[2 * i], ay = v[2 * i + 1], bx = v[(2 * i + 2) % v.length], by = v[(2 * i + 3) % v.length];
    let nx = by - ay, ny = -(bx - ax);
    const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    if ((ax - cx) * nx + (ay - cy) * ny < 0) { nx = -nx; ny = -ny; }   // que apunte hacia fuera
    n[2 * i] = nx; n[2 * i + 1] = ny;
  }
  b.v = v; b.n = n; b.cx = cx; b.cy = cy;
}

// Primer contacto de una bola (centro p, desplazamiento d, radio r) con un polígono convexo inflado.
const choque = { t: 2, nx: 0, ny: 0 };
function barrer(px, py, dx, dy, b, r) {
  let best = 2, bnx = 0, bny = 0;
  const v = b.v, n = b.n, L = v.length, m = L / 2;
  for (let i = 0; i < m; i++) {
    const nx = n[2 * i], ny = n[2 * i + 1];
    const dd = dx * nx + dy * ny;
    if (dd >= 0) continue;
    const ax = v[2 * i], ay = v[2 * i + 1];
    const d0 = (px - ax) * nx + (py - ay) * ny;
    if (d0 < r - 0.75) continue;                     // ya está por detrás de esta arista
    let t = (d0 - r) / -dd;
    if (t < 0) t = 0;
    if (t > 1 || t >= best) continue;
    const qx = px + dx * t - nx * r, qy = py + dy * t - ny * r;
    const ex = v[(2 * i + 2) % L] - ax, ey = v[(2 * i + 3) % L] - ay;
    const s = ((qx - ax) * ex + (qy - ay) * ey) / (ex * ex + ey * ey);
    if (s < 0 || s > 1) continue;
    best = t; bnx = nx; bny = ny;
  }
  const a = dx * dx + dy * dy;
  if (a > 1e-12) {
    for (let i = 0; i < m; i++) {
      const fx = px - v[2 * i], fy = py - v[2 * i + 1];
      const bb = fx * dx + fy * dy;
      if (bb >= 0) continue;                        // se aleja del vértice
      const c = fx * fx + fy * fy - r * r;
      let t;
      if (c < 0) { if (c < -r * r * 0.5) continue; t = 0; }
      else {
        const disc = bb * bb - a * c;
        if (disc < 0) continue;
        t = (-bb - Math.sqrt(disc)) / a;
        if (t < 0) t = 0;
      }
      if (t > 1 || t >= best) continue;
      const qx = px + dx * t - v[2 * i], qy = py + dy * t - v[2 * i + 1];
      const l = Math.hypot(qx, qy) || 1;
      best = t; bnx = qx / l; bny = qy / l;
    }
  }
  choque.t = best; choque.nx = bnx; choque.ny = bny;
  return best <= 1;
}

// ---------- partida ----------
export function crearPartida(nv) {
  const g = {
    nivel: nv, semilla: (nv.n * 2654435761 + 7) >>> 0,
    bloques: [], items: [], rej: new Array(FILAS_REJ * COLS).fill(null), rejI: new Array(FILAS_REJ * COLS).fill(null),
    bolas: nv.bolas, lanzX: W / 2, estado: 'apuntar',
    activas: [], porLanzar: 0, tLanz: 0, ang: -Math.PI / 2, primeraX: null, tTirada: 0,
    tiradas: 0, total: 0, restantes: 0, rotos: 0, cadena: 0, cadenaMax: 0, rotosTirada: 0, rafagaMax: 0,
    golpesTirada: 0, congelar: false, rebTirada: false, colaExpl: [], eventos: [], sigId: 1, recogidas: 0,
    sinSonido: false,
  };
  for (const b0 of nv.bloques) {
    const b = { ...b0, id: g.sigId++, max: b0.hp, vivo: true, tocado: false, w: 0, f: 0 };
    poligono(b);
    g.bloques.push(b);
    if (b.tipo !== 'irrompible') { g.total++; g.restantes++; }
  }
  for (const i0 of nv.items) g.items.push({ ...i0, id: g.sigId++, vivo: true, usado: false });
  reindexar(g);
  return g;
}

function idx(c, r) { return r < -OFF || r > FILA_LIMITE + 1 || c < 0 || c >= COLS ? -1 : (r + OFF) * COLS + c; }
function reindexar(g) {
  g.rej.fill(null); g.rejI.fill(null);
  for (const b of g.bloques) if (b.vivo) { const i = idx(b.c, b.r); if (i >= 0) g.rej[i] = b; }
  for (const it of g.items) if (it.vivo) { const i = idx(it.c, it.r); if (i >= 0) g.rejI[i] = it; }
}
export function bloqueEn(g, c, r) { const i = idx(c, r); return i < 0 ? null : g.rej[i]; }
function itemEn(g, c, r) { const i = idx(c, r); return i < 0 ? null : g.rejI[i]; }

function ev(g, e) { g.eventos.push(e); }
// azar determinista guardado en el propio estado (así una copia sigue la misma secuencia)
function azar(g) {
  let t = (g.semilla = (g.semilla + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Ángulo válido: hacia arriba y nunca más plano que ANG_MIN.
export function limitarAngulo(a) {
  // a en radianes, ángulos de pantalla (y hacia abajo): arriba = -PI/2
  let x = Math.cos(a), y = Math.sin(a);
  if (y > -SIN_MIN) { y = -SIN_MIN; x = Math.sign(x || 1) * Math.cos(ANG_MIN); }
  return Math.atan2(y, x);
}

export function lanzar(g, ang) {
  if (g.estado !== 'apuntar') return false;
  g.ang = limitarAngulo(ang);
  g.estado = 'vuelo'; g.porLanzar = g.bolas; g.tLanz = 0; g.primeraX = null; g.tTirada = 0;
  // la ráfaga entera sale en unos 2,4 s como mucho: con muchas bolas, más juntas
  g.intervalo = Math.max(0.012, Math.min(INTERVALO, 2.4 / Math.max(1, g.bolas)));
  g.tiradas++; g.cadena = 0; g.rotosTirada = 0; g.golpesTirada = 0; g.rebTirada = false; g.recogidas = 0;
  ev(g, { e: 'lanzar' });
  return true;
}

function nuevaBola(g, x, y, ang, temp) {
  const b = { x, y, vx: Math.cos(ang) * VEL, vy: Math.sin(ang) * VEL, temp: !!temp, bomba: 0, pierce: 0, ign: null,
    reb: g.rebTirada ? 1 : 0, sinBloque: 0, ultItem: null, vivo: true };
  g.activas.push(b);
  return b;
}

// Avanza la simulación dt segundos (llamar con PASO).
export function paso(g, dt) {
  if (g.estado !== 'vuelo') { decaer(g, dt); return; }
  g.tTirada += dt;
  // ráfaga: sale una bola cada INTERVALO
  if (g.porLanzar > 0) {
    g.tLanz -= dt;
    while (g.porLanzar > 0 && g.tLanz <= 0) {
      nuevaBola(g, g.lanzX, SUELO - R_BOLA - 0.5, g.ang, false);
      g.porLanzar--; g.tLanz += g.intervalo;
      if (!g.sinSonido) ev(g, { e: 'sale' });
    }
  }
  const act = g.activas;
  for (let i = 0; i < act.length; i++) {
    const b = act[i];
    if (!b.vivo) continue;
    moverBola(g, b, dt);
    if (g.colaExpl.length) explosiones(g);
    if (g.estado === 'ganado') break;
  }
  // limpiar bolas que ya han vuelto
  let j = 0;
  for (let i = 0; i < act.length; i++) if (act[i].vivo) act[j++] = act[i];
  act.length = j;
  decaer(g, dt);
  if (g.estado === 'ganado') { terminarVuelo(g); return; }
  if (g.porLanzar === 0 && act.length === 0) finTirada(g);
}

function decaer(g, dt) {
  for (const b of g.bloques) { if (b.w > 0) b.w = Math.max(0, b.w - dt * 2.6); if (b.f > 0) b.f = Math.max(0, b.f - dt * 6); }
}

function moverBola(g, b, dt) {
  const r = R_BOLA;
  let rem = 1;
  for (let it = 0; it < 8 && rem > 1e-7; it++) {
    const sx = b.vx * dt * rem, sy = b.vy * dt * rem;
    let tMin = 1, tipo = 0, nx = 0, ny = 0, blq = null;
    // paredes y techo
    if (sx < 0 && b.x + sx < r) { const t = Math.max(0, (r - b.x) / sx); if (t < tMin) { tMin = t; tipo = 1; nx = 1; ny = 0; } }
    if (sx > 0 && b.x + sx > W - r) { const t = Math.max(0, (W - r - b.x) / sx); if (t < tMin) { tMin = t; tipo = 1; nx = -1; ny = 0; } }
    if (sy < 0 && b.y + sy < r) { const t = Math.max(0, (r - b.y) / sy); if (t < tMin) { tMin = t; tipo = 1; nx = 0; ny = 1; } }
    if (sy > 0 && b.y + sy > SUELO - r) { const t = Math.max(0, (SUELO - r - b.y) / sy); if (t < tMin) { tMin = t; tipo = 2; nx = 0; ny = -1; } }
    // gominolas en las celdas que toca el barrido
    const c0 = Math.max(0, Math.floor((Math.min(b.x, b.x + sx) - r - 1) / CELL));
    const c1 = Math.min(COLS - 1, Math.floor((Math.max(b.x, b.x + sx) + r + 1) / CELL));
    const r0 = Math.max(0, Math.floor((Math.min(b.y, b.y + sy) - r - 1) / CELL));
    const r1 = Math.min(FILA_LIMITE, Math.floor((Math.max(b.y, b.y + sy) + r + 1) / CELL));
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const k = g.rej[(rr + OFF) * COLS + cc];
        if (!k || k === b.ign) continue;
        if (barrer(b.x, b.y, sx, sy, k, r) && choque.t < tMin) { tMin = choque.t; tipo = 3; nx = choque.nx; ny = choque.ny; blq = k; }
      }
    }
    // avanzar hasta el contacto
    b.x += sx * tMin; b.y += sy * tMin;
    rem *= 1 - tMin;
    if (tipo === 0) break;
    if (tipo === 2) {                                   // suelo
      if (b.reb > 0) { b.reb--; reflejar(b, nx, ny); if (!g.sinSonido) ev(g, { e: 'rebSuelo', x: b.x }); continue; }
      aterrizar(g, b); return;
    }
    if (tipo === 3 && b.pierce > 0 && blq.tipo !== 'irrompible') {
      // perforante: atraviesa sin rebotar
      b.pierce--; b.ign = blq;
      golpear(g, blq, 1, nx, ny, b);
      b.x += nx * 0.02; b.y += ny * 0.02;
      if (g.estado === 'ganado') return;
      continue;
    }
    reflejar(b, nx, ny);
    b.x += nx * 0.02; b.y += ny * 0.02;
    if (tipo === 1) { b.sinBloque++; if (!g.sinSonido) ev(g, { e: 'pared' }); }
    else {
      if (blq.tipo === 'irrompible') b.sinBloque++; else b.sinBloque = 0;
      golpear(g, blq, 1, nx, ny, b);
      if (b.bomba > 0 && blq.tipo !== 'irrompible') { b.bomba--; g.colaExpl.push({ c: blq.c, r: blq.r, dmg: g.danoBomba || 2, bomba: true }); }
      if (g.estado === 'ganado') return;
    }
    // desvío automático: si una bola lleva muchos rebotes sin tocar nada que se rompa, se inclina un poco
    if (b.sinBloque > 24) { girar(b, (b.vx >= 0 ? 1 : -1) * 0.21); b.sinBloque = 12; }
  }
  if (b.ign) {
    const k = b.ign;
    if (!k.vivo || Math.abs(b.x - k.cx) > CELL * 0.5 + R_BOLA + 1 || Math.abs(b.y - k.cy) > CELL * 0.5 + R_BOLA + 1) b.ign = null;
  }
  tocarItems(g, b);
}

function reflejar(b, nx, ny) {
  const d = b.vx * nx + b.vy * ny;
  if (d < 0) { b.vx -= 2 * d * nx; b.vy -= 2 * d * ny; }
  // nunca casi horizontal: se corrige el ángulo conservando el sentido
  const v = Math.hypot(b.vx, b.vy) || VEL;
  if (Math.abs(b.vy) < v * SIN_MIN) {
    const sy = b.vy > 0 ? 1 : b.vy < 0 ? -1 : 1;
    b.vy = sy * v * SIN_MIN; b.vx = Math.sign(b.vx || 1) * v * Math.cos(ANG_MIN);
  }
  // ni casi vertical eterna entre techo y caramelo duro: lo resuelve el desvío por rebotes
}
function girar(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
  b.vx = vx; b.vy = vy;
  if (Math.abs(b.vy) < VEL * SIN_MIN) b.vy = (b.vy >= 0 ? 1 : -1) * VEL * SIN_MIN;
}

function aterrizar(g, b) {
  b.vivo = false;
  if (b.temp) { if (!g.sinSonido) ev(g, { e: 'fundeTemp', x: b.x }); return; }
  const x = Math.max(R_BOLA + 2, Math.min(W - R_BOLA - 2, b.x));
  if (g.primeraX === null) { g.primeraX = x; ev(g, { e: 'primera', x }); }
  if (!g.sinSonido) ev(g, { e: 'vuelve', x });
}

function ladoDe(nx, ny) { return Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 1 : 3) : (ny > 0 ? 2 : 0); }

export function golpear(g, k, dmg, nx, ny, bola) {
  if (!k.vivo) return;
  if (k.tipo === 'irrompible') { k.f = 0.6; if (!g.sinSonido) ev(g, { e: 'duro', b: k }); return; }
  if (k.tipo === 'cascara' && bola && ladoDe(nx, ny) === k.lado) { k.f = 0.4; k.w = Math.max(k.w, 0.3); if (!g.sinSonido) ev(g, { e: 'blindado', b: k }); return; }
  k.hp -= dmg; k.tocado = true; k.w = 1; k.f = 1;
  g.cadena++; g.golpesTirada += dmg; if (g.cadena > g.cadenaMax) g.cadenaMax = g.cadena;
  if (k.hp <= 0) romper(g, k);
  else if (!g.sinSonido) ev(g, { e: 'golpe', b: k, cadena: g.cadena });
}

function romper(g, k) {
  k.vivo = false; k.hp = 0;
  const i = idx(k.c, k.r); if (i >= 0 && g.rej[i] === k) g.rej[i] = null;
  g.restantes--; g.rotos++; g.rotosTirada++;
  if (g.rotosTirada > g.rafagaMax) g.rafagaMax = g.rotosTirada;
  ev(g, { e: 'romper', b: k, cadena: g.cadena, ultimo: g.restantes === 0 });
  if (k.mej && k.r >= 0 && k.r < FILA_LIMITE) {
    const it = { c: k.c, r: k.r, k: k.mej, id: g.sigId++, vivo: true, usado: false, nace: 1 };
    g.items.push(it); g.rejI[idx(it.c, it.r)] = it;
    ev(g, { e: 'sueltaMejora', it });
  }
  if (k.tipo === 'explosivo') g.colaExpl.push({ c: k.c, r: k.r, dmg: Math.max(2, k.max), bomba: false });
  if (g.restantes <= 0) { g.estado = 'ganado'; ev(g, { e: 'ganar' }); }
}

function explosiones(g) {
  let guard = 0;
  while (g.colaExpl.length && guard++ < 200) {
    const x = g.colaExpl.shift();
    ev(g, { e: 'explosion', c: x.c, r: x.r, bomba: x.bomba });
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!x.bomba && dr === 0 && dc === 0) continue;
      const k = bloqueEn(g, x.c + dc, x.r + dr);
      if (k && k.vivo && k.r >= 0) golpear(g, k, x.dmg, 0, 0, null);
      if (g.estado === 'ganado') { g.colaExpl.length = 0; return; }
    }
  }
}

function tocarItems(g, b) {
  const c = Math.floor(b.x / CELL), r = Math.floor(b.y / CELL);
  let tocado = null;
  for (let dr = -1; dr <= 1 && !tocado; dr++) for (let dc = -1; dc <= 1; dc++) {
    const it = itemEn(g, c + dc, r + dr);
    if (!it || !it.vivo) continue;
    const ix = (it.c + 0.5) * CELL, iy = (it.r + 0.5) * CELL;
    const dx = b.x - ix, dy = b.y - iy, rr = R_ITEM + R_BOLA;
    if (dx * dx + dy * dy <= rr * rr) { tocado = it; break; }
  }
  if (!tocado) { b.ultItem = null; return; }
  if (b.ultItem === tocado) return;
  b.ultItem = tocado;
  usarItem(g, tocado, b);
}

export function usarItem(g, it, b) {
  const k = it.k;
  switch (k) {
    case 'extra': g.bolas++; quitarItem(g, it); break;
    case 'bomba': if (b) { b.bomba = 3; g.danoBomba = Math.max(2, Math.round(g.bolas / 4)); } quitarItem(g, it); break;
    case 'perfora': if (b) b.pierce = 5; quitarItem(g, it); break;
    case 'rebote': g.rebTirada = true; for (const o of g.activas) if (o.vivo && o.reb < 1) o.reb = 1; quitarItem(g, it); break;
    case 'congela': g.congelar = true; quitarItem(g, it); break;
    case 'divide':
      if (!b || b.temp) return;
      it.usado = true;
      for (const s of [-0.38, 0.38]) {
        if (g.activas.length >= MAX_BOLAS_EN_VUELO) break;
        const a = Math.atan2(b.vy, b.vx) + s;
        const nb = nuevaBola(g, b.x, b.y, a, true); nb.ultItem = it; nb.reb = b.reb;
        if (Math.abs(nb.vy) < VEL * SIN_MIN) nb.vy = (nb.vy >= 0 ? 1 : -1) * VEL * SIN_MIN;
      }
      break;
    case 'rayoH': case 'rayoV': {
      it.usado = true;
      for (const o of g.bloques) {
        if (!o.vivo || o.r < 0 || o.r >= FILA_LIMITE) continue;
        if (k === 'rayoH' ? o.r === it.r : o.c === it.c) golpear(g, o, 1, 0, 0, null);
        if (g.estado === 'ganado') break;
      }
      break;
    }
    default: break;
  }
  ev(g, { e: 'mejora', k, it, x: b ? b.x : (it.c + 0.5) * CELL, y: b ? b.y : (it.r + 0.5) * CELL });
}
function quitarItem(g, it) {
  it.vivo = false;
  const i = idx(it.c, it.r); if (i >= 0 && g.rejI[i] === it) g.rejI[i] = null;
}

// Recoger ya: todas las bolas en vuelo vuelven y la tirada termina.
export function recoger(g) {
  if (g.estado !== 'vuelo') return false;
  const quedaban = g.porLanzar;
  g.porLanzar = 0;
  for (const b of g.activas) if (b.vivo) { b.vivo = false; g.recogidas++; }
  g.activas.length = 0;
  ev(g, { e: 'recoger', quedaban });
  finTirada(g);
  return true;
}

function terminarVuelo(g) {
  for (const b of g.activas) b.vivo = false;
  g.activas.length = 0; g.porLanzar = 0;
}

function libre(g, c, r) { return c >= 0 && c < COLS && r >= 0 && r < FILA_LIMITE && !bloqueEn(g, c, r) && !itemEn(g, c, r); }

function finTirada(g) {
  if (g.estado === 'ganado' || g.estado === 'perdido') return;
  if (g.primeraX !== null) g.lanzX = g.primeraX;
  // las mejoras que duran la tirada y se han usado, desaparecen
  for (const it of g.items) if (it.vivo && it.usado && MEJORAS[it.k].persiste) quitarItem(g, it);
  const vis = g.bloques.filter((b) => b.vivo && b.r >= 0 && b.r < FILA_LIMITE);
  // gominolas que se rellenan si no se han tocado
  for (const b of vis) if (b.tipo === 'regen' && !b.tocado && b.hp < b.max) { b.hp = Math.min(b.max, b.hp + Math.ceil(b.max * 0.3)); b.w = 0.5; ev(g, { e: 'regenera', b }); }
  // gominolas que se desplazan un paso
  for (const b of vis.filter((x) => x.tipo === 'movil').sort((a, c) => a.r - c.r || a.c - c.c)) {
    for (let intento = 0; intento < 2; intento++) {
      const nc = b.c + b.dir;
      if (libre(g, nc, b.r)) { g.rej[idx(b.c, b.r)] = null; b.c = nc; poligono(b); g.rej[idx(b.c, b.r)] = b; ev(g, { e: 'mueve', b }); break; }
      b.dir = -b.dir;
    }
  }
  // brotes: crean una gominola nueva al lado
  for (const b of vis.filter((x) => x.tipo === 'brote' && x.cargas > 0 && x.vivo)) {
    const cand = [[b.c, b.r - 1], [b.c - 1, b.r], [b.c + 1, b.r]].filter(([c, r]) => libre(g, c, r));
    if (!cand.length) continue;
    const [c, r] = cand[Math.floor(azar(g) * cand.length)];
    const nb = { c, r, hp: Math.max(1, Math.ceil(b.max * 0.5)), tipo: 'base', forma: 'cuad', o: 0, id: g.sigId++, vivo: true, tocado: false, w: 0.8, f: 0, nace: 1 };
    nb.max = nb.hp; poligono(nb);
    g.bloques.push(nb); g.rej[idx(c, r)] = nb; g.total++; g.restantes++; b.cargas--;
    ev(g, { e: 'brote', b: nb });
  }
  for (const b of g.bloques) b.tocado = false;
  // bajar una fila (salvo congelado)
  if (g.congelar) { g.congelar = false; ev(g, { e: 'congelado' }); }
  else {
    for (const b of g.bloques) if (b.vivo) { b.r++; poligono(b); }
    for (const it of g.items) if (it.vivo) it.r++;
    reindexar(g);
    ev(g, { e: 'desciende' });
  }
  // lo que llega a la línea: las +1 se recogen solas, las demás mejoras y el azúcar cande se deshacen
  for (const it of g.items) if (it.vivo && it.r >= FILA_LIMITE) { if (it.k === 'extra') { g.bolas++; ev(g, { e: 'mejora', k: 'extra', it, x: (it.c + 0.5) * CELL, y: SUELO - 40, sola: true }); } quitarItem(g, it); }
  for (const b of g.bloques) if (b.vivo && b.tipo === 'irrompible' && b.r >= FILA_LIMITE) { b.vivo = false; const i = idx(b.c, b.r); if (i >= 0) g.rej[i] = null; ev(g, { e: 'derrite', b }); }
  g.items = g.items.filter((it) => it.vivo);
  if (g.bloques.length > 400) g.bloques = g.bloques.filter((b) => b.vivo);
  let peligro = false;
  for (const b of g.bloques) {
    if (!b.vivo || b.tipo === 'irrompible') continue;
    if (b.r >= FILA_LIMITE) { g.estado = 'perdido'; ev(g, { e: 'perder', b }); return; }
    if (b.r === FILA_LIMITE - 1) peligro = true;
  }
  if (peligro) ev(g, { e: 'peligro' });
  g.estado = 'apuntar';
  ev(g, { e: 'finTirada', rotos: g.rotosTirada, golpes: g.golpesTirada });
}

// ---------- utilidades para la guía y el bot ----------
// Primer contacto del disparo con ángulo a desde el punto de lanzamiento: hasta dónde se dibuja la guía.
export function trazarGuia(g, a) {
  a = limitarAngulo(a);
  const r = R_BOLA, x0 = g.lanzX, y0 = SUELO - r - 0.5;
  const dx = Math.cos(a) * 3000, dy = Math.sin(a) * 3000;
  let tMin = 1, nx = 0, ny = 0;
  if (dx < 0) { const t = (r - x0) / dx; if (t < tMin) { tMin = t; nx = 1; ny = 0; } }
  if (dx > 0) { const t = (W - r - x0) / dx; if (t < tMin) { tMin = t; nx = -1; ny = 0; } }
  if (dy < 0) { const t = (r - y0) / dy; if (t < tMin) { tMin = t; nx = 0; ny = 1; } }
  for (const b of g.bloques) {
    if (!b.vivo || b.r < 0 || b.r >= FILA_LIMITE + 1) continue;
    if (barrer(x0, y0, dx, dy, b, r) && choque.t < tMin) { tMin = choque.t; nx = choque.nx; ny = choque.ny; }
  }
  const x1 = x0 + dx * tMin, y1 = y0 + dy * tMin;
  const vx = Math.cos(a), vy = Math.sin(a), d = vx * nx + vy * ny;
  return { x0, y0, x1, y1, rx: vx - 2 * d * nx, ry: vy - 2 * d * ny, a };
}

export function clonar(g) {
  const c = { ...g, eventos: [], colaExpl: [], activas: [], rej: new Array(g.rej.length).fill(null), rejI: new Array(g.rejI.length).fill(null) };
  c.bloques = g.bloques.filter((b) => b.vivo).map((b) => ({ ...b, v: b.v.slice(), n: b.n.slice() }));
  c.items = g.items.filter((i) => i.vivo).map((i) => ({ ...i }));
  reindexar(c);
  return c;
}

// Simula una tirada completa con el ángulo a (sin eventos). Devuelve el estado resultante.
export function simularTirada(g, a, maxT = 30) {
  const c = clonar(g);
  c.sinSonido = true;
  lanzar(c, a);
  let t = 0;
  while (c.estado === 'vuelo') {
    paso(c, PASO); t += PASO;
    c.eventos.length = 0;
    if (t > maxT) recoger(c);
  }
  return c;
}

// Elige el mejor ángulo de un abanico de candidatos (bot de verificación y demo de la portada).
export function angulosCandidatos(n = 25) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(-Math.PI + ANG_MIN + (Math.PI - 2 * ANG_MIN) * (i / (n - 1)));
  return out;
}
export function valorar(c) {
  if (c.estado === 'ganado') return 1e9 - c.tiradas * 1000;
  if (c.estado === 'perdido') return -1e9;
  let v = c.golpesTirada + c.rotosTirada * 6 + c.bolas * 4;
  for (const b of c.bloques) {
    if (!b.vivo || b.tipo === 'irrompible') continue;
    const fila = b.r;
    if (fila >= 5) v -= (fila - 4) * (fila - 4) * 3 * Math.min(b.hp, 40);
  }
  return v;
}
export function mejorAngulo(g, n = 25, maxT = 30) {
  let mejor = -Infinity, ang = -Math.PI / 2;
  for (const a of angulosCandidatos(n)) {
    const c = simularTirada(g, a, maxT);
    const v = valorar(c);
    if (v > mejor) { mejor = v; ang = a; }
  }
  return ang;
}

export function estrellasDe(g) {
  const nv = g.nivel;
  return g.tiradas <= nv.t3 ? 3 : g.tiradas <= nv.t2 ? 2 : 1;
}
