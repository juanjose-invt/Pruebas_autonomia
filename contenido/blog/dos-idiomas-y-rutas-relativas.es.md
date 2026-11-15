---
titulo: Dos idiomas en la misma página y ninguna ruta absoluta
fecha: 2026-11-15
idioma: es
resumen: Por qué el español y el inglés viajan juntos en cada página, y por qué ningún enlace empieza por una barra.
---

Dos decisiones pequeñas explican buena parte de cómo se comporta este sitio.

## Los dos idiomas van en el mismo HTML

Cada página lleva su texto en español y en inglés. Cada fragmento está marcado con su idioma, y la hoja de estilos esconde el que no toca:

```
<span class="l" lang="es">Proyectos</span>
<span class="l" lang="en">Projects</span>
```

Al pulsar **ES** o **EN**, un script cambia un atributo en la etiqueta `<html>` y guarda la elección en el almacenamiento local del navegador. La siguiente página que se abre lee esa elección antes de pintarse, así que no hay parpadeo de un idioma a otro.

> [margen] Si el navegador no deja guardar nada, el sitio sigue funcionando: se queda en español, que es el idioma por defecto.

La ventaja es que cambiar de idioma no recarga nada ni te saca de la página. El coste es que cada página pesa algo más, porque lleva el texto dos veces. Para un cuaderno con poco texto por página, compensa.

Una entrada del blog puede existir en un solo idioma. En ese caso se enseña tal cual, con un aviso para quien la lee en el otro.

## Ninguna ruta empieza por una barra

El sitio se publica dentro de una subcarpeta de GitHub Pages, no en la raíz de un dominio. Un enlace como `/proyectos.html` apuntaría fuera del sitio.

Por eso todas las rutas son relativas. El script de build sabe a qué profundidad está cada página y antepone los `../` que hagan falta: una entrada del blog, que vive en `blog/`, carga la hoja de estilos desde `../recursos/cuaderno.css`.

El resultado se puede comprobar sin publicar nada: basta con servir la carpeta `_site/` desde cualquier subruta y ver que todo carga.
