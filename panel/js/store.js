// Paneles guardados en el dispositivo (IndexedDB). Las filas crudas se guardan aparte de la
// configuración para que guardar un cambio de gráfico no copie de nuevo decenas de miles de filas.
//
// INTEGRACIÓN FUTURA (sincronización): aquí se conectaría un servicio para compartir paneles entre
// dispositivos o con el equipo. Habría que:
//   1. Autenticar a la persona (p. ej. con el SSO de la empresa) y obtener un token.
//   2. En savePanel(), además de escribir en IndexedDB, enviar { panel, sourceMeta } al servidor
//      (POST /api/paneles). Las filas solo deberían subir si la persona lo acepta expresamente,
//      porque la promesa actual de la app es que los datos no salen del dispositivo.
//   3. En listPanels(), mezclar los paneles remotos marcándolos como "compartidos".
// Mientras no exista ese servicio, todo se queda en este navegador.

const DB = 'tirada';
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB, VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('panels')) db.createObjectStore('panels', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

function tx(stores, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tr = db.transaction(stores, mode);
    let result;
    tr.oncomplete = () => resolve(result);
    tr.onerror = () => reject(tr.error);
    tr.onabort = () => reject(tr.error || new Error('abort'));
    result = fn(tr);
  }));
}

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function putSource(source) {
  try {
    await tx(['sources'], 'readwrite', (tr) => { tr.objectStore('sources').put(source); });
    return true;
  } catch { return false; }
}

export async function getSource(id) {
  try {
    const db = await open();
    return await reqP(db.transaction('sources').objectStore('sources').get(id));
  } catch { return null; }
}

export async function putPanel(panel) {
  try {
    await tx(['panels'], 'readwrite', (tr) => { tr.objectStore('panels').put(panel); });
    return true;
  } catch { return false; }
}

export async function getPanel(id) {
  try {
    const db = await open();
    return await reqP(db.transaction('panels').objectStore('panels').get(id));
  } catch { return null; }
}

export async function listPanels() {
  try {
    const db = await open();
    const all = await reqP(db.transaction('panels').objectStore('panels').getAll());
    return all.filter((p) => p.id !== DRAFT_ID).sort((a, b) => b.savedAt - a.savedAt);
  } catch { return []; }
}

// Borra el panel y, si nadie más usa sus datos, también las filas.
export async function deletePanel(id) {
  try {
    const db = await open();
    const all = await reqP(db.transaction('panels').objectStore('panels').getAll());
    const target = all.find((p) => p.id === id);
    if (!target) return true;
    const stillUsed = all.some((p) => p.id !== id && p.sourceId === target.sourceId);
    await tx(['panels', 'sources'], 'readwrite', (tr) => {
      tr.objectStore('panels').delete(id);
      if (!stillUsed) tr.objectStore('sources').delete(target.sourceId);
    });
    return true;
  } catch { return false; }
}

// Limpia filas que ya no usa ningún panel (p. ej. borradores sustituidos).
export async function pruneSources() {
  try {
    const db = await open();
    const panels = await reqP(db.transaction('panels').objectStore('panels').getAll());
    const keys = await reqP(db.transaction('sources').objectStore('sources').getAllKeys());
    const used = new Set(panels.map((p) => p.sourceId));
    const orphan = keys.filter((k) => !used.has(k));
    if (orphan.length) await tx(['sources'], 'readwrite', (tr) => orphan.forEach((k) => tr.objectStore('sources').delete(k)));
  } catch { /* nada que limpiar */ }
}

export const DRAFT_ID = '__draft';
