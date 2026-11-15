// Lee contenido/perfil.md y lo convierte en un objeto con los campos del perfil.
// Cada campo queda como { es, en } con el texto en bruto, o null si sigue pendiente.

import { direccionSegura } from './markdown.mjs';

const IDIOMAS = ['es', 'en'];

export function estaPendiente(texto) {
  const limpio = String(texto ?? '').trim().replace(/^[-*]\s*/, '');
  return !limpio || /^(pendiente|pending)\b/i.test(limpio);
}

function elementosDeLista(texto) {
  return String(texto ?? '')
    .split('\n')
    .map((l) => l.match(/^\s*[-*]\s+(.*)$/))
    .filter(Boolean)
    .map((m) => m[1].trim())
    .filter((e) => !estaPendiente(e));
}

export function leerPerfil(fuente) {
  const texto = String(fuente).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const secciones = {};
  let seccion = null;
  let idioma = null;

  for (const linea of texto.split('\n')) {
    const s = linea.match(/^##\s+(.+?)\s*$/);
    if (s) {
      seccion = s[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      secciones[seccion] = { comun: [] };
      idioma = null;
      continue;
    }
    const sub = linea.match(/^###\s+(\w+)\s*$/);
    if (sub && seccion) {
      idioma = sub[1].toLowerCase();
      secciones[seccion][idioma] = [];
      continue;
    }
    if (!seccion) continue;
    secciones[seccion][idioma ?? 'comun'].push(linea);
  }

  // Texto de una sección en un idioma; si no hay «### es/en», vale el texto común.
  const bruto = (clave, lang) => {
    const sec = secciones[clave];
    if (!sec) return '';
    return (sec[lang] ?? sec.comun).join('\n').trim();
  };

  const campoTexto = (clave) => {
    const campo = {};
    for (const lang of IDIOMAS) {
      const valor = bruto(clave, lang);
      campo[lang] = estaPendiente(valor) ? null : valor;
    }
    return campo;
  };

  const campoLista = (clave) => {
    const campo = {};
    for (const lang of IDIOMAS) {
      const elementos = elementosDeLista(bruto(clave, lang));
      campo[lang] = elementos.length ? elementos : null;
    }
    return campo;
  };

  const experiencia = campoLista('experiencia');
  for (const lang of IDIOMAS) {
    if (!experiencia[lang]) continue;
    experiencia[lang] = experiencia[lang].map((linea) => {
      const tramos = linea.split('|').map((t) => t.trim());
      return tramos.length >= 2
        ? { periodo: tramos[0], puesto: tramos[1], detalle: tramos.slice(2).join(' | ') }
        : { periodo: '', puesto: tramos[0], detalle: '' };
    });
  }

  // Enlaces: «- Etiqueta: dirección» o «- Etiqueta es / Label en: dirección».
  const enlaces = elementosDeLista(bruto('enlaces', 'comun'))
    .map((linea) => {
      const m = linea.match(/^(.*?):\s*((?:https?:\/\/|mailto:)\S+)\s*$/i);
      if (!m) return null;
      const url = direccionSegura(m[2]);
      if (!url) return null;
      const [es, en] = m[1].split(' / ').map((t) => t.trim());
      return { es, en: en || es, url };
    })
    .filter(Boolean);

  return {
    nombre: campoTexto('nombre'),
    dedicacion: campoTexto('dedicacion'),
    biografia: campoTexto('biografia'),
    experiencia,
    inquietudes: campoLista('inquietudes'),
    objetivos: campoLista('objetivos'),
    enlaces: enlaces.length ? enlaces : null,
  };
}
