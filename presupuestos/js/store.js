// Almacenamiento local. Todo vive en localStorage de este navegador; nada sale del dispositivo.
const PREFIX = 'ofz-presupuestos:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // Sin espacio o almacenamiento bloqueado (modo privado): la app sigue, sin persistir.
  }
}

export const FREE_LIMIT = 3;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + Number(days || 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// ---------- Registro (correo + empresa o nombre) ----------
export function getLead() { return load('lead', null); }
export function setLead(lead) { save('lead', lead); }

// ---------- Contador del plan gratuito ----------
// Cuenta los presupuestos CREADOS (no los que hay ahora), para que borrar no libere huecos.
export function getCreated() { return Number(load('created', 0)) || 0; }
export function canCreate() { return getCreated() < FREE_LIMIT; }
function bumpCreated() { save('created', getCreated() + 1); }

// ---------- Datos del emisor por defecto ----------
export function getIssuer() { return load('issuer', null); }
export function setIssuer(issuer) { save('issuer', issuer); }

// ---------- Presupuestos ----------
export function listQuotes() {
  const q = load('quotes', []);
  return Array.isArray(q) ? q : [];
}
export function getQuote(id) { return listQuotes().find((q) => q.id === id) || null; }

/** Guarda un presupuesto. Devuelve false si es nuevo y ya no quedan gratis. */
export function upsertQuote(quote) {
  const all = listQuotes();
  const i = all.findIndex((q) => q.id === quote.id);
  const now = new Date().toISOString();
  if (i === -1) {
    if (!canCreate()) return false;
    all.unshift({ ...quote, createdAt: now, updatedAt: now });
    bumpCreated();
  } else {
    all[i] = { ...quote, createdAt: all[i].createdAt, updatedAt: now };
  }
  return save('quotes', all);
}

export function deleteQuote(id) {
  save('quotes', listQuotes().filter((q) => q.id !== id));
}

export function nextNumber() {
  const year = new Date().getFullYear();
  const re = new RegExp(`^P-${year}-(\\d+)$`);
  let max = 0;
  for (const q of listQuotes()) {
    const m = re.exec(q.number || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  // Si no hay coincidencias, se sigue desde el contador para no repetir números ya usados y borrados.
  max = Math.max(max, getCreated());
  return `P-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ---------- Clientes ----------
export function listClients() {
  const c = load('clients', []);
  return Array.isArray(c) ? c : [];
}
export function getClient(id) { return listClients().find((c) => c.id === id) || null; }

export function upsertClient(client) {
  const all = listClients();
  const i = all.findIndex((c) => c.id === client.id);
  if (i === -1) all.push(client); else all[i] = client;
  all.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  save('clients', all);
  return client;
}

/** Busca un cliente igual (mismo NIF, o mismo nombre si no hay NIF) para no duplicarlo. */
export function findSameClient(c) {
  const norm = (s) => (s || '').trim().toLowerCase();
  return listClients().find((x) =>
    (norm(c.nif) && norm(x.nif) === norm(c.nif)) || (!norm(c.nif) && !norm(x.nif) && norm(x.name) === norm(c.name))
  ) || null;
}

export function deleteClient(id) {
  save('clients', listClients().filter((c) => c.id !== id));
}
