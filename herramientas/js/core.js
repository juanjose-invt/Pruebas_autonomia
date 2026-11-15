// Utilidades compartidas: almacenamiento, idioma, DOM, iconos, avisos.

const PREFIJO = 'cincohojas.';

export const store = {
  get(clave, porDefecto) {
    try {
      const v = localStorage.getItem(PREFIJO + clave);
      return v == null ? porDefecto : JSON.parse(v);
    } catch { return porDefecto; }
  },
  set(clave, valor) {
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); return true; }
    catch { return false; }
  },
};

/* ---------- idioma ---------- */
let idioma = store.get('idioma', 'es') === 'en' ? 'en' : 'es';
const oyentes = new Set();
export const getLang = () => idioma;
export function setLang(l) {
  if (l !== 'es' && l !== 'en' || l === idioma) return;
  idioma = l;
  store.set('idioma', l);
  document.documentElement.lang = l;
  oyentes.forEach((f) => f(l));
}
export const onLang = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
/** Devuelve la rama del diccionario {es, en} para el idioma activo. */
export const tr = (dic) => dic[idioma];

/* ---------- DOM ---------- */
export function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* ---------- iconos (trazo único 1.75, rejilla 24) ---------- */
const TRAZOS = {
  conversor: 'M3.5 16.5 16.5 3.5l4 4-13 13z M8 12l2 2 M11 9l2 2 M14 6l2 2',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M20 14v2.5 M14 20h2.5 M19.5 19.5h.5v.5h-.5z',
  claves: 'M12.2 11.8a4.5 4.5 0 1 1-6.4 6.4 4.5 4.5 0 0 1 6.4-6.4z M12 12l8-8 M16.5 7.5l2.5 2.5 M14 10l2 2',
  tiempo: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 9v4l2.5 2.5 M9.5 2h5',
  notas: 'M4 20h4L19.5 8.5l-4-4L4 16z M13 7l4 4',
  copiar: 'M9 9h10v11H9z M5 15V4h10',
  refrescar: 'M19 12a7 7 0 1 1-2.2-5.1 M19 4v4h-4',
  cambiar: 'M7 4v15 M7 19l-3.5-3.5 M7 19l3.5-3.5 M17 20V5 M17 5l-3.5 3.5 M17 5l3.5 3.5',
  descargar: 'M12 4v11 M12 15l-4.5-4.5 M12 15l4.5-4.5 M5 20h14',
  subir: 'M12 16V5 M12 5 7.5 9.5 M12 5l4.5 4.5 M5 20h14',
  papelera: 'M5 7h14 M9.5 7V4.5h5V7 M7 7l1 13h8l1-13 M10.5 11v5.5 M13.5 11v5.5',
  mas: 'M12 5v14 M5 12h14',
  menos: 'M5 12h14',
  lista: 'M9 6h11 M9 12h11 M9 18h11 M4.2 6h.6 M4.2 12h.6 M4.2 18h.6',
  tarea: 'M4 5h15v14H4z M8 12l2.5 2.5L15 9.5',
  cita: 'M5 6v12 M9.5 8H20 M9.5 12H20 M9.5 16h6',
  codigo: 'M8.5 7 3.5 12l5 5 M15.5 7l5 5-5 5',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  play: 'M8 5.5v13l11-6.5z',
  pausa: 'M8 5v14 M16 5v14',
  bandera: 'M6 21V4 M6 4.5h11l-2.5 4 2.5 4H6',
  saltar: 'M6 5.5v13l9-6.5z M18 5v14',
  x: 'M6 6l12 12 M18 6 6 18',
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 4 2.5 20h19z M12 10v5 M12 17.6v.4',
  plegar: 'M4 12h16 M4 12l5-5 M4 12l5 5',
  ojo: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  imagen: 'M4 5h16v14H4z M4 16l4.5-4.5 3.5 3.5 3-3 5 5 M9 9.2a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z',
  sonido: 'M4 9.5v5h3.5L12 18V6L7.5 9.5z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
  instalar: 'M12 4v10 M12 14l-4-4 M12 14l4-4 M5 15v5h14v-5',
};
export function icon(nombre, tam = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tam);
  svg.setAttribute('height', tam);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ico');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', TRAZOS[nombre] || '');
  svg.append(p);
  return svg;
}

/* ---------- avisos breves ---------- */
let temporizadorVoz = 0;
/** Muestra un aviso corto. `accion` = {texto, fn} añade un botón (p. ej. Deshacer). */
export function say(mensaje, accion) {
  const voz = document.getElementById('voz');
  voz.replaceChildren(h('span', null, mensaje));
  if (accion) voz.append(h('button', { type: 'button', class: 'voz__btn', onclick: () => { accion.fn(); voz.classList.remove('voz--on'); } }, accion.texto));
  voz.classList.add('voz--on');
  clearTimeout(temporizadorVoz);
  temporizadorVoz = setTimeout(() => voz.classList.remove('voz--on'), accion ? 6000 : 2200);
}

export async function copy(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = h('textarea', { value: texto, style: 'position:fixed;opacity:0;top:0;left:0' });
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function download(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Control segmentado accesible. opciones: [{v, t, ico?}] */
export function segmented({ label, opciones, valor, onChange, clase = '' }) {
  const grupo = h('div', { class: 'seg ' + clase, role: 'group', 'aria-label': label });
  for (const o of opciones) {
    grupo.append(h('button', {
      type: 'button', class: 'seg__b', 'aria-pressed': String(o.v === valor), dataset: { v: o.v }, title: o.title,
      onclick: (e) => {
        for (const b of grupo.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onChange(o.v);
      },
    }, o.ico ? icon(o.ico, 18) : null, o.nodo || null, o.t ? h('span', null, o.t) : null));
  }
  return grupo;
}

/** Interruptor accesible (checkbox con aspecto de palanca). */
export function toggle({ texto, valor, onChange, id }) {
  const input = h('input', { type: 'checkbox', class: 'palanca__i', checked: !!valor, id, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'palanca' }, input, h('span', { class: 'palanca__v', 'aria-hidden': 'true' }), h('span', { class: 'palanca__t' }, texto));
}

export const fmtNum = (n, opts) => new Intl.NumberFormat(idioma === 'es' ? 'es-ES' : 'en-GB', opts).format(n);
