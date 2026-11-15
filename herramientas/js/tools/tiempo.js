import { h, icon, tr, store, segmented, toggle } from '../core.js';

const T = {
  es: {
    modo: 'Modo', crono: 'Cronómetro', pomo: 'Pomodoro',
    iniciar: 'Iniciar', pausar: 'Pausar', seguir: 'Seguir', vuelta: 'Vuelta', reiniciar: 'Reiniciar',
    vueltas: 'Vueltas', sinVueltas: 'Pulsa «Vuelta» con el cronómetro en marcha para marcar parciales.',
    rapida: 'la más rápida', lenta: 'la más lenta', total: 'total', n: 'N.º',
    fases: { foco: 'Concentración', corta: 'Descanso corto', larga: 'Descanso largo' },
    saltar: 'Saltar fase', ronda: (a, b) => `Ronda ${a} de ${b}`,
    ajustes: 'Duraciones', minFoco: 'Concentración', minCorta: 'Descanso corto', minLarga: 'Descanso largo', cada: 'Descanso largo cada', rondas: 'rondas', min: 'min',
    menos: 'Menos', mas: 'Más',
    sonido: 'Aviso sonoro al acabar cada fase', auto: 'Empezar la fase siguiente sin preguntar', probar: 'Probar el aviso',
    tiempo: 'Tiempo transcurrido', queda: 'Tiempo restante',
  },
  en: {
    modo: 'Mode', crono: 'Stopwatch', pomo: 'Pomodoro',
    iniciar: 'Start', pausar: 'Pause', seguir: 'Resume', vuelta: 'Lap', reiniciar: 'Reset',
    vueltas: 'Laps', sinVueltas: 'Press “Lap” while the stopwatch runs to mark split times.',
    rapida: 'fastest', lenta: 'slowest', total: 'total', n: 'No.',
    fases: { foco: 'Focus', corta: 'Short break', larga: 'Long break' },
    saltar: 'Skip phase', ronda: (a, b) => `Round ${a} of ${b}`,
    ajustes: 'Durations', minFoco: 'Focus', minCorta: 'Short break', minLarga: 'Long break', cada: 'Long break every', rondas: 'rounds', min: 'min',
    menos: 'Less', mas: 'More',
    sonido: 'Play a chime when each phase ends', auto: 'Start the next phase without asking', probar: 'Test the chime',
    tiempo: 'Elapsed time', queda: 'Time left',
  },
};

/* ================= motor (vive a nivel de módulo: sigue contando al cambiar de hoja) ================= */
const CFG0 = { foco: 25, corta: 5, larga: 15, cada: 4, sonido: true, auto: true };
const crono = Object.assign({ running: false, t0: 0, acc: 0, laps: [] }, store.get('crono', {}));
const pomo = Object.assign({ running: false, fase: 'foco', fin: 0, queda: null, ronda: 1 }, store.get('pomo', {}));
pomo.cfg = Object.assign({}, CFG0, pomo.cfg);
if (pomo.queda == null) pomo.queda = pomo.cfg.foco * 60000;

const guardar = () => { store.set('crono', crono); store.set('pomo', pomo); window.dispatchEvent(new Event('cincohojas:tiempo')); };
const durFase = (f) => pomo.cfg[f] * 60000;
export const cronoMs = () => crono.acc + (crono.running ? Date.now() - crono.t0 : 0);
export const pomoMs = () => (pomo.running ? Math.max(0, pomo.fin - Date.now()) : pomo.queda);

let audio = null;
function prepararAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
/** Aviso sintetizado: tres notas ascendentes al acabar de concentrarse, descendentes al acabar el descanso. */
export function sonar(tipo = 'foco') {
  prepararAudio();
  if (!audio) return false;
  const notas = tipo === 'foco' ? [659.25, 830.61, 987.77] : [987.77, 830.61, 659.25];
  const ahora = audio.currentTime + 0.02;
  notas.forEach((f, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const t = ahora + i * 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 2 ? 0.9 : 0.34));
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 1);
  });
  window.dispatchEvent(new CustomEvent('cincohojas:aviso', { detail: { tipo, estado: audio.state } }));
  return true;
}

function siguienteFase() {
  const era = pomo.fase;
  if (era === 'foco') {
    pomo.fase = pomo.ronda % pomo.cfg.cada === 0 ? 'larga' : 'corta';
  } else {
    pomo.ronda = era === 'larga' ? 1 : pomo.ronda + 1;
    pomo.fase = 'foco';
  }
  return era;
}
function terminarFase(avisar) {
  const era = siguienteFase();
  if (avisar) {
    if (pomo.cfg.sonido) sonar(era);
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
  }
  if (pomo.running && (pomo.cfg.auto || !avisar)) { pomo.fin = Date.now() + durFase(pomo.fase); pomo.queda = durFase(pomo.fase); }
  else { pomo.running = false; pomo.queda = durFase(pomo.fase); }
  guardar();
}

let reloj = 0;
function latido() {
  if (pomo.running && Date.now() >= pomo.fin) terminarFase(true);
  if (pomo.running) {
    const d = tr(T);
    document.title = `${mmss(pomoMs())} ${d.fases[pomo.fase]}`;
  }
  pintores.forEach((f) => f());
  if (!pomo.running && !crono.running) { clearInterval(reloj); reloj = 0; }
}
function arrancarReloj() { if (!reloj) reloj = setInterval(latido, 250); }
const pintores = new Set();

const dos = (n) => String(n).padStart(2, '0');
export function mmss(ms) {
  const s = Math.ceil(ms / 1000);
  return `${dos(Math.floor(s / 60))}:${dos(s % 60)}`;
}
export function cronoTxt(ms) {
  const c = Math.floor(ms / 10);
  const hh = Math.floor(c / 360000), mm = Math.floor(c / 6000) % 60, ss = Math.floor(c / 100) % 60;
  return { grande: `${hh ? hh + ':' : ''}${dos(mm)}:${dos(ss)}`, cent: `.${dos(c % 100)}` };
}

if (pomo.running || crono.running) arrancarReloj();

/* ================= interfaz ================= */
export function mount(raiz) {
  const t = tr(T);
  let vista = store.get('tiempoVista', 'crono');
  const cuerpo = h('div', { class: 'tiempo__cuerpo' });
  let raf = 0;
  let limpiar = () => {};

  function pintarCrono() {
    const grande = h('span', { class: 'reloj__g' }), cent = h('span', { class: 'reloj__c' });
    const reloj$ = h('div', { class: 'reloj', role: 'timer', 'aria-label': t.tiempo, id: 'crono-reloj' }, grande, cent);
    const bPlay = h('button', { type: 'button', class: 'btn btn--rojo btn--xl', id: 'crono-play' });
    const bVuelta = h('button', { type: 'button', class: 'btn btn--acero btn--xl', id: 'crono-vuelta' }, icon('bandera', 22), t.vuelta);
    const bReset = h('button', { type: 'button', class: 'btn btn--linea btn--xl', id: 'crono-reset' }, icon('refrescar', 22), t.reiniciar);
    const lista = h('div', { class: 'vueltas' });

    const tick = () => {
      const x = cronoTxt(cronoMs());
      grande.textContent = x.grande; cent.textContent = x.cent;
      if (crono.running) raf = requestAnimationFrame(tick);
    };
    function estado() {
      bPlay.replaceChildren(icon(crono.running ? 'pausa' : 'play', 22), crono.running ? t.pausar : cronoMs() > 0 ? t.seguir : t.iniciar);
      bVuelta.disabled = !crono.running;
      bReset.disabled = crono.running || cronoMs() === 0;
      cancelAnimationFrame(raf); tick();
      pintarVueltas();
    }
    function pintarVueltas() {
      if (!crono.laps.length) { lista.replaceChildren(h('p', { class: 'vacio' }, t.sinVueltas)); return; }
      const parciales = crono.laps.map((tot, i) => tot - (i ? crono.laps[i - 1] : 0));
      const min = Math.min(...parciales), max = Math.max(...parciales);
      const filas = parciales.map((p, i) => {
        const x = cronoTxt(p), tt = cronoTxt(crono.laps[i]);
        const marca = parciales.length > 1 && min !== max ? (p === min ? t.rapida : p === max ? t.lenta : '') : '';
        return h('tr', { class: marca === t.rapida ? 'es-rapida' : marca === t.lenta ? 'es-lenta' : '' },
          h('th', { scope: 'row' }, i + 1), h('td', { class: 'vueltas__p' }, x.grande + x.cent, marca ? h('span', { class: 'vueltas__m' }, marca) : null), h('td', { class: 'vueltas__t' }, tt.grande + tt.cent));
      }).reverse();
      lista.replaceChildren(h('table', { class: 'vueltas__tabla' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, t.n), h('th', { scope: 'col' }, t.vuelta), h('th', { scope: 'col' }, t.total))),
        h('tbody', null, filas)));
    }
    bPlay.onclick = () => {
      if (crono.running) { crono.acc = cronoMs(); crono.running = false; }
      else { crono.t0 = Date.now(); crono.running = true; arrancarReloj(); }
      guardar(); estado();
    };
    bVuelta.onclick = () => { crono.laps.push(cronoMs()); guardar(); pintarVueltas(); };
    bReset.onclick = () => { crono.acc = 0; crono.laps = []; crono.running = false; guardar(); estado(); };
    cuerpo.replaceChildren(reloj$, h('div', { class: 'tiempo__botones' }, bPlay, bVuelta, bReset), h('h2', { class: 'sub' }, t.vueltas), lista);
    estado();
    limpiar = () => cancelAnimationFrame(raf);
  }

  function pintarPomo() {
    const fase = h('p', { class: 'pomo__fase', id: 'pomo-fase' });
    const reloj$ = h('div', { class: 'reloj reloj--pomo', role: 'timer', 'aria-label': t.queda, id: 'pomo-reloj' });
    const barra = h('div', { class: 'pomo__barra', 'aria-hidden': 'true' }, h('i'));
    const ronda = h('p', { class: 'pomo__ronda', id: 'pomo-ronda' });
    const bPlay = h('button', { type: 'button', class: 'btn btn--rojo btn--xl', id: 'pomo-play' });
    const bSaltar = h('button', { type: 'button', class: 'btn btn--acero btn--xl', id: 'pomo-saltar' }, icon('saltar', 22), t.saltar);
    const bReset = h('button', { type: 'button', class: 'btn btn--linea btn--xl', id: 'pomo-reset' }, icon('refrescar', 22), t.reiniciar);

    let ultimaFase = null, ultimoRun = null;
    function pintar() {
      const ms = pomoMs();
      reloj$.textContent = mmss(ms);
      barra.firstChild.style.transform = `scaleX(${1 - ms / durFase(pomo.fase)})`;
      if (ultimaFase !== pomo.fase + pomo.ronda || ultimoRun !== pomo.running) {
        ultimaFase = pomo.fase + pomo.ronda; ultimoRun = pomo.running;
        fase.textContent = t.fases[pomo.fase];
        cuerpo.dataset.fase = pomo.fase;
        ronda.replaceChildren(t.ronda(pomo.ronda, pomo.cfg.cada), h('span', { class: 'pomo__puntos', 'aria-hidden': 'true' },
          Array.from({ length: pomo.cfg.cada }, (_, i) => h('i', { class: i < pomo.ronda - (pomo.fase === 'foco' ? 1 : 0) ? 'hecho' : i === pomo.ronda - 1 ? 'ahora' : '' }))));
        const empezada = ms < durFase(pomo.fase);
        bPlay.replaceChildren(icon(pomo.running ? 'pausa' : 'play', 22), pomo.running ? t.pausar : empezada ? t.seguir : t.iniciar);
      }
    }
    bPlay.onclick = () => {
      prepararAudio();
      if (pomo.running) { pomo.queda = pomoMs(); pomo.running = false; }
      else { pomo.fin = Date.now() + pomo.queda; pomo.running = true; arrancarReloj(); }
      guardar(); pintar();
    };
    bSaltar.onclick = () => { terminarFase(false); if (!pomo.running) document.title = `${t.pomo} – Cinco hojas`; ultimaFase = null; pintar(); };
    bReset.onclick = () => { pomo.running = false; pomo.fase = 'foco'; pomo.ronda = 1; pomo.queda = durFase('foco'); guardar(); ultimaFase = null; pintar(); };

    function paso(clave, etiqueta, min, max, unidad) {
      const id = 'pomo-' + clave;
      const input = h('input', { class: 'paso__i', id, type: 'number', inputmode: 'numeric', min, max, step: 1, value: pomo.cfg[clave],
        onchange: () => poner(Number(input.value)) });
      function poner(v) {
        v = Math.min(max, Math.max(min, Math.round(v) || min));
        input.value = v;
        pomo.cfg[clave] = v;
        // Si la fase afectada no ha empezado, adopta la duración nueva.
        if (!pomo.running && clave === pomo.fase) pomo.queda = durFase(pomo.fase);
        guardar(); ultimaFase = null; pintar();
      }
      return h('div', { class: 'paso' }, h('label', { class: 'rot', for: id }, etiqueta),
        h('div', { class: 'paso__fila' },
          h('button', { type: 'button', class: 'paso__b', 'aria-label': `${t.menos}: ${etiqueta}`, onclick: () => poner(pomo.cfg[clave] - 1) }, icon('menos', 20)),
          input,
          h('button', { type: 'button', class: 'paso__b', 'aria-label': `${t.mas}: ${etiqueta}`, onclick: () => poner(pomo.cfg[clave] + 1) }, icon('mas', 20)),
          h('span', { class: 'paso__u' }, unidad)));
    }

    cuerpo.replaceChildren(
      fase, reloj$, barra, ronda,
      h('div', { class: 'tiempo__botones' }, bPlay, bSaltar, bReset),
      h('h2', { class: 'sub' }, t.ajustes),
      h('div', { class: 'pasos' },
        paso('foco', t.minFoco, 1, 180, t.min), paso('corta', t.minCorta, 1, 60, t.min), paso('larga', t.minLarga, 1, 120, t.min), paso('cada', t.cada, 2, 12, t.rondas)),
      h('div', { class: 'clave__palancas' },
        toggle({ texto: t.sonido, valor: pomo.cfg.sonido, id: 'pomo-sonido', onChange: (v) => { pomo.cfg.sonido = v; guardar(); } }),
        toggle({ texto: t.auto, valor: pomo.cfg.auto, id: 'pomo-auto', onChange: (v) => { pomo.cfg.auto = v; guardar(); } })),
      h('button', { type: 'button', class: 'btn btn--acero', id: 'pomo-probar', onclick: () => sonar('foco') }, icon('sonido', 20), t.probar));
    pintar();
    pintores.add(pintar);
    limpiar = () => pintores.delete(pintar);
  }

  function pintarVista() {
    limpiar();
    delete cuerpo.dataset.fase;
    (vista === 'crono' ? pintarCrono : pintarPomo)();
  }

  raiz.append(h('div', { class: 'tiempo' },
    segmented({ label: t.modo, valor: vista, opciones: [{ v: 'crono', t: t.crono }, { v: 'pomo', t: t.pomo }], onChange: (v) => { vista = v; store.set('tiempoVista', v); pintarVista(); } }),
    cuerpo));
  pintarVista();
  return () => limpiar();
}
