// Caramboleta — calibra y verifica los 100 niveles jugándolos con bots.
//
//   node tools/verificar-niveles.mjs            calibra (busca la dureza de cada nivel) y escribe js/umbrales.js
//   node tools/verificar-niveles.mjs --comprobar   solo comprueba los niveles tal como están
//
// Dos bots eligen ángulo entre un abanico de 21 candidatos simulando cada tirada:
//   · «fino»: se queda con el mejor candidato.
//   · «normal»: se queda con un candidato del montón (percentil 60), para parecerse más a una persona.
// Un nivel vale si los DOS lo ganan, y el «normal» sin acercar ningún bloque a la línea más de lo que
// permite la dificultad del nivel (dientes de sierra). Las estrellas salen de las tiradas que usan:
//   3 estrellas ≤ tiradas del fino + 1 · 2 estrellas ≤ tiradas del normal + 1 · 1 estrella: ganar.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { nivel, dificultad } from '../js/levels.js';
import { crearPartida, angulosCandidatos, simularTirada, valorar, lanzar, paso, PASO, recoger } from '../js/engine.js';
import { TOTAL_NIVELES } from '../js/config.js';

const AJUSTES = [0.3, 0.38, 0.45, 0.52, 0.6, 0.75, 0.9, 1.05, 1.25, 1.5, 1.75, 2.05, 2.4, 2.8, 3.25, 3.8, 4.4, 5.1, 6];

// Elige ángulo: el percentil se aplica solo entre los candidatos que consiguen algo (si casi ninguno
// acierta, una persona también apuntaría al único hueco bueno).
export function elegir(g, percentil) {
  const vals = angulosCandidatos(21).map((a) => ({ a, v: valorar(simularTirada(g, a, 30)) })).sort((x, y) => y.v - x.v);
  const peor = vals[vals.length - 1].v;
  const utiles = vals.filter((x) => x.v > peor);
  const lista = utiles.length ? utiles : vals;
  return lista[Math.min(lista.length - 1, Math.floor((1 - percentil) * (lista.length - 1)))].a;
}

function jugar(nv, percentil) {
  const g = crearPartida(nv);
  let maxFila = 0, segundos = 0;
  while (g.estado === 'apuntar' && g.tiradas < 80) {
    lanzar(g, elegir(g, percentil));
    let t = 0;
    while (g.estado === 'vuelo') { paso(g, PASO); t += PASO; g.eventos.length = 0; if (t > 30) recoger(g); }
    segundos += t;
    for (const b of g.bloques) if (b.vivo && b.tipo !== 'irrompible' && b.r > maxFila) maxFila = b.r;
  }
  return { gana: g.estado === 'ganado', tiradas: g.tiradas, maxFila, bolas: g.bolas, segundos: Math.round(segundos) };
}

// Cuánto puede acercarse el bot normal a la línea (fila 9 = perder): 6 en los valles, 8 en los picos.
function margen(n) {
  const k = (n - 1) % 10 + 1;
  return [6, 6, 7, 6, 7, 7, 6, 7, 8, 8][k - 1];
}

function calibrar(n) {
  let elegido = null;
  for (const a of AJUSTES) {
    const nv = nivel(n, { a });
    const normal = jugar(nv, 0.6);
    if (!normal.gana || normal.maxFila > margen(n)) break;
    const fino = jugar(nv, 1);
    if (!fino.gana) break;
    elegido = { a, normal, fino };
  }
  if (!elegido) {   // ni con la dureza más baja: se rebaja más hasta que se pueda
    for (const a of [0.5, 0.4, 0.3, 0.2, 0.12]) {
      const nv = nivel(n, { a });
      const normal = jugar(nv, 0.6), fino = jugar(nv, 1);
      if (normal.gana && fino.gana) { elegido = { a, normal, fino }; break; }
    }
  }
  return elegido;
}

function comprobar(n, u) {
  const nv = nivel(n, u);
  return { fino: jugar(nv, 1), normal: jugar(nv, 0.6), filas: nv.filas, bolas: nv.bolas };
}

if (!isMainThread) {
  const { lista, modo, tabla } = workerData;
  for (const n of lista) {
    if (modo === 'calibrar') parentPort.postMessage({ n, r: calibrar(n) });
    else parentPort.postMessage({ n, r: comprobar(n, tabla[n]) });
  }
} else {
  const modo = process.argv.includes('--comprobar') ? 'comprobar' : 'calibrar';
  const { UMBRALES } = await import('../js/umbrales.js');
  const hilos = Math.max(1, Math.min(8, os.cpus().length));
  const res = {};
  const t0 = Date.now();
  await Promise.all(Array.from({ length: hilos }, (_, h) => new Promise((ok, mal) => {
    const lista = [];
    for (let n = 1 + h; n <= TOTAL_NIVELES; n += hilos) lista.push(n);
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { lista, modo, tabla: UMBRALES } });
    w.on('message', (m) => { res[m.n] = m.r; process.stdout.write(`${m.n} `); });
    w.on('error', mal); w.on('exit', ok);
  })));
  console.log(`\n${modo}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (modo === 'calibrar') {
    const tabla = {};
    let lineas = '';
    for (let n = 1; n <= TOTAL_NIVELES; n++) {
      const r = res[n];
      if (!r) { console.log(`NIVEL ${n}: SIN SOLUCIÓN`); process.exitCode = 1; continue; }
      const t3 = r.fino.tiradas + 1, t2 = Math.max(t3 + 1, r.normal.tiradas + 1);
      tabla[n] = { a: r.a, t3, t2 };
      lineas += `  ${n}: { a: ${r.a}, t3: ${t3}, t2: ${t2} },  // fino ${r.fino.tiradas} t (fila máx ${r.fino.maxFila}), normal ${r.normal.tiradas} t (fila máx ${r.normal.maxFila}, ${r.normal.segundos} s de vuelo), dif ${dificultad(n).toFixed(2)}\n`;
    }
    writeFileSync(new URL('../js/umbrales.js', import.meta.url),
      `// Generado por tools/verificar-niveles.mjs (no editar a mano).\n// a = dureza del nivel · t3/t2 = tiradas máximas para 3 y 2 estrellas (medidas con los bots).\nexport const UMBRALES = {\n${lineas}};\n`);
    console.log('js/umbrales.js escrito');
  } else {
    let fallos = 0, sumaF = 0, sumaN = 0;
    for (let n = 1; n <= TOTAL_NIVELES; n++) {
      const r = res[n];
      const ok = r.fino.gana && r.normal.gana;
      if (!ok) fallos++;
      sumaF += r.fino.tiradas; sumaN += r.normal.tiradas;
      console.log(`${String(n).padStart(3)} ${ok ? 'OK ' : 'MAL'} fino ${r.fino.gana ? 'gana' : 'pierde'} en ${r.fino.tiradas} t (fila ${r.fino.maxFila}) · normal ${r.normal.gana ? 'gana' : 'pierde'} en ${r.normal.tiradas} t (fila ${r.normal.maxFila}, ${r.normal.segundos} s de vuelo) · ${r.filas} filas · ${r.bolas}→${r.fino.bolas} bolas`);
    }
    console.log(`\nNiveles ganados por ambos bots: ${TOTAL_NIVELES - fallos} / ${TOTAL_NIVELES}. Media de tiradas: fino ${(sumaF / TOTAL_NIVELES).toFixed(1)}, normal ${(sumaN / TOTAL_NIVELES).toFixed(1)}.`);
    if (fallos) process.exitCode = 1;
  }
}
