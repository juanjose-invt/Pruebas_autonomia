---
titulo: Cómo está hecho este cuaderno
fecha: 2026-11-15
idioma: es
resumen: Un script de Node convierte unos archivos Markdown en páginas HTML. No hay nada más que instalar.
---

Este sitio es una carpeta de archivos de texto y un script que los convierte en páginas. No hay framework, ni base de datos, ni servidor propio: lo que se publica es HTML, una hoja de estilos, un script pequeño y una fuente.

## Qué hay en el repositorio

- `contenido/perfil.md` guarda los datos personales: nombre, biografía, experiencia, inquietudes, objetivos y enlaces de contacto.
- `contenido/blog/` guarda las entradas, un archivo Markdown por entrada y por idioma.
- `sitio/` guarda la hoja de estilos, el script del navegador y la fuente Instrument Serif en formato woff2.
- `scripts/build.mjs` lo junta todo y escribe el resultado en la carpeta `_site/`.

> [margen] La carpeta `_site/` no se guarda en git. Se genera cada vez.

## El build

El build se ejecuta con una sola orden:

```
node scripts/build.mjs
```

El script no usa ningún paquete de npm. El conversor de Markdown está escrito a mano en `scripts/lib/markdown.mjs` y entiende lo justo: títulos, párrafos, listas, citas, bloques de código, enlaces, **resaltado**, *cursiva* y las notas al margen como la de arriba.

Como no hay dependencias, tampoco hay paso de instalación. Con tener Node basta.

## Los campos pendientes

Cuando un campo de `contenido/perfil.md` empieza por la palabra `PENDIENTE`, el script no inventa nada: deja unos renglones en blanco y una nota en lápiz rojo que dice qué falta y en qué archivo se escribe. Al rellenar el campo, la nota desaparece en el siguiente build.

## La publicación

En cada envío a la rama `main`, un flujo de GitHub Actions (`.github/workflows/deploy.yml`) ejecuta el build y publica la carpeta `_site/` en GitHub Pages. El mismo build copia dentro de `_site/` las carpetas de las cuatro aplicaciones (`gastos/`, `kanban/`, `juego/` y `herramientas/`), tal como están, para que todo salga bajo la misma dirección.

> [margen] Los bocetos de la sección de proyectos están dibujados en SVG dentro de `scripts/lib/bocetos.mjs`. No hay ninguna imagen.
