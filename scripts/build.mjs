#!/usr/bin/env node
// Construye el portfolio en una carpeta de salida (por defecto, _site/).
//
//   node scripts/build.mjs            → genera _site/
//   node scripts/build.mjs --salida x → genera x/
//
// No necesita instalar nada: solo Node 20 o posterior.
// Entrada:  contenido/perfil.md, contenido/blog/*.md, sitio/ (estilos, fuente, script)
// Salida:   páginas HTML con rutas relativas + recursos/ + las carpetas de las apps, si existen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdown, enLinea, escapar, separarCabecera } from './lib/markdown.mjs';
import { leerPerfil } from './lib/perfil.mjs';
import { bocetos } from './lib/bocetos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const iSalida = args.indexOf('--salida');
const SALIDA = path.resolve(RAIZ, iSalida >= 0 && args[iSalida + 1] ? args[iSalida + 1] : '_site');
const APPS = ['gastos', 'kanban', 'juego', 'herramientas'];
const ARCHIVO_PERFIL = 'contenido/perfil.md';

/* ---------- Textos fijos del sitio ---------- */

const SECCIONES = [
  { id: 'inicio', archivo: 'index.html', es: 'Inicio', en: 'Home' },
  { id: 'proyectos', archivo: 'proyectos.html', es: 'Proyectos', en: 'Projects' },
  { id: 'blog', archivo: 'blog/index.html', es: 'Blog', en: 'Blog' },
  { id: 'sobre-mi', archivo: 'sobre-mi.html', es: 'Sobre mí', en: 'About me' },
  { id: 'experiencia', archivo: 'experiencia.html', es: 'Experiencia', en: 'Experience' },
  { id: 'inquietudes', archivo: 'inquietudes.html', es: 'Inquietudes', en: 'Interests' },
  { id: 'objetivos', archivo: 'objetivos.html', es: 'Objetivos', en: 'Goals' },
];

const PROYECTOS = [
  {
    id: 'gastos',
    es: { nombre: 'Gastos', texto: 'Gestor de gastos. Lo ahorrado se guarda en huchas de cristal en 3D.', abrir: 'Abrir Gastos' },
    en: { nombre: 'Expenses', texto: 'An expense tracker. Savings go into 3D glass money jars.', abrir: 'Open Expenses' },
  },
  {
    id: 'kanban',
    es: { nombre: 'Kanban', texto: 'Tablero de tareas hecho de corcho y pósits.', abrir: 'Abrir Kanban' },
    en: { nombre: 'Kanban', texto: 'A task board made of cork and sticky notes.', abrir: 'Open Kanban' },
  },
  {
    id: 'juego',
    es: { nombre: 'Juego', texto: 'Puzle de gravedad sobre un tablero de madera con canicas.', abrir: 'Abrir el juego' },
    en: { nombre: 'Game', texto: 'A gravity puzzle on a wooden board with marbles.', abrir: 'Open the game' },
  },
  {
    id: 'herramientas',
    es: { nombre: 'Herramientas', texto: 'Caja de herramientas tipo navaja: conversor, QR con logo o foto, contraseñas, cronómetro y pomodoro, y notas en Markdown.', abrir: 'Abrir Herramientas' },
    en: { nombre: 'Tools', texto: 'A pocket-knife toolbox: converter, QR codes with a logo or photo, passwords, stopwatch and pomodoro, and Markdown notes.', abrir: 'Open Tools' },
  },
];

/* ---------- Utilidades ---------- */

// Texto en los dos idiomas; el CSS enseña solo el activo.
const bi = (es, en, etiqueta = 'span', clase = '') =>
  `<${etiqueta} class="l${clase ? ' ' + clase : ''}" lang="es">${es}</${etiqueta}><${etiqueta} class="l${clase ? ' ' + clase : ''}" lang="en">${en}</${etiqueta}>`;

const pendienteCorto = () =>
  `<span class="pendiente">${bi('pendiente de rellenar', 'to be filled in')}</span>`;

const notaPendiente = (queEs, queEn) =>
  `<aside class="nota-margen nota-roja">${bi(
    `Pendiente de rellenar: ${queEs}. Se escribe en <code>${ARCHIVO_PERFIL}</code>.`,
    `To be filled in: ${queEn}. It is written in <code>${ARCHIVO_PERFIL}</code>.`,
    'p',
  )}</aside>`;

// Un campo del perfil por idioma: su contenido o, si falta, renglones en blanco con la nota roja.
function bloqueCampo(campo, pintar, queEs, queEn, renglones = 3) {
  const hueco = `${notaPendiente(queEs, queEn)}<div class="hueco${renglones < 3 ? ' hueco-corto' : ''}" aria-hidden="true"></div>`;
  if (!campo.es && !campo.en) return hueco;
  return ['es', 'en']
    .map((lang) => `<div class="l bloque" lang="${lang}">${campo[lang] ? pintar(campo[lang], lang) : hueco}</div>`)
    .join('');
}

function lineaCampo(campo) {
  if (!campo.es && !campo.en) return pendienteCorto();
  return ['es', 'en']
    .map((lang) => `<span class="l" lang="${lang}">${campo[lang] ? enLinea(campo[lang]) : pendienteCorto()}</span>`)
    .join('');
}

const formatoFecha = {
  es: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
};
const fechaHtml = (iso) =>
  `<time datetime="${iso}">${bi(formatoFecha.es.format(new Date(iso)), formatoFecha.en.format(new Date(iso)))}</time>`;

const FLECHA = '<svg viewBox="0 0 26 16" aria-hidden="true"><path d="M1 8h23M17 2l7 6-7 6"/></svg>';

/* ---------- Plantilla común ---------- */

function pagina({ archivo, seccion, tituloEs, tituloEn, descripcion, cuerpo, numero }) {
  const profundidad = archivo.split('/').length - 1;
  const r = '../'.repeat(profundidad); // prefijo relativo hasta la raíz del sitio
  const marca = { es: 'Cuaderno de campo', en: 'Field notebook' };
  const tEs = tituloEs === marca.es ? marca.es : `${tituloEs} | ${marca.es}`;
  const tEn = tituloEn === marca.en ? marca.en : `${tituloEn} | ${marca.en}`;

  const pestanas = SECCIONES.map((s) => {
    const actual = s.id === seccion ? ' aria-current="page"' : '';
    return `<li><a class="pestana" href="${r}${s.archivo}"${actual}>${bi(s.es, s.en)}</a></li>`;
  }).join('');

  return `<!doctype html>
<html lang="es" data-lang="es" data-titulo-es="${escapar(tEs)}" data-titulo-en="${escapar(tEn)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(tEs)}</title>
<meta name="description" content="${escapar(descripcion)}">
<meta name="theme-color" content="#2c3d36">
<link rel="icon" href="${r}recursos/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${r}recursos/fuentes/instrument-serif-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}recursos/cuaderno.css">
<script src="${r}recursos/cuaderno.js"></script>
</head>
<body>
<a class="salto" href="#contenido">${bi('Saltar al contenido', 'Skip to content')}</a>
<div class="cuaderno">
<header class="cabecera">
<nav aria-label="Secciones / Sections"><ul class="pestanas">${pestanas}</ul></nav>
<div class="idiomas" role="group" aria-label="Idioma / Language">
<button type="button" data-idioma="es" aria-pressed="true" aria-label="Español">ES</button>
<button type="button" data-idioma="en" aria-pressed="false" aria-label="English">EN</button>
</div>
</header>
<div class="hoja">
<main id="contenido">
${cuerpo}
</main>
<footer class="pie">
<a class="sello" href="${r || './'}" aria-label="by innovativecode: ${'volver al inicio / back to home'}">by innovativecode</a>
${numero ? `<span class="num-pagina">${bi(`pág. ${numero}`, `p. ${numero}`)}</span>` : ''}
</footer>
</div>
</div>
</body>
</html>
`;
}

/* ---------- Blog ---------- */

function leerEntradas() {
  const carpeta = path.join(RAIZ, 'contenido/blog');
  if (!fs.existsSync(carpeta)) return [];
  const porClave = new Map();

  for (const archivo of fs.readdirSync(carpeta).filter((a) => a.endsWith('.md')).sort()) {
    const { datos, cuerpo } = separarCabecera(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    const m = archivo.match(/^(.*?)(?:\.(es|en))?\.md$/);
    const idioma = (datos.idioma || datos.lang || m[2] || 'es').toLowerCase();
    const titulo = datos.titulo || datos.title;
    const fecha = datos.fecha || datos.date;
    const donde = `contenido/blog/${archivo}`;

    if (/^(s[ií]|true|yes)$/i.test(datos.borrador || datos.draft || '')) continue;
    if (!['es', 'en'].includes(idioma)) throw new Error(`${donde}: «idioma» debe ser es o en.`);
    if (!titulo) throw new Error(`${donde}: falta «titulo» en la cabecera.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || Number.isNaN(Date.parse(fecha))) {
      throw new Error(`${donde}: «fecha» debe tener la forma AAAA-MM-DD.`);
    }

    const clave = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!clave || clave === 'index') throw new Error(`${donde}: el nombre del archivo no sirve como dirección.`);
    const entrada = porClave.get(clave) ?? { clave, versiones: {} };
    if (entrada.versiones[idioma]) throw new Error(`${donde}: ya hay otra versión «${idioma}» de esta entrada.`);
    entrada.versiones[idioma] = { titulo, fecha, resumen: datos.resumen || datos.summary || '', html: markdown(cuerpo) };
    porClave.set(clave, entrada);
  }

  const entradas = [...porClave.values()].map((e) => {
    const principal = e.versiones.es ?? e.versiones.en;
    return { ...e, fecha: principal.fecha };
  });
  entradas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.clave.localeCompare(b.clave)));
  return entradas;
}

// Devuelve el texto de una entrada en los dos idiomas; si falta uno, usa el otro.
function biEntrada(entrada, campo) {
  const es = entrada.versiones.es ?? entrada.versiones.en;
  const en = entrada.versiones.en ?? entrada.versiones.es;
  return { es: es[campo], en: en[campo] };
}

function elementoEntrada(entrada, r, nivel = 'h2') {
  const titulo = biEntrada(entrada, 'titulo');
  const resumen = biEntrada(entrada, 'resumen');
  const falta = !entrada.versiones.en
    ? `<span class="l" lang="en"> (in Spanish)</span>`
    : !entrada.versiones.es
      ? `<span class="l" lang="es"> (en inglés)</span>`
      : '';
  return `<li>${fechaHtml(entrada.fecha)}<div class="cuerpo-anotacion"><${nivel}><a href="${r}blog/${entrada.clave}.html">${bi(escapar(titulo.es), escapar(titulo.en))}</a>${falta}</${nivel}>${
    resumen.es || resumen.en ? `<p>${bi(enLinea(resumen.es), enLinea(resumen.en))}</p>` : ''
  }</div></li>`;
}

function paginaEntrada(entrada, anterior, siguiente) {
  const titulo = biEntrada(entrada, 'titulo');
  const { es, en } = entrada.versiones;
  let cuerpo;
  if (es && en) {
    cuerpo = `<div class="entrada-cuerpo l" lang="es">${es.html}</div><div class="entrada-cuerpo l" lang="en">${en.html}</div>`;
  } else if (es) {
    cuerpo = `<p class="aviso-idioma l" lang="en">This entry is only written in Spanish.</p><div class="entrada-cuerpo" lang="es">${es.html}</div>`;
  } else {
    cuerpo = `<p class="aviso-idioma l" lang="es">Esta entrada solo está escrita en inglés.</p><div class="entrada-cuerpo" lang="en">${en.html}</div>`;
  }
  const vecina = (e, es_, en_) => {
    if (!e) return '';
    const t = biEntrada(e, 'titulo');
    return `<div><span class="cual">${bi(es_, en_)}</span><a href="${e.clave}.html">${bi(escapar(t.es), escapar(t.en))}</a></div>`;
  };
  const resumen = biEntrada(entrada, 'resumen');
  return pagina({
    archivo: `blog/${entrada.clave}.html`,
    seccion: 'blog',
    tituloEs: titulo.es,
    tituloEn: titulo.en,
    descripcion: resumen.es || titulo.es,
    cuerpo: `<article class="entrada">
<header class="entrada-cabecera">
<a class="volver" href="index.html">${bi('Volver al blog', 'Back to the blog')}</a>
<h1>${bi(escapar(titulo.es), escapar(titulo.en))}</h1>
<p class="cuando">${fechaHtml(entrada.fecha)}</p>
</header>
${cuerpo}
${anterior || siguiente ? `<nav class="vecinas" aria-label="Otras entradas / Other entries">${vecina(siguiente, 'Entrada posterior', 'Newer entry')}${vecina(anterior, 'Entrada anterior', 'Older entry')}</nav>` : ''}
</article>`,
  });
}

/* ---------- Páginas ---------- */

function paginaInicio(perfil, entradas) {
  const figuras = PROYECTOS.map((p, i) =>
    `<a class="figura" href="proyectos.html#${p.id}"><figure><div class="plancha">${bocetos[p.id]()}</div><figcaption>fig. ${i + 1}, <span class="nombre">${bi(p.es.nombre, p.en.nombre)}</span></figcaption></figure></a>`,
  ).join('');

  const indice = SECCIONES.slice(1).map((s, i) =>
    `<li><a href="${s.archivo}" data-pagina="${i + 2}"><span class="titulo">${bi(s.es, s.en)}</span><span class="puntos" aria-hidden="true"></span></a></li>`,
  ).join('');

  const ultimas = entradas.slice(0, 3).map((e) => elementoEntrada(e, '', 'h3')).join('');

  return pagina({
    archivo: 'index.html',
    seccion: 'inicio',
    tituloEs: 'Cuaderno de campo',
    tituloEn: 'Field notebook',
    descripcion: 'Cuaderno de campo de un desarrollador: proyectos, blog y apuntes. By innovativecode.',
    numero: 1,
    cuerpo: `<div class="portada">
<div class="portada-texto">
<h1>${bi('Cuaderno de campo', 'Field notebook')}</h1>
<p class="entradilla">${bi(
      'Aquí se guardan cuatro proyectos hechos con código, un blog y unas páginas que todavía están por escribir.',
      'This notebook holds four projects made with code, a blog and a few pages that are still to be written.',
    )}</p>
<dl class="ficha">
<dt>${bi('Este cuaderno es de', 'This notebook belongs to')}</dt><dd>${lineaCampo(perfil.nombre)}</dd>
<dt>${bi('Se dedica a', 'Works on')}</dt><dd>${lineaCampo(perfil.dedicacion)}</dd>
</dl>
</div>
<div class="figuras">${figuras}</div>
</div>
<div class="columna">
<h2>${bi('Índice', 'Contents')}</h2>
<ol class="indice">${indice}</ol>
${ultimas ? `<h2>${bi('Últimas anotaciones', 'Latest entries')}</h2><ul class="anotaciones">${ultimas}</ul>` : ''}
</div>`,
  });
}

function paginaProyectos() {
  const laminas = PROYECTOS.map((p, i) => `<article class="lamina" id="${p.id}">
<figure><div class="plancha">${bocetos[p.id]()}</div></figure>
<div class="lamina-texto">
<p class="pie-figura">fig. ${i + 1}</p>
<h2>${bi(p.es.nombre, p.en.nombre)}</h2>
<p>${bi(p.es.texto, p.en.texto)}</p>
<a class="abrir" href="${p.id}/">${bi(p.es.abrir, p.en.abrir)}${FLECHA}</a>
</div>
</article>`).join('\n');

  return pagina({
    archivo: 'proyectos.html',
    seccion: 'proyectos',
    tituloEs: 'Proyectos',
    tituloEn: 'Projects',
    descripcion: 'Cuatro aplicaciones web: gastos, kanban, juego de canicas y caja de herramientas.',
    numero: 2,
    cuerpo: `<div class="columna">
<h1>${bi('Proyectos', 'Projects')}</h1>
<aside class="nota-margen">${bi(
      'Los dibujos son bocetos hechos en SVG, no capturas. Cada aplicación se abre en su propia carpeta.',
      'The drawings are sketches made in SVG, not screenshots. Each app opens in its own folder.',
      'p',
    )}</aside>
<p class="entradilla">${bi(
      'Cuatro aplicaciones web que viven en este mismo repositorio. Funcionan en el navegador, sin servidor, y están pensadas para usarse con el dedo en una tablet.',
      'Four web apps that live in this same repository. They run in the browser, with no server, and are meant to be used by touch on a tablet.',
    )}</p>
</div>
<div class="laminas">
${laminas}
</div>`,
  });
}

function paginaBlog(entradas) {
  const lista = entradas.length
    ? `<ul class="anotaciones">${entradas.map((e) => elementoEntrada(e, '../')).join('')}</ul>`
    : `<p>${bi('Todavía no hay ninguna entrada. La primera se añade con un archivo Markdown en <code>contenido/blog/</code>.', 'There are no entries yet. Add the first one as a Markdown file in <code>contenido/blog/</code>.')}</p>`;
  return pagina({
    archivo: 'blog/index.html',
    seccion: 'blog',
    tituloEs: 'Blog',
    tituloEn: 'Blog',
    descripcion: 'Anotaciones del cuaderno de campo.',
    numero: 3,
    cuerpo: `<div class="columna">
<h1>Blog</h1>
<aside class="nota-margen">${bi(
      'Cada entrada es un archivo Markdown del repositorio. Un script la convierte en página.',
      'Each entry is a Markdown file in the repository. A script turns it into a page.',
      'p',
    )}</aside>
<p class="entradilla">${bi('Anotaciones con fecha, de la más reciente a la más antigua.', 'Dated entries, newest first.')}</p>
${lista}
</div>`,
  });
}

function paginaSobreMi(perfil) {
  const contacto = perfil.enlaces
    ? `<ul class="contacto">${perfil.enlaces.map((e) => `<li><a href="${escapar(e.url)}"${/^https?:/i.test(e.url) ? ' rel="noopener me"' : ''}>${bi(escapar(e.es), escapar(e.en))}</a></li>`).join('')}</ul>`
    : `${notaPendiente('los enlaces de contacto', 'the contact links')}<div class="hueco hueco-corto" aria-hidden="true"></div>`;
  return pagina({
    archivo: 'sobre-mi.html',
    seccion: 'sobre-mi',
    tituloEs: 'Sobre mí',
    tituloEn: 'About me',
    descripcion: 'Quién escribe este cuaderno de campo.',
    numero: 4,
    cuerpo: `<div class="columna">
<h1>${bi('Sobre mí', 'About me')}</h1>
<dl class="ficha">
<dt>${bi('Nombre', 'Name')}</dt><dd>${lineaCampo(perfil.nombre)}</dd>
<dt>${bi('Se dedica a', 'Works on')}</dt><dd>${lineaCampo(perfil.dedicacion)}</dd>
</dl>
<h2>${bi('Biografía', 'Biography')}</h2>
${bloqueCampo(perfil.biografia, (t) => markdown(t), 'la biografía', 'the biography')}
<h2>${bi('Contacto', 'Contact')}</h2>
${contacto}
</div>`,
  });
}

function paginaExperiencia(perfil) {
  const pintar = (etapas) =>
    `<ol class="etapas">${etapas.map((e) => `<li><span class="periodo">${enLinea(e.periodo)}</span><div><div class="puesto">${enLinea(e.puesto)}</div>${e.detalle ? `<p class="detalle">${enLinea(e.detalle)}</p>` : ''}</div></li>`).join('')}</ol>`;
  return pagina({
    archivo: 'experiencia.html',
    seccion: 'experiencia',
    tituloEs: 'Experiencia',
    tituloEn: 'Experience',
    descripcion: 'Experiencia profesional.',
    numero: 5,
    cuerpo: `<div class="columna">
<h1>${bi('Experiencia', 'Experience')}</h1>
${bloqueCampo(perfil.experiencia, pintar, 'la experiencia, una línea por etapa', 'the experience, one line per stage')}
</div>`,
  });
}

function paginaLista({ archivo, seccion, es, en, numero, campo, clase, queEs, queEn, descripcion }) {
  const pintar = (elementos) => `<ul class="${clase}">${elementos.map((e) => `<li>${enLinea(e)}</li>`).join('')}</ul>`;
  return pagina({
    archivo,
    seccion,
    tituloEs: es,
    tituloEn: en,
    descripcion,
    numero,
    cuerpo: `<div class="columna">
<h1>${bi(es, en)}</h1>
${bloqueCampo(campo, pintar, queEs, queEn)}
</div>`,
  });
}

/* ---------- Escritura ---------- */

function escribir(relativa, contenido) {
  const destino = path.join(SALIDA, relativa);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, contenido);
}

function copiarCarpeta(origen, destino) {
  fs.cpSync(origen, destino, {
    recursive: true,
    filter: (ruta) => {
      const nombre = path.basename(ruta);
      return nombre !== 'node_modules' && !(nombre.startsWith('.') && ruta !== origen);
    },
  });
}

function construir() {
  if (fs.existsSync(SALIDA)) {
    // Solo se vacía una carpeta que haya creado este script (lleva una marca) o que esté vacía.
    const creadaAqui = fs.existsSync(path.join(SALIDA, '.cuaderno-build'));
    if (!creadaAqui && fs.readdirSync(SALIDA).length) {
      throw new Error(`La carpeta de salida ${SALIDA} ya existe y no la creó este script. Bórrala a mano o elige otra.`);
    }
    fs.rmSync(SALIDA, { recursive: true, force: true });
  }
  fs.mkdirSync(SALIDA, { recursive: true });
  fs.writeFileSync(path.join(SALIDA, '.cuaderno-build'), '');

  const perfil = leerPerfil(fs.readFileSync(path.join(RAIZ, ARCHIVO_PERFIL), 'utf8'));
  const entradas = leerEntradas();

  copiarCarpeta(path.join(RAIZ, 'sitio'), path.join(SALIDA, 'recursos'));

  escribir('index.html', paginaInicio(perfil, entradas));
  escribir('proyectos.html', paginaProyectos());
  escribir('blog/index.html', paginaBlog(entradas));
  entradas.forEach((e, i) => escribir(`blog/${e.clave}.html`, paginaEntrada(e, entradas[i + 1], entradas[i - 1])));
  escribir('sobre-mi.html', paginaSobreMi(perfil));
  escribir('experiencia.html', paginaExperiencia(perfil));
  escribir('inquietudes.html', paginaLista({
    archivo: 'inquietudes.html', seccion: 'inquietudes', es: 'Inquietudes', en: 'Interests', numero: 6,
    campo: perfil.inquietudes, clase: 'apuntes', queEs: 'las inquietudes, una por línea', queEn: 'the interests, one per line',
    descripcion: 'Inquietudes y temas que interesan.',
  }));
  escribir('objetivos.html', paginaLista({
    archivo: 'objetivos.html', seccion: 'objetivos', es: 'Objetivos', en: 'Goals', numero: 7,
    campo: perfil.objetivos, clase: 'casillas', queEs: 'los objetivos, uno por línea', queEn: 'the goals, one per line',
    descripcion: 'Objetivos.',
  }));

  const copiadas = [];
  const ausentes = [];
  for (const app of APPS) {
    const origen = path.join(RAIZ, app);
    if (fs.existsSync(origen) && fs.statSync(origen).isDirectory()) {
      copiarCarpeta(origen, path.join(SALIDA, app));
      copiadas.push(app);
    } else {
      ausentes.push(app);
    }
  }

  const pendientes = Object.entries(perfil).filter(([, v]) => !v || (typeof v === 'object' && !Array.isArray(v) && !v.es && !v.en)).map(([k]) => k);
  console.log(`Sitio generado en ${path.relative(RAIZ, SALIDA) || SALIDA}/`);
  console.log(`  entradas del blog: ${entradas.length}`);
  console.log(`  apps copiadas: ${copiadas.join(', ') || 'ninguna'}`);
  if (ausentes.length) console.log(`  apps que no existen todavía (no copiadas): ${ausentes.join(', ')}`);
  if (pendientes.length) console.log(`  campos del perfil pendientes: ${pendientes.join(', ')}`);
}

try {
  construir();
} catch (error) {
  console.error(`No se pudo construir el sitio: ${error.message}`);
  process.exit(1);
}
