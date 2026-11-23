// Bocetos de los once proyectos, dibujados a mano en SVG (sin imágenes).
// Clases de trazo, definidas en sitio/cuaderno.css:
//   .t      tinta, trazo principal        .fino   tinta, trazo fino
//   .lapiz  grafito discontinuo           .rojo   lápiz rojo (cotas y flechas)
//   .vidrio / .papelito  rellenos suaves  .rot    rótulos
//   .rrel   relleno de lápiz rojo que se mezcla con lo de debajo (efecto de tinta superpuesta)

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

/* ---------- Presupuestos: hoja de presupuesto y sello PDF ---------- */

export function bocetoPresupuestos() {
  const filas = [118, 138, 158]
    .map((y, i) =>
      `<path class="fino" pathLength="1" d="M88,${y} h${[62, 48, 70][i]} M204,${y} h30"/>` +
      `<path class="lapiz" d="M86,${y + 9} H236"/>`)
    .join('');
  const cuerpo =
    // la hoja, con la esquina doblada
    `<path class="t papelito" pathLength="1" d="M70,24 H226 L250,48 V232 H70 Z"/>` +
    `<path class="fino" pathLength="1" d="M226,24 V48 H250"/>` +
    // membrete y datos del cliente
    `<circle class="t" pathLength="1" cx="92" cy="50" r="9"/>` +
    `<path class="t" pathLength="1" d="M110,46 h58"/>` +
    `<path class="fino" pathLength="1" d="M110,56 h38 M88,82 h52 M88,92 h76"/>` +
    `<path class="t" pathLength="1" d="M86,104 H236"/>` +
    filas +
    // casilla del total
    `<rect class="t fondo" pathLength="1" x="170" y="186" width="66" height="26" rx="2"/>` +
    `<path class="tinta-trazo" d="M180,199 h34"/>` +
    `<path class="rojo" d="M170,218 H236 M172,222 H234"/>` +
    // sello PDF
    `<g transform="rotate(7 292 82)">` +
    `<rect class="t" pathLength="1" x="262" y="62" width="62" height="40" rx="4"/>` +
    `<rect class="fino" pathLength="1" x="267" y="67" width="52" height="30" rx="2"/>` +
    rot(293, 90, 'PDF', 'PDF', 'middle', 'rot rot-grande') +
    `</g>` +
    `<path class="rojo" d="M252,120 C268,122 282,116 290,108 M281,106 l10,1 l-3,9"/>` +
    // total
    `<path class="rojo" d="M274,199 H244 M250,195 l-6,4 l6,4"/>` +
    rot(280, 204, 'total', 'total', 'start', 'rot rot-rojo') +
    `<path class="lapiz" d="M52,82 C58,86 66,88 82,87"/>` +
    rot(4, 78, 'cliente', 'client') +
    rot(160, 250, 'hoja a hoja', 'sheet by sheet', 'middle');
  return lienzo(cuerpo, 'Boceto: una hoja de presupuesto con una casilla de total y un sello PDF', 'Sketch: a quote sheet with a total box and a PDF stamp');
}

/* ---------- Panel: tabla, barras y anillo en dos tintas ---------- */

export function bocetoPanel() {
  // Tabla de datos (el CSV)
  let tabla =
    `<rect class="t papelito" pathLength="1" x="24" y="44" width="124" height="98" rx="2"/>` +
    `<path class="t" pathLength="1" d="M24,66 H148"/>` +
    `<path class="fino" pathLength="1" d="M65,44 V142 M106,44 V142 M24,86 H148 M24,106 H148 M24,126 H148"/>` +
    `<path class="tinta-trazo" d="M32,55 h25 M73,55 h25 M114,55 h25"/>` +
    `<path class="fino" pathLength="1" d="M32,76 h18 M73,76 h12 M114,76 h22 M32,96 h22 M73,96 h20 M114,96 h10 M32,116 h14 M73,116 h24 M114,116 h18 M32,134 h20 M73,134 h10 M114,134 h24"/>`;

  // Barras: tinta + una segunda pasada de tinta roja, desplazada, como en la risografía
  const barras = [[192, 44], [216, 74], [240, 56], [264, 98]];
  let b = '';
  for (const [x, h] of barras) {
    b +=
      `<rect class="rrel" x="${x + 3}" y="${186 - h - 3}" width="18" height="${h}"/>` +
      `<rect class="t papelito" pathLength="1" x="${x}" y="${186 - h}" width="18" height="${h}"/>`;
  }
  // Anillo con un sector
  const cx = 308, cy = 92, r = 21;
  const anillo =
    `<circle class="rrel" cx="${cx + 3}" cy="${cy - 2}" r="${r}"/>` +
    `<circle class="t papelito" pathLength="1" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<circle class="fino" pathLength="1" cx="${cx}" cy="${cy}" r="9"/>` +
    `<path class="fino" pathLength="1" d="M${cx},${cy - r} V${cy - 9} M${cx + 18},${cy + 11} L${cx + 8},${cy + 5}"/>` +
    `<path class="fino" pathLength="1" d="M296,140 h24 M296,152 h18 M296,164 h22"/>`;

  const cuerpo =
    // marco de «tu dispositivo»
    `<rect class="lapiz" x="10" y="24" width="340" height="206" rx="12"/>` +
    tabla +
    rot(24, 168, 'CSV · Excel', 'CSV · Excel') +
    `<path class="lapiz" d="M60,176 V196"/>` +
    // paso de la tabla al panel
    `<path class="rojo" d="M152,92 C160,92 164,92 170,92 M162,86 l9,6 l-9,6"/>` +
    // lámina del panel
    `<rect class="t" pathLength="1" x="176" y="44" width="164" height="160" rx="4"/>` +
    `<path class="fino" pathLength="1" d="M186,186 H282 M186,148 H282 M186,110 H282"/>` +
    b +
    anillo +
    `<path class="tinta-trazo" d="M188,60 h40"/>` +
    rot(8, 248, 'tu dispositivo', 'your device', 'start', 'rot rot-rojo') +
    rot(250, 248, 'dos tintas', 'two inks', 'start');
  return lienzo(cuerpo, 'Boceto: una tabla de datos que se convierte en un panel de barras y un anillo, dentro de un marco punteado', 'Sketch: a data table turning into a panel of bars and a ring, inside a dotted frame');
}

/* ---------- Escáner: mesa con ticket y texto reconocido ---------- */

export function bocetoEscaner() {
  const lineasTicket = [112, 124, 136, 148, 160, 172]
    .map((y, i) => `M122,${y} h${[44, 30, 52, 38, 48, 26][i]} M${190 - [10, 12, 10, 12, 10, 12][i]},${y} h${[10, 12, 10, 12, 10, 12][i]}`)
    .join(' ');
  // Texto reconocido: cajas de lápiz alrededor de algunas líneas
  const cajas =
    `<rect class="lapiz" x="118" y="106" width="76" height="12"/>` +
    `<rect class="lapiz" x="118" y="130" width="76" height="12"/>` +
    `<rect class="lapiz" x="118" y="154" width="76" height="12"/>`;
  const cuerpo =
    // cuerpo del escáner y cristal
    `<rect class="t fondo" pathLength="1" x="36" y="60" width="288" height="168" rx="8"/>` +
    `<rect class="t vidrio" pathLength="1" x="52" y="90" width="256" height="122" rx="3"/>` +
    // tapa abierta (bisagra)
    `<rect class="t papelito" pathLength="1" x="66" y="40" width="228" height="14" rx="3"/>` +
    `<path class="fino" pathLength="1" d="M84,54 v6 M276,54 v6"/>` +
    // ticket con borde dentado
    `<g transform="rotate(-3 156 150)">` +
    `<path class="t papelito" pathLength="1" d="M108,98 H206 V196 l-7,-6 l-7,6 l-7,-6 l-7,6 l-7,-6 l-7,6 l-7,-6 l-7,6 l-7,-6 l-7,6 l-7,-6 l-7,6 l-7,-6 Z"/>` +
    `<path class="t" pathLength="1" d="M122,106 h34"/>` +
    `<path class="fino" pathLength="1" d="${lineasTicket}"/>` +
    `<path class="tinta-trazo" d="M168,178 h24"/>` +
    cajas +
    `</g>` +
    // barra de luz
    `<rect class="rrel" x="52" y="140" width="256" height="10"/>` +
    `<path class="rojo" d="M52,145 H308"/>` +
    `<path class="rojo" d="M334,126 V164 M328,156 l6,9 l6,-9"/>` +
    // texto en el dispositivo
    `<path class="rojo" d="M212,146 C222,140 228,136 234,134 M226,128 l10,5 l-9,7"/>` +
    `<rect class="t papelito" pathLength="1" x="244" y="98" width="52" height="96" rx="3"/>` +
    `<path class="tinta-trazo" d="M252,110 h22 M252,126 h28 M252,142 h18"/>` +
    `<path class="fino" pathLength="1" d="M252,118 h36 M252,134 h30 M252,150 h34 M252,166 h24 M252,180 h30"/>` +
    rot(270, 84, 'texto', 'text', 'middle', 'rot rot-rojo') +
    rot(8, 120, 'luz', 'light') +
    `<path class="lapiz" d="M32,126 C38,134 42,138 48,142"/>` +
    rot(180, 252, 'mesa de escáner', 'scanner bed', 'middle');
  return lienzo(cuerpo, 'Boceto: un ticket sobre el cristal de un escáner, una barra de luz y el texto reconocido a la derecha', 'Sketch: a receipt on a scanner glass, a bar of light and the recognised text on the right');
}

/* ---------- Pizza: pizza vista desde arriba y pasos de la masa ---------- */

export function bocetoPizza() {
  const cx = 110, cy = 128, R = 84;
  const punto = (ang, r) => [n(cx + r * Math.cos(ang)), n(cy + r * Math.sin(ang))];
  // Cortes
  let cortes = '';
  for (let k = 0; k < 4; k++) {
    const [x1, y1] = punto((k * Math.PI) / 4 + 0.2, R - 4);
    const [x2, y2] = punto((k * Math.PI) / 4 + 0.2 + Math.PI, R - 4);
    cortes += `M${x1},${y1} L${x2},${y2} `;
  }
  // Rodajas
  const rodajas = [[-0.9, 52], [0.2, 58], [1.5, 50], [2.4, 56], [3.5, 52], [4.5, 60], [5.4, 40], [0, 0]];
  let pepperoni = '';
  for (const [a, r] of rodajas) {
    const [x, y] = punto(a, r * 0.88);
    pepperoni += `<circle class="t" pathLength="1" cx="${x}" cy="${y}" r="11"/><path class="fino" pathLength="1" d="M${n(x - 4)},${n(y - 2)} h0.1 M${n(x + 3)},${n(y + 3)} h0.1 M${n(x + 2)},${n(y - 5)} h0.1"/>`;
  }
  // Hojas de albahaca
  const hoja = (x, y, giro) =>
    `<g transform="rotate(${giro} ${x} ${y})"><path class="t" pathLength="1" d="M${x},${y} q10,-14 24,-2 q-10,14 -24,2 Z"/><path class="fino" pathLength="1" d="M${x},${y} h20"/></g>`;
  // Pasos de la masa
  const px = 314;
  const pasos =
    `<circle class="t papelito" pathLength="1" cx="${px}" cy="48" r="20"/>` +
    `<path class="fino" pathLength="1" d="M${px - 11},40 q8,-8 16,-2"/>` +
    `<ellipse class="t papelito" pathLength="1" cx="${px}" cy="126" rx="32" ry="12"/>` +
    `<path class="fino" pathLength="1" d="M${px - 16},124 q16,5 32,0"/>` +
    `<circle class="t papelito" pathLength="1" cx="${px}" cy="206" r="26"/>` +
    `<circle class="fino" pathLength="1" cx="${px}" cy="206" r="21"/>` +
    `<circle class="tinta" cx="${px - 8}" cy="200" r="3.5"/><circle class="tinta" cx="${px + 9}" cy="208" r="3.5"/><circle class="tinta" cx="${px - 2}" cy="215" r="3"/>` +
    `<path class="rojo" d="M${px},74 V100 M${px - 6},91 l6,10 l6,-10"/>` +
    `<path class="rojo" d="M${px},148 V172 M${px - 6},163 l6,10 l6,-10"/>`;
  const cuerpo =
    `<circle class="t papelito" pathLength="1" cx="${cx}" cy="${cy}" r="${R}"/>` +
    `<circle class="fino" pathLength="1" cx="${cx}" cy="${cy}" r="${R - 12}"/>` +
    `<path class="lapiz" d="M${cx - 70},${cy - 30} q6,-3 10,2 M${cx + 60},${cy + 40} q6,-3 10,2 M${cx + 20},${cy - 72} q6,2 8,8"/>` +
    `<path class="lapiz" d="${cortes.trim()}"/>` +
    pepperoni +
    hoja(cx - 44, cy + 30, -30) + hoja(cx + 20, cy - 36, 40) + hoja(cx + 36, cy + 44, 100) + hoja(cx - 28, cy - 54, 200) +
    pasos +
    rot(280, 54, 'masa', 'dough', 'end') +
    rot(274, 132, 'extendida', 'stretched', 'end') +
    rot(278, 212, 'al horno', 'baked', 'end') +
    rot(110, 248, 'paso a paso', 'step by step', 'middle', 'rot rot-rojo');
  return lienzo(cuerpo, 'Boceto: una pizza vista desde arriba y, a la derecha, tres pasos de la masa', 'Sketch: a pizza seen from above and, on the right, three stages of the dough');
}

/* ---------- Currículum: hoja con cabecera, secciones y marcas de imprenta ---------- */

export function bocetoCurriculum() {
  // Hojas apiladas detrás (plantillas)
  const pila =
    `<path class="t papelito" pathLength="1" d="M92,40 H252 V222 H92 Z" transform="rotate(5 172 130)"/>` +
    `<path class="t papelito" pathLength="1" d="M92,40 H252 V222 H92 Z" transform="rotate(-4 172 130)"/>`;
  // Hoja principal
  const hoja = `<path class="t fondo" pathLength="1" d="M92,40 H252 V222 H92 Z"/>`;
  // Cabecera: recuadro de foto y nombre
  const cabecera =
    `<rect class="t papelito" pathLength="1" x="104" y="52" width="34" height="40" rx="2"/>` +
    `<circle class="fino" pathLength="1" cx="121" cy="68" r="7"/>` +
    `<path class="fino" pathLength="1" d="M110,88 q11,-12 22,0"/>` +
    `<path class="tinta-trazo" d="M148,60 h62"/>` +
    `<path class="fino" pathLength="1" d="M148,72 h44 M148,82 h54 M148,92 h36"/>` +
    `<path class="t" pathLength="1" d="M104,102 H240"/>`;
  // Secciones con título y renglones
  const seccion = (y, ancho) =>
    `<path class="tinta-trazo" d="M104,${y} h${ancho}"/>` +
    `<path class="fino" pathLength="1" d="M104,${y + 10} h126 M104,${y + 19} h112 M104,${y + 28} h120"/>`;
  const cuerpo =
    pila + hoja + cabecera + seccion(116, 30) + seccion(160, 38) +
    // marcas de corte y de registro de imprenta
    `<path class="rojo" d="M78,40 h-12 M92,26 v-12 M266,40 h12 M252,26 v-12 M78,222 h-12 M92,236 v12 M266,222 h12 M252,236 v12"/>` +
    // cota: ancho de la hoja
    `<path class="rojo" d="M92,254 H252 M98,250 l-6,4 l6,4 M246,250 l6,4 l-6,4"/>` +
    // sello de tinta
    `<circle class="rojo" cx="226" cy="196" r="16"/>` +
    `<circle class="rrel" cx="226" cy="196" r="12"/>` +
    `<path class="rojo" d="M219,196 l5,5 l9,-10"/>` +
    // lápiz y pestañas laterales (idiomas / sectores)
    `<path class="t papelito" pathLength="1" d="M252,70 h14 v22 h-14 M252,100 h14 v22 h-14 M252,130 h14 v22 h-14"/>` +
    `<path class="lapiz" d="M300,70 C284,84 276,96 272,110"/>` +
    rot(304, 66, 'plantillas', 'templates', 'start') +
    rot(8, 130, 'hoja A4', 'A4 sheet', 'start', 'rot rot-rojo') +
    rot(172, 12, 'currículum', 'résumé', 'middle');
  return lienzo(cuerpo, 'Boceto: una hoja de currículum con foto, nombre y secciones, hojas apiladas detrás, marcas de corte de imprenta y un sello', 'Sketch: a résumé sheet with photo, name and sections, sheets stacked behind, printer crop marks and a stamp');
}

/* ---------- Bloques: muro de bloques como vidriera, bola con estela y pala ---------- */

export function bocetoBloques() {
  // Vidriera: ojiva con plomos; los bloques son los vidrios
  const bx = 96, by = 46, w = 34, h = 18, g = 4;
  let bloques = '';
  for (let f = 0; f < 4; f++) {
    for (let c = 0; c < 6; c++) {
      if (f === 2 && c === 3) continue; // hueco: bloque roto por la bola
      if (f === 3 && c === 1) continue;
      const x = bx + c * (w + g), y = by + f * (h + g);
      bloques += `<rect class="t ${(f + c) % 3 === 0 ? 'vidrio' : 'papelito'}" pathLength="1" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
      if ((f * 6 + c) % 4 === 1) bloques += `<path class="fino" pathLength="1" d="M${x + 6},${y + 5} h${w - 14} M${x + 6},${y + 10} h${w - 22}"/>`;
    }
  }
  // Rayos de luz que atraviesan el muro
  const rayos = `<path class="lapiz" d="M60,26 L120,150 M96,22 L170,150 M268,22 L226,150 M308,30 L262,150"/>`;
  // Fragmentos del bloque roto
  const fragmentos =
    `<path class="fino" pathLength="1" d="M198,104 l8,-4 l4,8 l-9,3 Z M214,114 l7,2 l-3,7 l-7,-2 Z"/>`;
  // Bola, estela y rebote
  const bola =
    `<circle class="t papelito" pathLength="1" cx="172" cy="170" r="7"/>` +
    `<path class="lapiz" d="M118,234 L160,182 M236,222 L184,178"/>` +
    `<path class="rojo" d="M184,160 L200,128 M194,131 l6,-3 l1,7"/>`;
  // Pala
  const pala = `<path class="t fondo" pathLength="1" d="M128,226 H216 Q222,226 222,232 Q222,238 216,238 H128 Q122,238 122,232 Q122,226 128,226 Z"/>`;
  // Cota del muro y mejoras que caen
  const cota = `<path class="rojo" d="M86,44 V114 M82,50 l4,-6 l4,6 M82,108 l4,6 l4,-6"/>`;
  const mejoras =
    `<circle class="fino" pathLength="1" cx="292" cy="112" r="8"/><path class="fino" pathLength="1" d="M292,108 v8 M288,112 h8"/>` +
    `<path class="lapiz" d="M292,84 V102"/>`;
  const cuerpo =
    rayos + bloques + fragmentos + cota + mejoras + bola + pala +
    rot(8, 82, '100 niveles', '100 levels', 'start', 'rot rot-rojo') +
    rot(300, 148, 'mejoras', 'power-ups', 'middle') +
    rot(172, 14, 'vidriera de luz', 'light stained glass', 'middle');
  return lienzo(cuerpo, 'Boceto: un muro de bloques como vidrios con plomos, rayos de luz, una bola con su estela rebotando contra la pala y una mejora que cae', 'Sketch: a wall of blocks like leaded glass panes, rays of light, a ball with its trail bouncing off the paddle and a power-up falling');
}

/* ---------- Ráfaga: abanico de bolas lanzadas contra bloques numerados, con gominolas ---------- */

export function bocetoRafaga() {
  // Rejilla de bloques con su número (gominolas: esquinas muy redondas)
  const nums = [[9, 12, 7, 15], [6, 0, 11, 4], [0, 8, 0, 10]];
  const bx = 100, by = 40, w = 40, h = 28, g = 6;
  let bloques = '';
  nums.forEach((fila, f) => fila.forEach((v, c) => {
    if (!v) return;
    const x = bx + c * (w + g), y = by + f * (h + g);
    bloques += `<rect class="t ${(f + c) % 2 ? 'vidrio' : 'papelito'}" pathLength="1" x="${x}" y="${y}" width="${w}" height="${h}" rx="11"/>` +
      `<text x="${x + w / 2}" y="${y + 19}" text-anchor="middle" class="rot rot-num">${v}</text>`;
  }));
  // Bolas en ráfaga: una fila de bolas que sale del punto de lanzamiento
  let bolas = '';
  const ox = 180, oy = 226;
  for (let k = 0; k < 6; k++) {
    const t = 0.18 + k * 0.13;
    bolas += `<circle class="t papelito" pathLength="1" cx="${n(ox + (232 - ox) * t * 1.6)}" cy="${n(oy - 118 * t * 1.45)}" r="${k === 5 ? 6 : 5}"/>`;
  }
  const apuntar = `<path class="lapiz" d="M${ox},${oy} L276,112"/><path class="rojo" d="M262,152 L276,112 M264,122 l12,-10 l2,15"/>`;
  const suelo = `<path class="t" pathLength="1" d="M70,238 H300"/><circle class="t vidrio" pathLength="1" cx="${ox}" cy="${oy + 3}" r="9"/>`;
  const cota = `<path class="rojo" d="M92,40 V122 M88,46 l4,-6 l4,6 M88,116 l4,6 l4,-6"/>`;
  const cuerpo =
    bloques + cota + apuntar + bolas + suelo +
    rot(8, 80, '100 niveles', '100 levels', 'start', 'rot rot-rojo') +
    rot(300, 196, 'ráfaga', 'volley', 'middle') +
    rot(180, 20, 'gominolas numeradas', 'numbered gumdrops', 'middle');
  return lienzo(cuerpo, 'Boceto: bloques redondeados como gominolas con números, una línea de apuntado y una ráfaga de bolas que sale desde abajo', 'Sketch: rounded gumdrop blocks with numbers, an aiming line and a volley of balls leaving from below');
}

export const bocetos = {
  gastos: bocetoGastos,
  kanban: bocetoKanban,
  juego: bocetoJuego,
  herramientas: bocetoHerramientas,
  presupuestos: bocetoPresupuestos,
  panel: bocetoPanel,
  escaner: bocetoEscaner,
  pizza: bocetoPizza,
  curriculum: bocetoCurriculum,
  bloques: bocetoBloques,
  rafaga: bocetoRafaga,
};
