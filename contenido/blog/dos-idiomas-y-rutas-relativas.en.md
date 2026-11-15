---
titulo: Two languages on one page and no absolute paths
fecha: 2026-11-15
idioma: en
resumen: Why Spanish and English travel together on every page, and why no link starts with a slash.
---

Two small decisions explain a good part of how this site behaves.

## Both languages live in the same HTML

Every page carries its text in Spanish and in English. Each fragment is marked with its language, and the stylesheet hides the one that is not in use:

```
<span class="l" lang="es">Proyectos</span>
<span class="l" lang="en">Projects</span>
```

Pressing **ES** or **EN** makes a script change one attribute on the `<html>` tag and save the choice in the browser's local storage. The next page you open reads that choice before it paints, so there is no flicker from one language to the other.

> [margin] If the browser will not store anything, the site still works: it stays in Spanish, the default language.

The upside is that switching language reloads nothing and keeps you on the page. The cost is that each page weighs a little more, because it carries the text twice. For a notebook with little text per page, it is worth it.

A blog entry can exist in one language only. In that case it is shown as it is, with a notice for whoever reads it in the other one.

## No path starts with a slash

The site is published inside a GitHub Pages subfolder, not at the root of a domain. A link like `/proyectos.html` would point outside the site.

That is why every path is relative. The build script knows how deep each page sits and adds as many `../` as needed: a blog entry, which lives in `blog/`, loads the stylesheet from `../recursos/cuaderno.css`.

The result can be checked without publishing anything: serve the `_site/` folder from any subpath and see that everything loads.
