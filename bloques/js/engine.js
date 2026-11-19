// Vitraluz — motor de juego puro (sin DOM ni sonido): estado, física y reglas.
// Avanza a paso fijo y deja en `eventos` lo que ha pasado para que la capa visual y sonora reaccione.
// Al no depender del navegador, la verificación en Node juega aquí los 100 niveles con un bot.

import { W, H, COLS, CW, CH, OX, OY } from './levels.js';
import { VIDAS_INICIALES, VIDAS_MAXIMAS } from './config.js';

export const PASO = 1 / 120;          // paso fijo de simulación (s)
export const RADIO = 9;               // radio de la bola
export const PALA_Y = 930, PALA_ALTO = 16;
export const ESCUDO_Y = 978;
const MAX_BOLAS = 24;
const AVANCE_MAX = 4;                 // px por subpaso: la bola nunca salta un cristal (30 px de alto)
const MIN_VERTICAL = 0.3;             // |dy| mínimo de la dirección (≈17° sobre la horizontal)
const ANG_MAX = Math.PI / 3;          // ±60° al salir de la pala
const COMBO_SEG = 1.7;

// Mejoras: duración en segundos (0 = instantánea), si es penalización y desde qué nivel aparece.
export const MEJORAS = {
  multi:    { dur: 0,  mala: false, desde: 1,  peso: 14 },
  ancha:    { dur: 18, mala: false, desde: 1,  peso: 12 },
  bomba:    { dur: 10, mala: false, desde: 2,  peso: 12 },
  lenta:    { dur: 10, mala: false, desde: 3,  peso: 9 },
  escudo:   { dur: 14, mala: false, desde: 5,  peso: 9 },
  laser:    { dur: 8,  mala: false, desde: 7,  peso: 10 },
  perfora:  { dur: 7,  mala: false, desde: 9,  peso: 9 },
  iman:     { dur: 14, mala: false, desde: 12, peso: 7 },
  vida:     { dur: 0,  mala: false, desde: 15, peso: 3 },
  estrecha: { dur: 10, mala: true,  desde: 6,  peso: 10 },
  rapida:   { dur: 8,  mala: true,  desde: 13, peso: 10 },
};
export const ORDEN_MEJORAS = Object.keys(MEJORAS);

export function crearPartida(nivel, opciones = {}) {
  const rng = opciones.rng || Math.random;
  const g = {
    nivel, rng,
    t: 0, tJuego: 0,
    estado: 'listo',                  // listo · jugando · ganado · perdido
    vidas: opciones.vidas || VIDAS_INICIALES,
    vidasPerdidas: 0,
    puntos: 0, combo: 0, comboT: 0, comboMax: 0,
    rotos: 0, recogidas: 0,
    pala: { x: W / 2, w: nivel.pala * (opciones.ayuda ? 1.12 : 1), base: nivel.pala * (opciones.ayuda ? 1.12 : 1), objetivo: nivel.pala },
    bolas: [], capsulas: [], disparos: [], explosiones: [],
    ef: {},                           // efectos activos: nombre → segundos restantes
    efMax: {},
    bloques: [], rejilla: new Map(), moviles: [],
    restantes: 0, llaves: 0,
    offY: 0, velBase: nivel.velocidad, golpes: 0,
    tUltimoDanio: 0, tUltimoDesvio: 0, tUltimaAyuda: 0, tLaser: 0,
    reboteSinPala: 0,
    eventos: [],
  };
  g.pala.w = g.pala.base; g.pala.objetivo = g.pala.base;
  for (const d of nivel.bloques) {
    const b = {
      c: d.c, r: d.r, type: d.type, hp: d.hp, hpMax: d.hp, color: d.color, drop: !!d.drop, mv: !!d.mv,
      fase: d.fase || 0, vivo: true, x: OX + d.c * CW, y: OY + d.r * CH, w: CW, h: CH, golpeT: -9, solido: true,
    };
    if (b.mv) { b.fila = nivel.filasMoviles.find((f) => f.r === d.r); b.x0 = b.x; g.moviles.push(b); }
    else g.rejilla.set(b.r * COLS + b.c, b);
    if (b.type !== 'u') g.restantes++;
    if (b.type === 'k') g.llaves++;
    g.bloques.push(b);
  }
  g.total = g.restantes;
  nuevaBolaPegada(g);
  return g;
}

function nuevaBolaPegada(g) {
  g.bolas.push({ x: g.pala.x, y: PALA_Y - RADIO, dx: 0, dy: -1, pegada: true, off: 0, tPegada: 0, inicial: true });
}

export function lanzar(g) {
  let alguna = false;
  for (const b of g.bolas) {
    if (!b.pegada) continue;
    const rel = Math.max(-1, Math.min(1, b.off / (g.pala.w / 2)));
    const ang = b.inicial ? (g.rng() - 0.5) * 0.5 : rel * ANG_MAX;
    b.dx = Math.sin(ang); b.dy = -Math.cos(ang); b.pegada = false; b.inicial = false;
    alguna = true;
  }
  if (alguna) {
    if (g.estado === 'listo') { g.estado = 'jugando'; g.tUltimoDanio = g.t; }
    g.eventos.push({ e: 'lanzar' });
  }
  return alguna;
}

export function moverPala(g, x) {
  const m = g.pala.w / 2;
  g.pala.x = Math.max(m, Math.min(W - m, x));
}

export function velocidadActual(g) {
  // sube un poco con cada rotura (techo +32 %) y se ajusta con las mejoras de bola lenta o rápida
  let v = g.velBase * (1 + Math.min(0.32, g.golpes * 0.006));
  if (g.ef.lenta > 0) v *= 0.7;
  if (g.ef.rapida > 0) v *= 1.28;
  return v;
}

export function esSolido(g, b) {
  if (!b.vivo) return false;
  if (b.type === 'g') return ((g.t + b.fase) % 4.2) < 2.9;
  return true;
}

function posicionar(g) {
  for (const f of g.nivel.filasMoviles) f.off = Math.sin(g.t * f.vel + f.fase) * f.amp;
  for (const b of g.moviles) { b.x = b.x0 + b.fila.off; b.y = OY + b.r * CH + g.offY; }
  if (g.offY !== g.offPrev) { g.offPrev = g.offY; for (const b of g.bloques) if (!b.mv) b.y = OY + b.r * CH + g.offY; }
}

// ---------- paso de simulación ----------
export function paso(g, dt = PASO) {
  g.t += dt;
  if (g.estado === 'jugando') g.tJuego += dt;

  // descenso de la vidriera
  if (g.nivel.descenso && g.estado === 'jugando') {
    const d = g.nivel.descenso;
    const meta = Math.min(d.max, Math.floor(g.tJuego / d.cada)) * CH;
    if (g.offY < meta) { const antes = g.offY; g.offY = Math.min(meta, g.offY + 40 * dt); if (antes === Math.floor(antes / CH) * CH && g.offY > antes) g.eventos.push({ e: 'desciende' }); }
  }
  posicionar(g);

  // efectos con duración
  for (const k in g.ef) {
    if (g.ef[k] > 0) { g.ef[k] -= dt; if (g.ef[k] <= 0) { g.ef[k] = 0; g.eventos.push({ e: 'finEfecto', k }); } }
  }
  g.pala.objetivo = g.pala.base * (g.ef.ancha > 0 ? 1.5 : 1) * (g.ef.estrecha > 0 ? 0.68 : 1);
  g.pala.w += (g.pala.objetivo - g.pala.w) * Math.min(1, dt * 12);
  moverPala(g, g.pala.x);

  // combo
  if (g.combo > 0) { g.comboT -= dt; if (g.comboT <= 0) { g.eventos.push({ e: 'finCombo', n: g.combo }); g.combo = 0; } }

  // explosiones en cola (reacción en cadena con un pequeño retardo)
  for (let i = g.explosiones.length - 1; i >= 0; i--) {
    const ex = g.explosiones[i];
    if (g.t >= ex.t) { g.explosiones.splice(i, 1); explotar(g, ex.x, ex.y, ex.dmg, ex.rx, ex.ry); }
  }

  // láser
  if (g.ef.laser > 0 && g.estado === 'jugando') {
    g.tLaser -= dt;
    if (g.tLaser <= 0) {
      g.tLaser = 0.34;
      g.disparos.push({ x: g.pala.x - g.pala.w / 2 + 8, y: PALA_Y - 4 }, { x: g.pala.x + g.pala.w / 2 - 8, y: PALA_Y - 4 });
      g.eventos.push({ e: 'laser' });
    }
  }
  for (let i = g.disparos.length - 1; i >= 0; i--) {
    const s = g.disparos[i];
    s.y -= 980 * dt;
    const b = bloqueEn(g, s.x, s.y);
    if (b) { danar(g, b, 1, 'laser'); g.disparos.splice(i, 1); }
    else if (s.y < 0) g.disparos.splice(i, 1);
  }

  // cápsulas
  const px0 = g.pala.x - g.pala.w / 2 - 6, px1 = g.pala.x + g.pala.w / 2 + 6;
  for (let i = g.capsulas.length - 1; i >= 0; i--) {
    const c = g.capsulas[i];
    c.y += 185 * dt; c.giro += dt;
    if (c.y + 14 >= PALA_Y && c.y - 14 <= PALA_Y + PALA_ALTO && c.x >= px0 - 12 && c.x <= px1 + 12 && g.estado !== 'perdido') {
      g.capsulas.splice(i, 1); aplicarMejora(g, c.k, c.x, c.y);
    } else if (c.y > H + 30) g.capsulas.splice(i, 1);
  }

  // bolas
  const v = velocidadActual(g);
  for (let i = g.bolas.length - 1; i >= 0; i--) {
    const b = g.bolas[i];
    if (b.pegada) {
      b.x = g.pala.x + b.off; b.y = PALA_Y - RADIO;
      b.x = Math.max(RADIO, Math.min(W - RADIO, b.x));
      if (!b.inicial) { b.tPegada += dt; if (b.tPegada > 1.6) lanzar(g); }
      continue;
    }
    let resto = v * dt;
    let vivo = true;
    while (resto > 0 && vivo) {
      const d = Math.min(AVANCE_MAX, resto); resto -= d;
      b.x += b.dx * d; b.y += b.dy * d;
      vivo = colisiones(g, b);
    }
    if (!vivo) g.bolas.splice(i, 1);
  }

  if (g.estado === 'jugando') {
    // guía en el tramo final: con 3 cristales o menos, la bola que sube se inclina un poco hacia ellos
    if (g.restantes > 0 && (g.restantes <= 3 || g.t - g.tUltimoDanio > 10)) guiar(g, dt);

    // atascos: si pasa mucho sin romper nada, desvío automático; si sigue, cae una ayuda
    const sin = g.t - g.tUltimoDanio;
    if (sin > 8 && g.t - g.tUltimoDesvio > 5) {
      g.tUltimoDesvio = g.t;
      for (const b of g.bolas) if (!b.pegada) girar(b, (g.rng() < 0.5 ? -1 : 1) * (0.2 + g.rng() * 0.35));
      g.eventos.push({ e: 'desvio' });
    }
    if (sin > 20 && g.t - g.tUltimaAyuda > 20 && g.capsulas.length < 3) {
      g.tUltimaAyuda = g.t;
      const k = g.nivel.n >= 7 ? 'laser' : 'multi';
      g.capsulas.push({ x: 120 + g.rng() * (W - 240), y: 40, k, giro: 0 });
      g.eventos.push({ e: 'ayuda', k });
    }

    if (g.restantes <= 0) { g.estado = 'ganado'; g.eventos.push({ e: 'ganar' }); }
    else if (g.bolas.length === 0) perderVida(g);
  }
}

function girar(b, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = b.dx * c - b.dy * s, dy = b.dx * s + b.dy * c;
  b.dx = dx; b.dy = dy; normalizar(b);
}
function normalizar(b) {
  let m = Math.hypot(b.dx, b.dy) || 1;
  b.dx /= m; b.dy /= m;
  if (Math.abs(b.dy) < MIN_VERTICAL) {
    b.dy = (b.dy < 0 ? -1 : 1) * MIN_VERTICAL;
    b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - MIN_VERTICAL * MIN_VERTICAL);
  }
}

function guiar(g, dt) {
  for (const b of g.bolas) {
    if (b.pegada || b.y > 700) continue;
    // candidatos: los cristales rompibles más cercanos; se elige el primero con línea de visión libre
    const cand = [];
    for (const q of g.bloques) {
      if (!q.vivo || q.type === 'u' || (q.type === 'l' && g.llaves > 0)) continue;
      const oy = q.y + q.h / 2;
      if ((b.dy < 0 && oy > b.y) || (b.dy > 0 && oy < b.y)) continue;      // solo los que tiene por delante
      cand.push([Math.abs(q.x + q.w / 2 - b.x) + Math.abs(oy - b.y), q]);
    }
    cand.sort((a, c) => a[0] - c[0]);
    for (let i = 0; i < Math.min(5, cand.length); i++) {
      const q = cand[i][1];
      const tx = q.x + q.w / 2 - b.x, ty = q.y + q.h / 2 - b.y, m = Math.hypot(tx, ty) || 1;
      let libre = true;
      for (let d = 14; d < m - 14 && libre; d += 14) {
        const o = bloqueEn(g, b.x + tx / m * d, b.y + ty / m * d);
        if (o && o !== q && (o.type === 'u' || (o.type === 'l' && g.llaves > 0))) libre = false;
      }
      if (!libre) continue;
      const k = Math.min(1, dt * 1.3);               // giro suave: se nota como ayuda, no como imán
      b.dx += (tx / m - b.dx) * k; b.dy += (ty / m - b.dy) * k; normalizar(b);
      break;
    }
  }
}

function perderVida(g) {
  g.vidas--; g.vidasPerdidas++;
  g.ef = {}; g.capsulas.length = 0; g.disparos.length = 0;
  g.combo = 0;
  g.pala.objetivo = g.pala.base;
  if (g.vidas <= 0) { g.estado = 'perdido'; g.eventos.push({ e: 'vidaPerdida', vidas: 0 }, { e: 'perder' }); return; }
  g.estado = 'listo';
  g.eventos.push({ e: 'vidaPerdida', vidas: g.vidas });
  nuevaBolaPegada(g);
}

function bloqueEn(g, x, y) {
  const c = Math.floor((x - OX) / CW), r = Math.floor((y - g.offY - OY) / CH);
  if (c >= 0 && c < COLS && r >= 0) {
    const b = g.rejilla.get(r * COLS + c);
    if (b && esSolido(g, b)) return b;
  }
  for (const b of g.moviles) if (b.vivo && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

function fijoEn(g, c, r) {
  if (c < 0 || c >= COLS || r < 0) return null;
  const b = g.rejilla.get(r * COLS + c);
  return b && esSolido(g, b) ? b : null;
}

// Devuelve false si la bola se ha perdido por abajo.
function colisiones(g, b) {
  // paredes
  if (b.x < RADIO) { b.x = RADIO; b.dx = Math.abs(b.dx); g.eventos.push({ e: 'pared', x: 0, y: b.y }); b.rebotes = (b.rebotes || 0) + 1; }
  else if (b.x > W - RADIO) { b.x = W - RADIO; b.dx = -Math.abs(b.dx); g.eventos.push({ e: 'pared', x: W, y: b.y }); b.rebotes = (b.rebotes || 0) + 1; }
  if (b.y < RADIO) { b.y = RADIO; b.dy = Math.abs(b.dy); g.eventos.push({ e: 'pared', x: b.x, y: 0 }); b.rebotes = (b.rebotes || 0) + 1; }

  // tras muchos rebotes seguidos sin tocar la pala ni romper nada, corrige el ángulo unos grados
  if (b.rebotes >= 10) { b.rebotes = 0; girar(b, (g.rng() < 0.5 ? -1 : 1) * 0.17); }

  // pala (la zona de contacto es algo más ancha que su dibujo)
  if (b.dy > 0 && b.y + RADIO >= PALA_Y && b.y < PALA_Y + PALA_ALTO * 0.75) {
    const m = g.pala.w / 2 + g.pala.w * 0.06 + RADIO * 0.6;
    const rel = (b.x - g.pala.x) / m;
    if (rel >= -1 && rel <= 1) {
      const ang = rel * ANG_MAX;
      b.dx = Math.sin(ang); b.dy = -Math.cos(ang); normalizar(b);
      b.y = PALA_Y - RADIO; b.rebotes = 0;
      if (g.ef.iman > 0 && g.estado === 'jugando') { b.pegada = true; b.off = b.x - g.pala.x; b.tPegada = 0; }
      g.eventos.push({ e: 'pala', x: b.x, rel });
      return true;
    }
  }
  // escudo inferior
  if (g.ef.escudo > 0 && b.dy > 0 && b.y + RADIO >= ESCUDO_Y) {
    b.y = ESCUDO_Y - RADIO; b.dy = -Math.abs(b.dy); b.rebotes = 0;
    g.eventos.push({ e: 'escudo', x: b.x });
    return true;
  }
  if (b.y > H + RADIO * 2) return g.estado === 'ganado' ? (b.dy = -Math.abs(b.dy), b.y = H, true) : false;

  // cristales: se busca el contacto más profundo entre los candidatos cercanos
  let mejor = null, mejorPen = 0, mnx = 0, mny = 0;
  const probar = (q) => {
    const cxp = Math.max(q.x, Math.min(b.x, q.x + q.w)), cyp = Math.max(q.y, Math.min(b.y, q.y + q.h));
    let dx = b.x - cxp, dy = b.y - cyp;
    const d2 = dx * dx + dy * dy;
    if (d2 >= RADIO * RADIO) return;
    let pen, nx, ny;
    if (d2 === 0) { // centro dentro del bloque: salir por la cara más cercana
      const izq = b.x - q.x, der = q.x + q.w - b.x, arr = b.y - q.y, aba = q.y + q.h - b.y;
      const mn = Math.min(izq, der, arr, aba);
      if (mn === izq) { nx = -1; ny = 0; } else if (mn === der) { nx = 1; ny = 0; } else if (mn === arr) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
      pen = mn + RADIO;
    } else {
      const d = Math.sqrt(d2); pen = RADIO - d; nx = dx / d; ny = dy / d;
      if (nx !== 0 && ny !== 0 && !q.mv) {
        // esquina: si el vecino de ese lado existe, la junta entre dos cristales cuenta como cara plana
        const vx = fijoEn(g, q.c + (nx > 0 ? 1 : -1), q.r), vy = fijoEn(g, q.c, q.r + (ny > 0 ? 1 : -1));
        if (vx && !vy) { nx = 0; ny = ny > 0 ? 1 : -1; }
        else if (vy && !vx) { ny = 0; nx = nx > 0 ? 1 : -1; }
      }
    }
    if (pen > mejorPen) { mejorPen = pen; mejor = q; mnx = nx; mny = ny; }
  };
  const yy = b.y - g.offY;
  const c0 = Math.floor((b.x - RADIO - OX) / CW), c1 = Math.floor((b.x + RADIO - OX) / CW);
  const r0 = Math.floor((yy - RADIO - OY) / CH), r1 = Math.floor((yy + RADIO - OY) / CH);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (c < 0 || c >= COLS || r < 0) continue;
    const q = g.rejilla.get(r * COLS + c);
    if (q && esSolido(g, q)) { q.y = OY + q.r * CH + g.offY; probar(q); }
  }
  for (const q of g.moviles) if (q.vivo && Math.abs(q.y + q.h / 2 - b.y) < CH && Math.abs(q.x + q.w / 2 - b.x) < CW) probar(q);

  if (mejor) {
    const q = mejor;
    const rompible = q.type !== 'u' && !(q.type === 'l' && g.llaves > 0);
    const atraviesa = g.ef.perfora > 0 && rompible;
    if (g.ef.bomba > 0) {
      g.explosiones.push({ t: g.t, x: q.x + q.w / 2, y: q.y + q.h / 2, dmg: 2, rx: CW * 1.55, ry: CH * 1.6 });
    }
    if (atraviesa) {
      if (q !== b.ultimo) { danar(g, q, 3, 'bola'); b.ultimo = q; }
    } else {
      b.x += mnx * mejorPen; b.y += mny * mejorPen;
      const p = b.dx * mnx + b.dy * mny;
      if (p < 0) { b.dx -= 2 * p * mnx; b.dy -= 2 * p * mny; normalizar(b); }
      danar(g, q, 1, 'bola');
      if (!rompible) b.rebotes = (b.rebotes || 0) + 1; else b.rebotes = 0;
    }
  }
  return true;
}

function danar(g, q, dmg, causa) {
  if (!q.vivo) return false;
  q.golpeT = g.t;
  const px = q.x + q.w / 2, py = q.y + q.h / 2;
  if (q.type === 'u') { g.eventos.push({ e: 'plomo', x: px, y: py }); return false; }
  if (q.type === 'l' && g.llaves > 0) { g.eventos.push({ e: 'sellado', x: px, y: py }); return false; }
  g.tUltimoDanio = g.t;
  q.hp -= dmg;
  if (q.hp > 0) { g.eventos.push({ e: 'grieta', x: px, y: py, color: q.color, hp: q.hp, b: q }); return true; }
  q.vivo = false; g.restantes--; g.rotos++; g.golpes++;
  g.combo++; g.comboT = COMBO_SEG; if (g.combo > g.comboMax) g.comboMax = g.combo;
  const mult = multiplicador(g.combo);
  const base = q.type === 'x' ? 20 : q.type === 'k' ? 30 : q.type === 'g' ? 20 : q.type === 'l' ? 15 : 10 * q.hpMax;
  const pts = Math.round(base * mult);
  g.puntos += pts;
  g.eventos.push({ e: 'romper', x: px, y: py, color: q.color, tipo: q.type, pts, combo: g.combo, mult, causa, c: q.c, r: q.r, mv: q.mv, b: q, ultimo: g.restantes === 0 });
  if (q.type === 'x') g.explosiones.push({ t: g.t + 0.075, x: px, y: py, dmg: 3, rx: CW * 1.55, ry: CH * 1.6 });
  if (q.type === 'k') { g.llaves--; if (g.llaves === 0) g.eventos.push({ e: 'abrirSellos' }); }
  if (g.restantes > 0 && g.capsulas.length < 4 && (q.drop || g.rng() < 0.035)) soltar(g, px, py);
  return true;
}

export function multiplicador(combo) { return 1 + Math.min(8, Math.floor(combo / 4)) * 0.5; }

function explotar(g, x, y, dmg, rx, ry) {
  g.eventos.push({ e: 'explosion', x, y });
  for (const q of g.bloques) {
    if (!q.vivo) continue;
    if (!q.mv) q.y = OY + q.r * CH + g.offY;
    if (Math.abs(q.x + q.w / 2 - x) <= rx && Math.abs(q.y + q.h / 2 - y) <= ry) {
      if (q.type === 'u' || (q.type === 'l' && g.llaves > 0)) continue;
      danar(g, q, dmg, 'explosion');
    }
  }
}

function soltar(g, x, y) {
  const n = g.nivel.n;
  let total = 0; const op = [];
  for (const k of ORDEN_MEJORAS) {
    const m = MEJORAS[k];
    if (n < m.desde) continue;
    if (k === 'vida' && g.vidas >= VIDAS_MAXIMAS) continue;
    if (k === 'multi' && g.bolas.length >= MAX_BOLAS / 2) continue;
    const peso = m.mala ? m.peso * g.nivel.malas * 3.2 : m.peso;
    total += peso; op.push([k, peso]);
  }
  let r = g.rng() * total, k = op[0][0];
  for (const [kk, p] of op) { r -= p; if (r <= 0) { k = kk; break; } }
  g.capsulas.push({ x: Math.max(24, Math.min(W - 24, x)), y, k, giro: 0 });
  g.eventos.push({ e: 'capsula', k, x, y });
}

export function aplicarMejora(g, k, x = g.pala.x, y = PALA_Y) {
  const m = MEJORAS[k];
  g.recogidas++;
  if (m.dur > 0) { g.ef[k] = m.dur; g.efMax[k] = m.dur; }
  if (k === 'ancha') g.ef.estrecha = 0;
  if (k === 'estrecha') g.ef.ancha = 0;
  if (k === 'lenta') g.ef.rapida = 0;
  if (k === 'rapida') g.ef.lenta = 0;
  if (k === 'vida') g.vidas = Math.min(VIDAS_MAXIMAS, g.vidas + 1);
  if (k === 'laser') g.tLaser = 0.1;
  if (k === 'multi') {
    const nuevas = [];
    for (const b of g.bolas) {
      if (g.bolas.length + nuevas.length >= MAX_BOLAS) break;
      for (const a of [-0.45, 0.45]) {
        if (g.bolas.length + nuevas.length >= MAX_BOLAS) break;
        const n = { x: b.x, y: b.y, dx: b.dx, dy: b.pegada ? -1 : b.dy, pegada: false, off: 0, tPegada: 0 };
        if (b.pegada) n.dx = 0;
        girar(n, a); nuevas.push(n);
      }
    }
    g.bolas.push(...nuevas);
    if (g.estado === 'listo') { /* las nuevas salen ya; la pegada espera al jugador */ g.estado = 'jugando'; g.tUltimoDanio = g.t; }
  }
  g.puntos += m.mala ? 0 : 25;
  g.eventos.push({ e: 'mejora', k, x, y, mala: m.mala });
}

// Estrellas: 3 sin perder vidas, 2 perdiendo una, 1 en otro caso.
export function estrellasDe(g) { return g.vidasPerdidas === 0 ? 3 : g.vidasPerdidas === 1 ? 2 : 1; }
// Puntuación final: lo conseguido + premio por vidas conservadas y por rapidez.
export function puntuacionFinal(g) {
  const porVidas = g.vidas * 150;
  const porTiempo = Math.max(0, Math.round((240 - g.tJuego) * 2));
  return { total: g.puntos + porVidas + porTiempo, porVidas, porTiempo };
}

// ---------- bot de pruebas ----------
// Predice dónde caerá la bola más urgente y lleva allí la pala (con velocidad limitada, como una mano).
export function crearBot(opciones = {}) {
  const velMax = opciones.velMax || 1500;     // px/s
  const error = opciones.error ?? 10;         // px de imprecisión
  let desvio = 0, tCambio = 0;
  return function bot(g, dt) {
    if (g.t > tCambio) { tCambio = g.t + 0.5 + g.rng() * 0.8; desvio = (g.rng() - 0.5) * g.pala.w * 0.7 + (g.rng() - 0.5) * error; }
    let objetivo = null, urg = 1e9;
    const v = velocidadActual(g);
    for (const b of g.bolas) {
      if (b.pegada) continue;
      if (b.dy <= 0) continue;
      const tLleg = (PALA_Y - RADIO - b.y) / (b.dy * v);
      if (tLleg < 0 || tLleg >= urg) continue;
      let x = b.x + b.dx * v * tLleg;
      const ancho = W - 2 * RADIO; x -= RADIO;
      x = ((x % (2 * ancho)) + 2 * ancho) % (2 * ancho); if (x > ancho) x = 2 * ancho - x; x += RADIO;
      urg = tLleg; objetivo = x;
    }
    if (objetivo === null || urg > 0.9) {
      // sin urgencia: ir a por una cápsula buena, o seguir a la bola más baja
      let cap = null;
      for (const c of g.capsulas) if (!MEJORAS[c.k].mala && (!cap || c.y > cap.y)) cap = c;
      if (cap && (objetivo === null || urg > (PALA_Y - cap.y) / 185 + 0.25)) objetivo = cap.x - desvio;
      else if (objetivo === null) { let baja = null; for (const b of g.bolas) if (!b.pegada && (!baja || b.y > baja.y)) baja = b; objetivo = baja ? baja.x : g.pala.x; }
    }
    const meta = objetivo + desvio;
    const paso = velMax * dt;
    const d = meta - g.pala.x;
    moverPala(g, g.pala.x + Math.max(-paso, Math.min(paso, d)));
    if (g.bolas.some((b) => b.pegada) && (g.estado === 'listo' || g.rng() < 0.05)) lanzar(g);
  };
}
