// Geometría y pintado del QR. La matriz la calcula qrcode-generator; aquí se
// decide la forma de cada módulo y se pinta igual en canvas (Path2D) y en SVG.
import qrcode from '../vendor/qrcode-generator.mjs';

// La librería trunca a Latin-1 por defecto: se sustituye por UTF-8 real.
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

export const MARGEN = 4; // zona de silencio, en módulos

/** Devuelve {n, m[r][c]} o lanza si el texto no cabe. */
export function matriz(texto, nivel) {
  const q = qrcode(0, nivel);
  q.addData(texto, 'Byte');
  q.make();
  const n = q.getModuleCount();
  const m = [];
  for (let r = 0; r < n; r++) { const fila = []; for (let c = 0; c < n; c++) fila.push(q.isDark(r, c)); m.push(fila); }
  return { n, m };
}

const f = (x) => +x.toFixed(3);
/** Rectángulo con radio propio en cada esquina (tl, tr, br, bl). */
function rr(x, y, w, hh, tl, trr, br, bl) {
  return `M${f(x + tl)} ${f(y)}H${f(x + w - trr)}${trr ? `a${trr} ${trr} 0 0 1 ${trr} ${trr}` : ''}V${f(y + hh - br)}${br ? `a${br} ${br} 0 0 1 ${-br} ${br}` : ''}H${f(x + bl)}${bl ? `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}` : ''}V${f(y + tl)}${tl ? `a${tl} ${tl} 0 0 1 ${tl} ${-tl}` : ''}Z`;
}
const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * Calcula los trazados. op: { puntos, marco, centro, logo: {frac, forma}|null }
 * Devuelve { n, total, puntos, marcos, centros, placa } con coordenadas en módulos.
 */
export function geometria({ n, m }, op) {
  const esBuscador = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // Placa del logo: centrada en la rejilla, con la misma paridad que n.
  let placa = null;
  if (op.logo) {
    let s = Math.max(3, Math.floor(n * op.logo.frac));
    if ((n - s) % 2) s += 1;
    const o = (n - s) / 2;
    placa = { x: o, y: o, s, forma: op.logo.forma };
  }
  const enPlaca = (r, c) => {
    if (!placa) return false;
    if (placa.forma === 'redondo') {
      const R = placa.s / 2, cx = placa.x + R, cy = placa.y + R;
      const dx = Math.max(c - cx, 0, cx - (c + 1)), dy = Math.max(r - cy, 0, cy - (r + 1));
      return dx * dx + dy * dy < R * R;
    }
    return c >= placa.x && c < placa.x + placa.s && r >= placa.y && r < placa.y + placa.s;
  };
  // Patrones de alineación (los cuadraditos interiores): se pintan siempre rectos
  // y macizos, porque los lectores los usan para corregir la perspectiva.
  const ver = (n - 17) / 4;
  const ejes = [];
  if (ver >= 2) {
    const num = Math.floor(ver / 7) + 2;
    const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
    ejes.push(6);
    for (let pos = ver * 4 + 10; ejes.length < num; pos -= paso) ejes.splice(1, 0, pos);
  }
  const esAlineacion = (r, c) => ejes.some((y) => Math.abs(r - y) <= 2 && ejes.some((x) => Math.abs(c - x) <= 2 && !esBuscador(y, x)));
  const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && m[r][c] && !esBuscador(r, c) && !enPlaca(r, c);

  let puntos = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!on(r, c)) continue;
    if (esAlineacion(r, c)) { puntos += `M${c} ${r}h1v1h-1Z`; continue; }
    const u = on(r - 1, c), d = on(r + 1, c), l = on(r, c - 1), rg = on(r, c + 1);
    switch (op.puntos) {
      case 'redondo': puntos += circ(c + 0.5, r + 0.5, 0.48); break;
      case 'fluido': puntos += rr(c, r, 1, 1, !u && !l ? 0.5 : 0, !u && !rg ? 0.5 : 0, !d && !rg ? 0.5 : 0, !d && !l ? 0.5 : 0); break;
      case 'barras': { const w = 0.8, q = w / 2; puntos += rr(c + (1 - w) / 2, r, w, 1, u ? 0 : q, u ? 0 : q, d ? 0 : q, d ? 0 : q); break; }
      default: puntos += `M${c} ${r}h1v1h-1Z`;
    }
  }

  let marcos = '', centros = '';
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    if (op.marco === 'circulo') marcos += circ(fx + 3.5, fy + 3.5, 3.5) + circ(fx + 3.5, fy + 3.5, 2.5);
    else if (op.marco === 'redondeado') marcos += rr(fx, fy, 7, 7, 2.2, 2.2, 2.2, 2.2) + rr(fx + 1, fy + 1, 5, 5, 1.3, 1.3, 1.3, 1.3);
    else marcos += rr(fx, fy, 7, 7, 0, 0, 0, 0) + rr(fx + 1, fy + 1, 5, 5, 0, 0, 0, 0);
    if (op.centro === 'circulo') centros += circ(fx + 3.5, fy + 3.5, 1.5);
    else if (op.centro === 'redondeado') centros += rr(fx + 2, fy + 2, 3, 3, 0.9, 0.9, 0.9, 0.9);
    else centros += rr(fx + 2, fy + 2, 3, 3, 0, 0, 0, 0);
  }
  return { n, total: n + MARGEN * 2, puntos, marcos, centros, placa };
}

/**
 * Pinta en un canvas 2D. est: { colPuntos, colEsquinas, colFondo, velo (0-1), logo: Image|Canvas|null, fondo: Image|Canvas|null }
 */
export function pintarCanvas(ctx, lado, g, est) {
  const T = g.total;
  ctx.save();
  ctx.clearRect(0, 0, lado, lado);
  ctx.scale(lado / T, lado / T);
  ctx.fillStyle = est.colFondo;
  ctx.fillRect(0, 0, T, T);
  if (est.fondo) {
    ctx.drawImage(est.fondo, 0, 0, T, T);
    ctx.globalAlpha = est.velo;
    ctx.fillRect(0, 0, T, T);
    ctx.globalAlpha = 0.88;
    for (const [fx, fy] of [[0, 0], [g.n - 7, 0], [0, g.n - 7]]) ctx.fill(new Path2D(rr(fx + MARGEN - 1, fy + MARGEN - 1, 9, 9, 1.5, 1.5, 1.5, 1.5)));
    ctx.globalAlpha = 1;
  }
  ctx.translate(MARGEN, MARGEN);
  ctx.fillStyle = est.colPuntos;
  ctx.fill(new Path2D(g.puntos));
  ctx.fillStyle = est.colEsquinas;
  ctx.fill(new Path2D(g.marcos), 'evenodd');
  ctx.fill(new Path2D(g.centros));
  if (g.placa && est.logo) {
    const { x, y, s, forma } = g.placa;
    const p = 0.45; // aire entre el logo y los módulos
    ctx.fillStyle = est.colFondo;
    if (est.fondo) ctx.fill(new Path2D(forma === 'redondo' ? circ(x + s / 2, y + s / 2, s / 2) : rr(x, y, s, s, 0.8, 0.8, 0.8, 0.8)));
    ctx.save();
    ctx.beginPath();
    if (forma === 'redondo') ctx.arc(x + s / 2, y + s / 2, s / 2 - p, 0, Math.PI * 2);
    else ctx.roundRect ? ctx.roundRect(x + p, y + p, s - 2 * p, s - 2 * p, 0.6) : ctx.rect(x + p, y + p, s - 2 * p, s - 2 * p);
    ctx.clip();
    ctx.drawImage(est.logo, x + p, y + p, s - 2 * p, s - 2 * p);
    ctx.restore();
  }
  ctx.restore();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** SVG autónomo. est igual que en canvas, pero logoURL / fondoURL son data URL. */
export function svg(g, est, lado = 1024) {
  const T = g.total;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${lado}" height="${lado}" shape-rendering="geometricPrecision">`;
  s += `<rect width="${T}" height="${T}" fill="${esc(est.colFondo)}"/>`;
  if (est.fondoURL) {
    s += `<image href="${esc(est.fondoURL)}" width="${T}" height="${T}" preserveAspectRatio="xMidYMid slice"/>`;
    s += `<rect width="${T}" height="${T}" fill="${esc(est.colFondo)}" opacity="${est.velo}"/>`;
    for (const [fx, fy] of [[0, 0], [g.n - 7, 0], [0, g.n - 7]]) s += `<path d="${rr(fx + MARGEN - 1, fy + MARGEN - 1, 9, 9, 1.5, 1.5, 1.5, 1.5)}" fill="${esc(est.colFondo)}" opacity="0.88"/>`;
  }
  s += `<g transform="translate(${MARGEN} ${MARGEN})">`;
  s += `<path d="${g.puntos}" fill="${esc(est.colPuntos)}"/>`;
  s += `<path d="${g.marcos}" fill="${esc(est.colEsquinas)}" fill-rule="evenodd"/>`;
  s += `<path d="${g.centros}" fill="${esc(est.colEsquinas)}"/>`;
  if (g.placa && est.logoURL) {
    const { x, y, s: lp, forma } = g.placa;
    const p = 0.45;
    if (est.fondoURL) s += `<path d="${forma === 'redondo' ? circ(x + lp / 2, y + lp / 2, lp / 2) : rr(x, y, lp, lp, 0.8, 0.8, 0.8, 0.8)}" fill="${esc(est.colFondo)}"/>`;
    s += `<clipPath id="recorte">${forma === 'redondo' ? `<circle cx="${x + lp / 2}" cy="${y + lp / 2}" r="${lp / 2 - p}"/>` : `<rect x="${x + p}" y="${y + p}" width="${lp - 2 * p}" height="${lp - 2 * p}" rx="0.6"/>`}</clipPath>`;
    s += `<image href="${esc(est.logoURL)}" x="${x + p}" y="${y + p}" width="${lp - 2 * p}" height="${lp - 2 * p}" preserveAspectRatio="xMidYMid slice" clip-path="url(#recorte)"/>`;
  }
  return s + '</g></svg>';
}
