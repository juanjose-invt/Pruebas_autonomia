// Vitraluz — configuración única del juego.
// Todo lo que el dueño del proyecto puede querer cambiar sin tocar el resto del código está aquí.

// ---------- Límite diario ----------
// Empezar un nivel gasta una jugada del día. Reintentar el mismo nivel (tras perder o salir) no gasta otra.
// El día cambia a medianoche, hora local del dispositivo.
export const NIVELES_GRATIS_AL_DIA = 2;   // jugadas sin anuncio
export const NIVELES_MAXIMOS_AL_DIA = 5;  // tope total al día (las que pasan de las gratis piden un anuncio cada una)

// ---------- Causa solidaria ----------
// Con DONACION_ACTIVA en false (o sin nombre de asociación) el juego NO afirma que se done nada:
// solo explica la intención del proyecto y que todavía no está en marcha.
// Para activarlo: pon DONACION_ACTIVA = true, el nombre exacto de la asociación y su enlace oficial.
export const DONACION_ACTIVA = false;
export const ASOCIACION_NOMBRE = '';   // p. ej. 'Nombre de la asociación'
export const ASOCIACION_ENLACE = '';   // p. ej. 'https://…'

// Cifra donada acumulada (opcional). Solo se muestra si DONACION_ACTIVA es true y los DOS campos están rellenos.
// Escribe la cifra tal y como quieras que se lea y la fecha en que la actualizaste. Nunca se calcula sola.
export const DONACION_CIFRA = '';        // p. ej. '312 €'
export const DONACION_CIFRA_FECHA = '';  // p. ej. '2026-12-31'

// ---------- Anuncios ----------
// Segundos que dura el anuncio simulado (el real lo marcará el proveedor).
export const ANUNCIO_SIMULADO_SEGUNDOS = 5;
// Espacios fijos de anuncio (menú, mapa, pantallas de resultado). false los oculta del todo.
export const ESPACIOS_DE_ANUNCIO = true;

// ---------- Juego ----------
export const TOTAL_NIVELES = 100;
export const VIDAS_INICIALES = 3;
export const VIDAS_MAXIMAS = 5;
// Tras estos fallos seguidos en un mismo nivel se ofrece una ayuda discreta (sin anuncio): una vida más.
export const FALLOS_PARA_AYUDA = 3;

export function donacionConfigurada() {
  return DONACION_ACTIVA === true && String(ASOCIACION_NOMBRE).trim() !== '';
}
export function cifraConfigurada() {
  return donacionConfigurada() && String(DONACION_CIFRA).trim() !== '' && String(DONACION_CIFRA_FECHA).trim() !== '';
}
