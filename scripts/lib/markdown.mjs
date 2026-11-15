// Conversor de Markdown a HTML, pequeño y sin dependencias.
// Cubre lo que usan las entradas del blog y el perfil: títulos, párrafos, listas,
// citas, notas al margen, bloques de código, reglas, imágenes, enlaces, resaltado y cursiva.
// El HTML escrito dentro del Markdown no se interpreta: se muestra como texto.

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ESQUEMAS_SEGUROS = /^(https?:|mailto:|#|\.{0,2}\/|[\w\-./%]+(?:[?#].*)?$)/i;

export function direccionSegura(url) {
  const limpia = String(url).trim();
  if (/^\s*(javascript|data|vbscript):/i.test(limpia)) return null;
  return ESQUEMAS_SEGUROS.test(limpia) ? limpia : null;
}

// Texto en línea: código, imágenes, enlaces, resaltado y cursiva.
export function enLinea(texto) {
  const guardados = [];
  const guardar = (html) => `\u0000${guardados.push(html) - 1}\u0000`;

  let s = String(texto).replace(/`([^`]+)`/g, (_, codigo) => guardar(`<code>${escapar(codigo)}</code>`));
  s = escapar(s);

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (todo, alt, url) => {
    const destino = direccionSegura(url.replace(/&amp;/g, '&'));
    return destino ? guardar(`<img src="${escapar(destino)}" alt="${alt}" loading="lazy">`) : todo;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (todo, etiqueta, url) => {
    const destino = direccionSegura(url.replace(/&amp;/g, '&'));
    if (!destino) return todo;
    const externo = /^https?:/i.test(destino) ? ' rel="noopener"' : '';
    return `<a href="${escapar(destino)}"${externo}>${etiqueta}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
}

const MARCA_MARGEN = /^\[(margen|margin)\]\s*/i;

export function markdown(fuente) {
  const lineas = String(fuente).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const salida = [];
  let i = 0;

  const esEspecial = (l) =>
    /^(#{1,6})\s/.test(l) || /^```/.test(l) || /^>/.test(l) || /^\s*([-*]|\d+[.)])\s+/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) { i++; continue; }

    // Bloque de código
    const valla = linea.match(/^```\s*([\w-]*)\s*$/);
    if (valla) {
      const cuerpo = [];
      i++;
      while (i < lineas.length && !/^```\s*$/.test(lineas[i])) cuerpo.push(lineas[i++]);
      i++;
      const lenguaje = valla[1] ? ` data-lenguaje="${escapar(valla[1])}"` : '';
      salida.push(`<pre${lenguaje} tabindex="0"><code>${escapar(cuerpo.join('\n'))}</code></pre>`);
      continue;
    }

    // Título. En una entrada, «#» se reserva para el título de la cabecera: aquí empieza en h2.
    const titulo = linea.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (titulo) {
      const nivel = Math.min(6, Math.max(2, titulo[1].length));
      salida.push(`<h${nivel}>${enLinea(titulo[2])}</h${nivel}>`);
      i++;
      continue;
    }

    // Regla horizontal
    if (/^(-{3,}|\*{3,})\s*$/.test(linea)) { salida.push('<hr>'); i++; continue; }

    // Cita o nota al margen
    if (/^>/.test(linea)) {
      const cuerpo = [];
      while (i < lineas.length && /^>/.test(lineas[i])) cuerpo.push(lineas[i++].replace(/^>\s?/, ''));
      if (MARCA_MARGEN.test(cuerpo[0] || '')) {
        cuerpo[0] = cuerpo[0].replace(MARCA_MARGEN, '');
        salida.push(`<aside class="nota-margen">${markdown(cuerpo.join('\n'))}</aside>`);
      } else {
        salida.push(`<blockquote>${markdown(cuerpo.join('\n'))}</blockquote>`);
      }
      continue;
    }

    // Lista
    const vineta = linea.match(/^\s*([-*]|\d+[.)])\s+(.*)$/);
    if (vineta) {
      const ordenada = /\d/.test(vineta[1]);
      const elementos = [];
      while (i < lineas.length) {
        const m = lineas[i].match(/^\s*([-*]|\d+[.)])\s+(.*)$/);
        if (m) { elementos.push(m[2]); i++; continue; }
        // Línea de continuación con sangría
        if (/^\s{2,}\S/.test(lineas[i]) && elementos.length) { elementos[elementos.length - 1] += ' ' + lineas[i].trim(); i++; continue; }
        break;
      }
      const etiqueta = ordenada ? 'ol' : 'ul';
      salida.push(`<${etiqueta}>${elementos.map((e) => `<li>${enLinea(e)}</li>`).join('')}</${etiqueta}>`);
      continue;
    }

    // Párrafo
    const parrafo = [linea.trim()];
    i++;
    while (i < lineas.length && lineas[i].trim() && !esEspecial(lineas[i])) parrafo.push(lineas[i++].trim());
    salida.push(`<p>${enLinea(parrafo.join(' '))}</p>`);
  }

  return salida.join('\n');
}

// Cabecera de metadatos entre líneas «---» al principio del archivo.
export function separarCabecera(fuente) {
  const texto = String(fuente).replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { datos: {}, cuerpo: texto };
  const datos = {};
  for (const linea of m[1].split('\n')) {
    const par = linea.match(/^\s*([\wáéíóúñ-]+)\s*:\s*(.*?)\s*$/i);
    if (par) datos[par[1].toLowerCase()] = par[2].replace(/^["'](.*)["']$/, '$1');
  }
  return { datos, cuerpo: m[2] };
}
