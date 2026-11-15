---
titulo: How this notebook is made
fecha: 2026-11-15
idioma: en
resumen: A Node script turns a few Markdown files into HTML pages. There is nothing else to install.
---

This site is a folder of text files and a script that turns them into pages. There is no framework, no database and no server of its own: what gets published is HTML, one stylesheet, one small script and one font.

## What is in the repository

- `contenido/perfil.md` holds the personal details: name, biography, experience, interests, goals and contact links.
- `contenido/blog/` holds the entries, one Markdown file per entry and per language.
- `sitio/` holds the stylesheet, the browser script and the Instrument Serif font as woff2 files.
- `scripts/build.mjs` puts it all together and writes the result to the `_site/` folder.

> [margin] The `_site/` folder is not kept in git. It is generated every time.

## The build

The build runs with a single command:

```
node scripts/build.mjs
```

The script uses no npm packages. The Markdown converter is hand-written in `scripts/lib/markdown.mjs` and understands just enough: headings, paragraphs, lists, quotes, code blocks, links, **highlights**, *italics* and margin notes like the one above.

With no dependencies there is no install step either. Having Node is enough.

## The fields still to be filled in

When a field in `contenido/perfil.md` starts with the word `PENDIENTE`, the script makes nothing up: it leaves a few blank ruled lines and a red-pencil note saying what is missing and which file it goes in. Once the field is filled in, the note is gone on the next build.

## Publishing

On every push to the `main` branch, a GitHub Actions workflow (`.github/workflows/deploy.yml`) runs the build and publishes the `_site/` folder to GitHub Pages. The same build copies the folders of the four apps (`gastos/`, `kanban/`, `juego/` and `herramientas/`) into `_site/` as they are, so everything ships under one address.

> [margin] The sketches in the projects section are drawn in SVG inside `scripts/lib/bocetos.mjs`. There are no image files.
