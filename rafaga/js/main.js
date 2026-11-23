// Caramboleta — interfaz y flujo de la partida. La física está en engine.js y el dibujo en render.js.
// Estructura de pantallas, límite diario, anuncios y diálogos adaptados de bloques/js/main.js.

import * as CFG from './config.js';
import { nivel as nivelN, TRAMOS, W, SUELO, R_BOLA, ORDEN_MEJORAS } from './levels.js';
import { crearPartida, paso, PASO, lanzar, recoger, trazarGuia, limitarAngulo, estrellasDe, mejorAngulo, usarItem } from './engine.js';
import { crearRender, PALETAS, RAMPA } from './render.js';
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
reducido.addEventListener?.('change', () => { render.reducido = reducido.matches; demoRender.reducido = reducido.matches; });

let g = null, nivelActual = 0, pantalla = 'inicio', pausado = false;
let acum = 0, previo = 0, velocidad = 1, finEn = 0, finTipo = '';
let angulo = -Math.PI / 2, apuntando = false, guiaTeclado = false, punteroId = null;
let rect = { left: 0, top: 0, width: 1, height: 1 };
const teclas = { izq: false, der: false, fino: false };
const inicioSesion = performance.now();
let ultimoElogio = -1, mejorasNivel = new Set(), avisoLargo = false;
const coste = { suma: 0, max: 0, cuadros: 0, sim: 0, dibujo: 0, maxBolas: 0 };

// ---------- textos ----------
function aplicarIdioma() {
  const s = t();
  document.documentElement.lang = datos.lang;
  document.querySelectorAll('[data-t]').forEach((el) => { const v = s[el.dataset.t]; if (typeof v === 'string') el.textContent = v; });
  document.querySelectorAll('[data-aria]').forEach((el) => { el.setAttribute('aria-label', s[el.dataset.aria]); el.title = s[el.dataset.aria]; });
  $('grupoIdioma').setAttribute('aria-label', s.idioma);
  $('grupoIdioma').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === datos.lang)));
  document.title = `Caramboleta: ${s.lema.charAt(0).toLowerCase()}${s.lema.slice(1)}`;
  pintarInterruptores();
  montarEspacios();
  refrescarInicio();
  if (pantalla === 'mapa') pintarMapa();
  hudCache = {};
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
  if (p === 'inicio') { refrescarInicio(); ajustarDemo(); }
  if (p === 'mapa') pintarMapa();
}
function abrir(dlg) { if (!dlg.open) { dlg.showModal(); dlg.scrollTop = 0; } }
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
    html += `<section class="bandeja" style="--fondo:${pal.fondo};--acento:${pal.acento}"><h3>${s.tramos[tr.id]} <small>${s.nivelesDe(i * 10 + 1, i * 10 + 10)}</small></h3><p class="mec">${s.mecanicas[tr.mec]}</p><div class="teselas">`;
    for (let k = 1; k <= 10; k++) {
      const n = i * 10 + k, reg = datos.niveles[n], abierto = n <= datos.desbloqueado;
      const e = reg ? reg.e : 0;
      const col = RAMPA[(i * 3 + k * 2) % RAMPA.length];
      if (abierto) {
        html += `<button type="button" class="tesela${k === 10 ? ' hito' : ''}${n === sig && !reg ? ' siguiente' : ''}" data-n="${n}" style="--v:${col}" aria-label="${s.nivelAria(n, e)}"><span class="num">${n}</span><span class="est">${[0, 1, 2].map((x) => svgEstrella(x < e)).join('')}</span></button>`;
      } else {
        html += `<button type="button" class="tesela cerrada${k === 10 ? ' hito' : ''}" data-n="${n}" aria-disabled="true" aria-label="${s.nivelBloqueado(n)}"><span class="num">${n}</span>${ICO.candado}</button>`;
      }
    }
    html += '</div></section>';
  });
  $('bandejas').innerHTML = html;
}
$('bandejas').addEventListener('click', (e) => {
  const b = e.target.closest('.tesela'); if (!b) return;
  const n = Number(b.dataset.n);
  if (n > datos.desbloqueado) { tostada(t().nivelBloqueado(n), 2200); return; }
  abrirNivel(n); sfx.boton();
});
let nivelHoja = 1;
function abrirNivel(n) {
  const s = t(); nivelHoja = n;
  const nv = nivelN(n), reg = datos.niveles[n];
  $('nivT').textContent = `${s.nivel} ${n}`;
  $('nivSala').textContent = s.tramos[TRAMOS[nv.tramo].id] + (nv.hito ? ` · ${s.hito}` : '');
  $('nivEstrellas').innerHTML = [0, 1, 2].map((x) => svgEstrella(reg && x < reg.e)).join('');
  $('nivEstrellas').setAttribute('aria-label', s.estrellasAria(reg ? reg.e : 0));
  const filas = reg ? [s.nivelRecord(reg.t), s.nivelRafaga(reg.r)] : [s.nivelSin];
  filas.push(s.nivelMetas(nv.t3, nv.t2));
  $('nivDatos').innerHTML = filas.map((x) => `<li class="linea">${x}</li>`).join('');
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
  return [[s.hoyJugadas, `${d.usadas} / ${CFG.NIVELES_MAXIMOS_AL_DIA}`], [s.hoyGanados, d.ganados], [s.hoyEstrellas, d.estrellas], [s.hoyTiradas, d.tiradas], [s.hoyRotos, num(d.rotos)], [s.hoyRafaga, d.rafagaMax], [s.hoyRecords, d.records]]
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
  g = crearPartida(nv);
  pausado = false; acum = 0; velocidad = 1; finEn = 0; finTipo = ''; apuntando = false; guiaTeclado = false; avisoLargo = false;
  angulo = -Math.PI / 2; mejorasNivel = new Set();
  hudCache = {};
  $('avisoMejora').hidden = true;
  pantalla = 'juego';
  for (const id of ['inicio', 'mapa', 'juego']) $(id).hidden = id !== 'juego';
  render.nuevaPartida(g, PALETAS[nv.tramo]);
  $('juego').style.setProperty('--fondo', PALETAS[nv.tramo].fondo);
  $('juego').style.setProperty('--acento', PALETAS[nv.tramo].acento);
  ajustar();
  musica(datos.musica, nv.tramo);
  previo = performance.now();
  lienzo.focus({ preventScroll: true });
  // la mecánica nueva del tramo se presenta la primera vez
  const mec = nv.mec;
  if (mec !== 'base' && mec !== 'todo' && !datos.vistosTipos[mec]) {
    datos.vistosTipos[mec] = 1; guardar();
    mostrarAviso(`<span><b>${t().nuevoTipo}.</b> ${t().mecanicas[mec]}</span>`, PALETAS[nv.tramo].acento, 5200);
  }
}

function mostrarAviso(html, color, ms = 4200) {
  const a = $('avisoMejora'); a.style.setProperty('--c', color);
  a.innerHTML = html; a.hidden = false;
  clearTimeout(a.r); a.r = setTimeout(() => { a.hidden = true; }, ms);
}

function ajustar() {
  if (pantalla !== 'juego') return;
  const j = $('juego'), cs = getComputedStyle(j);
  const ancho = j.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const alto = j.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // en horizontal, el campo ocupa todo el alto y deja dos columnas laterales para la interfaz
  j.style.setProperty('--campo-w', Math.max(120, Math.min(alto * 0.7, ancho - 2 * 9 * rem - 40)) + 'px');
  const e = $('escena');
  const k = Math.max(0.05, Math.min(e.clientWidth / W, e.clientHeight / SUELO));
  const cw = Math.floor(W * k), ch = Math.floor(SUELO * k);
  lienzo.style.width = cw + 'px'; lienzo.style.height = ch + 'px';
  e.style.setProperty('--cw', cw + 'px'); e.style.setProperty('--ch', ch + 'px');
  render.redimensionar(cw, ch, window.devicePixelRatio || 1);
  rect = lienzo.getBoundingClientRect();
  if (g) render.dibujar(g, 0, guiaActual());
}
let rAjuste = 0;
const reajustar = () => { cancelAnimationFrame(rAjuste); rAjuste = requestAnimationFrame(() => { ajustar(); ajustarDemo(); }); };
window.addEventListener('resize', reajustar);
window.visualViewport?.addEventListener('resize', reajustar);
window.addEventListener('orientationchange', reajustar);

// HUD: solo se toca el DOM cuando cambia el dato
let hudCache = {};
function actualizarHud() {
  const s = t(), nv = g.nivel;
  if (hudCache.n !== nivelActual) { hudCache.n = nivelActual; $('hudNivel').textContent = nivelActual; }
  const tir = g.tiradas;
  if (hudCache.t !== tir) {
    hudCache.t = tir;
    $('hudTirada').textContent = tir;
    // estrellas aún posibles si la próxima tirada acabara el nivel
    const prox = g.estado === 'vuelo' ? tir : tir + 1;
    const e = prox <= nv.t3 ? 3 : prox <= nv.t2 ? 2 : 1;
    $('hudEstrellas').innerHTML = [0, 1, 2].map((x) => svgEstrella(x < e)).join('');
    $('hudMetaTexto').textContent = e === 3 ? s.estrellasHasta(3, nv.t3) : e === 2 ? s.estrellasHasta(2, nv.t2) : s.estrellasUna;
    $('hudMetaCorto').textContent = e === 3 ? s.hastaCorto(nv.t3) : e === 2 ? s.hastaCorto(nv.t2) : '';
  }
  const vuelo = g.estado === 'vuelo' && !pausado;
  if (hudCache.v !== vuelo) {
    hudCache.v = vuelo;
    $('btnAcelerar').disabled = !vuelo; $('btnRecoger').disabled = !vuelo;
    if (!vuelo) { $('btnRecoger').classList.remove('llama'); avisoLargo = false; }
  }
  if (hudCache.vel !== velocidad || hudCache.lang !== datos.lang) {
    hudCache.vel = velocidad; hudCache.lang = datos.lang;
    $('txtAcelerar').textContent = velocidad === 1 ? s.acelerar : s.acelerarN(velocidad);
    $('btnAcelerar').setAttribute('aria-pressed', String(velocidad > 1));
  }
  if (vuelo && !avisoLargo && g.tTirada > CFG.AVISO_TIRADA_LARGA) {
    avisoLargo = true; $('btnRecoger').classList.add('llama');
    render.aviso(s.recogerLargo, 470, 24, 2.4);
  }
  const listo = g.estado === 'apuntar' && !pausado && !apuntando && !guiaTeclado && g.tiradas === 0;
  if (hudCache.l !== listo || hudCache.lang2 !== datos.lang) {
    hudCache.l = listo; hudCache.lang2 = datos.lang;
    const a = $('avisoApuntar'); a.hidden = !listo; a.textContent = tactil.matches ? s.apuntarToque : s.apuntarRaton;
  }
}

function guiaActual() {
  if (!g || g.estado !== 'apuntar' || pausado) return null;
  if (!apuntando && !guiaTeclado) return null;
  return trazarGuia(g, angulo);
}

let registro = null;   // solo existe con el gancho de pruebas (ver final del archivo)
function anotar(ev) {
  if (registro.length > 6000) registro.splice(0, 1000);
  if (ev.e === 'mejora' && ev.it) {
    const it = ev.it;
    registro.push({ e: 'mejora', k: ev.k, tiradas: g.tiradas, bolas: g.bolas, temps: g.activas.filter((b) => b.vivo && b.temp).length,
      bombas: g.activas.filter((b) => b.vivo && b.bomba > 0).length, agujas: g.activas.filter((b) => b.vivo && b.pierce > 0).length,
      reb: g.activas.filter((b) => b.vivo && b.reb > 0).length, congelar: g.congelar,
      fila: g.bloques.filter((b) => b.vivo && b.r === it.r).map((b) => [b.c, b.hp]), col: g.bloques.filter((b) => b.vivo && b.c === it.c && b.r >= 0).map((b) => [b.r, b.hp]) });
  } else if (ev.e !== 'golpe' && ev.e !== 'pared' && ev.e !== 'sale' && ev.e !== 'vuelve') registro.push({ e: ev.e, tiradas: g.tiradas });
}

function procesarEventos() {
  const s = t();
  for (const ev of g.eventos) {
    if (registro) anotar(ev);
    switch (ev.e) {
      case 'sale': sfx.lanzar(); break;
      case 'golpe': sfx.golpe(ev.cadena); break;
      case 'romper':
        sfx.romper(ev.cadena);
        if (s.enJuego[g.rotosTirada]) render.aviso(s.enJuego[g.rotosTirada], 560, 38);
        if (g.restantes === 1) render.aviso(s.ultima, 620, 30, 1.2);
        break;
      case 'duro': sfx.duro(); break;
      case 'blindado': sfx.blindado(); break;
      case 'pared': sfx.pared(); break;
      case 'rebSuelo': sfx.suelo(); break;
      case 'primera': sfx.suelo(); break;
      case 'explosion': sfx.explosion(); vibrar(30, datos.vibra); break;
      case 'regenera': sfx.regenera(); break;
      case 'brote': sfx.brote(); break;
      case 'mueve': sfx.mueve(); break;
      case 'recoger': sfx.recoger(); break;
      case 'desciende': sfx.desciende(); break;
      case 'congelado': sfx.congelado(); render.aviso(s.congelado, 640, 28, 1.8); break;
      case 'peligro': sfx.peligro(); vibrar([30, 50, 30], datos.vibra); render.aviso(s.peligro, 800, 30, 1.6, '#c1123f'); break;
      case 'mejora': {
        if (ev.k === 'rayoH' || ev.k === 'rayoV') sfx.rayo(); else sfx.mejora(ev.k);
        vibrar(12, datos.vibra);
        if (!ev.sola) { mejorasNivel.add(ev.k); }
        if (!datos.vistas[ev.k]) { // la primera vez, explica qué hace
          datos.vistas[ev.k] = 1; guardar();
          mostrarAviso(`${svgIcono(ev.k)}<span><b>${s.mejora[ev.k][0]}.</b> ${s.mejora[ev.k][1]}</span>`, COLOR_MEJORA[ev.k]);
        }
        break;
      }
      case 'finTirada':
        datos.dia.tiradas++; datos.total.tiradas++;
        if (g.cadenaMax > (datos.total.cadenaMax || 0)) datos.total.cadenaMax = g.cadenaMax;
        break;
      case 'ganar': sfx.ganar(); vibrar([40, 60, 40, 60, 90], datos.vibra); finEn = performance.now() + 1100; finTipo = 'ganar'; break;
      case 'perder': sfx.perder(); vibrar(160, datos.vibra); finEn = performance.now() + 900; finTipo = 'perder'; break;
      default: break;
    }
    render.evento(ev, g);
  }
  g.eventos.length = 0;
}

function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, Math.max(0, (ts - previo) / 1000)); previo = ts;
  if (pantalla === 'inicio') { pasoDemo(dt); return; }
  if (!g || pantalla !== 'juego' || pausado) return;
  const t0 = performance.now();
  // puntería con teclado
  const giro = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
  if (giro && g.estado === 'apuntar') { angulo = limitarAngulo(angulo + giro * dt * (teclas.fino ? 0.25 : 1.1)); guiaTeclado = true; }
  if (g.estado === 'vuelo') {
    acum += dt * velocidad;
    let n = 0;
    while (acum >= PASO && n < 40) { paso(g, PASO); acum -= PASO; n++; if (g.eventos.length) procesarEventos(); if (g.estado !== 'vuelo') { acum = 0; break; } }
    if (n === 40) acum = 0;
    if (g.activas.length > coste.maxBolas) coste.maxBolas = g.activas.length;
  } else { paso(g, dt); if (g.eventos.length) procesarEventos(); }
  const t1 = performance.now();
  render.dibujar(g, dt, guiaActual());
  const t2 = performance.now();
  actualizarHud();
  coste.sim += t1 - t0; coste.dibujo += t2 - t1;
  const cst = performance.now() - t0; coste.suma += cst; coste.cuadros++; if (cst > coste.max) coste.max = cst;
  if (finEn && performance.now() >= finEn) { finEn = 0; if (finTipo === 'ganar') victoria(); else derrota(); }
}

// ---------- entrada: arrastrar para apuntar, soltar para lanzar ----------
function apuntarA(cx, cy) {
  rect = lienzo.getBoundingClientRect();
  const x = (cx - rect.left) / rect.width * W, y = (cy - rect.top) / rect.height * SUELO;
  const x0 = g.lanzX, y0 = SUELO - R_BOLA;
  let dx = x - x0, dy = y - y0;
  if (dy > -30) { dx = -dx; dy = -dy; }           // por debajo del lanzador: como un tirachinas
  if (Math.hypot(dx, dy) < 34) return false;
  angulo = limitarAngulo(Math.atan2(dy, dx));
  return true;
}
let apunteValido = false;
$('juego').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || !g || pausado || g.estado !== 'apuntar' || finEn) return;
  iniciarAudio();
  punteroId = e.pointerId; apuntando = true; guiaTeclado = false;
  apunteValido = apuntarA(e.clientX, e.clientY);
  try { $('juego').setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ }
  e.preventDefault();
});
$('juego').addEventListener('pointermove', (e) => {
  if (!apuntando || e.pointerId !== punteroId || !g) return;
  apunteValido = apuntarA(e.clientX, e.clientY);
});
const soltar = (e) => {
  if (e.pointerId !== punteroId) return;
  punteroId = null;
  const ok = apuntando && apunteValido && e.type === 'pointerup';
  apuntando = false;
  if (ok && g && !pausado && g.estado === 'apuntar') disparar();
};
$('juego').addEventListener('pointerup', soltar);
$('juego').addEventListener('pointercancel', soltar);
$('juego').addEventListener('contextmenu', (e) => e.preventDefault());

function disparar() {
  if (!g || g.estado !== 'apuntar') return;
  if (lanzar(g, angulo)) {
    guiaTeclado = false;
    datos.total.bolas += g.bolas;
    procesarEventos();
  }
}
function acelerar() {
  if (!g || g.estado !== 'vuelo') return;
  velocidad = velocidad === 1 ? 2 : velocidad === 2 ? 3 : 1;
  sfx.acelerar(velocidad);
}
function recogerYa() {
  if (!g || g.estado !== 'vuelo') return;
  recoger(g); procesarEventos();
}
$('btnAcelerar').addEventListener('click', acelerar);
$('btnRecoger').addEventListener('click', recogerYa);

window.addEventListener('keydown', (e) => {
  if (pantalla !== 'juego' || !g || document.querySelector('dialog[open]')) return;
  const k = e.key;
  teclas.fino = e.shiftKey;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { teclas.izq = true; e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { teclas.der = true; e.preventDefault(); }
  else if (k === ' ' || k === 'ArrowUp' || (k === 'Enter' && document.activeElement === lienzo)) {
    if (!e.target.closest('button')) { iniciarAudio(); disparar(); e.preventDefault(); }
  }
  else if (k === 'f' || k === 'F') { acelerar(); e.preventDefault(); }
  else if (k === 'r' || k === 'R' || k === 'ArrowDown') { recogerYa(); e.preventDefault(); }
  else if (k === 'p' || k === 'P' || k === 'Escape') { pausar(); e.preventDefault(); }
  else if (k === 'm' || k === 'M') { datos.sfx = !datos.sfx; guardar(); iniciarAudio(); ponerEfectos(datos.sfx); pintarInterruptores(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  teclas.fino = e.shiftKey;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') teclas.izq = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') teclas.der = false;
});

// ---------- pausa ----------
function pausar() {
  if (pantalla !== 'juego' || !g || pausado || finEn || g.estado === 'ganado' || g.estado === 'perdido') return;
  pausado = true; teclas.izq = teclas.der = false; apuntando = false; punteroId = null;
  musica(false);
  hudCache.l = undefined; hudCache.v = undefined; $('avisoApuntar').hidden = true;
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
$('btnReiniciar').addEventListener('click', () => { $('dlgPausa').close(); contarRotos(); empezar(nivelActual, false); });
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
  if (g.rafagaMax > datos.dia.rafagaMax) datos.dia.rafagaMax = g.rafagaMax;
  for (const k of mejorasNivel) datos.vistas[k] = datos.vistas[k] || 1;
  datos.total.mejoras += mejorasNivel.size;
  datos.usadas = Object.assign(datos.usadas || {}, Object.fromEntries([...mejorasNivel].map((k) => [k, 1])));
}

const LOGROS = {
  primera: () => !!datos.niveles[1], bandeja: () => !!datos.niveles[10], mitad: () => !!datos.niveles[50], final: () => !!datos.niveles[100],
  rafaga15: () => datos.total.rafagaMax >= 15, cadena150: () => (datos.total.cadenaMax || 0) >= 150,
  perfecto10: () => Object.values(datos.niveles).filter((r) => r.e === 3).length >= 10,
  estrellas60: () => estrellasTotales() >= 60, estrellas200: () => estrellasTotales() >= 200,
  racha3: () => datos.racha.mejor >= 3, racha7: () => datos.racha.mejor >= 7,
  mil: () => datos.total.rotos >= 1000, coleccion: () => ORDEN_MEJORAS.every((k) => (datos.usadas || {})[k]),
  bolas50: () => (datos.total.bolasMax || 0) >= 50,
};
function revisarLogros() {
  const nuevos = [];
  for (const id in LOGROS) if (!datos.logros[id] && LOGROS[id]()) { datos.logros[id] = datos.dia.fecha; nuevos.push(id); }
  return nuevos;
}

function victoria() {
  const s = t(), n = nivelActual, nv = g.nivel;
  const est = estrellasDe(g);
  const reg = datos.niveles[n] || { e: 0, t: 0, r: 0, v: 0 };
  const antes = { ...reg }, rafagaPrevia = datos.total.rafagaMax;
  const esRecord = antes.v > 0 && g.tiradas < antes.t;
  contarRotos();
  reg.e = Math.max(reg.e, est); reg.t = antes.v > 0 ? Math.min(antes.t, g.tiradas) : g.tiradas; reg.r = Math.max(reg.r || 0, g.rafagaMax); reg.v++;
  datos.niveles[n] = reg;
  datos.dia.pase = null; datos.dia.ganados++; datos.dia.estrellas += Math.max(0, est - antes.e);
  if (esRecord) datos.dia.records++;
  datos.total.ganados++;
  if (g.rafagaMax > datos.total.rafagaMax) datos.total.rafagaMax = g.rafagaMax;
  if (g.bolas > (datos.total.bolasMax || 0)) datos.total.bolasMax = g.bolas;
  datos.fallos[n] = 0;
  const abreBandeja = n % 10 === 0 && n < CFG.TOTAL_NIVELES && datos.desbloqueado <= n;
  datos.desbloqueado = Math.max(datos.desbloqueado, Math.min(CFG.TOTAL_NIVELES, n + 1));
  const logros = revisarLogros();
  const rachaNueva = datos.racha.nueva; datos.racha.nueva = false;
  guardar();

  // felicitación: una frase principal según cómo ha ido y datos concretos debajo
  const lista = nv.hito ? [s.bravoHito] : est === 3 ? s.bravo3 : est === 1 ? s.bravo1 : s.bravo;
  let i = Math.floor(Math.random() * lista.length); if (lista.length > 1 && i === ultimoElogio) i = (i + 1) % lista.length; ultimoElogio = i;
  $('vicElogio').textContent = lista[i];
  $('vicT').textContent = s.nivelSuperado(n);
  $('vicEstrellas').innerHTML = [0, 1, 2].map((x) => svgEstrella(x < est, x)).join('');
  $('vicEstrellas').setAttribute('aria-label', s.estrellasAria(est));
  $('vicResumen').textContent = s.resumenTiradas(g.tiradas, g.bolas);
  const lineas = [];
  if (esRecord) lineas.push(s.recordNuevo(antes.t, g.tiradas));
  else if (antes.v > 0) lineas.push(s.recordAnterior(antes.t));
  if (g.rafagaMax > rafagaPrevia && rafagaPrevia > 0) lineas.push(s.bravoRafagaRecord(g.rafagaMax));
  else if (g.rafagaMax >= 5) lineas.push(s.bravoRafaga(g.rafagaMax));
  if (g.cadenaMax >= 60) lineas.push(s.bravoCadena(g.cadenaMax));
  if (mejorasNivel.size >= 2) lineas.push(s.bravoMejoras(mejorasNivel.size));
  if (est < 3) lineas.push(s.pista3(nv.t3));
  if (rachaNueva && datos.racha.dias >= 2) {
    const d = datos.racha.dias;
    lineas.push([3, 7, 30, 100].includes(d) ? s.bravoRachaHito(d) : s.bravoRacha(d));
    if (datos.racha.gracia) lineas.push(s.bravoGracia);
  }
  if (abreBandeja) lineas.push(s.tramoNuevo(s.tramos[TRAMOS[n / 10].id]));
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
$('btnVicMapa').addEventListener('click', () => { $('dlgVictoria').close(); irA('mapa'); });
// Si para el nivel pedido hace falta anuncio o no quedan jugadas, la oferta se enseña ya fuera de la partida.
function pedirSaliendo(n) { if (!['pase', 'gratis'].includes(accesoA(n))) irA('inicio'); pedirNivel(n); }

function derrota() {
  const s = t(), n = nivelActual;
  contarRotos();
  datos.fallos[n] = (datos.fallos[n] || 0) + 1; datos.total.perdidos++;
  const previo = datos.intentos[n];
  if (previo === undefined || g.restantes < previo) datos.intentos[n] = g.restantes;
  revisarLogros(); guardar();
  let dato = s.derrotaDato(g.rotos, g.total);
  if (g.restantes <= 3) dato += ' ' + s.derrotaCasi(g.restantes);
  else if (previo !== undefined && g.restantes < previo) dato += ' ' + s.derrotaMejor(g.restantes);
  $('derDato').textContent = dato;
  $('derAnimo').textContent = azar(s.animo);
  musica(false);
  abrir($('dlgDerrota'));
  $('btnReintentar').focus();
}
$('btnReintentar').addEventListener('click', () => { $('dlgDerrota').close(); empezar(nivelActual, false); });
$('btnDerInicio').addEventListener('click', () => { $('dlgDerrota').close(); irA('inicio'); });

// ---------- final propio tras el nivel 100 ----------
let finalRender = null;
function abrirFinal() {
  const s = t();
  datos.final = true; guardar();
  irA('inicio');
  const tiradas = Object.values(datos.niveles).reduce((a, r) => a + (r.t || 0), 0);
  $('finTexto').textContent = s.finalTexto(estrellasTotales(), tiradas);
  abrir($('dlgFinal'));
  const cv = $('finalLienzo'), caja = cv.parentElement;
  const ancho = Math.max(120, Math.round(caja.clientWidth)), alto = Math.round(ancho / 0.7);
  cv.style.width = ancho + 'px'; cv.style.height = alto + 'px';
  finalRender = crearRender(cv); finalRender.reducido = reducido.matches;
  finalRender.redimensionar(ancho, alto, window.devicePixelRatio || 1);
  const gf = crearPartida(nivelN(100));
  // la última bandeja, en todos los tonos de la rampa y sin tipos especiales: una tarta de colores
  gf.bloques.forEach((b, i) => { b.r += 3; b.cy += 300; b.tipo = 'base'; b.mej = null; b.hp = [100, 1, 3, 8, 20, 50, 2, 5, 12, 30][i % 10]; b.max = 100; });
  gf.items = []; gf.bolas = 100; gf.estado = 'apuntar';
  finalRender.nuevaPartida(gf, PALETAS[9]);
  let n = 0;
  const anima = () => {
    finalRender.dibujar(gf, 1 / 60, null);
    if (n === 0) finalRender.evento({ e: 'ganar' }, gf);
    if (++n < (reducido.matches ? 1 : 150) && $('dlgFinal').open) requestAnimationFrame(anima);
  };
  anima();
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
  $('ayMejoras').innerHTML = ORDEN_MEJORAS.map((k) => `<li style="--c:${COLOR_MEJORA[k]}">${svgIcono(k)}<b>${s.mejora[k][0]}</b><span>${s.mejora[k][1]}</span></li>`).join('');
  $('ayTipos').innerHTML = TRAMOS.map((tr, i) => `<li style="--c:${PALETAS[i].acento}"><i aria-hidden="true"></i><b>${s.tramos[tr.id]}</b><span>${s.mecanicas[tr.mec]}</span></li>`).join('');
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

// ---------- escaparate de la portada: una bandeja jugándose sola ----------
const demoCv = $('demo');
const demoRender = crearRender(demoCv);
demoRender.reducido = reducido.matches;
let gDemo = null, esperaDemo = 0, demoLado = 0, demoParado = false;
function nuevaDemo() {
  const nv = nivelN(14);
  gDemo = crearPartida({ ...nv, bolas: 14 });
  gDemo.sinSonido = true;
  demoRender.nuevaPartida(gDemo, PALETAS[1]);
  esperaDemo = 0.8;
}
function ajustarDemo() {
  if (pantalla !== 'inicio') return;
  const caja = demoCv.parentElement;
  const ancho = Math.floor(caja.clientWidth), alto = Math.floor(caja.clientHeight);
  const k = Math.min(ancho / W, alto / SUELO);
  const w = Math.max(60, Math.floor(W * k)), h = Math.max(86, Math.floor(SUELO * k));
  if (w === demoLado) return;
  demoLado = w;
  demoCv.style.width = w + 'px'; demoCv.style.height = h + 'px';
  demoRender.redimensionar(w, h, window.devicePixelRatio || 1);
  if (!gDemo) nuevaDemo();
  demoRender.dibujar(gDemo, 0, reducido.matches ? trazarGuia(gDemo, -1.2) : null);
}
let demoAcum = 0;
function pasoDemo(dt) {
  if (!gDemo || document.hidden || demoParado) return;
  if (reducido.matches) return;      // con movimiento reducido el escaparate queda quieto
  if (gDemo.estado === 'apuntar') {
    esperaDemo -= dt;
    if (esperaDemo <= 0) { lanzar(gDemo, mejorAngulo(gDemo, 7, 6)); }
  } else if (gDemo.estado === 'vuelo') {
    demoAcum += dt;
    let n = 0;
    while (demoAcum >= PASO && n < 20) { paso(gDemo, PASO); demoAcum -= PASO; n++; }
    if (gDemo.tTirada > 12) recoger(gDemo);
    if (gDemo.estado === 'apuntar') esperaDemo = 0.9;
  } else { esperaDemo -= dt; if (esperaDemo < -1.6) nuevaDemo(); }
  if (gDemo.estado === 'ganado' || gDemo.estado === 'perdido') { if (esperaDemo > 0) esperaDemo = 0; }
  for (const ev of gDemo.eventos) demoRender.evento(ev, gDemo);
  gDemo.eventos.length = 0;
  demoRender.dibujar(gDemo, dt, null);
}

// ---------- arranque ----------
$('marca').innerHTML = [...'Caramboleta'].map((l, i) => `<span style="--i:${i}">${l}</span>`).join('');
$('marca').setAttribute('aria-label', 'Caramboleta');
asegurarDia();
ponerEfectos(datos.sfx); ponerMusica(datos.musica);
iniciarAnuncios({ textos: t, reducido: reducido.matches });
aplicarIdioma();
ajustarDemo();
if (document.fonts?.ready) document.fonts.ready.then(() => { if (g && pantalla === 'juego') render.dibujar(g, 0, null); demoLado = 0; ajustarDemo(); });
if (!guardar()) tostada(t().sinGuardado, 6000);
setInterval(() => { if (asegurarDia() && pantalla !== 'juego') refrescarInicio(); }, 30000);
window.addEventListener('offline', () => tostada(t().sinConexion, 3000));
requestAnimationFrame((ts) => { previo = ts; requestAnimationFrame(cuadro); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// Gancho para pruebas automáticas. NO se puede activar desde la URL ni desde la página: solo existe si el
// propio test define window.__RAFAGA_PRUEBAS__ = true ANTES de cargar la página (p. ej. con addInitScript).
if (window.__RAFAGA_PRUEBAS__ === true) {
  registro = [];
  window.__rafaga = {
    registro,
    get g() { return g; }, get pausado() { return pausado; }, get pantalla() { return pantalla; }, get velocidad() { return velocidad; },
    get angulo() { return angulo; },
    coste, datos, render,
    // punto de pantalla (clientX, clientY) que corresponde a un punto lógico del campo
    pantallaDe: (x, y) => { const r = lienzo.getBoundingClientRect(); return { x: r.left + x / W * r.width, y: r.top + y / SUELO * r.height }; },
    mejorAngulo: (n = 21) => (g ? mejorAngulo(g, n, 30) : null),
    lanzX: () => (g ? g.lanzX : null),
    // pone una mejora en una celda vacía (para probar cada una en una partida real)
    ponerMejora: (k, c, r) => { if (!g) return false; const it = { c, r, k, id: 9e6 + Math.random(), vivo: true, usado: false }; g.items.push(it); g.rejI[(r + 48) * 7 + c] = it; return true; },
    usarMejora: (k) => g && usarItem(g, { k, c: 3, r: 5, vivo: true }, null),
    // pone una gominola en una celda vacía (solo para preparar pruebas de las mejoras)
    ponerBloque: (c, r, hp) => {
      if (!g || g.rej[(r + 48) * 7 + c] || g.rejI[(r + 48) * 7 + c]) return false;
      const h = 4, x0 = c * 100 + h, y0 = r * 100 + h, x1 = (c + 1) * 100 - h, y1 = (r + 1) * 100 - h;
      const b = { c, r, hp, max: hp, tipo: 'base', forma: 'cuad', o: 0, id: 8e6 + c * 10 + r, vivo: true, tocado: false, w: 0, f: 0,
        v: [x0, y0, x1, y0, x1, y1, x0, y1], n: [0, -1, 1, 0, 0, 1, -1, 0], cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
      g.bloques.push(b); g.rej[(r + 48) * 7 + c] = b; g.total++; g.restantes++; return true;
    },
    ponerBolas: (n) => { if (g) g.bolas = n; },
  };
}
