// Estado del tablero: carga, guardado, datos de ejemplo y validación de importaciones.
const KEY = 'kanban.board.v1';

export const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'orange', 'lilac'];
export const TAG_COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'graphite'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

const SEED = {
  es: {
    title: 'Mi corcho',
    tags: ['Urgente', 'Casa', 'Trabajo', 'Recados', 'Ideas', 'Esperando'],
    columns: [
      ['Pendiente', [
        ['Pedir cita en el dentista', '', 'yellow', [0], -2],
        ['Regalo de cumpleaños para Marta', 'Le gustó la lámpara de la tienda de la plaza.', 'pink', [3], 6],
        ['Revisar la presión de las ruedas', '', 'blue', [], null],
      ]],
      ['Esta semana', [
        ['Renovar el abono de transporte', '', 'orange', [3], 1],
        ['Devolver el libro a la biblioteca', '', 'green', [], 0],
        ['Preparar la reunión del jueves', 'Llevar las cifras del trimestre impresas.', 'yellow', [2], 3],
      ]],
      ['En marcha', [
        ['Montar la estantería del pasillo', 'Faltan cuatro tacos del 6.', 'lilac', [1], null],
      ]],
      ['Hecho', [
        ['Pagar el recibo de la comunidad', '', 'green', [1], null],
      ]],
    ],
  },
  en: {
    title: 'My corkboard',
    tags: ['Urgent', 'Home', 'Work', 'Errands', 'Ideas', 'Waiting'],
    columns: [
      ['To do', [
        ['Book a dentist appointment', '', 'yellow', [0], -2],
        ['Birthday present for Martha', 'She liked the lamp in the shop on the square.', 'pink', [3], 6],
        ['Check the tyre pressure', '', 'blue', [], null],
      ]],
      ['This week', [
        ['Renew the travel pass', '', 'orange', [3], 1],
        ['Return the library book', '', 'green', [], 0],
        ['Prepare Thursday\'s meeting', 'Bring the quarterly figures printed.', 'yellow', [2], 3],
      ]],
      ['Doing', [
        ['Put up the hallway shelf', 'Four size 6 wall plugs missing.', 'lilac', [1], null],
      ]],
      ['Done', [
        ['Pay the building fees', '', 'green', [1], null],
      ]],
    ],
  },
};

export function seedBoard(lang) {
  const s = SEED[lang] || SEED.es;
  const labels = TAG_COLORS.map((color, i) => ({ id: 'tag-' + color, color, name: s.tags[i] }));
  return {
    version: 1,
    title: s.title,
    labels,
    columns: s.columns.map(([title, cards]) => ({
      id: uid(),
      title,
      cards: cards.map(([ct, notes, color, tags, due]) => ({
        id: uid(),
        title: ct,
        notes,
        color,
        labels: tags.map((i) => labels[i].id),
        due: due == null ? '' : inDays(due),
      })),
    })),
  };
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// Devuelve un tablero limpio a partir de datos de fuera, o null si no lo parecen.
export function normalizeBoard(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.columns)) return null;
  const seenIds = new Set();
  const freshId = (v) => {
    let id = typeof v === 'string' && v && v.length < 64 ? v : uid();
    while (seenIds.has(id)) id = uid();
    seenIds.add(id);
    return id;
  };
  const rawLabels = Array.isArray(raw.labels) ? raw.labels : [];
  const labels = TAG_COLORS.map((color) => {
    const found = rawLabels.find((l) => l && l.color === color);
    return { id: 'tag-' + color, color, name: found ? str(found.name, 40) : '' };
  });
  const labelIdMap = new Map();
  rawLabels.forEach((l) => { if (l && TAG_COLORS.includes(l.color)) labelIdMap.set(l.id, 'tag-' + l.color); });

  const columns = [];
  for (const c of raw.columns) {
    if (!c || typeof c !== 'object') return null;
    const cards = [];
    for (const k of Array.isArray(c.cards) ? c.cards : []) {
      if (!k || typeof k !== 'object') continue;
      const tagIds = Array.isArray(k.labels) ? k.labels.map((id) => labelIdMap.get(id)).filter(Boolean) : [];
      cards.push({
        id: freshId(k.id),
        title: str(k.title, 300),
        notes: str(k.notes, 4000),
        color: NOTE_COLORS.includes(k.color) ? k.color : 'yellow',
        labels: [...new Set(tagIds)],
        due: /^\d{4}-\d{2}-\d{2}$/.test(k.due) ? k.due : '',
      });
    }
    columns.push({ id: freshId(c.id), title: str(c.title, 80), cards });
  }
  return { version: 1, title: str(raw.title, 80), labels, columns };
}

export function loadBoard() {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return normalizeBoard(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveBoard(board) {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}
