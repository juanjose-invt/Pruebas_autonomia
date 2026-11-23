// Caramboleta — iconos propios de las mejoras (caja 24×24). `s` se traza, `f` se rellena.
// Los mismos trazos se usan en el lienzo (caramelos de mejora) y en la interfaz (ayuda, avisos).

const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const ICONOS = {
  extra:   { s: 'M4 12h8M8 8v8M15 9l3-2.5V18' },
  divide:  { f: circ(12, 18, 2.8) + circ(5.5, 6.5, 2.8) + circ(18.5, 6.5, 2.8), s: 'M12 15V9.5M12 15l-4.6-5.8M12 15l4.6-5.8' },
  rayoH:   { s: 'M2 12h5l2.2-4.5 3.6 9 2.2-4.5H22' },
  rayoV:   { s: 'M12 2v5l4.5 2.2-9 3.6 4.5 2.2V22' },
  bomba:   { f: circ(11, 14.5, 6.2), s: 'M15.5 9.5l2.6-2.6M20 3.5v2.4M22.4 6h-2.4M18.6 4.6l1 1' },
  perfora: { s: 'M3 21L19 5M14.5 4.5H19.5V9.5M7 11l6 6' },
  rebote:  { s: 'M4 21h16M7 18l10-2.5L7 13l10-2.5L7 8l10-2.5M12 5.5V2.5' },
  congela: { s: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6L12 7l2.4-2.4M9.6 19.4L12 17l2.4 2.4' },
};

// Color propio de cada mejora (caramelo oscuro con el icono en blanco encima: contraste ≥ 3:1).
export const COLOR_MEJORA = {
  extra: '#0f9465', divide: '#7446e0', rayoH: '#d9531f', rayoV: '#b8327f',
  bomba: '#cf2f3a', perfora: '#0b8794', rebote: '#4e8a12', congela: '#2a6fc4',
};

export function svgIcono(k, clase = '') {
  const i = ICONOS[k]; if (!i) return '';
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" aria-hidden="true">${i.f ? `<path class="rel" d="${i.f}"/>` : ''}${i.s ? `<path d="${i.s}"/>` : ''}</svg>`;
}

// Path2D listos para el lienzo (se crean una vez).
let cache = null;
export function pathsIconos() {
  if (cache || typeof Path2D === 'undefined') return cache;
  cache = {};
  for (const k in ICONOS) cache[k] = { f: ICONOS[k].f ? new Path2D(ICONOS[k].f) : null, s: ICONOS[k].s ? new Path2D(ICONOS[k].s) : null };
  return cache;
}
