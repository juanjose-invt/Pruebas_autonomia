// Prueba suelta: un bot juega un nivel y cuenta cada tirada.
// Uso: node tools/prueba-rapida.mjs <nivel> [ajuste] [percentil 0..1]
import { nivel } from '../js/levels.js';
import { crearPartida, angulosCandidatos, simularTirada, valorar, lanzar, paso, PASO, recoger } from '../js/engine.js';
const n = Number(process.argv[2] || 1), a = process.argv[3] ? Number(process.argv[3]) : null, pc = Number(process.argv[4] || 1);
const nv = nivel(n, a ? { a } : null);
const g = crearPartida(nv);
const t0 = Date.now();
let tJuego = 0;
const dibujo = () => {
  const filas = [];
  for (let r = -2; r < 10; r++) {
    let s = '';
    for (let c = 0; c < 7; c++) {
      const b = g.bloques.find((x) => x.vivo && x.c === c && x.r === r);
      const it = g.items.find((x) => x.vivo && x.c === c && x.r === r);
      s += b ? (b.tipo === 'irrompible' ? '  ##' : String(b.hp).padStart(4)) : it ? '   ' + it.k[0] : '   .';
    }
    filas.push(String(r).padStart(2) + s);
  }
  return filas.join('\n');
};
while (g.estado === 'apuntar' && g.tiradas < 60) {
  const vals = angulosCandidatos(21).map((x) => ({ a: x, v: valorar(simularTirada(g, x, 30)) })).sort((x, y) => y.v - x.v);
  const el = vals[Math.min(vals.length - 1, Math.floor((1 - pc) * (vals.length - 1)))];
  lanzar(g, el.a);
  let t = 0;
  while (g.estado === 'vuelo') { paso(g, PASO); t += PASO; g.eventos.length = 0; if (t > 30) recoger(g); }
  tJuego += t;
  if (process.argv.includes('-v')) console.log(`tirada ${g.tiradas} ang ${(el.a * 180 / Math.PI).toFixed(0)} t ${t.toFixed(1)}s bolas ${g.bolas} quedan ${g.restantes}\n${dibujo()}`);
}
console.log(JSON.stringify({ n, a, pc, estado: g.estado, tiradas: g.tiradas, bolas: g.bolas, total: g.total, filas: nv.filas, segJuego: Math.round(tJuego), ms: Date.now() - t0 }));
