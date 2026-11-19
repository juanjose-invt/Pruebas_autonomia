// Vitraluz — interfaz y flujo de la partida. La física está en engine.js y el dibujo en render.js.

import * as CFG from './config.js';
import { nivel as nivelN, TRAMOS, W } from './levels.js';
import { crearPartida, paso, PASO, lanzar, moverPala, aplicarMejora, estrellasDe, puntuacionFinal, multiplicador, MEJORAS, ORDEN_MEJORAS } from './engine.js';
import { crearRender, PALETAS, pintarPortada } from './render.js';
import { STR } from './i18n.js';
import { datos, guardar, asegurarDia, jugadas, accesoA, gastarJugada, rachaVigente, estrellasTotales } from './store.js';
import { iniciarAudio, sfx, musica, ponerEfectos, ponerMusica, pausarAudio, vibrar, puedeVibrar } from './audio.js';
import { iniciarAnuncios, hayAnuncioListo, mostrarAnuncioRecompensado, montarEspacios } from './ads.js';
import { svgIcono, COLOR_MEJORA } from './iconos.js';

const $ = (id) => document.getElementById(id);
const t = () => STR[datos.lang] || STR.es;
const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
const tactil = window.matchMedia('(pointer: coarse)');
const num = (n) => Math.round(n).toLocaleString(datos.lang === 'en' ? 'en-GB' : 'es-ES');

const ESTRELLA = 'M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z';
const svgEstrella = (si, i = 0) => `<svg viewBox="0 0 24 24" class="${si ? 'si' : ''}" style="--i:${i}" aria-hidden="true"><path d="${ESTRELLA}"/></svg>`;
const ICO = {
  sfx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="onda" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11"/><path class="tacha" d="M15.5 9.5l5 5m0-5l-5 5"/></svg>',
  musica: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path class="tacha" d="M3 3l18 18"/></svg>',
  vibra: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="16" rx="2"/><path class="onda" d="M4 9v6M20 9v6"/><path class="tacha" d="M3 3l18 18"/></svg>',
  candado: '<svg class="candado" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};

const lienzo = $('lienzo');
const render = crearRender(lienzo);
render.reducido = reducido.matches;
reducido.addEventListener?.('change', () => { render.reducido = reducido.matches; });

let g = null, nivelActual = 0, pantalla = 'inicio', pausado = false;
let acum = 0, previo = 0, escalaT = 1, congelado = 0, tLento = 0, finEn = 0, finTipo = '';
let rect = { left: 0, top: 0, width: 1, height: 1 };
let teclas = { izq: false, der: false };
let punteroActivo = null;
let inicioSesion = performance.now();
let ultimoElogio = -1;
const coste = { suma: 0, max: 0, cuadros: 0, sim: 0, dibujo: 0 };

// ---------- textos ----------
function aplicarIdioma() {
  const s = t();
  document.documentElement.lang = datos.lang;
  document.querySelectorAll('[data-t]').forEach((el) => { const v = s[el.dataset.t]; if (typeof v === 'string') el.textContent = v; });
  document.querySelectorAll('[data-aria]').forEach((el) => { el.setAttribute('aria-label', s[el.dataset.aria]); el.title = s[el.dataset.aria]; });
  $('grupoIdioma').setAttribute('aria-label', s.idioma);
  $('grupoIdioma').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === datos.lang)));
  document.title = `Vitraluz — ${s.lema.toLowerCase()}`;
  pintarInterruptores();
  montarEspacios();
  refrescarInicio();
  if (pantalla === 'mapa') pintarMapa();
  if (g) { hudCache = {}; chips.forEach((c) => c.el.remove()); chips.clear(); }
}

function pintarInterruptores() {
  const s = t();
  const lista = [['sfx', s.efectos], ['musica', s.musica]];
  if (puedeVibrar()) lista.push(['vibra', s.vibracion]);
  document.querySelectorAll('[data-interruptores]').forEach((caja) => {
    caja.innerHTML = lista.map(([k, nombre]) => `<button type="button" class="boton icono" data-int="${k}" aria-pressed="${datos[k]}" aria-label="${nombre}" title="${nombre}: ${datos[k] ? s.activado : s.desactivado}">${ICO[k]}</button>`).join('');
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-int]');
  if (b) {
    const k = b.dataset.int;
    datos[k] = !datos[k]; guardar();
    iniciarAudio(); ponerEfectos(datos.sfx); ponerMusica(datos.musica);
    if (k === 'musica') musica(datos.musica && pantalla === 'juego' && !pausado, g ? g.nivel.tramo : 0);
    if (k === 'vibra' && datos.vibra) vibrar(30, true);
    pintarInterruptores(); sfx.boton();
    return;
  }
  const c = e.target.closest('[data-cerrar]');
  if (c) { c.closest('dialog').close(); sfx.boton(); }
});

$('grupoIdioma').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-lang]');
  if (!b || b.dataset.lang === datos.lang) return;
  datos.lang = b.dataset.lang; guardar(); aplicarIdioma(); sfx.boton();
});

function tostada(html, ms = 3200) {
  const el = $('tostada');
  el.innerHTML = html; el.hidden = false;
  clearTimeout(tostada.r); tostada.r = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- navegación ----------
function irA(p) {
  pantalla = p;
  for (const id of ['inicio', 'mapa', 'juego']) $(id).hidden = id !== p;
  if (p !== 'juego') { musica(false); g = null; }
  if (p === 'inicio') { refrescarInicio(); pintarPortadaInicio(); }
  if (p === 'mapa') pintarMapa();
}
function abrir(dlg) { if (!dlg.open) dlg.showModal(); }
function cerrarTodos() { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }

function siguienteNivel() { return datos.dia.pase || datos.desbloqueado; }
function todoSuperado() { return !!datos.niveles[CFG.TOTAL_NIVELES]; }

function refrescarInicio() {
  const s = t();
  asegurarDia();
  const n = siguienteNivel();
  $('btnJugar').textContent = todoSuperado() && !datos.dia.pase ? s.rejugarFinal : s.jugarNivel(n);
  const j = jugadas();
  $('jugadasHoy').textContent = j.pase ? s.jugadasPase(j.pase) : j.gratis > 0 ? s.jugadasGratis(j.gratis) : j.restantes > 0 ? s.jugadasAnuncio(j.restantes) : s.jugadasFin;
  const r = rachaVigente();
  $('rachaInicio').textContent = r > 0 ? s.racha(r) : s.rachaNada;
}

// ---------- mapa ----------
function pintarMapa() {
  const s = t();
  $('mapaEstrellas').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="rel" d="${ESTRELLA}"/></svg>${estrellasTotales()} / ${CFG.TOTAL_NIVELES * 3}`;
  const sig = datos.desbloqueado;
  let html = '';
  TRAMOS.forEach((tr, i) => {
    const pal = PALETAS[i];
    html += `<section class="sala"><h3>${s.tramos[tr.id]} <small>${s.nivelesDe(i * 10 + 1, i * 10 + 10)}</small></h3><p class="mec">${s.mecanicas[tr.mec]}</p><div class="teselas">`;
    for (let k = 1; k <= 10; k++) {
      const n = i * 10 + k, reg = datos.niveles[n], abierto = n <= datos.desbloqueado;
      const e = reg ? reg.e : 0;
      if (abierto) {
        html += `<button type="button" class="tesela${k === 10 ? ' hito' : ''}${n === sig && !reg ? ' siguiente' : ''}" data-n="${n}" style="--v:${pal.vidrios[(k - 1) % 5]}" aria-label="${s.nivelAria(n, e)}">${n}<span class="est">${[0, 1, 2].map((x) => svgEstrella(x < e)).join('')}</span></button>`;
      } else {
        html += `<button type="button" class="tesela cerrada${k === 10 ? ' hito' : ''}" data-n="${n}" aria-disabled="true" aria-label="${s.nivelBloqueado(n)}">${n}${ICO.candado}</button>`;
      }
    }
    html += '</div></section>';
  });
  $('salas').innerHTML = html;
}
$('salas').addEventListener('click', (e) => {
  const b = e.target.closest('.tesela'); if (!b) return;
  const n = Number(b.dataset.n);
  if (n > datos.desbloqueado) { tostada(t().nivelBloqueado(n), 2200); return; }
  abrirNivel(n); sfx.boton();
});
let nivelHoja = 1;
function abrirNivel(n) {
  const s = t(); nivelHoja = n;
  const tr = TRAMOS[Math.floor((n - 1) / 10)], reg = datos.niveles[n];
  $('nivT').textContent = `${s.nivel} ${n}`;
  $('nivSala').textContent = s.tramos[tr.id] + (n % 10 === 0 ? ` · ${s.hito}` : '');
  $('nivEstrellas').innerHTML = [0, 1, 2].map((x) => svgEstrella(reg && x < reg.e)).join('');
  $('nivEstrellas').setAttribute('aria-label', s.estrellasAria(reg ? reg.e : 0));
  $('nivDatos').innerHTML = reg ? `<li class="linea">${s.nivelRecord(num(reg.p))}</li><li class="linea">${s.nivelCombo(reg.c)}</li>` : `<li class="linea">${s.nivelSin}</li>`;
  const acc = accesoA(n);
  $('nivCoste').textContent = { pase: s.costePase, gratis: s.costeGratis, anuncio: s.costeAnuncio, tope: s.costeTope }[acc];
  abrir($('dlgNivel'));
}
$('btnNivJugar').addEventListener('click', () => { $('dlgNivel').close(); pedirNivel(nivelHoja); });

// ---------- acceso diario ----------
let nivelPedido = 1;
function pedirNivel(n) {
  iniciarAudio(); ponerEfectos(datos.sfx); ponerMusica(datos.musica);
  nivelPedido = n;
  const acc = accesoA(n);
  if (acc === 'pase' || acc === 'gratis') return empezar(n, false);
  if (acc === 'anuncio') return abrirOferta();
  return abrirTope();
}

function abrirOferta() {
  const s = t(), j = jugadas();
  $('ofTexto').textContent = s.ofertaTexto(CFG.NIVELES_GRATIS_AL_DIA, j.restantes);
  // a qué se destina solo se dice si la donación está configurada; si no, se avisa de que es una prueba
  $('ofNota').textContent = CFG.donacionConfigurada() ? s.ofertaDona(CFG.ASOCIACION_NOMBRE) : s.ofertaSimulado;
  $('ofAviso').hidden = true;
  $('btnOfertaSi').disabled = false;
  abrir($('dlgOferta'));
}
$('btnOfertaNo').addEventListener('click', () => { $('dlgOferta').close(); if (pantalla === 'juego') irA('inicio'); sfx.boton(); });
$('btnOfertaSi').addEventListener('click', async () => {
  const s = t();
  if (!hayAnuncioListo()) { $('ofAviso').textContent = s.adFallo; $('ofAviso').hidden = false; return; }
  $('btnOfertaSi').disabled = true;
  musica(false); pausarAudio(true);                 // partida y sonido en pausa mientras dura el anuncio
  const r = await mostrarAnuncioRecompensado();
  pausarAudio(false);
  $('btnOfertaSi').disabled = false;
  if (r === 'visto' && accesoA(nivelPedido) === 'anuncio') { $('dlgOferta').close(); empezar(nivelPedido, true); return; }
  $('ofAviso').textContent = r === 'cerrado' ? s.adCerrado : s.adFallo;
  $('ofAviso').hidden = false;
});

function datosDeHoy() {
  const s = t(), d = datos.dia;
  return [[s.hoyJugadas, `${d.usadas} / ${CFG.NIVELES_MAXIMOS_AL_DIA}`], [s.hoyGanados, d.ganados], [s.hoyEstrellas, d.estrellas], [s.hoyRotos, num(d.rotos)], [s.hoyCombo, d.comboMax], [s.hoyRecords, d.records]]
    .map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
}
function abrirTope() {
  const s = t();
  $('topeTexto').textContent = s.topeTexto(CFG.NIVELES_MAXIMOS_AL_DIA);
  $('topeDatos').innerHTML = datosDeHoy();
  $('topeManana').textContent = todoSuperado() ? '' : s.topeManana(datos.desbloqueado);
  abrir($('dlgTope'));
}
$('btnTopeCerrar').addEventListener('click', () => { $('dlgTope').close(); if (pantalla === 'juego') irA('inicio'); });
$('btnTopeMapa').addEventListener('click', () => { $('dlgTope').close(); irA('mapa'); });

// ---------- partida ----------
function empezar(n, conAnuncio) {
  if (!gastarJugada(n, conAnuncio)) { abrirTope(); return; }
  cerrarTodos();
  nivelActual = n;
  const nv = nivelN(n);
  const ayuda = (datos.fallos[n] || 0) >= CFG.FALLOS_PARA_AYUDA;
  g = crearPartida(nv, { ayuda });
  pausado = false; acum = 0; escalaT = 1; congelado = 0; tLento = 0; finEn = 0; finTipo = '';
  hudCache = {}; chips.forEach((c) => c.el.remove()); chips.clear();
  $('avisoMejora').hidden = true;
  irAJuego(nv);
  if (ayuda) setTimeout(() => { if (g && nivelActual === n) render.evento({ e: 'aviso', texto: t().ayudaPala, y: 700, tam: 24, dur: 2.6 }, g); }, 400);
}
function irAJuego(nv) {
  pantalla = 'juego';
  for (const id of ['inicio', 'mapa', 'juego']) $(id).hidden = id !== 'juego';
  render.nuevaPartida(g, PALETAS[nv.tramo]);
  ajustar();
  musica(datos.musica, nv.tramo);
  previo = performance.now();
  lienzo.focus({ preventScroll: true });
}

function ajustar() {
  if (pantalla !== 'juego') return;
  const j = $('juego'), cs = getComputedStyle(j);
  const ancho = j.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const alto = j.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  // en horizontal, el campo ocupa todo el alto y deja dos columnas laterales para la interfaz
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  j.style.setProperty('--campo-w', Math.max(120, Math.min(alto * 0.72, ancho - 2 * 8.5 * rem - 40)) + 'px');
  const e = $('escena');
  const k = Math.max(0.1, Math.min(e.clientWidth / 720, e.clientHeight / 1000));
  const cw = Math.floor(720 * k), ch = Math.floor(1000 * k);
  lienzo.style.width = cw + 'px'; lienzo.style.height = ch + 'px';
  e.style.setProperty('--cw', cw + 'px');
  render.redimensionar(cw, ch, window.devicePixelRatio || 1);
  rect = lienzo.getBoundingClientRect();
  $('avisoLanzar').style.top = Math.round(ch * 0.66) + 'px';
  if (g) render.dibujar(g, 0);
}
let rAjuste = 0;
const reajustar = () => { cancelAnimationFrame(rAjuste); rAjuste = requestAnimationFrame(() => { ajustar(); pintarPortadaInicio(); }); };
window.addEventListener('resize', reajustar);
window.visualViewport?.addEventListener('resize', reajustar);
window.addEventListener('orientationchange', reajustar);

// HUD: solo se toca el DOM cuando cambia el dato
let hudCache = {};
const chips = new Map();
function actualizarHud() {
  const s = t();
  if (hudCache.n !== nivelActual) { hudCache.n = nivelActual; $('hudNivel').textContent = nivelActual; }
  if (hudCache.p !== g.puntos) { hudCache.p = g.puntos; $('hudPuntos').textContent = num(g.puntos); }
  if (hudCache.v !== g.vidas) {
    hudCache.v = g.vidas;
    const tot = Math.max(CFG.VIDAS_INICIALES, g.vidas);
    $('hudVidas').innerHTML = Array.from({ length: tot }, (_, i) => `<i class="${i < g.vidas ? '' : 'no'}"></i>`).join('');
    $('hudVidas').setAttribute('aria-label', `${s.vidas}: ${g.vidas}`);
  }
  if (hudCache.c !== g.combo) {
    hudCache.c = g.combo;
    $('hudCombo').innerHTML = g.combo >= 2 ? `×${multiplicador(g.combo).toLocaleString(datos.lang === 'en' ? 'en-GB' : 'es-ES')}<small>combo ${g.combo}</small>` : '';
  }
  const listo = g.estado === 'listo' && !pausado;
  if (hudCache.l !== listo) { hudCache.l = listo; const a = $('avisoLanzar'); a.hidden = !listo; a.textContent = tactil.matches ? s.lanzarToque : s.lanzarRaton; }
  // efectos activos con su duración
  for (const k in g.ef) {
    const v = g.ef[k];
    let c = chips.get(k);
    if (v > 0) {
      if (!c) {
        const el = document.createElement('li');
        el.className = 'efecto' + (MEJORAS[k].mala ? ' mala' : ''); el.style.setProperty('--c', COLOR_MEJORA[k]);
        el.innerHTML = `${svgIcono(k)}<span>${s.mejora[k][0]}</span><i></i>`;
        $('efectos').appendChild(el); c = { el, barra: el.lastElementChild }; chips.set(k, c);
      }
      c.barra.style.transform = `scaleX(${Math.max(0, v / g.efMax[k]).toFixed(3)})`;
    } else if (c) { c.el.remove(); chips.delete(k); }
  }
  if (chips.size && !Object.keys(g.ef).length) { chips.forEach((c) => c.el.remove()); chips.clear(); }
}

function procesarEventos() {
  const s = t();
  for (const ev of g.eventos) {
    switch (ev.e) {
      case 'romper':
        sfx.romper(ev.combo, ev.tipo);
        if (s.enJuego[ev.combo]) render.evento({ e: 'aviso', texto: s.enJuego[ev.combo], y: 640, tam: 34 }, g);
        if (g.restantes === 3 && g.total > 8) render.evento({ e: 'aviso', texto: s.quedan3, y: 580, tam: 24 }, g);
        if (ev.ultimo && !reducido.matches) { escalaT = 0.3; tLento = 0.55; }   // cámara lenta breve en el último cristal
        break;
      case 'grieta': sfx.grieta(); break;
      case 'plomo': sfx.plomo(); break;
      case 'sellado': sfx.sellado(); break;
      case 'pala': sfx.pala(); break;
      case 'pared': sfx.pared(); break;
      case 'lanzar': sfx.lanzar(); break;
      case 'explosion': sfx.explosion(); vibrar(35, datos.vibra); if (!reducido.matches) congelado = 0.045; break;
      case 'laser': sfx.laser(); break;
      case 'escudo': sfx.escudo(); break;
      case 'capsula': sfx.capsula(); break;
      case 'finEfecto': sfx.finEfecto(); break;
      case 'finCombo': sfx.comboFin(ev.n); break;
      case 'desciende': sfx.desciende(); render.evento({ e: 'aviso', texto: s.desciende, y: 700, tam: 22 }, g); break;
      case 'abrirSellos': sfx.abrirSellos(); render.evento({ e: 'aviso', texto: s.sellosAbiertos, y: 620, tam: 30 }, g); break;
      case 'ayuda': render.evento({ e: 'aviso', texto: s.ayudaCae, y: 660, tam: 22 }, g); break;
      case 'mejora': {
        sfx.mejora(ev.k, ev.mala); vibrar(ev.mala ? [20, 40, 20] : 18, datos.vibra);
        ev.texto = s.mejora[ev.k][0];
        datos.total.mejoras++;
        if (!datos.vistas[ev.k]) { // la primera vez, explica qué hace
          datos.vistas[ev.k] = 1; guardar();
          const a = $('avisoMejora'); a.style.setProperty('--c', COLOR_MEJORA[ev.k]);
          a.innerHTML = `${svgIcono(ev.k)}<span><b>${s.mejora[ev.k][0]}.</b> ${s.mejora[ev.k][1]}</span>`; a.hidden = false;
          clearTimeout(a.r); a.r = setTimeout(() => { a.hidden = true; }, 4200);
        }
        break;
      }
      case 'vidaPerdida':
        sfx.vida(); vibrar(120, datos.vibra);
        if (ev.vidas === 1) render.evento({ e: 'aviso', texto: s.ultimaVida, y: 640, tam: 26, dur: 2 }, g);
        break;
      case 'ganar': sfx.ganar(); vibrar([40, 60, 40, 60, 90], datos.vibra); finEn = performance.now() + 1100; finTipo = 'ganar'; break;
      case 'perder': sfx.perder(); finEn = performance.now() + 900; finTipo = 'perder'; break;
      default: break;
    }
    render.evento(ev, g);
  }
  g.eventos.length = 0;
}

function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, Math.max(0, (ts - previo) / 1000)); previo = ts;
  if (!g || pantalla !== 'juego' || pausado) return;
  const t0 = performance.now();
  if (congelado > 0) congelado -= dt;
  else {
    const v = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    if (v) moverPala(g, g.pala.x + v * 980 * dt);
    if (tLento > 0) { tLento -= dt; if (tLento <= 0) escalaT = 1; }
    acum += dt * escalaT;
    let n = 0;
    while (acum >= PASO && n < 10) { paso(g, PASO); acum -= PASO; n++; if (g.eventos.length) procesarEventos(); }
    if (n === 10) acum = 0;
  }
  const t1 = performance.now();
  render.dibujar(g, dt);
  const t2 = performance.now();
  actualizarHud();
  coste.sim += t1 - t0; coste.dibujo += t2 - t1;
  const c = performance.now() - t0; coste.suma += c; coste.cuadros++; if (c > coste.max) coste.max = c;
  if (finEn && performance.now() >= finEn) { finEn = 0; if (finTipo === 'ganar') victoria(); else derrota(); }
}

// ---------- entrada ----------
const xDe = (e) => (e.clientX - rect.left) / rect.width * W;
$('juego').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || !g || pausado) return;
  iniciarAudio();
  punteroActivo = e.pointerId;
  rect = lienzo.getBoundingClientRect();
  moverPala(g, xDe(e));
  if (e.pointerType !== 'mouse') e.preventDefault();
});
$('juego').addEventListener('pointermove', (e) => {
  if (!g || pausado) return;
  if (e.pointerType === 'mouse' || e.pointerId === punteroActivo) moverPala(g, xDe(e));
});
const soltar = (e) => {
  if (e.pointerId !== punteroActivo) return;
  punteroActivo = null;
  if (g && !pausado && !e.target.closest('button') && e.type === 'pointerup') lanzar(g);
};
$('juego').addEventListener('pointerup', soltar);
$('juego').addEventListener('pointercancel', soltar);
$('juego').addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (pantalla !== 'juego' || !g || document.querySelector('dialog[open]')) return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { teclas.izq = true; e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { teclas.der = true; e.preventDefault(); }
  else if (k === ' ' || k === 'ArrowUp' || (k === 'Enter' && document.activeElement === lienzo)) { if (!e.target.closest('button')) { iniciarAudio(); lanzar(g); e.preventDefault(); } }
  else if (k === 'p' || k === 'P' || k === 'Escape') { pausar(); e.preventDefault(); }
  else if (k === 'm' || k === 'M') { datos.sfx = !datos.sfx; guardar(); ponerEfectos(datos.sfx); pintarInterruptores(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') teclas.izq = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') teclas.der = false;
});

// ---------- pausa ----------
function pausar() {
  if (pantalla !== 'juego' || !g || pausado || finEn || g.estado === 'ganado' || g.estado === 'perdido') return;
  pausado = true; teclas.izq = teclas.der = false; punteroActivo = null;
  musica(false);
  hudCache.l = undefined; $('avisoLanzar').hidden = true;
  const min = (performance.now() - inicioSesion) / 60000;
  $('pausaDescanso').hidden = min < 25; $('pausaDescanso').textContent = t().descanso;
  abrir($('dlgPausa'));
}
function continuar() {
  if ($('dlgPausa').open) $('dlgPausa').close();
  if (!g || !pausado) return;
  pausado = false; previo = performance.now(); acum = 0;
  musica(datos.musica, g.nivel.tramo);
  lienzo.focus({ preventScroll: true });
}
$('btnPausa').addEventListener('click', () => { sfx.boton(); pausar(); });
$('btnContinuar').addEventListener('click', () => { sfx.boton(); continuar(); });
$('dlgPausa').addEventListener('cancel', (e) => { e.preventDefault(); continuar(); });
$('btnReiniciar').addEventListener('click', () => { $('dlgPausa').close(); empezar(nivelActual, false); });
$('btnSalir').addEventListener('click', () => { $('dlgPausa').close(); contarRotos(); guardar(); irA('inicio'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausar();
  else if (asegurarDia() || pantalla === 'inicio') refrescarInicio();
});
window.addEventListener('blur', pausar);
for (const id of ['dlgVictoria', 'dlgDerrota', 'dlgFinal']) $(id).addEventListener('cancel', (e) => e.preventDefault());
$('dlgOferta').addEventListener('cancel', () => { if (pantalla === 'juego') irA('inicio'); });
$('dlgTope').addEventListener('cancel', () => { if (pantalla === 'juego') irA('inicio'); });

// ---------- final de partida ----------
function contarRotos() {
  if (!g || g.contado) return;
  g.contado = true;
  datos.dia.rotos += g.rotos; datos.total.rotos += g.rotos;
  if (g.comboMax > datos.dia.comboMax) datos.dia.comboMax = g.comboMax;
}

const LOGROS = {
  primera: () => !!datos.niveles[1], combo10: () => datos.total.comboMax >= 12, combo25: () => datos.total.comboMax >= 40,
  perfecto10: () => Object.values(datos.niveles).filter((r) => r.e === 3).length >= 10, sala: () => !!datos.niveles[10],
  hitoPerfecto: () => Object.keys(datos.niveles).some((n) => n % 10 === 0 && datos.niveles[n].e === 3), mitad: () => !!datos.niveles[50],
  final: () => !!datos.niveles[100], racha3: () => datos.racha.mejor >= 3, racha7: () => datos.racha.mejor >= 7,
  mil: () => datos.total.rotos >= 1000, coleccion: () => ORDEN_MEJORAS.every((k) => datos.vistas[k]),
  estrellas30: () => estrellasTotales() >= 30, estrellas150: () => estrellasTotales() >= 150,
};
function revisarLogros() {
  const nuevos = [];
  for (const id in LOGROS) if (!datos.logros[id] && LOGROS[id]()) { datos.logros[id] = datos.dia.fecha; nuevos.push(id); }
  return nuevos;
}

function victoria() {
  const s = t(), n = nivelActual;
  const pf = puntuacionFinal(g), est = estrellasDe(g);
  const reg = datos.niveles[n] || { e: 0, p: 0, c: 0, v: 0 };
  const antes = { ...reg }, comboPrevio = datos.total.comboMax;
  const esRecord = antes.v > 0 && pf.total > antes.p;
  contarRotos();
  reg.e = Math.max(reg.e, est); reg.p = Math.max(reg.p, pf.total); reg.c = Math.max(reg.c, g.comboMax); reg.v++;
  datos.niveles[n] = reg;
  datos.dia.pase = null; datos.dia.ganados++; datos.dia.estrellas += Math.max(0, est - antes.e); datos.dia.puntos += pf.total;
  if (esRecord) datos.dia.records++;
  datos.total.ganados++; if (g.comboMax > datos.total.comboMax) datos.total.comboMax = g.comboMax;
  datos.fallos[n] = 0; delete datos.niveles[n].m;
  const abreSala = n % 10 === 0 && n < CFG.TOTAL_NIVELES && datos.desbloqueado <= n;
  datos.desbloqueado = Math.max(datos.desbloqueado, Math.min(CFG.TOTAL_NIVELES, n + 1));
  const logros = revisarLogros();
  const rachaNueva = datos.racha.nueva; datos.racha.nueva = false;
  guardar();

  // felicitación: una frase principal según cómo ha ido y datos concretos debajo
  const lista = n % 10 === 0 ? [s.bravoHito] : est === 3 ? s.bravo3 : est === 1 ? s.bravo1 : s.bravo;
  let i = Math.floor(Math.random() * lista.length); if (lista.length > 1 && i === ultimoElogio) i = (i + 1) % lista.length; ultimoElogio = i;
  $('vicElogio').textContent = lista[i];
  $('vicT').textContent = s.nivelSuperado(n);
  $('vicEstrellas').innerHTML = [0, 1, 2].map((x) => svgEstrella(x < est, x)).join('');
  $('vicEstrellas').setAttribute('aria-label', s.estrellasAria(est));
  $('vicPuntos').textContent = num(pf.total);
  $('vicDesglose').textContent = s.desglose(num(pf.porVidas), num(pf.porTiempo));
  const lineas = [];
  if (esRecord) lineas.push(`${s.recordNuevo}. ${s.bravoRecord(num(pf.total - antes.p))}`);
  else if (antes.v > 0) lineas.push(s.recordAnterior(num(antes.p)));
  if (g.comboMax >= 8) lineas.push(g.comboMax > comboPrevio && comboPrevio > 0 ? s.bravoComboRecord(g.comboMax) : s.bravoCombo(g.comboMax));
  else if (g.comboMax >= 3) lineas.push(s.comboDato(g.comboMax));
  if (rachaNueva && datos.racha.dias >= 2) {
    const d = datos.racha.dias;
    lineas.push([3, 7, 30, 100].includes(d) ? s.bravoRachaHito(d) : s.bravoRacha(d));
    if (datos.racha.gracia) lineas.push(s.bravoGracia);
  }
  if (abreSala) lineas.push(s.tramoNuevo(s.tramos[TRAMOS[n / 10].id]));
  for (const id of logros) lineas.push(`${s.logroNuevo}: ${s.logro[id][0]}`);
  if ((performance.now() - inicioSesion) / 60000 > 25) lineas.push(s.descanso);
  $('vicDatos').innerHTML = lineas.map((l) => `<li class="linea">${l}</li>`).join('');
  $('btnSiguiente').textContent = n >= CFG.TOTAL_NIVELES ? s.finalBoton : s.siguiente(n + 1);
  musica(false);
  abrir($('dlgVictoria'));
  if (datos.sfx) for (let k = 0; k < est; k++) setTimeout(() => sfx.estrella(k), 250 + k * 260);
  if (logros.length) setTimeout(() => sfx.logro(), 1200);
  $('btnSiguiente').focus();
}
$('btnSiguiente').addEventListener('click', () => {
  $('dlgVictoria').close();
  if (nivelActual >= CFG.TOTAL_NIVELES) { abrirFinal(); return; }
  pedirSaliendo(nivelActual + 1);
});
$('btnRepetir').addEventListener('click', () => { $('dlgVictoria').close(); pedirSaliendo(nivelActual); });
$('btnVicInicio').addEventListener('click', () => { $('dlgVictoria').close(); irA('inicio'); });
// Si para el nivel pedido hace falta anuncio o no quedan jugadas, la oferta se enseña ya fuera de la partida.
function pedirSaliendo(n) { if (!['pase', 'gratis'].includes(accesoA(n))) irA('inicio'); pedirNivel(n); }

function derrota() {
  const s = t(), n = nivelActual;
  contarRotos();
  datos.fallos[n] = (datos.fallos[n] || 0) + 1; datos.total.perdidos++;
  if (g.comboMax > datos.total.comboMax) datos.total.comboMax = g.comboMax;
  const intentos = datos.intentos || (datos.intentos = {});
  const mejorAntes = intentos[n] || 0;
  if (g.rotos > mejorAntes) intentos[n] = g.rotos;
  revisarLogros(); guardar();
  let dato = s.derrotaDato(g.rotos, g.total);
  if (g.restantes <= 5) dato += ' ' + s.derrotaCasi(g.restantes);
  else if (mejorAntes > 0 && g.rotos > mejorAntes) dato += ' ' + s.derrotaMejor(g.rotos);
  $('derDato').textContent = dato;
  $('derAnimo').textContent = azar(s.animo);
  const ayuda = datos.fallos[n] >= CFG.FALLOS_PARA_AYUDA;
  $('derAyuda').hidden = !ayuda; $('derAyuda').textContent = s.ayudaPala;
  musica(false);
  abrir($('dlgDerrota'));
  $('btnReintentar').focus();
}
$('btnReintentar').addEventListener('click', () => { $('dlgDerrota').close(); empezar(nivelActual, false); });
$('btnDerInicio').addEventListener('click', () => { $('dlgDerrota').close(); irA('inicio'); });

function abrirFinal() {
  const s = t();
  datos.final = true; guardar();
  irA('inicio');
  $('finTexto').textContent = s.finalTexto(estrellasTotales());
  abrir($('dlgFinal'));
  pintarPortada($('finalRoseton'), PALETAS[9], 176);
  sfx.ganar();
}
$('btnFinalMapa').addEventListener('click', () => { $('dlgFinal').close(); irA('mapa'); });

// ---------- inicio: botones ----------
$('btnJugar').addEventListener('click', () => { if (todoSuperado() && !datos.dia.pase) { iniciarAudio(); irA('mapa'); } else pedirNivel(siguienteNivel()); });
$('btnMapa').addEventListener('click', () => { iniciarAudio(); sfx.boton(); irA('mapa'); });
$('btnMapaVolver').addEventListener('click', () => { sfx.boton(); irA('inicio'); });
$('btnHoy').addEventListener('click', () => {
  const s = t(); asegurarDia(); iniciarAudio(); sfx.boton();
  const nada = datos.dia.usadas === 0;
  $('hoyNada').hidden = !nada; $('hoyNada').textContent = s.hoyNada;
  $('hoyDatos').hidden = nada; $('hoyDatos').innerHTML = datosDeHoy();
  const r = rachaVigente();
  $('hoyRacha').textContent = r > 0 ? s.hoyRacha(r, datos.racha.mejor) : s.rachaNada;
  $('hoyTotal').textContent = s.hoyTotal(estrellasTotales(), Object.keys(datos.niveles).length);
  abrir($('dlgHoy'));
});
$('btnLogros').addEventListener('click', () => {
  const s = t(); iniciarAudio(); sfx.boton();
  const ids = Object.keys(LOGROS);
  $('logCuenta').textContent = s.logrosCuenta(ids.filter((id) => datos.logros[id]).length, ids.length);
  $('logLista').innerHTML = ids.map((id) => `<li class="${datos.logros[id] ? 'si' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ESTRELLA}"/></svg><b>${s.logro[id][0]}</b><span>${s.logro[id][1]}</span></li>`).join('');
  abrir($('dlgLogros'));
});
$('btnAyuda').addEventListener('click', () => {
  const s = t(); iniciarAudio(); sfx.boton();
  const li = (k) => `<li style="--c:${COLOR_MEJORA[k]}">${svgIcono(k)}<b>${s.mejora[k][0]}</b><span>${s.mejora[k][1]}</span></li>`;
  $('ayBuenas').innerHTML = ORDEN_MEJORAS.filter((k) => !MEJORAS[k].mala).map(li).join('');
  $('ayMalas').innerHTML = ORDEN_MEJORAS.filter((k) => MEJORAS[k].mala).map(li).join('');
  $('ayLimite').textContent = s.ayudaLimite(CFG.NIVELES_GRATIS_AL_DIA, CFG.NIVELES_MAXIMOS_AL_DIA);
  abrir($('dlgAyuda'));
});
$('btnCausa').addEventListener('click', () => {
  const s = t(); iniciarAudio(); sfx.boton();
  const c = $('cauCuerpo'); c.textContent = '';
  const p = (txt) => { const el = document.createElement('p'); el.textContent = txt; el.style.marginBottom = '0.7rem'; c.appendChild(el); return el; };
  if (CFG.donacionConfigurada()) {
    // Solo con la donación activada y el nombre puesto en config.js se afirma que se dona.
    p(s.causaActiva(CFG.ASOCIACION_NOMBRE));
    if (/^https:\/\//.test(CFG.ASOCIACION_ENLACE)) { const a = document.createElement('a'); a.href = CFG.ASOCIACION_ENLACE; a.rel = 'noopener noreferrer'; a.target = '_blank'; a.textContent = s.causaEnlace; p('').appendChild(a); }
    if (CFG.cifraConfigurada()) p(s.causaCifra(CFG.DONACION_CIFRA, CFG.DONACION_CIFRA_FECHA));
  } else { p(s.causaInactiva1); p(s.causaInactiva2); p(s.causaInactiva3); }
  abrir($('dlgCausa'));
});

// ---------- portada ----------
function pintarPortadaInicio() {
  if (pantalla !== 'inicio') return;
  const caja = $('portada').parentElement, lado = Math.round(caja.clientWidth);
  if (lado > 0 && pintarPortadaInicio.lado !== lado) { pintarPortadaInicio.lado = lado; pintarPortada($('portada'), PALETAS[9], lado); }
}

// ---------- arranque ----------
$('inicio').querySelector('.marca').innerHTML = [...'Vitraluz'].map((l) => `<span>${l}</span>`).join('');
asegurarDia();
ponerEfectos(datos.sfx); ponerMusica(datos.musica);
iniciarAnuncios({ textos: t, reducido: reducido.matches });
aplicarIdioma();
pintarPortadaInicio();
if (document.fonts?.ready) document.fonts.ready.then(() => { if (g && pantalla === 'juego') render.dibujar(g, 0); });
if (!guardar()) tostada(t().sinGuardado, 6000);
setInterval(() => { if (asegurarDia() && pantalla !== 'juego') refrescarInicio(); }, 30000);
requestAnimationFrame((ts) => { previo = ts; requestAnimationFrame(cuadro); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// Acceso para pruebas automáticas (solo con #pruebas en la dirección). No toca el límite diario.
if (location.hash.includes('pruebas')) {
  window.__vitraluz = {
    get g() { return g; }, get pausado() { return pausado; }, get pantalla() { return pantalla; },
    coste, render, datos, W,
    mejora: (k) => g && aplicarMejora(g, k),
    rect: () => lienzo.getBoundingClientRect(),
  };
}
