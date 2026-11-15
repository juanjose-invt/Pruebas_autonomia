// Progreso y preferencias en localStorage, con red de seguridad si el almacenamiento falla.
const KEY = 'ladea.v1';
const base = { lang: 'es', muted: false, current: 0, unlocked: 0, best: {} };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...base, best: {} };
    const d = JSON.parse(raw);
    return { ...base, ...d, best: { ...(d.best || {}) } };
  } catch (e) { return { ...base, best: {} }; }
}
export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
