// Historial en IndexedDB («escaner», almacén «docs»). Cada documento guarda la imagen
// tratada (Blob JPEG), una miniatura, el texto, las palabras con su caja y los campos.
const DB = 'escaner';
const STORE = 'docs';
let dbP = null;
export let available = true;

function open() {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('created', 'created');
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('blocked'));
  }).catch((e) => { available = false; dbP = null; throw e; });
  return dbP;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('abort'));
  });
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function put(doc) {
  try { await tx('readwrite', (s) => req2p(s.put(doc))); return true; } catch (e) { available = false; return false; }
}

export async function get(id) {
  try { return await tx('readonly', (s) => req2p(s.get(id))); } catch (e) { available = false; return null; }
}

export async function remove(id) {
  try { await tx('readwrite', (s) => req2p(s.delete(id))); return true; } catch (e) { return false; }
}

// Lista sin la imagen grande (solo lo necesario para el historial).
export async function list() {
  try {
    const all = await tx('readonly', (s) => req2p(s.getAll()));
    return (all || []).map(({ image, ...rest }) => rest).sort((a, b) => b.created - a.created);
  } catch (e) {
    available = false;
    return [];
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
