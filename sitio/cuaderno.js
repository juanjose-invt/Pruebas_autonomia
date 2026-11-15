// Cuaderno de campo: idioma recordado y trazado de los bocetos.
// Se carga en <head> sin «defer» para fijar el idioma antes de pintar la página.
(function () {
  'use strict';

  var raiz = document.documentElement;
  var CLAVE = 'cuaderno-idioma';

  function leerIdioma() {
    try {
      var guardado = window.localStorage.getItem(CLAVE);
      return guardado === 'en' || guardado === 'es' ? guardado : 'es';
    } catch (e) {
      return 'es';
    }
  }

  function guardarIdioma(idioma) {
    try { window.localStorage.setItem(CLAVE, idioma); } catch (e) { /* sin almacenamiento: se queda en esta página */ }
  }

  function aplicarIdioma(idioma) {
    raiz.setAttribute('data-lang', idioma);
    raiz.lang = idioma;
    var titulo = raiz.getAttribute('data-titulo-' + idioma);
    if (titulo) document.title = titulo;
    var botones = document.querySelectorAll('[data-idioma]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-pressed', String(botones[i].getAttribute('data-idioma') === idioma));
    }
  }

  raiz.classList.add('js');
  aplicarIdioma(leerIdioma());

  function prepararBocetos() {
    var bocetos = document.querySelectorAll('.boceto');
    if (!bocetos.length) return;

    for (var b = 0; b < bocetos.length; b++) {
      var trazos = bocetos[b].querySelectorAll('.tz');
      for (var t = 0; t < trazos.length; t++) trazos[t].style.setProperty('--i', t);
      bocetos[b].style.setProperty('--n', trazos.length);
    }

    if (!('IntersectionObserver' in window)) {
      for (var k = 0; k < bocetos.length; k++) bocetos[k].classList.add('dibujado');
      return;
    }
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('dibujado');
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.25 });
    for (var j = 0; j < bocetos.length; j++) observador.observe(bocetos[j]);
  }

  function alCargar() {
    aplicarIdioma(leerIdioma());
    var botones = document.querySelectorAll('[data-idioma]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', function () {
        var idioma = this.getAttribute('data-idioma');
        guardarIdioma(idioma);
        aplicarIdioma(idioma);
      });
    }
    prepararBocetos();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alCargar);
  else alCargar();

  // Si se vuelve a la página desde el historial, respeta un cambio de idioma hecho en otra.
  window.addEventListener('pageshow', function () { aplicarIdioma(leerIdioma()); });
})();
