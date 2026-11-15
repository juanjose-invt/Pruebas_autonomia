// Estado guardado en el dispositivo (localStorage). Todo acceso va protegido:
// si el navegador no deja guardar, la app sigue funcionando en memoria.
import { BUILTIN } from './recipes.js';

const KEY = 'impasto.v1';

const DEFAULTS = {
  lang: null,
  recipes: {},   // recetas propias y versiones modificadas de las de la casa (misma id)
  favs: [],
  scale: {},     // { id: { pizzas, ball } } cantidades elegidas en la ficha
  plan: {},      // { id: { eat: ISO, ov: { pasoId: minutos } } }
  progress: {},  // { id: índice de paso } del modo paso a paso
  timers: {},    // { 'id|paso': { end, left, total, running } }
  sound: true,
  stage: 's',    // tamaño de la escena del paso a paso: 'off', 's' o 'l'
  calc: null,    // último estado de la calculadora
};

let state = load();
let failed = false;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return { ...structuredClone(DEFAULTS), ...data };
    }
  } catch { /* almacenamiento no disponible o datos corruptos: empezamos de cero */ }
  return structuredClone(DEFAULTS);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    failed = false;
  } catch {
    failed = true;
  }
  // PUNTO DE INTEGRACIÓN (futuro): sincronización de recetas entre dispositivos.
  // Ahora mismo no hay servidor. Para conectarlo bastaría con enviar aquí `state.recipes`
  // y `state.favs` a una API propia (p. ej. PUT /recetas con la sesión del usuario) y,
  // en `load()`, fusionar lo recibido con lo local por fecha de modificación (`updated`).
  // La app no depende de ello: todo funciona solo con localStorage.
  listeners.forEach((fn) => fn());
}

export const store = {
  get: (k) => state[k],
  set(k, v) { state[k] = v; persist(); },
  patch(k, id, v) { state[k] = { ...state[k], [id]: v }; persist(); },
  drop(k, id) { const c = { ...state[k] }; delete c[id]; state[k] = c; persist(); },
  get saveFailed() { return failed; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function allRecipes() {
  const user = state.recipes || {};
  const out = BUILTIN.map((b) => (user[b.id] ? { ...user[b.id], builtin: true, modified: true } : b));
  const own = Object.values(user).filter((r) => !BUILTIN.some((b) => b.id === r.id));
  own.sort((a, b) => (a.created || 0) - (b.created || 0));
  return out.concat(own);
}

export function getRecipe(id) {
  return allRecipes().find((r) => r.id === id) || null;
}

// Receta con las cantidades elegidas en la ficha (nº de pizzas y peso por bola).
export function scaled(r) {
  const s = state.scale?.[r.id];
  return s ? { ...r, pizzas: s.pizzas ?? r.pizzas, ball: s.ball ?? r.ball } : r;
}

export function saveRecipe(r) {
  const now = Date.now();
  const rec = { ...r, updated: now, created: r.created || now };
  delete rec.modified;
  if (!rec.id) rec.id = uid();
  state.recipes = { ...state.recipes, [rec.id]: rec };
  const sc = { ...state.scale }; delete sc[rec.id]; state.scale = sc;
  persist();
  return rec;
}

export function deleteRecipe(id) {
  const c = { ...state.recipes }; delete c[id]; state.recipes = c;
  state.favs = state.favs.filter((f) => f !== id);
  for (const k of ['scale', 'plan', 'progress']) { const o = { ...state[k] }; delete o[id]; state[k] = o; }
  persist();
}

export function duplicateRecipe(r, name) {
  const copy = structuredClone(r);
  delete copy.modified;
  return saveRecipe({ ...copy, id: uid(), builtin: false, name, created: Date.now() });
}

export const isFav = (id) => state.favs.includes(id);
export function toggleFav(id) {
  state.favs = isFav(id) ? state.favs.filter((f) => f !== id) : [...state.favs, id];
  persist();
  return isFav(id);
}
