// Alternativa sin WebGL: un esquema vectorial por tipo de paso, con el mismo código de color
// que la escena 3D (rojo = gesto principal, verde = giro o segundo movimiento).
const D = '#f1dfba', DS = '#b9976a', R = '#c5301e', G = '#2f6b3a', INK = '#1c2b20';

const frame = (inner) => `<svg viewBox="0 0 400 260" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs>
<marker id="ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${R}"/></marker>
<marker id="ag" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${G}"/></marker>
</defs>
<rect width="400" height="260" fill="#f4ecd9"/>
<rect y="206" width="400" height="54" fill="#e6e2d8"/><path d="M0 206H400" stroke="#bdb9af" stroke-width="2"/>
${inner}</svg>`;
const ar = (d, c = R, id = 'ar') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" marker-end="url(#${id})"/>`;
const ag = (d) => ar(d, G, 'ag');
const bowl = `<path d="M92 112Q104 206 200 206Q296 206 308 112" fill="#f6efe0" stroke="${DS}" stroke-width="3"/><path d="M86 112H314" stroke="${R}" stroke-width="6" stroke-linecap="round"/>`;
const dough = (d) => `<path d="${d}" fill="${D}" stroke="${DS}" stroke-width="3" stroke-linejoin="round"/>`;
const clock = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="#fbf6ea" stroke="${INK}" stroke-width="3"/><path d="M${x} ${y - 11}V${y}l8 6" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;

const DIAGRAMS = {
  mix: () => frame(`${bowl}
<path d="M140 200Q200 120 260 200z" fill="#fbf7ee" stroke="${DS}" stroke-width="2"/>
<path d="M232 40V150" stroke="#8fc3d1" stroke-width="7" stroke-linecap="round"/>
<path d="M214 22h44l-8 26h-28z" fill="#dcebe4" stroke="${DS}" stroke-width="2"/>
${ar('M150 84A52 16 0 1 0 250 84')}`),
  autolyse: () => frame(`${bowl}
${dough('M132 200Q128 160 160 158Q178 140 204 152Q236 138 250 162Q276 168 268 200z')}
<path d="M70 118Q200 92 330 118" fill="none" stroke="#cfc4a8" stroke-width="7" stroke-linecap="round"/>
${clock(340, 60)}`),
  knead: () => frame(`${dough('M96 204Q84 160 150 150Q230 132 300 168Q330 190 300 204z')}
${ar('M120 120H250')}
${ag('M300 140Q330 80 250 76Q200 76 190 120')}
${ag('M150 236Q200 252 250 236')}`),
  fold: () => frame(`${bowl}
${dough('M128 200Q124 170 170 166L236 166Q262 100 282 60Q296 70 292 96Q286 170 270 200z')}
${ar('M276 50Q210 -6 150 120')}
${ag('M110 232Q200 256 290 232')}`),
  ball: () => frame(`<path d="M132 204A68 62 0 0 1 268 204z" fill="${D}" stroke="${DS}" stroke-width="3"/>
<path d="M108 204Q96 150 136 118" fill="none" stroke="#b98f6c" stroke-width="12" stroke-linecap="round"/>
<path d="M292 204Q304 150 264 118" fill="none" stroke="#b98f6c" stroke-width="12" stroke-linecap="round"/>
${ar('M120 232Q200 256 280 232')}
${ag('M200 120V90')}`),
  ferment: () => frame(`<path d="M112 204A88 92 0 0 1 288 204z" fill="${D}" stroke="${DS}" stroke-width="3"/>
<path d="M146 204A54 56 0 0 1 254 204" fill="none" stroke="${R}" stroke-width="3" stroke-dasharray="7 7"/>
<circle cx="170" cy="150" r="9" fill="none" stroke="${DS}" stroke-width="2"/><circle cx="222" cy="136" r="6" fill="none" stroke="${DS}" stroke-width="2"/><circle cx="244" cy="172" r="7" fill="none" stroke="${DS}" stroke-width="2"/>
${ar('M200 96V52')}${ar('M106 150L78 126')}${ar('M294 150L322 126')}
${clock(346, 56)}`),
  stretch: () => frame(`<path d="M60 204Q60 176 84 178Q104 180 112 192H288Q296 180 316 178Q340 176 340 204z" fill="${D}" stroke="${DS}" stroke-width="3" stroke-linejoin="round"/>
${ar('M186 150H110')}${ar('M214 150H290')}
<path d="M200 120V176" stroke="#b98f6c" stroke-width="12" stroke-linecap="round"/>
${ag('M130 236Q200 256 270 236')}`),
  bake: () => frame(`<path d="M40 206V120A160 110 0 0 1 360 120V206" fill="#7a4a34" stroke="#4e2e20" stroke-width="4"/>
<path d="M70 206V128A130 88 0 0 1 330 128V206z" fill="#2a1c16"/>
<path d="M110 204Q108 168 136 172Q150 174 156 190H244Q250 174 264 172Q292 168 290 204z" fill="#e2b46a" stroke="#8a5a2b" stroke-width="3" stroke-linejoin="round"/>
<path d="M158 190H242" stroke="${R}" stroke-width="7" stroke-linecap="round"/>
${ar('M150 96V140', '#ff9a4a')}${ar('M200 84V132', '#ff9a4a')}${ar('M250 96V140', '#ff9a4a')}`),
};

export function diagram(type) {
  return (DIAGRAMS[type] || DIAGRAMS.mix)();
}
