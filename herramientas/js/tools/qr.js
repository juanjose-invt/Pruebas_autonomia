import { h, icon, tr, store, say, download, segmented, toggle } from '../core.js';
import { matriz, geometria, pintarCanvas, svg } from '../qr-render.js';

const T = {
  es: {
    contenido: 'Contenido', tipos: { texto: 'Texto', url: 'Enlace', wifi: 'Wifi', contacto: 'Contacto' },
    texto: 'Texto', url: 'Dirección web', urlPh: 'ejemplo.org/pagina',
    ssid: 'Nombre de la red', pass: 'Contraseña de la red', cifrado: 'Seguridad', sinClave: 'Abierta (sin contraseña)', oculta: 'La red está oculta',
    nombre: 'Nombre', apellidos: 'Apellidos', tel: 'Teléfono', email: 'Correo', org: 'Empresa', web: 'Web',
    logo: 'Imagen central', subirLogo: 'Elegir logo o foto', cambiar: 'Cambiar imagen', quitar: 'Quitar', tamLogo: 'Tamaño de la imagen', formaLogo: 'Recorte',
    cuadrado: 'Cuadrado', redondo: 'Redondo', local: 'La imagen se procesa en este dispositivo; no se sube a ningún sitio.',
    puntos: 'Puntos', formaPuntos: 'Forma de los puntos', pts: { cuadrado: 'Cuadrados', redondo: 'Redondos', fluido: 'Fluidos', barras: 'Barras' },
    esquinas: 'Esquinas', formaEsquinas: 'Forma de las esquinas', esq: { cuadrado: 'Rectas', redondeado: 'Suaves', circulo: 'Redondas' },
    colores: 'Colores', colPuntos: 'Puntos', colEsquinas: 'Esquinas', colFondo: 'Fondo', otro: 'Otro color',
    fondo: 'Foto de fondo', subirFondo: 'Elegir foto de fondo', velo: 'Aclarar la foto',
    vista: 'Vista previa del código QR',
    comprobando: 'Comprobando si se lee…',
    ok: 'Se lee bien', okD: 'Descodificado dentro de la app a tamaño normal y a tamaño pequeño.',
    justo: 'Se lee, pero con poco margen', justoD: 'De lejos o impreso pequeño puede fallar. Prueba con una imagen central más pequeña, más contraste o aclarando la foto.',
    mal: 'No se lee', malD: 'La app no ha conseguido descodificarlo. Reduce la imagen central, sube el contraste entre puntos y fondo o aclara más la foto.',
    vacio: 'Escribe algo para generar el código', vacioD: 'El QR aparece en cuanto haya contenido.',
    largo: 'Demasiado contenido', largoD: 'No cabe en un QR con esta corrección de errores. Acorta el texto.',
    sinLector: 'No se pudo cargar el comprobador', sinLectorD: 'El QR se ha generado, pero no se ha podido verificar.',
    invertido: 'Los puntos son más claros que el fondo: muchos lectores no leen códigos invertidos.',
    datos: (n, niv, pct) => `${n} × ${n} módulos, corrección de errores ${niv} (${pct} %)`,
    png: 'Descargar PNG', svg: 'Descargar SVG', tam: 'Tamaño del PNG', bajado: 'Descargado', noImagen: 'No se pudo abrir esa imagen. Prueba con un JPG o PNG.',
  },
  en: {
    contenido: 'Content', tipos: { texto: 'Text', url: 'Link', wifi: 'Wi-Fi', contacto: 'Contact' },
    texto: 'Text', url: 'Web address', urlPh: 'example.org/page',
    ssid: 'Network name', pass: 'Network password', cifrado: 'Security', sinClave: 'Open (no password)', oculta: 'The network is hidden',
    nombre: 'First name', apellidos: 'Last name', tel: 'Phone', email: 'Email', org: 'Company', web: 'Website',
    logo: 'Centre image', subirLogo: 'Choose a logo or photo', cambiar: 'Change image', quitar: 'Remove', tamLogo: 'Image size', formaLogo: 'Crop',
    cuadrado: 'Square', redondo: 'Round', local: 'The image is processed on this device; it is not uploaded anywhere.',
    puntos: 'Dots', formaPuntos: 'Dot shape', pts: { cuadrado: 'Square', redondo: 'Round', fluido: 'Fluid', barras: 'Bars' },
    esquinas: 'Corners', formaEsquinas: 'Corner shape', esq: { cuadrado: 'Sharp', redondeado: 'Soft', circulo: 'Round' },
    colores: 'Colours', colPuntos: 'Dots', colEsquinas: 'Corners', colFondo: 'Background', otro: 'Other colour',
    fondo: 'Background photo', subirFondo: 'Choose a background photo', velo: 'Lighten the photo',
    vista: 'QR code preview',
    comprobando: 'Checking that it scans…',
    ok: 'Scans well', okD: 'Decoded inside the app at normal size and at small size.',
    justo: 'Scans, but only just', justoD: 'It may fail from a distance or printed small. Try a smaller centre image, more contrast or a lighter photo.',
    mal: 'Does not scan', malD: 'The app could not decode it. Shrink the centre image, raise the contrast between dots and background or lighten the photo.',
    vacio: 'Type something to make the code', vacioD: 'The QR appears as soon as there is content.',
    largo: 'Too much content', largoD: 'It does not fit in a QR at this error correction. Shorten the text.',
    sinLector: 'The checker could not be loaded', sinLectorD: 'The QR was generated but could not be verified.',
    invertido: 'The dots are lighter than the background: many scanners cannot read inverted codes.',
    datos: (n, niv, pct) => `${n} × ${n} modules, error correction ${niv} (${pct}%)`,
    png: 'Download PNG', svg: 'Download SVG', tam: 'PNG size', bajado: 'Downloaded', noImagen: 'That image could not be opened. Try a JPG or PNG.',
  },
};

const TINTAS = ['#1A2026', '#C8102E', '#0B3D91', '#0F6B3E', '#5B2A86'];
const FONDOS = ['#FFFFFF', '#F3F5F7', '#FFF3D1'];
const PCT = { L: 7, M: 15, Q: 25, H: 30 };

// El contenido sensible (wifi, contacto) y las imágenes viven solo en memoria.
const memoria = { wifi: { ssid: '', pass: '', cif: 'WPA', oculta: false }, contacto: { nombre: '', apellidos: '', tel: '', email: '', org: '', web: '' }, logo: null, fondo: null };

let lector = null;
function cargarLector() {
  lector ||= new Promise((ok, ko) => {
    if (window.jsQR) return ok(window.jsQR);
    const s = document.createElement('script');
    s.src = new URL('../../vendor/jsQR.js', import.meta.url).href;
    s.onload = () => (window.jsQR ? ok(window.jsQR) : ko(new Error('jsQR')));
    s.onerror = () => { lector = null; ko(new Error('jsQR')); };
    document.head.append(s);
  });
  return lector;
}

const escWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');
const escV = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function carga(st) {
  if (st.tipo === 'texto') return st.texto;
  if (st.tipo === 'url') {
    const u = st.url.trim();
    return !u ? '' : /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;
  }
  if (st.tipo === 'wifi') {
    const w = memoria.wifi;
    if (!w.ssid.trim()) return '';
    return `WIFI:T:${w.cif};S:${escWifi(w.ssid)};${w.cif !== 'nopass' ? `P:${escWifi(w.pass)};` : ''}${w.oculta ? 'H:true;' : ''};`;
  }
  const c = memoria.contacto;
  if (!Object.values(c).some((v) => v.trim())) return '';
  const lineas = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escV(c.apellidos.trim())};${escV(c.nombre.trim())};;;`, `FN:${escV(`${c.nombre} ${c.apellidos}`.trim() || c.org.trim())}`];
  if (c.org.trim()) lineas.push(`ORG:${escV(c.org.trim())}`);
  if (c.tel.trim()) lineas.push(`TEL;TYPE=CELL:${c.tel.trim()}`);
  if (c.email.trim()) lineas.push(`EMAIL:${c.email.trim()}`);
  if (c.web.trim()) lineas.push(`URL:${c.web.trim()}`);
  lineas.push('END:VCARD');
  return lineas.join('\n');
}

/** Lee un archivo de imagen y lo recorta a un cuadrado centrado. Todo en local. */
async function leerImagen(archivo, lado, jpeg) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, hh = img.naturalHeight;
    if (!w || !hh) throw new Error('vacía');
    const rec = Math.min(w, hh);
    const fin = Math.min(lado, Math.max(rec, 64));
    const c = document.createElement('canvas');
    c.width = c.height = fin;
    c.getContext('2d').drawImage(img, (w - rec) / 2, (hh - rec) / 2, rec, rec, 0, 0, fin, fin);
    return { lienzo: c, url: jpeg ? c.toDataURL('image/jpeg', 0.86) : c.toDataURL('image/png'), nombre: archivo.name };
  } finally { URL.revokeObjectURL(url); }
}

function luminancia(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function mount(raiz) {
  const t = tr(T);
  const st = Object.assign({ tipo: 'texto', texto: 'Cinco hojas', url: '', puntos: 'cuadrado', esquinas: 'cuadrado',
    colPuntos: TINTAS[0], colEsquinas: TINTAS[1], colFondo: FONDOS[0], logoFrac: 0.24, logoForma: 'cuadrado', velo: 0.6, tam: 1024 }, store.get('qr', {}));
  const guardar = () => store.set('qr', st);
  let vivo = true, espera = 0, serie = 0;
  let ultimo = null; // { g, est, payload }

  const lienzo = h('canvas', { class: 'qr__lienzo', id: 'qr-lienzo', width: 840, height: 840, role: 'img', 'aria-label': t.vista });
  const estado = h('div', { class: 'qr__estado', id: 'qr-estado', role: 'status' });
  const datos = h('p', { class: 'qr__datos', id: 'qr-datos' });
  const aviso = h('p', { class: 'qr__aviso', id: 'qr-aviso', hidden: true }, icon('alerta', 18), h('span', null, t.invertido));
  const bPng = h('button', { type: 'button', class: 'btn btn--rojo', id: 'qr-png' }, icon('descargar', 20), t.png);
  const bSvg = h('button', { type: 'button', class: 'btn btn--acero', id: 'qr-svg' }, icon('descargar', 20), t.svg);

  function ponerEstado(clave, comprobando) {
    estado.dataset.estado = comprobando ? 'espera' : clave;
    const ic = { ok: 'ok', justo: 'alerta', mal: 'alerta', vacio: 'qr', largo: 'alerta', sinLector: 'alerta' }[clave];
    estado.replaceChildren(icon(comprobando ? 'ojo' : ic, 24), h('div', null, h('strong', null, comprobando ? t.comprobando : t[clave]), comprobando ? null : h('span', null, t[clave + 'D'])));
  }

  function generar() {
    const payload = carga(st);
    const nivel = memoria.logo || memoria.fondo ? 'H' : 'M';
    const ctx = lienzo.getContext('2d');
    aviso.hidden = luminancia(st.colPuntos) <= luminancia(st.colFondo) && luminancia(st.colEsquinas) <= luminancia(st.colFondo);
    bPng.disabled = bSvg.disabled = true;
    ultimo = null;
    const mio = ++serie;
    if (!payload) { ctx.clearRect(0, 0, 840, 840); lienzo.dataset.vacio = '1'; datos.textContent = ''; ponerEstado('vacio'); return; }
    let mat;
    try { mat = matriz(payload, nivel); } catch { ctx.clearRect(0, 0, 840, 840); lienzo.dataset.vacio = '1'; datos.textContent = ''; ponerEstado('largo'); return; }
    delete lienzo.dataset.vacio;
    const g = geometria(mat, { puntos: st.puntos, marco: st.esquinas, centro: st.esquinas, logo: memoria.logo ? { frac: st.logoFrac, forma: st.logoForma } : null });
    const est = { colPuntos: st.colPuntos, colEsquinas: st.colEsquinas, colFondo: st.colFondo, velo: st.velo,
      logo: memoria.logo?.lienzo || null, fondo: memoria.fondo?.lienzo || null, logoURL: memoria.logo?.url, fondoURL: memoria.fondo?.url };
    pintarCanvas(ctx, 840, g, est);
    ultimo = { g, est, payload };
    bPng.disabled = bSvg.disabled = false;
    datos.textContent = t.datos(g.n, nivel, PCT[nivel]);
    ponerEstado('ok', true);
    comprobar(mio, g, est, payload);
  }

  async function comprobar(mio, g, est, payload) {
    let jsQR;
    try { jsQR = await cargarLector(); } catch { if (vivo && mio === serie) ponerEstado('sinLector'); return; }
    if (!vivo || mio !== serie) return;
    const lee = (lado) => {
      const c = document.createElement('canvas');
      c.width = c.height = lado;
      const x = c.getContext('2d', { willReadFrequently: true });
      pintarCanvas(x, lado, g, est);
      const r = jsQR(x.getImageData(0, 0, lado, lado).data, lado, lado);
      return !!r && r.data === payload;
    };
    const grande = lee(Math.min(1000, Math.max(480, g.total * 8)));
    const pequeno = grande && lee(g.total * 3);
    const veredicto = grande && pequeno ? 'ok' : grande ? 'justo' : 'mal';
    ponerEstado(veredicto);
    lienzo.dataset.legible = veredicto;
  }

  const programar = () => { clearTimeout(espera); espera = setTimeout(generar, 140); guardar(); };

  /* ----- campos de contenido ----- */
  const campos = h('div', { class: 'qr__campos' });
  const campo = (id, texto, obj, clave, extra = {}) => {
    const input = h(extra.area ? 'textarea' : 'input', Object.assign({ class: 'txt', id, value: obj[clave], autocomplete: 'off', autocapitalize: 'off',
      oninput: () => { obj[clave] = input.value; programar(); } }, extra.area ? { rows: 4 } : { type: extra.type || 'text' }, extra.attrs));
    return h('div', { class: 'campo' + (extra.ancho ? ' campo--ancho' : '') }, h('label', { class: 'rot', for: id }, texto), input);
  };
  function pintarCampos() {
    const w = memoria.wifi, c = memoria.contacto;
    if (st.tipo === 'texto') campos.replaceChildren(campo('qr-texto', t.texto, st, 'texto', { area: true, ancho: true }));
    else if (st.tipo === 'url') campos.replaceChildren(campo('qr-url', t.url, st, 'url', { type: 'url', ancho: true, attrs: { placeholder: t.urlPh, inputmode: 'url' } }));
    else if (st.tipo === 'wifi') campos.replaceChildren(
      campo('qr-ssid', t.ssid, w, 'ssid'), campo('qr-pass', t.pass, w, 'pass'),
      h('div', { class: 'campo' }, h('label', { class: 'rot', for: 'qr-cif' }, t.cifrado),
        h('select', { class: 'sel', id: 'qr-cif', onchange: (e) => { w.cif = e.target.value; programar(); } },
          [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', t.sinClave]].map(([v, x]) => h('option', { value: v, selected: w.cif === v }, x)))),
      h('div', { class: 'campo campo--palanca' }, toggle({ texto: t.oculta, valor: w.oculta, id: 'qr-oculta', onChange: (v) => { w.oculta = v; programar(); } })));
    else campos.replaceChildren(
      campo('qr-nombre', t.nombre, c, 'nombre', { attrs: { autocapitalize: 'words' } }), campo('qr-apellidos', t.apellidos, c, 'apellidos', { attrs: { autocapitalize: 'words' } }),
      campo('qr-tel', t.tel, c, 'tel', { type: 'tel' }), campo('qr-email', t.email, c, 'email', { type: 'email' }),
      campo('qr-org', t.org, c, 'org'), campo('qr-web', t.web, c, 'web', { type: 'url' }));
  }

  /* ----- selector de color ----- */
  function colores(texto, clave, lista) {
    const g = h('div', { class: 'tintas', role: 'group', 'aria-label': texto });
    const marcar = () => { for (const b of g.querySelectorAll('.tinta')) b.setAttribute('aria-pressed', String(b.dataset.c === st[clave].toUpperCase())); otro.value = st[clave]; otroCaja.classList.toggle('tinta--on', !lista.includes(st[clave].toUpperCase())); };
    const otro = h('input', { type: 'color', class: 'tinta__color', 'aria-label': `${texto}: ${t.otro}`, value: st[clave], oninput: () => { st[clave] = otro.value.toUpperCase(); marcar(); programar(); } });
    const otroCaja = h('span', { class: 'tinta tinta--otro', title: t.otro }, otro);
    for (const c of lista) g.append(h('button', { type: 'button', class: 'tinta', style: `--c:${c}`, dataset: { c }, 'aria-label': `${texto} ${c}`, onclick: () => { st[clave] = c; marcar(); programar(); } }));
    g.append(otroCaja);
    marcar();
    return h('div', { class: 'campo' }, h('span', { class: 'rot' }, texto), g);
  }

  /* ----- subida de imágenes ----- */
  function subida(clave, textoSubir, lado, jpeg) {
    const caja = h('div', { class: 'subida' });
    const input = h('input', { type: 'file', accept: 'image/*', class: 'subida__i', id: `qr-${clave}-archivo`,
      onchange: async () => {
        const a = input.files?.[0];
        if (!a) return;
        try { memoria[clave] = await leerImagen(a, lado, jpeg); pintar(); pintarExtras(); generar(); }
        catch { say(t.noImagen); }
        input.value = '';
      } });
    function pintar() {
      const hay = memoria[clave];
      caja.replaceChildren(...[
        hay ? h('img', { class: 'subida__mini', src: hay.url, alt: '' }) : null,
        h('label', { class: 'btn btn--acero subida__btn', for: input.id }, icon(hay ? 'imagen' : 'subir', 20), hay ? t.cambiar : textoSubir),
        input,
        hay ? h('button', { type: 'button', class: 'btn btn--linea', id: `qr-${clave}-quitar`, onclick: () => { memoria[clave] = null; pintar(); pintarExtras(); generar(); } }, icon('papelera', 20), t.quitar) : null].filter(Boolean));
    }
    pintar();
    return caja;
  }
  const rango = (id, texto, clave, min, max, paso, fmt) => {
    const out = h('output', { class: 'rango__v', for: id }, fmt(st[clave]));
    const input = h('input', { type: 'range', class: 'rango__i', id, min, max, step: paso, value: st[clave], oninput: () => { st[clave] = Number(input.value); out.textContent = fmt(st[clave]); programar(); } });
    return h('div', { class: 'rango' }, h('label', { class: 'rot', for: id }, texto), h('div', { class: 'rango__fila' }, input, h('span', { class: 'rango__n' }, out)));
  };
  const extrasLogo = h('div', { class: 'qr__extras' }), extrasFondo = h('div', { class: 'qr__extras' });
  function pintarExtras() {
    extrasLogo.replaceChildren(...(memoria.logo ? [
      rango('qr-logo-tam', t.tamLogo, 'logoFrac', 0.14, 0.34, 0.01, (v) => `${Math.round(v * 100)} %`),
      h('div', { class: 'campo' }, h('span', { class: 'rot' }, t.formaLogo), segmented({ label: t.formaLogo, valor: st.logoForma, opciones: [{ v: 'cuadrado', t: t.cuadrado }, { v: 'redondo', t: t.redondo }], onChange: (v) => { st.logoForma = v; programar(); } }))] : []));
    extrasFondo.replaceChildren(...(memoria.fondo ? [rango('qr-velo', t.velo, 'velo', 0.2, 0.9, 0.05, (v) => `${Math.round(v * 100)} %`)] : []));
  }

  bPng.onclick = () => {
    if (!ultimo) return;
    const c = document.createElement('canvas');
    c.width = c.height = st.tam;
    pintarCanvas(c.getContext('2d'), st.tam, ultimo.g, ultimo.est);
    c.toBlob((b) => { if (b) { download(b, 'codigo-qr.png'); say(t.bajado); } }, 'image/png');
  };
  bSvg.onclick = () => {
    if (!ultimo) return;
    download(new Blob([svg(ultimo.g, ultimo.est, 1024)], { type: 'image/svg+xml' }), 'codigo-qr.svg');
    say(t.bajado);
  };

  const seccion = (titulo, ...hijos) => h('section', { class: 'qr__sec' }, h('h2', { class: 'sub' }, titulo), ...hijos);
  const op3 = (obj) => Object.entries(obj).map(([v, x]) => ({ v, t: x }));

  raiz.append(h('div', { class: 'qr' },
    h('div', { class: 'qr__vista' },
      h('div', { class: 'qr__marco' }, lienzo),
      estado, aviso, datos,
      h('div', { class: 'qr__bajar' }, bPng, bSvg,
        h('select', { class: 'sel sel--corto', 'aria-label': t.tam, id: 'qr-tam', onchange: (e) => { st.tam = Number(e.target.value); guardar(); } },
          [512, 1024, 2048].map((n) => h('option', { value: n, selected: st.tam === n }, `${n} px`))))),
    h('div', { class: 'qr__ajustes' },
      seccion(t.contenido,
        segmented({ label: t.contenido, valor: st.tipo, opciones: op3(t.tipos), onChange: (v) => { st.tipo = v; pintarCampos(); programar(); } }),
        campos),
      seccion(t.logo, subida('logo', t.subirLogo, 512, false), extrasLogo, h('p', { class: 'nota-pie' }, t.local)),
      seccion(t.puntos, segmented({ label: t.formaPuntos, valor: st.puntos, opciones: op3(t.pts), onChange: (v) => { st.puntos = v; programar(); } })),
      seccion(t.esquinas, segmented({ label: t.formaEsquinas, valor: st.esquinas, opciones: op3(t.esq), onChange: (v) => { st.esquinas = v; programar(); } })),
      seccion(t.colores, h('div', { class: 'qr__tres' }, colores(t.colPuntos, 'colPuntos', TINTAS), colores(t.colEsquinas, 'colEsquinas', TINTAS), colores(t.colFondo, 'colFondo', FONDOS))),
      seccion(t.fondo, subida('fondo', t.subirFondo, 1200, true), extrasFondo))));

  pintarCampos();
  pintarExtras();
  generar();
  return () => { vivo = false; clearTimeout(espera); };
}
