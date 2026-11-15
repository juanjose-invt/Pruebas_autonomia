import { h, icon, tr, getLang, setLang, onLang, store } from './core.js';

const T = {
  es: {
    nombres: { conversor: 'Conversor', qr: 'Código QR', claves: 'Contraseñas', tiempo: 'Cronómetro', notas: 'Notas' },
    titulos: { tiempo: 'Cronómetro y pomodoro' },
    intro: 'Conversor, códigos QR, contraseñas, cronómetro y notas. Todo funciona sin conexión y nada sale de este dispositivo.',
    elige: 'Despliega una hoja para empezar.',
    cerrar: 'Plegar y volver al inicio',
    herramientas: 'Herramientas',
    idioma: 'Idioma',
    salto: 'Saltar al contenido',
    instalar: 'Instalar',
    cargando: 'Abriendo…',
    error: 'No se pudo abrir esta herramienta. Recarga la página.',
    enMarcha: 'en marcha',
    desc: 'Caja de herramientas sin conexión: conversor de unidades, códigos QR, contraseñas, cronómetro y notas.',
  },
  en: {
    nombres: { conversor: 'Converter', qr: 'QR code', claves: 'Passwords', tiempo: 'Timer', notas: 'Notes' },
    titulos: { tiempo: 'Stopwatch and pomodoro' },
    intro: 'Converter, QR codes, passwords, timer and notes. Everything works offline and nothing leaves this device.',
    elige: 'Unfold a blade to start.',
    cerrar: 'Fold and go back to start',
    herramientas: 'Tools',
    idioma: 'Language',
    salto: 'Skip to content',
    instalar: 'Install',
    cargando: 'Opening…',
    error: 'This tool could not be opened. Reload the page.',
    enMarcha: 'running',
    desc: 'Offline toolbox: unit converter, QR codes, passwords, timer and notes.',
  },
};

/* Cada hoja: silueta propia (viewBox 0 0 largo 66, eje en 33,33) */
const HOJAS = [
  { id: 'conversor', largo: 440, eje: 1, forma: 'M33 7H408Q434 7 434 33T408 59H33A26 26 0 0 1 33 7Z',
    extra: () => { let d = ''; for (let i = 0, x = 96; x <= 404; x += 14, i++) d += `M${x} 59v-${i % 5 === 0 ? 15 : 8}`; return `<path class="filo__marca" d="${d}"/>`; } },
  { id: 'qr', largo: 440, eje: 1, forma: 'M33 5H330C385 5 418 22 436 42C400 61 362 61 330 61H33A28 28 0 0 1 33 5Z',
    extra: () => '<path class="filo__una" d="M262 14q34-7 68 0q-34 6-68 0z"/>' },
  { id: 'claves', largo: 370, eje: 1, forma: 'M33 11H262C315 11 345 26 366 44C335 56 300 55 262 55H33A22 22 0 0 1 33 11Z',
    extra: () => '<path class="filo__una" d="M212 19q26-6 52 0q-26 5-52 0z"/>' },
  { id: 'tiempo', largo: 400, eje: 2, forma: 'M33 9H352L396 15V51L352 57H140C131 57 131 44 120 44S109 57 100 57H33A24 24 0 0 1 33 9Z',
    extra: () => '' },
  { id: 'notas', largo: 380, eje: 2, forma: 'M33 13H280L376 31 280 53H33A20 20 0 0 1 33 13Z',
    extra: () => '<path class="filo__marca" d="M280 13v40"/>' },
];
const IDS = HOJAS.map((x) => x.id);

const cargadores = {
  conversor: () => import('./tools/conversor.js'),
  qr: () => import('./tools/qr.js'),
  claves: () => import('./tools/claves.js'),
  tiempo: () => import('./tools/tiempo.js'),
  notas: () => import('./tools/notas.js'),
};

const escena = document.getElementById('escena');
const mango = document.getElementById('mango');
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let actual = null;        // id de la herramienta abierta
let desmontar = null;     // limpieza de la herramienta abierta
let turno = 0;            // evita carreras entre navegaciones
let instalarEvento = null;
let primeraVez = true;

function selectorIdioma() {
  const t = tr(T);
  const g = h('div', { class: 'idioma', role: 'group', 'aria-label': t.idioma });
  for (const l of ['es', 'en']) {
    g.append(h('button', { type: 'button', class: 'idioma__b', 'aria-pressed': String(getLang() === l), lang: l,
      'aria-label': l === 'es' ? 'Español' : 'English', onclick: () => setLang(l) }, l.toUpperCase()));
  }
  return g;
}

function svgHoja(hoja) {
  return `<svg class="filo__acero" viewBox="0 0 ${hoja.largo} 66" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="acero-${hoja.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F8F9"/><stop offset="0.55" stop-color="#D5DBE0"/><stop offset="1" stop-color="#B3BCC5"/></linearGradient></defs>
    <path class="filo__cuerpo" fill="url(#acero-${hoja.id})" d="${hoja.forma}"/><path class="filo__bisel" d="M150 ${hoja.id === 'notas' ? 45 : 50}H${hoja.largo - 110}"/>${hoja.extra()}</svg>`;
}

/* ---------- inicio: la navaja en abanico ---------- */
function pintarInicio() {
  const t = tr(T);
  mango.hidden = true;
  document.body.dataset.vista = 'inicio';
  document.title = 'Cinco hojas';

  const caja = h('div', { class: 'navaja__caja' + (primeraVez ? ' navaja__caja--abre' : '') });
  HOJAS.forEach((hoja, i) => {
    const a = h('a', { class: `filo filo--${hoja.id} filo--eje${hoja.eje}`, href: '#' + hoja.id, style: `--i:${i};--largo:${hoja.largo}`, dataset: { hoja: hoja.id } });
    a.innerHTML = svgHoja(hoja);
    a.append(h('span', { class: 'filo__rotulo' }, icon(hoja.id, 22), h('span', null, t.nombres[hoja.id])));
    caja.append(a);
  });
  const cachas = h('div', { class: 'cachas', 'aria-hidden': 'true' },
    h('span', { class: 'remache remache--1' }), h('span', { class: 'remache remache--2' }),
    h('span', { class: 'cachas__inserto' }, ...[0, 1, 2, 3, 4].map((n) => h('i', { style: `--n:${n}` }))));
  caja.append(cachas);

  const instalar = h('button', { type: 'button', class: 'btn btn--acero inicio__instalar', hidden: !instalarEvento, id: 'instalar',
    onclick: async () => { if (!instalarEvento) return; instalarEvento.prompt(); try { await instalarEvento.userChoice; } catch {} instalarEvento = null; instalar.hidden = true; } },
    icon('instalar', 20), t.instalar);

  const vista = h('section', { class: 'inicio' },
    h('div', { class: 'inicio__texto' },
      h('div', { class: 'inicio__barra' }, selectorIdioma()),
      h('h1', { class: 'inicio__titulo' }, 'Cinco hojas'),
      h('p', { class: 'inicio__intro' }, t.intro),
      h('p', { class: 'inicio__elige' }, t.elige),
      instalar),
    h('nav', { class: 'navaja', 'aria-label': t.herramientas }, caja));
  escena.replaceChildren(vista);
  primeraVez = false;
}

/* ---------- vista de herramienta: mango arriba + hoja ---------- */
function pintarMango() {
  const t = tr(T);
  mango.hidden = false;
  mango.replaceChildren(
    h('a', { class: 'mango__inicio', href: '#', 'aria-label': t.cerrar, title: t.cerrar },
      h('span', { class: 'remache', 'aria-hidden': 'true' }), h('span', { class: 'mango__marca' }, 'Cinco hojas')),
    h('nav', { class: 'mango__hojas', 'aria-label': t.herramientas },
      HOJAS.map((hoja) => h('a', { class: 'lomo', href: '#' + hoja.id, 'aria-current': hoja.id === actual ? 'page' : null, 'aria-label': t.nombres[hoja.id], title: t.nombres[hoja.id], dataset: { hoja: hoja.id } },
        icon(hoja.id, 22), h('span', { class: 'lomo__t' }, t.nombres[hoja.id]), h('span', { class: 'lomo__vivo', hidden: true })))),
    selectorIdioma(),
  );
  marcarEnMarcha();
}

async function abrir(id, animar = true) {
  const mio = ++turno;
  const t = tr(T);
  const previa = escena.querySelector('.hoja');
  if (previa && animar && !sinMovimiento()) {
    try { await previa.animate([{ transform: 'none', opacity: 1 }, { transform: 'perspective(1600px) rotateZ(7deg) rotateX(-14deg)', opacity: 0 }], { duration: 130, easing: 'ease-in', fill: 'forwards' }).finished; } catch {}
    if (mio !== turno) return;
  }
  if (desmontar) { try { desmontar(); } catch {} desmontar = null; }
  actual = id;
  document.body.dataset.vista = 'hoja';
  document.title = `${t.nombres[id]} – Cinco hojas`;
  pintarMango();

  const cuerpo = h('div', { class: 'hoja__cuerpo' }, h('p', { class: 'hoja__espera' }, t.cargando));
  const hoja = h('section', { class: `hoja hoja--${id}`, 'aria-labelledby': 'hoja-titulo' },
    h('header', { class: 'hoja__lomo' },
      h('h1', { class: 'hoja__titulo', id: 'hoja-titulo' }, icon(id, 26), t.titulos[id] || t.nombres[id]),
      h('span', { class: 'hoja__una', 'aria-hidden': 'true' }),
      h('a', { class: 'hoja__plegar', href: '#', 'aria-label': t.cerrar, title: t.cerrar }, icon('x', 22))),
    cuerpo);
  escena.replaceChildren(hoja);
  window.scrollTo(0, 0);
  if (animar) hoja.classList.add('hoja--abre');

  try {
    const mod = await cargadores[id]();
    if (mio !== turno) return;
    cuerpo.replaceChildren();
    desmontar = mod.mount(cuerpo) || null;
  } catch (e) {
    console.error(e);
    if (mio === turno) cuerpo.replaceChildren(h('p', { class: 'hoja__espera' }, t.error));
  }
}

function ruta(animar = true) {
  const id = location.hash.replace(/^#\/?/, '');
  if (IDS.includes(id)) {
    if (id !== actual || !escena.querySelector('.hoja')) abrir(id, animar);
  } else {
    turno++;
    if (desmontar) { try { desmontar(); } catch {} desmontar = null; }
    actual = null;
    pintarInicio();
  }
}

/* Punto rojo en el lomo cuando el cronómetro o el pomodoro siguen contando */
export function marcarEnMarcha() {
  const vivo = !!(store.get('crono', {}).running || store.get('pomo', {}).running);
  const p = mango.querySelector('.lomo[data-hoja="tiempo"] .lomo__vivo');
  if (p) { p.hidden = !vivo; p.title = tr(T).enMarcha; }
}
window.addEventListener('cincohojas:tiempo', marcarEnMarcha);

onLang(() => {
  const t = tr(T);
  document.getElementById('salto').textContent = t.salto;
  document.querySelector('meta[name="description"]').content = t.desc;
  if (actual) abrir(actual, false); else pintarInicio();
});

window.addEventListener('hashchange', () => ruta(true));
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  instalarEvento = e;
  const b = document.getElementById('instalar');
  if (b) b.hidden = false;
});

document.documentElement.lang = getLang();
document.getElementById('salto').textContent = tr(T).salto;
document.getElementById('salto').addEventListener('click', (e) => { e.preventDefault(); escena.focus(); });
ruta(true);

// El temporizador sigue contando (y avisa) aunque se esté en otra herramienta.
if (store.get('pomo', {}).running || store.get('crono', {}).running) import('./tools/tiempo.js').catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
