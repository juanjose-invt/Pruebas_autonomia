// Vitraluz — capa de anuncios. TODO lo que tenga que ver con anuncios pasa por este archivo.
//
// HOY NO HAY NINGUNA RED DE ANUNCIOS CONECTADA. El proveedor activo es `proveedorSimulado`:
//   · el anuncio recompensado es una pantalla propia rotulada "Aquí irá un anuncio", con una cuenta breve;
//   · los espacios fijos son cajas rotuladas "Espacio para anuncio", con su tamaño ya reservado.
// Nada de esto carga scripts externos, cookies ni rastreo.
//
// Interfaz única que usa el resto del juego:
//   iniciarAnuncios()               prepara el proveedor (nunca lanza error hacia fuera)
//   hayAnuncioListo()               true si se puede ofrecer el anuncio recompensado
//   mostrarAnuncioRecompensado()    Promise<'visto' | 'cerrado' | 'fallo'>
//                                   El nivel extra SOLO se concede con 'visto' (anuncio completo).
//   montarEspacios(raiz)            rellena los <div class="espacio-anuncio" data-formato="…">
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// PUNTO DE CONEXIÓN DE UN PROVEEDOR REAL (pendiente; lo hace el dueño del proyecto)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 1. Anuncio recompensado (el que da un nivel más).
//    En juegos web, el producto de Google para esto es "H5 Games Ads" (Ad Placement API), que se
//    solicita aparte con una cuenta de AdSense ya aprobada. Documentación oficial:
//        https://developers.google.com/ad-placement/apis
//    Según esa página (consultada al escribir esto; hay que releerla al integrar, porque cambia):
//      · la API expone adConfig({ preloadAdBreaks, sound }) y adBreak({ type: 'reward', name, … });
//      · en un adBreak de tipo 'reward' los avisos son: beforeReward(showAdFn) —momento de enseñar
//        NUESTRA oferta y llamar a showAdFn() solo si la persona acepta—, beforeAd (pausar y silenciar),
//        adViewed (lo vio entero: conceder la recompensa), adDismissed (lo cerró antes: no conceder),
//        afterAd (reanudar) y adBreakDone (se llama siempre, haya habido anuncio o no).
//    La página consultada NO mostraba la etiqueta <script> de carga ni sus atributos: hay que copiarla
//    tal cual de la guía de inicio de esa misma documentación, no escribirla de memoria.
//    Cómo encaja aquí: escribir un `proveedorReal` con los mismos tres métodos que el simulado
//    (iniciar, listo, recompensado) y devolverlo en `elegirProveedor()`. En `recompensado()`:
//    resolver 'visto' en adViewed, 'cerrado' en adDismissed y 'fallo' si adBreakDone llega sin anuncio.
//    El juego ya pausa partida y sonido alrededor de la llamada, y ya enseña antes su propia oferta
//    voluntaria (aceptar y rechazar con el mismo peso), como piden esas políticas.
//    HAY QUE CONFIRMAR en las políticas de AdSense / H5 Games Ads qué formatos de anuncio recompensado
//    se admiten en juegos web y con qué condiciones (voluntario cada vez, recompensa solo al completarlo,
//    nada de anuncios automáticos).
//
// 2. Espacios fijos (menú, mapa, resultados). Con Google AdSense serían bloques de anuncio de display:
//    hay que insertar, dentro de cada <div class="espacio-anuncio">, el bloque que AdSense genera para
//    la cuenta (su script de carga una sola vez en la página y el elemento del bloque en cada espacio),
//    copiado del panel de AdSense. No se escribe aquí ningún nombre de función ni parámetro porque no se
//    ha podido comprobar en su documentación oficial. `montarEspacios()` es el sitio: sustituye el rótulo
//    simulado por el bloque real y conserva el tamaño reservado para que nada salte al cargar.
//
// 3. Antes de publicar con anuncios reales, pasos del dueño:
//    · Cuenta de AdSense aprobada y solicitud de H5 Games Ads. Probablemente haga falta dominio propio
//      (no está confirmado que se apruebe un sitio github.io).
//    · Aviso de privacidad y consentimiento de cookies: en el EEE, una plataforma de consentimiento
//      certificada, con aceptar y rechazar en igualdad. Los scripts de anuncios se cargan SOLO después
//      del consentimiento. Sin consentimiento o sin red, el juego debe seguir funcionando igual.
//    · Decidir el tratamiento de menores (público infantil o mixto) según las políticas del proveedor.
//    · Cumplir las políticas del proveedor (colocación, clics accidentales, contenido) y retirar
//      cualquier modo de prueba al publicar.
//    · El límite diario se cuenta en este dispositivo (localStorage): se puede saltar borrando los
//      datos del navegador o cambiando la fecha. Para hacerlo robusto haría falta un servidor con cuentas.
//    · Si se anuncia una donación, la cifra mostrada sale de config.js con datos reales y fecha.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { ANUNCIO_SIMULADO_SEGUNDOS, ESPACIOS_DE_ANUNCIO } from './config.js';

let textos = () => ({});
let reducido = false;

const proveedorSimulado = {
  nombre: 'simulado',
  async iniciar() { return true; },
  listo() { return true; },
  recompensado() {
    return new Promise((resolver) => {
      const t = textos();
      const dlg = document.getElementById('anuncio');
      const cuenta = document.getElementById('anuncioCuenta');
      const barra = document.getElementById('anuncioBarra');
      const btnCerrar = document.getElementById('anuncioCerrar');
      const btnSeguir = document.getElementById('anuncioSeguir');
      if (!dlg || typeof dlg.showModal !== 'function') { resolver('fallo'); return; }
      let quedan = ANUNCIO_SIMULADO_SEGUNDOS, hecho = false, reloj = 0;
      const pinta = () => {
        cuenta.textContent = quedan > 0 ? t.adQuedan(quedan) : t.adListo;
        barra.style.transform = `scaleX(${1 - quedan / ANUNCIO_SIMULADO_SEGUNDOS})`;
        btnSeguir.hidden = quedan > 0; btnCerrar.hidden = quedan <= 0;
        if (quedan <= 0) btnSeguir.focus();
      };
      const fin = (r) => {
        if (hecho) return; hecho = true;
        clearInterval(reloj);
        btnCerrar.onclick = btnSeguir.onclick = null; dlg.oncancel = null;
        if (dlg.open) dlg.close();
        resolver(r);
      };
      btnCerrar.onclick = () => fin('cerrado');
      btnSeguir.onclick = () => fin('visto');
      dlg.oncancel = (e) => { e.preventDefault(); fin(quedan > 0 ? 'cerrado' : 'visto'); };
      barra.style.transition = reducido ? 'none' : 'transform 1s linear';
      pinta();
      try { dlg.showModal(); } catch (e) { fin('fallo'); return; }
      reloj = setInterval(() => { quedan--; pinta(); if (quedan <= 0) clearInterval(reloj); }, 1000);
    });
  },
};

function elegirProveedor() {
  // Aquí se devolvería `proveedorReal` cuando exista y haya consentimiento. Mientras tanto, el simulado.
  return proveedorSimulado;
}

let proveedor = proveedorSimulado, iniciado = false;

export async function iniciarAnuncios(opciones = {}) {
  if (opciones.textos) textos = opciones.textos;
  reducido = !!opciones.reducido;
  try { proveedor = elegirProveedor(); iniciado = await proveedor.iniciar(); }
  catch (e) { proveedor = proveedorSimulado; iniciado = true; }
  return iniciado;
}

export function hayAnuncioListo() {
  try { return iniciado && proveedor.listo(); } catch (e) { return false; }
}

// Resuelve 'visto' (anuncio completo), 'cerrado' (se cerró antes) o 'fallo' (no se pudo mostrar).
// Nunca rechaza: un error de anuncios no puede bloquear el juego.
export async function mostrarAnuncioRecompensado() {
  try {
    const r = await proveedor.recompensado();
    return r === 'visto' || r === 'cerrado' ? r : 'fallo';
  } catch (e) { return 'fallo'; }
}

// Espacios fijos: cajas con tamaño reservado por CSS (proporciones habituales: 320×50, 728×90 y 300×250).
export function montarEspacios(raiz = document) {
  const t = textos();
  raiz.querySelectorAll('.espacio-anuncio').forEach((el) => {
    if (!ESPACIOS_DE_ANUNCIO) { el.hidden = true; return; }
    el.hidden = false;
    el.setAttribute('role', 'note');
    el.setAttribute('aria-label', t.adEspacioAria || '');
    el.textContent = '';
    const s = document.createElement('span');
    s.textContent = t.adEspacio || '';
    el.appendChild(s);
    // ← aquí se insertaría el bloque real del proveedor en lugar del rótulo (ver comentario de cabecera)
  });
}
