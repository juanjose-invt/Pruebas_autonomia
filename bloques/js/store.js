// Vitraluz — progreso, preferencias y cuenta diaria, guardados en este dispositivo (localStorage).
// Todo acceso va protegido: si el almacenamiento falla, el juego sigue con los datos en memoria.

import { NIVELES_GRATIS_AL_DIA, NIVELES_MAXIMOS_AL_DIA, TOTAL_NIVELES } from './config.js';

const CLAVE = 'vitraluz-v1';

function diaVacio(fecha) {
  return { fecha, usadas: 0, anuncios: 0, pase: null, ganados: 0, estrellas: 0, rotos: 0, comboMax: 0, puntos: 0, records: 0 };
}
function base() {
  return {
    lang: 'es', sfx: true, musica: true, vibra: true,
    desbloqueado: 1,
    niveles: {},                    // n → { e: estrellas, p: mejor puntuación, c: mejor combo, v: veces ganado }
    racha: { dias: 0, ultimo: '', mejor: 0, gracia: false },
    dia: diaVacio(''),
    logros: {},                     // id → fecha
    total: { rotos: 0, mejoras: 0, ganados: 0, perdidos: 0, comboMax: 0 },
    intentos: {},                   // n → más cristales rotos en un intento perdido
    fallos: {},                     // n → derrotas seguidas
    vistas: {},                     // mejoras ya recogidas alguna vez
    final: false,
  };
}

export function fechaLocal(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function diasEntre(a, b) { // fechas 'AAAA-MM-DD' locales
  if (!a || !b) return 999;
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2, 12) - new Date(y1, m1 - 1, d1, 12)) / 86400000);
}

export function cargar() {
  const d = base();
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const g = JSON.parse(crudo);
      if (g && typeof g === 'object') {
        for (const k of Object.keys(d)) {
          if (g[k] === undefined || g[k] === null) continue;
          if (typeof d[k] === 'object') d[k] = Object.assign(d[k], g[k]); else if (typeof g[k] === typeof d[k]) d[k] = g[k];
        }
      }
    }
  } catch (e) { /* datos ilegibles: se empieza de cero sin romper nada */ }
  d.desbloqueado = Math.max(1, Math.min(TOTAL_NIVELES, Math.floor(Number(d.desbloqueado)) || 1));
  return d;
}

export const datos = cargar();

export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); return true; } catch (e) { return false; }
}

// ---------- día y jugadas ----------
// Devuelve true si ha cambiado el día (medianoche local) y se ha reiniciado la cuenta.
export function asegurarDia() {
  const hoy = fechaLocal();
  if (datos.dia.fecha === hoy) return false;
  datos.dia = diaVacio(hoy);
  guardar();
  return true;
}

export function jugadas() {
  asegurarDia();
  const u = datos.dia.usadas;
  return {
    usadas: u,
    gratis: Math.max(0, NIVELES_GRATIS_AL_DIA - u),
    conAnuncio: u >= NIVELES_GRATIS_AL_DIA ? Math.max(0, NIVELES_MAXIMOS_AL_DIA - u) : NIVELES_MAXIMOS_AL_DIA - NIVELES_GRATIS_AL_DIA,
    restantes: Math.max(0, NIVELES_MAXIMOS_AL_DIA - u),
    pase: datos.dia.pase,
  };
}

// Qué hace falta para empezar el nivel n: 'pase' (reintento, no gasta), 'gratis', 'anuncio' o 'tope'.
export function accesoA(n) {
  const j = jugadas();
  if (j.pase === n) return 'pase';
  if (j.gratis > 0) return 'gratis';
  if (j.restantes > 0) return 'anuncio';
  return 'tope';
}

// Gasta la jugada (si toca) y deja el pase de reintento para ese nivel.
export function gastarJugada(n, conAnuncio) {
  asegurarDia();
  if (datos.dia.pase !== n) {
    if (datos.dia.usadas >= NIVELES_MAXIMOS_AL_DIA) return false;
    datos.dia.usadas++;
    if (conAnuncio) datos.dia.anuncios++;
    datos.dia.pase = n;
  }
  contarRacha();
  guardar();
  return true;
}

// Racha de días jugados, con un día de gracia: saltarse un solo día no la rompe.
function contarRacha() {
  const hoy = fechaLocal(), r = datos.racha;
  if (r.ultimo === hoy) return;
  const salto = diasEntre(r.ultimo, hoy);
  if (salto === 1) { r.dias++; r.gracia = false; }
  else if (salto === 2 && r.dias > 0) { r.dias++; r.gracia = true; }
  else { r.dias = 1; r.gracia = false; }
  r.ultimo = hoy;
  r.nueva = true;                 // para felicitar una sola vez
  if (r.dias > r.mejor) r.mejor = r.dias;
}
export function rachaVigente() {
  const r = datos.racha;
  return diasEntre(r.ultimo, fechaLocal()) <= 2 ? r.dias : 0;
}

export function msHastaMedianoche() {
  const a = new Date();
  return new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1).getTime() - a.getTime();
}

export function estrellasTotales() {
  let s = 0; for (const k in datos.niveles) s += datos.niveles[k].e || 0; return s;
}
