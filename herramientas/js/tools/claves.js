import { h, icon, tr, getLang, store, say, copy, segmented, toggle } from '../core.js';

const T = {
  es: {
    modo: 'Tipo', clave: 'Contraseña', frase: 'Frase de paso',
    nueva: 'Generar otra', copiar: 'Copiar', copiada: 'Copiada al portapapeles', noCopia: 'No se pudo copiar. Mantén pulsado el texto para copiarlo.',
    longitud: 'Longitud', caracteres: 'caracteres', palabras: 'Palabras',
    may: 'Mayúsculas (A-Z)', min: 'Minúsculas (a-z)', num: 'Números (0-9)', sim: 'Símbolos (!?#…)', parecidos: 'Sin caracteres que se confunden (O 0 l 1 I)',
    separador: 'Separador', guion: 'Guion', punto: 'Punto', espacio: 'Espacio', bajo: 'Guion bajo',
    capital: 'Empezar cada palabra con mayúscula', numero: 'Añadir un número', lista: 'Idioma de las palabras',
    fuerza: ['Débil', 'Justa', 'Fuerte', 'Muy fuerte'], bits: 'bits de entropía',
    ayuda: ['Se adivina con medios modestos. Alárgala.', 'Vale para cuentas poco importantes.', 'Resiste ataques serios por fuerza bruta.', 'Fuera del alcance de la fuerza bruta.'],
    resultado: 'Contraseña generada', minimo: 'Tiene que quedar al menos un tipo de carácter.',
    azar: 'Generada en este dispositivo con el generador criptográfico del navegador. No se guarda ni se envía.',
    cargando: 'Cargando palabras…', sinLista: 'No se pudo cargar la lista de palabras.',
  },
  en: {
    modo: 'Type', clave: 'Password', frase: 'Passphrase',
    nueva: 'Generate another', copiar: 'Copy', copiada: 'Copied to clipboard', noCopia: 'Could not copy. Press and hold the text to copy it.',
    longitud: 'Length', caracteres: 'characters', palabras: 'Words',
    may: 'Uppercase (A-Z)', min: 'Lowercase (a-z)', num: 'Numbers (0-9)', sim: 'Symbols (!?#…)', parecidos: 'No look-alike characters (O 0 l 1 I)',
    separador: 'Separator', guion: 'Hyphen', punto: 'Dot', espacio: 'Space', bajo: 'Underscore',
    capital: 'Capitalise each word', numero: 'Add a number', lista: 'Word language',
    fuerza: ['Weak', 'Fair', 'Strong', 'Very strong'], bits: 'bits of entropy',
    ayuda: ['Guessable with modest means. Make it longer.', 'Fine for low-value accounts.', 'Holds up against serious brute force.', 'Out of reach of brute force.'],
    resultado: 'Generated password', minimo: 'At least one character type has to stay on.',
    azar: 'Generated on this device with the browser\'s cryptographic generator. Never stored or sent.',
    cargando: 'Loading words…', sinLista: 'The word list could not be loaded.',
  },
};

const JUEGOS = {
  may: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  min: 'abcdefghijklmnopqrstuvwxyz',
  num: '0123456789',
  sim: '!?#$%&*+-=@^_~.:;/()[]{}',
};
const PARECIDOS = /[O0oIl1|]/g;

/** Entero uniforme en [0, n) con muestreo por rechazo (sin sesgo de módulo). */
export function azar(n) {
  const limite = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limite);
  return x % n;
}

export function generarClave(o) {
  const grupos = ['may', 'min', 'num', 'sim'].filter((k) => o[k]).map((k) => (o.parecidos ? JUEGOS[k].replace(PARECIDOS, '') : JUEGOS[k]));
  if (!grupos.length) return { texto: '', bits: 0 };
  const todo = grupos.join('');
  let texto;
  // Se repite hasta que haya al menos un carácter de cada tipo pedido (si caben).
  for (let intento = 0; intento < 500; intento++) {
    texto = Array.from({ length: o.largo }, () => todo[azar(todo.length)]).join('');
    if (o.largo < grupos.length || grupos.every((g) => [...texto].some((c) => g.includes(c)))) break;
  }
  return { texto, bits: o.largo * Math.log2(todo.length) };
}

const listas = {};
async function cargarLista(l) {
  if (!listas[l]) {
    const r = await fetch(new URL(`../../vendor/words-${l}.json`, import.meta.url));
    if (!r.ok) throw new Error('lista');
    listas[l] = await r.json();
  }
  return listas[l];
}

export function generarFrase(o, lista) {
  const seps = { guion: '-', punto: '.', espacio: ' ', bajo: '_' };
  let palabras = Array.from({ length: o.n }, () => lista[azar(lista.length)]);
  if (o.capital) palabras = palabras.map((p) => p[0].toLocaleUpperCase(o.lista) + p.slice(1));
  let bits = o.n * Math.log2(lista.length);
  if (o.numero) {
    const i = azar(o.n);
    palabras[i] += String(azar(10));
    bits += Math.log2(10) + Math.log2(o.n);
  }
  return { texto: palabras.join(seps[o.sep] ?? '-'), bits };
}

const nivel = (bits) => (bits < 50 ? 0 : bits < 72 ? 1 : bits < 100 ? 2 : 3);

export function mount(raiz) {
  const t = tr(T);
  const o = Object.assign({ modo: 'clave', largo: 20, may: true, min: true, num: true, sim: true, parecidos: false, n: 5, sep: 'guion', capital: false, numero: false, lista: getLang() }, store.get('claves', {}));
  const guardar = () => store.set('claves', o);
  let actual = { texto: '', bits: 0 };
  let vivo = true;

  const visor = h('div', { class: 'clave__visor', id: 'clave-visor', tabindex: '0', 'aria-label': t.resultado });
  const medidor = h('div', { class: 'clave__medidor', role: 'img' }, h('i'), h('i'), h('i'), h('i'));
  const fuerza = h('p', { class: 'clave__fuerza' });
  const opciones = h('div', { class: 'clave__ops' });

  function mostrar() {
    visor.replaceChildren(...[...actual.texto].map((c) => h('span', { class: /\d/.test(c) ? 'c-num' : /[\p{L}]/u.test(c) ? 'c-let' : c === ' ' ? 'c-esp' : 'c-sim' }, c === ' ' ? ' ' : c)));
    const n = actual.texto ? nivel(actual.bits) : -1;
    medidor.dataset.nivel = n;
    medidor.setAttribute('aria-label', n < 0 ? '' : t.fuerza[n]);
    fuerza.replaceChildren(...(n < 0 ? [t.minimo] : [h('strong', null, t.fuerza[n]), ` ${Math.round(actual.bits)} ${t.bits}. ${t.ayuda[n]}`]));
  }

  async function generar() {
    if (o.modo === 'clave') { actual = generarClave(o); mostrar(); return; }
    try {
      const lista = await cargarLista(o.lista);
      if (!vivo) return;
      actual = generarFrase(o, lista);
      mostrar();
    } catch {
      visor.textContent = t.sinLista;
    }
  }

  function rango({ id, texto, min, max, clave, unidad }) {
    const valor = h('output', { class: 'rango__v', for: id }, `${o[clave]}`);
    const input = h('input', { type: 'range', class: 'rango__i', id, min, max, step: 1, value: o[clave],
      oninput: () => { o[clave] = Number(input.value); valor.textContent = input.value; generar(); guardar(); } });
    return h('div', { class: 'rango' }, h('label', { class: 'rot', for: id }, texto), h('div', { class: 'rango__fila' }, input, h('span', { class: 'rango__n' }, valor, ' ', unidad)));
  }

  function pintarOpciones() {
    const cambia = (k) => (v) => {
      o[k] = v;
      if (!o.may && !o.min && !o.num && !o.sim) { o[k] = true; say(t.minimo); pintarOpciones(); return; }
      generar(); guardar();
    };
    if (o.modo === 'clave') {
      opciones.replaceChildren(
        rango({ id: 'clave-largo', texto: t.longitud, min: 6, max: 64, clave: 'largo', unidad: t.caracteres }),
        h('div', { class: 'clave__palancas' },
          toggle({ texto: t.may, valor: o.may, onChange: cambia('may'), id: 'op-may' }),
          toggle({ texto: t.min, valor: o.min, onChange: cambia('min'), id: 'op-min' }),
          toggle({ texto: t.num, valor: o.num, onChange: cambia('num'), id: 'op-num' }),
          toggle({ texto: t.sim, valor: o.sim, onChange: cambia('sim'), id: 'op-sim' }),
          toggle({ texto: t.parecidos, valor: o.parecidos, onChange: cambia('parecidos'), id: 'op-par' })));
    } else {
      const sel = (k) => (e) => { o[k] = e.target.value; generar(); guardar(); };
      opciones.replaceChildren(
        rango({ id: 'frase-n', texto: t.palabras, min: 3, max: 10, clave: 'n', unidad: t.palabras.toLowerCase() }),
        h('div', { class: 'clave__dos' },
          h('div', { class: 'campo' }, h('label', { class: 'rot', for: 'frase-sep' }, t.separador),
            h('select', { class: 'sel', id: 'frase-sep', onchange: sel('sep') }, ['guion', 'punto', 'espacio', 'bajo'].map((s) => h('option', { value: s, selected: o.sep === s }, t[s])))),
          h('div', { class: 'campo' }, h('label', { class: 'rot', for: 'frase-lista' }, t.lista),
            h('select', { class: 'sel', id: 'frase-lista', onchange: sel('lista') }, h('option', { value: 'es', selected: o.lista === 'es' }, 'Español'), h('option', { value: 'en', selected: o.lista === 'en' }, 'English')))),
        h('div', { class: 'clave__palancas' },
          toggle({ texto: t.capital, valor: o.capital, onChange: (v) => { o.capital = v; generar(); guardar(); }, id: 'op-cap' }),
          toggle({ texto: t.numero, valor: o.numero, onChange: (v) => { o.numero = v; generar(); guardar(); }, id: 'op-numero' })));
    }
  }

  const modo = segmented({ label: t.modo, valor: o.modo, opciones: [{ v: 'clave', t: t.clave }, { v: 'frase', t: t.frase }],
    onChange: (v) => { o.modo = v; pintarOpciones(); generar(); guardar(); } });

  raiz.append(h('div', { class: 'clave' },
    modo,
    h('div', { class: 'clave__caja' },
      visor,
      medidor, fuerza,
      h('div', { class: 'clave__acciones' },
        h('button', { type: 'button', class: 'btn btn--rojo', id: 'clave-copiar', onclick: async () => { if (actual.texto) say(await copy(actual.texto) ? t.copiada : t.noCopia); } }, icon('copiar', 20), t.copiar),
        h('button', { type: 'button', class: 'btn btn--acero', id: 'clave-nueva', onclick: generar }, icon('refrescar', 20), t.nueva))),
    opciones,
    h('p', { class: 'nota-pie' }, t.azar)));
  pintarOpciones();
  generar();
  return () => { vivo = false; };
}
