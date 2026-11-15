// Datos del usuario: todo se queda en este navegador (localStorage). No hay servidor ni cuentas.

import { BASE_KEYS, SECTION_DEFS, newCV, newSection, tplById, uid } from './templates.js';

const KEY = 'ic-curriculum-v1';
export const state = { lang: 'es', tourDone: false, cvs: [] };

const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const oneOf = (v, list, def) => (list.includes(v) ? v : def);

// Acepta un currículum de cualquier procedencia (copia importada, versión anterior) y lo deja bien formado.
export function normalizeCV(raw, keepId = true) {
  if (!raw || typeof raw !== 'object') return null;
  const base = newCV(tplById(raw.template).id, str(raw.name, 80) || 'Currículum');
  const cv = base;
  if (keepId && typeof raw.id === 'string' && raw.id) cv.id = raw.id.slice(0, 40);
  cv.created = Number(raw.created) || Date.now();
  cv.updated = Number(raw.updated) || Date.now();
  cv.country = str(raw.country, 20) || 'es';
  cv.docLang = oneOf(raw.docLang, ['es', 'en', 'fr', 'de', 'pt', 'it'], 'es');
  const d = raw.design || {};
  Object.assign(cv.design, {
    accent: /^#[0-9a-f]{6}$/i.test(d.accent || '') ? d.accent : cv.design.accent,
    font: str(d.font, 40) || cv.design.font,
    size: oneOf(d.size, ['s', 'm', 'l', 'xl'], 'm'),
    margins: oneOf(d.margins, ['narrow', 'normal', 'wide'], 'normal'),
    density: oneOf(d.density, ['tight', 'normal', 'loose'], 'normal'),
    columns: d.columns === 2 ? 2 : 1,
    photo: !!d.photo,
    dateFormat: oneOf(d.dateFormat, ['num', 'short', 'long', 'year'], 'num'),
    page: oneOf(d.page, ['a4', 'letter'], 'a4'),
  });
  const p = raw.personal || {};
  for (const k of Object.keys(cv.personal)) cv.personal[k] = k === 'photo' ? (/^data:image\/(jpeg|png);base64,/.test(p.photo || '') ? p.photo : '') : str(p[k], 300);
  if (Array.isArray(raw.sections)) {
    const out = [];
    for (const s of raw.sections.slice(0, 40)) {
      if (!s || typeof s !== 'object') continue;
      const key = str(s.key, 30) || 'custom';
      const kind = SECTION_DEFS[key] ? SECTION_DEFS[key].kind : oneOf(s.kind, ['text', 'entries', 'list', 'facts', 'skills', 'langs'], 'entries');
      const n = newSection(SECTION_DEFS[key] ? key : 'custom', { kind, title: str(s.title, 80), on: s.on !== false });
      if (typeof s.id === 'string' && s.id) n.id = s.id.slice(0, 40);
      if (kind === 'text' || kind === 'list') { n.text = str(s.text, 6000); delete n.items; }
      else {
        delete n.text;
        n.items = (Array.isArray(s.items) ? s.items : []).slice(0, 60).map((it) => {
          const o = { id: typeof it?.id === 'string' && it.id ? it.id.slice(0, 40) : uid() };
          for (const [k, v] of Object.entries(it || {})) if (k !== 'id') o[k] = k === 'current' ? !!v : str(v, 3000);
          return o;
        });
      }
      out.push(n);
    }
    for (const k of BASE_KEYS) if (!out.some((s) => s.key === k)) out.push(newSection(k, { on: false }));
    cv.sections = out;
  }
  return cv;
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      state.lang = raw.lang === 'en' ? 'en' : 'es';
      state.tourDone = !!raw.tourDone;
      state.cvs = (Array.isArray(raw.cvs) ? raw.cvs : []).map((c) => normalizeCV(c)).filter(Boolean);
    }
  } catch (e) { console.warn('No se pudieron leer los datos guardados.', e); }
  return state;
}

// Devuelve true si se guardó. Falla si el navegador no deja guardar o no queda espacio.
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, lang: state.lang, tourDone: state.tourDone, cvs: state.cvs })); return true; }
  catch (e) { console.warn('No se pudo guardar.', e); return false; }
}

export const BACKUP_TAG = 'ic-curriculum';
export function backupOf(cvs) { return JSON.stringify({ app: BACKUP_TAG, v: 1, exported: new Date().toISOString(), cvs }, null, 1); }
export function parseBackup(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data?.cvs) ? data.cvs : data?.cv ? [data.cv] : data?.sections ? [data] : null;
  if (!list) throw new Error('formato');
  const out = list.map((c) => normalizeCV(c, false)).filter(Boolean);
  if (!out.length) throw new Error('vacío');
  return out;
}
