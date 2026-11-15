import { h, icon, tr, getLang, store, say, download, segmented } from '../core.js';
import { marked } from '../../vendor/marked.esm.js';
import DOMPurify from '../../vendor/purify.es.mjs';

const T = {
  es: {
    notas: 'Tus notas', nueva: 'Nota nueva', borrar: 'Borrar nota', borrada: 'Nota borrada', deshacer: 'Deshacer',
    sinTitulo: 'Sin título', editor: 'Texto de la nota en Markdown', previa: 'Vista previa',
    ver: 'Vista', escribir: 'Escribir', leer: 'Leer', ambos: 'Las dos',
    guardado: 'Guardado en este dispositivo', guardando: 'Guardando…', sinEspacio: 'No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.',
    exportar: 'Exportar', md: 'Esta nota (.md)', html: 'Esta nota (.html)', todas: 'Todas las notas (.json)', importar: 'Importar archivo…',
    importadas: (n) => (n === 1 ? '1 nota importada' : `${n} notas importadas`), noImporta: 'Ese archivo no se pudo leer como nota.',
    barra: 'Formato', negrita: 'Negrita', cursiva: 'Cursiva', titulo: 'Título', lista: 'Lista', tarea: 'Tarea', enlace: 'Enlace', codigo: 'Código', cita: 'Cita',
    vacia: 'La nota está vacía. Escribe a la izquierda y aquí verás el resultado.',
    palabras: (n) => (n === 1 ? '1 palabra' : `${n} palabras`),
    ph: 'Escribe aquí. Usa # para títulos, **negrita**, - listas…',
    bienvenida: '# Bienvenida a tus notas\n\nEscribe en **Markdown** y mira el resultado al lado. Todo se guarda solo en este dispositivo.\n\n## Lo básico\n\n- `# Título` y `## Subtítulo`\n- `**negrita**` y `*cursiva*`\n- Listas con `-` o `1.`\n- [ ] Tareas pendientes con `- [ ]`\n- [x] Y hechas con `- [x]`\n\n> Las citas empiezan con `>`.\n\n| Tabla | También |\n|---|---|\n| sí | funciona |\n',
  },
  en: {
    notas: 'Your notes', nueva: 'New note', borrar: 'Delete note', borrada: 'Note deleted', deshacer: 'Undo',
    sinTitulo: 'Untitled', editor: 'Note text in Markdown', previa: 'Preview',
    ver: 'View', escribir: 'Write', leer: 'Read', ambos: 'Both',
    guardado: 'Saved on this device', guardando: 'Saving…', sinEspacio: 'Could not save: browser storage is full or blocked.',
    exportar: 'Export', md: 'This note (.md)', html: 'This note (.html)', todas: 'All notes (.json)', importar: 'Import a file…',
    importadas: (n) => (n === 1 ? '1 note imported' : `${n} notes imported`), noImporta: 'That file could not be read as a note.',
    barra: 'Formatting', negrita: 'Bold', cursiva: 'Italic', titulo: 'Heading', lista: 'List', tarea: 'Task', enlace: 'Link', codigo: 'Code', cita: 'Quote',
    vacia: 'This note is empty. Write on the left and the result shows here.',
    palabras: (n) => (n === 1 ? '1 word' : `${n} words`),
    ph: 'Write here. Use # for headings, **bold**, - lists…',
    bienvenida: '# Welcome to your notes\n\nWrite in **Markdown** and see the result alongside. Everything is saved on this device only.\n\n## The basics\n\n- `# Heading` and `## Subheading`\n- `**bold**` and `*italic*`\n- Lists with `-` or `1.`\n- [ ] Open tasks with `- [ ]`\n- [x] And done ones with `- [x]`\n\n> Quotes start with `>`.\n\n| Tables | Too |\n|---|---|\n| yes | they work |\n',
  },
};

marked.setOptions({ gfm: true, breaks: true });
DOMPurify.addHook('afterSanitizeAttributes', (nodo) => {
  if (nodo.tagName === 'A' && nodo.getAttribute('href')) { nodo.setAttribute('target', '_blank'); nodo.setAttribute('rel', 'noopener noreferrer'); }
  // Solo se admiten las casillas de las listas de tareas, y siempre inertes.
  if (nodo.tagName === 'INPUT') { if (nodo.getAttribute('type') !== 'checkbox') nodo.remove(); else nodo.setAttribute('disabled', ''); }
});
export const aHtml = (md) => DOMPurify.sanitize(marked.parse(md), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe'], ADD_ATTR: ['checked', 'disabled', 'type', 'target'] });

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export function tituloDe(texto, vacio) {
  const linea = texto.split('\n').find((l) => l.trim());
  return linea ? linea.replace(/^[#>\-*\s]+/, '').replace(/[*_`]/g, '').trim().slice(0, 60) || vacio : vacio;
}
const nombreArchivo = (s) => (s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'nota').slice(0, 50);

export function mount(raiz) {
  const t = tr(T);
  let notas = store.get('notas', null);
  if (!Array.isArray(notas) || !notas.length) notas = [{ id: nuevoId(), texto: t.bienvenida, mod: Date.now() }];
  let actualId = store.get('notaActual', notas[0].id);
  if (!notas.some((n) => n.id === actualId)) actualId = notas[0].id;
  let vista = store.get('notasVista', null);
  const ancho = () => raiz.clientWidth >= 760;
  if (!vista || (vista === 'ambos' && !ancho())) vista = ancho() ? 'ambos' : 'escribir';
  let espera = 0;

  const actual = () => notas.find((n) => n.id === actualId);
  const lista = h('ul', { class: 'notas__lista', id: 'notas-lista' });
  const editor = h('textarea', { class: 'notas__editor', id: 'notas-editor', 'aria-label': t.editor, placeholder: t.ph, spellcheck: true, autocapitalize: 'sentences' });
  const previa = h('article', { class: 'notas__previa prosa', id: 'notas-previa', 'aria-label': t.previa, tabindex: '0' });
  const estado = h('span', { class: 'notas__estado', id: 'notas-estado' });
  const cuenta = h('span', { class: 'notas__cuenta' });
  const hojas = h('div', { class: 'notas__hojas', dataset: { vista } });

  function persistir() {
    const ok = store.set('notas', notas) && store.set('notaActual', actualId);
    estado.textContent = ok ? t.guardado : t.sinEspacio;
    estado.dataset.ok = String(ok);
  }
  function pintarLista() {
    const fecha = new Intl.DateTimeFormat(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    lista.replaceChildren(...[...notas].sort((a, b) => b.mod - a.mod).map((n) => h('li', null,
      h('button', { type: 'button', class: 'notas__item', 'aria-current': n.id === actualId ? 'true' : null, dataset: { id: n.id }, onclick: () => abrir(n.id) },
        h('span', { class: 'notas__it' }, tituloDe(n.texto, t.sinTitulo)), h('span', { class: 'notas__if' }, fecha.format(n.mod))))));
  }
  function pintarPrevia() {
    const n = actual();
    if (!n.texto.trim()) previa.replaceChildren(h('p', { class: 'vacio' }, t.vacia));
    else previa.innerHTML = aHtml(n.texto);
    const palabras = n.texto.trim() ? n.texto.trim().split(/\s+/).length : 0;
    cuenta.textContent = t.palabras(palabras);
  }
  function abrir(id) {
    clearTimeout(espera);
    actualId = id;
    editor.value = actual().texto;
    pintarLista(); pintarPrevia(); persistir();
  }
  function alEscribir() {
    const n = actual();
    n.texto = editor.value;
    n.mod = Date.now();
    estado.textContent = t.guardando;
    pintarPrevia();
    clearTimeout(espera);
    espera = setTimeout(() => { persistir(); pintarLista(); }, 350);
  }
  editor.addEventListener('input', alEscribir);

  /* ----- barra de formato: pensada para escribir Markdown sin teclado físico ----- */
  function envolver(antes, despues = antes, relleno = '') {
    const { selectionStart: a, selectionEnd: b, value } = editor;
    const sel = value.slice(a, b) || relleno;
    editor.setRangeText(antes + sel + despues, a, b, 'select');
    editor.selectionStart = a + antes.length;
    editor.selectionEnd = a + antes.length + sel.length;
    editor.focus();
    alEscribir();
  }
  function prefijo(p) {
    const { selectionStart: a, selectionEnd: b, value } = editor;
    const ini = value.lastIndexOf('\n', a - 1) + 1;
    const fin = value.indexOf('\n', b) === -1 ? value.length : value.indexOf('\n', b);
    const bloque = value.slice(ini, fin).split('\n').map((l) => (l.startsWith(p) ? l.slice(p.length) : p + l)).join('\n');
    editor.setRangeText(bloque, ini, fin, 'end');
    editor.focus();
    alEscribir();
  }
  const herramientas = [
    ['negrita', 'B', () => envolver('**', '**', t.negrita.toLowerCase())],
    ['cursiva', 'I', () => envolver('*', '*', t.cursiva.toLowerCase())],
    ['titulo', 'H', () => prefijo('## ')],
    ['lista', icon('lista', 22), () => prefijo('- ')],
    ['tarea', icon('tarea', 22), () => prefijo('- [ ] ')],
    ['cita', icon('cita', 22), () => prefijo('> ')],
    ['codigo', icon('codigo', 22), () => envolver('`', '`', t.codigo.toLowerCase())],
    ['enlace', icon('enlace', 22), () => envolver('[', '](https://)', t.enlace.toLowerCase())],
  ];
  const barra = h('div', { class: 'notas__barra', role: 'toolbar', 'aria-label': t.barra },
    herramientas.map(([k, signo, fn]) => h('button', { type: 'button', class: `notas__f notas__f--${k}`, 'aria-label': t[k], title: t[k], onclick: fn }, signo)));

  /* ----- acciones ----- */
  function crear(texto = '') {
    const n = { id: nuevoId(), texto, mod: Date.now() };
    notas.push(n);
    abrir(n.id);
    if (vista === 'leer') ponerVista('escribir');
    editor.focus();
  }
  function borrar() {
    const n = actual();
    const copia = { ...n };
    notas = notas.filter((x) => x.id !== n.id);
    if (!notas.length) notas.push({ id: nuevoId(), texto: '', mod: Date.now() });
    abrir([...notas].sort((a, b) => b.mod - a.mod)[0].id);
    say(t.borrada, { texto: t.deshacer, fn: () => { notas.push(copia); abrir(copia.id); } });
  }
  function exportar(tipo) {
    const n = actual();
    const titulo = tituloDe(n.texto, t.sinTitulo);
    if (tipo === 'md') download(new Blob([n.texto], { type: 'text/markdown;charset=utf-8' }), nombreArchivo(titulo) + '.md');
    else if (tipo === 'html') {
      const doc = `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo.replace(/[&<>]/g, '')}</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1.25rem;color:#1a2026}pre,code{background:#f3f5f7;border-radius:4px}pre{padding:1rem;overflow:auto}code{padding:.1em .3em}blockquote{border-left:3px solid #ccd3d9;margin-left:0;padding-left:1rem;color:#55606a}table{border-collapse:collapse}td,th{border:1px solid #ccd3d9;padding:.4rem .7rem}img{max-width:100%}</style></head><body>${aHtml(n.texto)}</body></html>`;
      download(new Blob([doc], { type: 'text/html;charset=utf-8' }), nombreArchivo(titulo) + '.html');
    } else if (tipo === 'todas') {
      download(new Blob([JSON.stringify({ app: 'cinco-hojas', version: 1, notas }, null, 2)], { type: 'application/json' }), 'notas-cinco-hojas.json');
    }
  }
  const archivo = h('input', { type: 'file', accept: '.md,.markdown,.txt,.json,text/markdown,text/plain,application/json', class: 'subida__i', id: 'notas-archivo',
    onchange: async () => {
      const a = archivo.files?.[0];
      if (!a) return;
      try {
        const texto = await a.text();
        if (/\.json$/i.test(a.name)) {
          const d = JSON.parse(texto);
          const nuevas = (Array.isArray(d) ? d : d.notas).filter((x) => x && typeof x.texto === 'string');
          if (!nuevas.length) throw new Error('vacío');
          let ultima;
          for (const x of nuevas) { ultima = { id: nuevoId(), texto: x.texto, mod: Number(x.mod) || Date.now() }; notas.push(ultima); }
          abrir(ultima.id);
          say(t.importadas(nuevas.length));
        } else { crear(texto); say(t.importadas(1)); }
      } catch { say(t.noImporta); }
      archivo.value = '';
    } });
  const menu = h('select', { class: 'sel sel--corto', id: 'notas-exportar', 'aria-label': t.exportar,
    onchange: () => { const v = menu.value; menu.value = ''; if (v === 'importar') archivo.click(); else if (v) exportar(v); } },
    h('option', { value: '' }, t.exportar), h('option', { value: 'md' }, t.md), h('option', { value: 'html' }, t.html), h('option', { value: 'todas' }, t.todas), h('option', { value: 'importar' }, t.importar));

  function ponerVista(v) {
    vista = v;
    hojas.dataset.vista = v;
    store.set('notasVista', v);
    for (const b of selVista.children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  }
  const selVista = segmented({ label: t.ver, valor: vista, clase: 'notas__vista', onChange: ponerVista,
    opciones: [{ v: 'escribir', t: t.escribir }, { v: 'leer', t: t.leer }, { v: 'ambos', t: t.ambos }] });

  hojas.append(h('div', { class: 'notas__col notas__col--e' }, barra, editor), previa);
  raiz.append(h('div', { class: 'notas' },
    h('aside', { class: 'notas__lado', 'aria-label': t.notas },
      h('button', { type: 'button', class: 'btn btn--rojo notas__nueva', id: 'notas-nueva', onclick: () => crear() }, icon('mas', 20), t.nueva),
      lista),
    h('div', { class: 'notas__main' },
      h('div', { class: 'notas__top' }, selVista, menu, archivo,
        h('button', { type: 'button', class: 'btn btn--linea notas__borrar', id: 'notas-borrar', 'aria-label': t.borrar, title: t.borrar, onclick: borrar }, icon('papelera', 20))),
      hojas,
      h('p', { class: 'notas__pie' }, estado, cuenta))));

  editor.value = actual().texto;
  pintarLista(); pintarPrevia(); persistir();
  return () => { clearTimeout(espera); if (actual()) { store.set('notas', notas); } };
}
