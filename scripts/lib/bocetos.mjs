// Bocetos de los cuatro proyectos, dibujados a mano en SVG (sin imágenes).
// Clases de trazo, definidas en sitio/cuaderno.css:
//   .t      tinta, trazo principal        .fino   tinta, trazo fino
//   .lapiz  grafito discontinuo           .rojo   lápiz rojo (cotas y flechas)
//   .vidrio / .papelito  rellenos suaves  .rot    rótulos

const n = (v) => Math.round(v * 10) / 10;

// Rótulo en los dos idiomas; el CSS enseña solo el activo.
function rot(x, y, es, en, ancla = 'start', clase = 'rot') {
  const a = `x="${x}" y="${y}" text-anchor="${ancla}" class="${clase} l"`;
  return `<text ${a} lang="es">${es}</text><text ${a} lang="en">${en}</text>`;
}

function lienzo(cuerpo, es, en) {
  // Marca con «tz» cada trazo que se dibuja al entrar en pantalla.
  cuerpo = cuerpo.replace(/class="([^"]*)" pathLength="1"/g, 'class="$1 tz" pathLength="1"');
  return `<svg class="boceto" viewBox="0 0 360 260" role="img" aria-label="${es} / ${en}" preserveAspectRatio="xMidYMid meet">${cuerpo}</svg>`;
}

/* ---------- Gastos: huchas de cristal ---------- */

function tarro(cx, alto, monedas) {
  const base = 214;
  const top = base - alto;
  const m = 35; // medio ancho
  const cuerpo =
    `M${cx - m + 8},${base} Q${cx - m},${base} ${cx - m},${base - 8} V${top + 24} ` +
    `Q${cx - m},${top + 10} ${cx - m + 13},${top + 8} V${top} H${cx + m - 13} V${top + 8} ` +
    `Q${cx + m},${top + 10} ${cx + m},${top + 24} V${base - 8} Q${cx + m},${base} ${cx + m - 8},${base} Z`;
  let pila = '';
  for (let k = 0; k < monedas; k++) {
    const y = base - 12 - k * 7;
    pila +=
      `<path class="fino" pathLength="1" d="M${cx - 22},${y} v4 a22 5.5 0 0 0 44 0 v-4"/>` +
      `<ellipse class="fino moneda" pathLength="1" cx="${cx}" cy="${y}" rx="22" ry="5.5"/>`;
  }
  return (
    `<path class="t vidrio" pathLength="1" d="${cuerpo}"/>` +
    `<rect class="t" pathLength="1" x="${cx - 26}" y="${top - 9}" width="52" height="9" rx="2.5"/>` +
    `<path class="t" pathLength="1" d="M${cx - 11},${top - 4.5} h22"/>` +
    `<path class="fino" pathLength="1" d="M${cx - m + 7},${top + 30} V${base - 22}"/>` +
    pila
  );
}

export function bocetoGastos() {
  const cuerpo =
    `<path class="t" pathLength="1" d="M22,214 H338"/>` +
    `<path class="lapiz" d="M30,222 l-8,8 M60,222 l-8,8 M90,222 l-8,8 M120,222 l-8,8 M150,222 l-8,8 M180,222 l-8,8 M210,222 l-8,8 M240,222 l-8,8 M270,222 l-8,8 M300,222 l-8,8 M330,222 l-8,8"/>` +
    tarro(86, 112, 5) +
    tarro(180, 146, 11) +
    tarro(274, 92, 2) +
    // moneda que cae en la hucha del centro
    `<circle class="t" pathLength="1" cx="180" cy="30" r="10"/>` +
    `<circle class="fino" pathLength="1" cx="180" cy="30" r="6"/>` +
    `<path class="lapiz" d="M180,44 V54 M168,18 l-5,-6 M192,18 l5,-6"/>` +
    // cota de nivel
    `<path class="rojo" d="M252,137 H222 M228,133 l-6,4 l6,4"/>` +
    rot(256, 141, 'nivel', 'level', 'start', 'rot rot-rojo') +
    `<path class="rojo" d="M26,118 C28,132 38,142 49,147"/>` +
    rot(6, 112, 'cristal', 'glass');
  return lienzo(cuerpo, 'Boceto: tres huchas de cristal con monedas', 'Sketch: three glass money jars with coins');
}

/* ---------- Kanban: corcho y pósits ---------- */

function posit(x, y, giro, lineas = 3) {
  let texto = '';
  for (let k = 0; k < lineas; k++) {
    const largo = [30, 24, 16][k % 3];
    texto += `M${x + 8},${y + 18 + k * 8} h${largo} `;
  }
  return (
    `<g transform="rotate(${giro} ${x + 23} ${y + 23})">` +
    `<path class="t papelito" pathLength="1" d="M${x},${y} h46 v36 l-10,10 h-36 Z"/>` +
    `<path class="fino" pathLength="1" d="M${x + 46},${y + 36} h-10 v10"/>` +
    `<path class="fino" pathLength="1" d="${texto.trim()}"/>` +
    `<circle class="t chincheta" pathLength="1" cx="${x + 23}" cy="${y + 5}" r="3.2"/>` +
    `</g>`
  );
}

export function bocetoKanban() {
  let motas = '';
  const puntos = [[52, 196], [78, 62], [120, 204], [141, 98], [150, 190], [196, 56], [214, 200], [236, 118], [300, 198], [310, 60], [286, 126], [102, 120], [176, 122], [58, 112]];
  for (const [x, y] of puntos) motas += `M${x},${y} h1.5 `;
  const cuerpo =
    `<rect class="t" pathLength="1" x="28" y="26" width="304" height="196" rx="5"/>` +
    `<rect class="t" pathLength="1" x="39" y="37" width="282" height="174" rx="2"/>` +
    `<path class="lapiz" d="M133,46 V202 M227,46 V202"/>` +
    `<path class="lapiz mota" d="${motas.trim()}"/>` +
    posit(62, 58, -4) +
    posit(66, 132, 3, 2) +
    posit(156, 62, 3) +
    posit(250, 60, -3, 2) +
    // hueco al que viaja la nota
    `<rect class="lapiz" x="251" y="134" width="46" height="46" transform="rotate(4 274 157)"/>` +
    `<path class="rojo" d="M118,170 C150,204 214,204 246,172 M238,172 l9,-1 l-2,9"/>` +
    rot(180, 246, 'corcho', 'cork', 'middle') +
    `<path class="rojo" d="M180,236 V224"/>` +
    rot(160, 124, 'pósit', 'sticky note', 'start', 'rot rot-rojo');
  return lienzo(cuerpo, 'Boceto: tablero de corcho con pósits en tres columnas', 'Sketch: cork board with sticky notes in three columns');
}

/* ---------- Juego: tablero de madera y canicas ---------- */

export function bocetoJuego() {
  const x0 = 62, y0 = 28, lado = 196, celda = 34;
  const cx = (c) => x0 + 30 + c * celda;
  const cy = (f) => y0 + 30 + f * celda;
  const canicas = [[1, 0], [3, 1], [0, 3], [2, 4], [4, 4]];
  const ocupada = (c, f) => canicas.some(([a, b]) => a === c && b === f);

  let pozos = '';
  for (let f = 0; f < 5; f++) for (let c = 0; c < 5; c++) {
    if (!ocupada(c, f)) pozos += `<circle class="fino" pathLength="1" cx="${cx(c)}" cy="${cy(f)}" r="3.2"/>`;
  }
  let bolas = '';
  for (const [c, f] of canicas) {
    bolas +=
      `<circle class="t vidrio" pathLength="1" cx="${cx(c)}" cy="${cy(f)}" r="11.5"/>` +
      `<path class="fino" pathLength="1" d="M${cx(c) - 6.5},${cy(f) - 2} a7 7 0 0 1 5,-5.5"/>`;
  }
  const veta = (y, d) =>
    `M${x0 + 14},${y} C${x0 + 60},${y - d} ${x0 + 120},${y + d} ${x0 + lado - 14},${y - d / 2}`;
  const cuerpo =
    `<rect class="t" pathLength="1" x="${x0}" y="${y0}" width="${lado}" height="${lado}" rx="8"/>` +
    `<rect class="fino" pathLength="1" x="${x0 + 9}" y="${y0 + 9}" width="${lado - 18}" height="${lado - 18}" rx="4"/>` +
    `<path class="lapiz veta" d="${veta(y0 + 46, 5)} ${veta(y0 + 81, -4)} ${veta(y0 + 115, 6)} ${veta(y0 + 149, -5)} ${veta(y0 + 181, 3)}"/>` +
    // paredes del laberinto
    `<path class="t pared" pathLength="1" d="M${cx(1) + 17},${cy(1) - 17} v34 M${cx(2) - 17},${cy(3) + 17} h68 M${cx(0) - 17},${cy(2) - 17} h34"/>` +
    pozos +
    bolas +
    // caída de la canica de arriba
    `<path class="lapiz" d="M${cx(1)},${cy(0) + 14} V${cy(2) - 8}"/>` +
    `<circle class="lapiz" cx="${cx(1)}" cy="${cy(2)}" r="11.5"/>` +
    // gravedad
    `<path class="rojo" d="M300,60 V186 M293,176 l7,11 l7,-11"/>` +
    rot(312, 128, 'g', 'g', 'start', 'rot rot-rojo rot-grande') +
    rot(292, 48, 'gravedad', 'gravity', 'middle', 'rot rot-rojo') +
    `<path class="rojo" d="M40,${cy(3)} H${cx(0) - 14}"/>` +
    rot(36, cy(3) - 6, 'canica', 'marble', 'middle') +
    rot(160, 246, 'madera', 'wood', 'middle');
  return lienzo(cuerpo, 'Boceto: tablero de madera con canicas y una flecha de gravedad', 'Sketch: wooden board with marbles and a gravity arrow');
}

/* ---------- Herramientas: navaja ---------- */

export function bocetoHerramientas() {
  const A = { x: 104, y: 190 }; // eje izquierdo
  const B = { x: 256, y: 190 }; // eje derecho
  const brazo = (eje, giro, dibujo) => `<g transform="rotate(${giro} ${eje.x} ${eje.y})">${dibujo}</g>`;

  // Regla (conversor)
  let marcas = '';
  for (let k = 1; k <= 8; k++) marcas += `M${A.x - 8},${A.y - 14 - k * 9.5} h${k % 2 ? 5 : 8} `;
  const regla =
    `<rect class="t papelito" pathLength="1" x="${A.x - 8}" y="${A.y - 100}" width="16" height="100" rx="2"/>` +
    `<path class="fino" pathLength="1" d="${marcas.trim()}"/>`;

  // Lápiz (notas)
  const lapiz =
    `<path class="t papelito" pathLength="1" d="M${A.x - 5.5},${A.y} V${A.y - 96} L${A.x},${A.y - 112} L${A.x + 5.5},${A.y - 96} V${A.y} Z"/>` +
    `<path class="fino" pathLength="1" d="M${A.x - 5.5},${A.y - 96} h11 M${A.x - 2},${A.y - 106} h4"/>`;

  // QR
  const q = { x: A.x - 16, y: A.y - 104 };
  const ojo = (x, y) => `<rect class="fino" pathLength="1" x="${n(x)}" y="${n(y)}" width="9" height="9"/><rect class="tinta" x="${n(x + 3)}" y="${n(y + 3)}" width="3" height="3"/>`;
  const qr =
    `<rect class="t papelito" pathLength="1" x="${A.x - 4}" y="${A.y - 72}" width="8" height="72" rx="1.5"/>` +
    `<rect class="t papelito" pathLength="1" x="${q.x}" y="${q.y}" width="32" height="32" rx="1.5"/>` +
    ojo(q.x + 3.5, q.y + 3.5) + ojo(q.x + 19.5, q.y + 3.5) + ojo(q.x + 3.5, q.y + 19.5) +
    `<path class="tinta-trazo" d="M${q.x + 16},${q.y + 6} h0.1 M${q.x + 16},${q.y + 15} h4 M${q.x + 22},${q.y + 20} v4 M${q.x + 17},${q.y + 25} h0.1 M${q.x + 26},${q.y + 26} h0.1 M${q.x + 6},${q.y + 16} h0.1"/>`;

  // Candado (contraseñas)
  const candado =
    `<rect class="t papelito" pathLength="1" x="${B.x - 4}" y="${B.y - 68}" width="8" height="68" rx="1.5"/>` +
    `<rect class="t papelito" pathLength="1" x="${B.x - 14}" y="${B.y - 90}" width="28" height="23" rx="3"/>` +
    `<path class="t" pathLength="1" d="M${B.x - 8},${B.y - 90} v-7 a8 8 0 0 1 16 0 v7"/>` +
    `<path class="fino" pathLength="1" d="M${B.x},${B.y - 82} v7"/>`;

  // Cronómetro
  const crono =
    `<rect class="t papelito" pathLength="1" x="${B.x - 4}" y="${B.y - 62}" width="8" height="62" rx="1.5"/>` +
    `<circle class="t papelito" pathLength="1" cx="${B.x}" cy="${B.y - 79}" r="17"/>` +
    `<path class="t" pathLength="1" d="M${B.x - 4},${B.y - 100} h8 M${B.x},${B.y - 100} v4"/>` +
    `<path class="fino" pathLength="1" d="M${B.x},${B.y - 79} v-11 M${B.x},${B.y - 79} l7,5"/>`;

  const cuerpo =
    brazo(A, -64, regla) +
    brazo(A, -27, lapiz) +
    brazo(A, 8, qr) +
    brazo(B, -14, candado) +
    brazo(B, 44, crono) +
    // mango
    `<rect class="t fondo" pathLength="1" x="80" y="168" width="200" height="44" rx="22"/>` +
    `<path class="fino" pathLength="1" d="M112,178 H248 M112,202 H248"/>` +
    `<circle class="t" pathLength="1" cx="${A.x}" cy="${A.y}" r="5"/><circle class="t" pathLength="1" cx="${B.x}" cy="${B.y}" r="5"/>` +
    rot(8, 204, 'conversor', 'converter') +
    rot(30, 76, 'notas', 'notes') +
    rot(118, 68, 'QR', 'QR', 'middle') +
    rot(234, 78, 'contraseñas', 'passwords', 'middle') +
    rot(318, 104, 'cronómetro', 'stopwatch', 'middle') +
    `<path class="rojo" d="M180,236 V218"/>` +
    rot(180, 250, 'todo en un mango', 'all in one handle', 'middle', 'rot rot-rojo');
  return lienzo(cuerpo, 'Boceto: navaja con cinco herramientas desplegadas', 'Sketch: pocket knife with five tools unfolded');
}

export const bocetos = {
  gastos: bocetoGastos,
  kanban: bocetoKanban,
  juego: bocetoJuego,
  herramientas: bocetoHerramientas,
};
