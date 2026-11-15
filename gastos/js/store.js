// Estado y persistencia. Los importes se guardan en céntimos (enteros).

const KEY = 'huchas.v1';

// Colores de las gomas de los tarros (y de los gráficos).
export const PALETTE = [
  '#F08A24', '#E9BE3A', '#9BB13C', '#2FA58C', '#58A9DC',
  '#6A78DA', '#B068BD', '#EE86A6', '#F3E7CF', '#F2664B',
];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'BRL', 'CHF', 'JPY'];

function defaults() {
  return {
    v: 1,
    lang: 'es',
    currency: 'EUR',
    categories: [
      { id: 'food', kind: 'expense', name: null, color: PALETTE[0], budget: 32000 },
      { id: 'home', kind: 'expense', name: null, color: PALETTE[4], budget: 75000 },
      { id: 'transport', kind: 'expense', name: null, color: PALETTE[3], budget: 9000 },
      { id: 'leisure', kind: 'expense', name: null, color: PALETTE[7], budget: 12000 },
      { id: 'health', kind: 'expense', name: null, color: PALETTE[2], budget: 6000 },
      { id: 'clothes', kind: 'expense', name: null, color: PALETTE[6], budget: 7000 },
      { id: 'subs', kind: 'expense', name: null, color: PALETTE[5], budget: 4500 },
      { id: 'other', kind: 'expense', name: null, color: PALETTE[8], budget: 8000 },
      { id: 'salary', kind: 'income', name: null, color: PALETTE[3], budget: 0 },
      { id: 'extra', kind: 'income', name: null, color: PALETTE[1], budget: 0 },
    ],
    tx: [],
  };
}

function sanitize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base };
  if (raw.lang === 'es' || raw.lang === 'en') out.lang = raw.lang;
  if (CURRENCIES.includes(raw.currency)) out.currency = raw.currency;
  if (Array.isArray(raw.categories)) {
    out.categories = raw.categories
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({
        id: c.id,
        kind: c.kind === 'income' ? 'income' : 'expense',
        name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 24) : null,
        color: typeof c.color === 'string' ? c.color : PALETTE[0],
        budget: Number.isFinite(c.budget) && c.budget > 0 ? Math.round(c.budget) : 0,
      }));
  }
  if (Array.isArray(raw.tx)) {
    out.tx = raw.tx
      .filter((t) => t && typeof t.id === 'string' && Number.isFinite(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
      .map((t) => ({
        id: t.id,
        type: t.type === 'income' ? 'income' : 'expense',
        amount: Math.max(0, Math.round(t.amount)),
        cat: typeof t.cat === 'string' ? t.cat : '',
        date: t.date,
        note: typeof t.note === 'string' ? t.note.slice(0, 120) : '',
      }));
  }
  return out;
}

export let storageOk = true;

export function load() {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return defaults();
    return sanitize(JSON.parse(txt));
  } catch (e) {
    storageOk = false;
    return defaults();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
    return true;
  } catch (e) {
    storageOk = false;
    return false;
  }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ }
  return defaults();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----
export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const today = () => isoDate(new Date());
export const monthOf = (iso) => iso.slice(0, 7);
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ---- consultas ----
export function monthTx(state, ym) {
  return state.tx.filter((t) => t.date.startsWith(ym));
}

export function monthTotals(state, ym) {
  let income = 0, expense = 0;
  const byCat = {};
  for (const t of state.tx) {
    if (!t.date.startsWith(ym)) continue;
    if (t.type === 'income') income += t.amount;
    else {
      expense += t.amount;
      byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
    }
  }
  return { income, expense, balance: income - expense, byCat };
}

// ---- datos de ejemplo (deterministas) ----
export function sampleData(state, noteFor) {
  let seed = 20261115;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const now = new Date();
  const tx = [];
  const plan = {
    food: [11, 900, 5200], home: [1, 70000, 70000], transport: [5, 300, 2600], leisure: [5, 800, 3600],
    health: [2, 600, 2400], clothes: [2, 1500, 4800], subs: [3, 599, 1499], other: [3, 400, 2500],
  };
  const has = (id) => state.categories.some((c) => c.id === id);
  for (let back = 5; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const ym = isoDate(first).slice(0, 7);
    const lastDay = back === 0 ? now.getDate() : daysInMonth(ym);
    const share = back === 0 ? Math.max(0.35, lastDay / daysInMonth(ym)) : 1;
    const day = (max) => `${ym}-${String(1 + Math.floor(rnd() * max)).padStart(2, '0')}`;
    if (has('salary')) tx.push({ id: uid(), type: 'income', amount: 185000, cat: 'salary', date: `${ym}-01`, note: '' });
    if (has('extra') && rnd() > 0.5) tx.push({ id: uid(), type: 'income', amount: 4000 + Math.floor(rnd() * 20) * 500, cat: 'extra', date: day(lastDay), note: '' });
    for (const [cat, [n, lo, hi]] of Object.entries(plan)) {
      if (!has(cat)) continue;
      const count = cat === 'home' ? 1 : Math.max(1, Math.round(n * share * (0.7 + rnd() * 0.7)));
      for (let i = 0; i < count; i++) {
        const amount = Math.round((lo + rnd() * (hi - lo)) / 5) * 5;
        tx.push({ id: uid(), type: 'expense', amount, cat, date: cat === 'home' ? `${ym}-02` : day(lastDay), note: noteFor(cat, Math.floor(rnd() * 3)) });
      }
    }
  }
  return tx;
}

// ---- CSV ----
export function toCSV(rows, { sep, decimal, header }) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n\r;,]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(sep)];
  for (const r of rows) {
    const amount = (r.amount / 100).toFixed(2).replace('.', decimal);
    // El importe va firmado y sin comillas para que la hoja de cálculo lo lea como número.
    lines.push([esc(r.date), esc(r.type), esc(r.category), (r.sign < 0 ? '-' : '') + amount, esc(r.currency), esc(r.note)].join(sep));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
