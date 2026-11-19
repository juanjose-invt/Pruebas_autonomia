// Vitraluz — iconos propios de las mejoras (caja 24×24). `s` se traza, `f` se rellena.
// Los mismos trazos se usan en el canvas (cápsulas) y en la interfaz (avisos, leyenda).

const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const ICONOS = {
  multi:    { f: circ(12, 6.5, 3.2) + circ(6, 16.5, 3.2) + circ(18, 16.5, 3.2) },
  ancha:    { s: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4' },
  bomba:    { f: circ(11, 14.5, 6.2), s: 'M15.5 9.5l2.6-2.6M20 3.5v2.4M22.4 6h-2.4M18.6 4.6l1 1' },
  lenta:    { s: circ(12, 12, 8.5) + 'M12 7v5l3.4 2.2' },
  escudo:   { s: 'M12 3l7.5 3v5.4c0 4.6-3 7.9-7.5 9.6-4.5-1.7-7.5-5-7.5-9.6V6z' },
  laser:    { s: 'M7 21V10M17 21V10M7 6V3.5M17 6V3.5M3.5 21h17' },
  perfora:  { s: 'M3 12h17M15 6.5l5.5 5.5-5.5 5.5M8.5 3.5v4M8.5 16.5v4' },
  iman:     { s: 'M5.5 4v8a6.5 6.5 0 0 0 13 0V4h-4.2v8a2.3 2.3 0 0 1-4.6 0V4zM5.5 7.5h4.2M14.3 7.5h4.2' },
  vida:     { f: 'M12 20.5S4.5 15.8 4.5 9.9a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.9-7.5 10.6-7.5 10.6z' },
  estrecha: { s: 'M2.5 12h6.5M5.5 8.5L9 12l-3.5 3.5M21.5 12H15M18.5 8.5L15 12l3.5 3.5' },
  rapida:   { s: 'M4.5 6l6 6-6 6M13 6l6 6-6 6' },
};

// Color propio de cada mejora (sobre fondo oscuro).
export const COLOR_MEJORA = {
  multi: '#4fd1ff', ancha: '#5be37d', bomba: '#ff9a3c', lenta: '#a9b9ff', escudo: '#3fe0c8', laser: '#ff5f7a',
  perfora: '#ffd43f', iman: '#cf8bff', vida: '#ff7fb0', estrecha: '#ff6b5e', rapida: '#ff6b5e',
};

export function svgIcono(k, clase = '') {
  const i = ICONOS[k]; if (!i) return '';
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" aria-hidden="true">${i.f ? `<path class="rel" d="${i.f}"/>` : ''}${i.s ? `<path d="${i.s}"/>` : ''}</svg>`;
}
