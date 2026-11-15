# Cuaderno de campo

Portfolio personal con blog, by innovativecode. Vive en la raíz de este repositorio y enlaza
cuatro aplicaciones que están en sus propias carpetas:

| Carpeta | Qué es |
| --- | --- |
| `gastos/` | Gestor de gastos con huchas de cristal en 3D |
| `kanban/` | Tablero de corcho y pósits |
| `juego/` | Puzle de gravedad con tablero de madera y canicas |
| `herramientas/` | Caja de herramientas tipo navaja: conversor, QR, contraseñas, cronómetro/pomodoro, notas |

El portfolio es un sitio estático bilingüe (español e inglés) que se genera con un script de Node
sin dependencias y se publica en GitHub Pages.

## Rellenar tus datos

Todos los datos personales están en **un solo archivo**: [`contenido/perfil.md`](contenido/perfil.md).
Se puede editar desde una tablet, en la web de GitHub:

1. Abre `contenido/perfil.md` y pulsa el lápiz (**Edit this file**).
2. Sustituye cada `PENDIENTE` por tu texto. Debajo de `### es` va el español y debajo de `### en`, el inglés.
3. No cambies las líneas que empiezan por `##` o `###`: son los nombres de los campos.
4. Pulsa **Commit changes**. El sitio se vuelve a publicar solo en uno o dos minutos.

Campos del archivo:

| Campo | Qué se escribe | Formato |
| --- | --- | --- |
| `nombre` | Tu nombre | Una línea (vale para los dos idiomas) |
| `dedicacion` | A qué te dedicas | Una frase corta por idioma |
| `biografia` | Tu biografía | Párrafos separados por una línea en blanco |
| `experiencia` | Tu experiencia | Una línea por etapa: `- periodo \| puesto y lugar \| qué hacías` |
| `inquietudes` | Tus inquietudes | Una línea por inquietud: `- texto` |
| `objetivos` | Tus objetivos | Una línea por objetivo: `- texto` |
| `enlaces` | Enlaces de contacto | `- Etiqueta: https://…` o `- Correo / Email: mailto:…` |

Mientras un campo empiece por `PENDIENTE` (o esté vacío), el sitio enseña unos renglones en blanco
y una nota en rojo que dice «pendiente de rellenar». Si rellenas un campo solo en español, la
versión inglesa sigue marcada como pendiente, y al revés.

Los textos admiten Markdown sencillo: `**resaltado**`, `*cursiva*` y `[enlace](https://…)`.

## Añadir una entrada al blog

1. Crea un archivo en `contenido/blog/` con este nombre: `titulo-corto.es.md` (español) o
   `titulo-corto.en.md` (inglés). El nombre, sin la extensión, será la dirección de la entrada.
   En la web de GitHub: **Add file → Create new file**.
2. Empieza el archivo con la cabecera de metadatos y escribe debajo en Markdown:

   ```markdown
   ---
   titulo: El título de la entrada
   fecha: 2026-11-15
   idioma: es
   resumen: Una frase que se ve en la lista del blog.
   ---

   Primer párrafo de la entrada.

   ## Un apartado

   Más texto, con **resaltado**, *cursiva* y [enlaces](https://example.com).

   > [margen] Esto sale como nota al margen.
   ```

3. Para publicar la misma entrada en los dos idiomas, crea dos archivos con el mismo nombre y
   distinta terminación: `titulo-corto.es.md` y `titulo-corto.en.md`. Si solo existe uno, la
   entrada se enseña en ese idioma con un aviso.
4. Guarda con **Commit changes**.

Cabecera:

| Clave | Obligatoria | Valor |
| --- | --- | --- |
| `titulo` | sí | Título de la entrada |
| `fecha` | sí | `AAAA-MM-DD`. Ordena el blog, de más reciente a más antigua |
| `idioma` | no | `es` o `en`. Si falta, se toma de la terminación del archivo (`.es.md`, `.en.md`) o se supone `es` |
| `resumen` | no | Frase para la lista del blog |
| `borrador` | no | `si` para que la entrada no se publique todavía |

Markdown admitido: títulos (`##`, `###`), párrafos, listas (`-` o `1.`), citas (`>`), notas al margen
(`> [margen] …` o `> [margin] …`), bloques de código entre líneas de tres acentos graves, código en línea, enlaces,
imágenes, `**resaltado**`, `*cursiva*` y la regla `---`. El HTML escrito dentro del Markdown no se
interpreta. Los enlaces a otras páginas del sitio deben ser relativos a la carpeta `blog/`
(por ejemplo `../proyectos.html`).

Si a una entrada le falta el título o la fecha, el build se detiene y dice qué archivo arreglar.

## Generar el sitio en local

Hace falta Node 20 o posterior. No hay que instalar nada más.

```
node scripts/build.mjs
```

Esto crea la carpeta `_site/` (ignorada por git) con el portfolio en la raíz y una copia de
`gastos/`, `kanban/`, `juego/` y `herramientas/`. Para verlo:

```
python3 -m http.server 8105
```

y abre `http://localhost:8105/_site/`. Con `node scripts/build.mjs --salida otra-carpeta` se
genera en otro sitio.

## Publicación

`.github/workflows/deploy.yml` ejecuta el build y publica `_site/` en GitHub Pages en cada push a
`main`, y también a mano desde la pestaña **Actions** (**Run workflow**).

Hay que activarlo una sola vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Estructura

```
contenido/perfil.md        datos personales (el único archivo que hay que rellenar)
contenido/blog/*.md        entradas del blog
sitio/                     hoja de estilos, script del navegador, fuente Instrument Serif (woff2), favicon
scripts/build.mjs          build: lee contenido/ y sitio/ y escribe _site/
scripts/lib/markdown.mjs   conversor de Markdown a HTML
scripts/lib/perfil.mjs     lector de contenido/perfil.md
scripts/lib/bocetos.mjs    bocetos de los proyectos, dibujados en SVG
.github/workflows/         publicación en GitHub Pages
gastos/ kanban/ juego/ herramientas/   las cuatro aplicaciones (sin paso de build)
```

Todas las rutas del sitio son relativas, porque se publica dentro de una subcarpeta. La fuente
Instrument Serif se distribuye con licencia SIL Open Font License 1.1
(`sitio/fuentes/LICENSE-instrument-serif.txt`).
