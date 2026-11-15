// Puente con Huchas (../gastos/), la app de gastos publicada en el mismo origen.
// Huchas guarda todo su estado en localStorage bajo la clave «huchas.v1»:
//   { v:1, lang, currency, categories:[{id, kind, name, color, budget}], tx:[{id, type, amount, cat, date, note}] }
// Los importes van en céntimos (enteros) y la fecha como AAAA-MM-DD. Al cargar, Huchas
// pasa el objeto por sanitize(): rellena lo que falte con sus valores por defecto.
// Este módulo solo AÑADE un movimiento al final de tx y deja intacto todo lo demás
// (incluidos campos que no conoce). Si el JSON no se puede leer, no escribe nada.

const KEY = 'huchas.v1';
const DEFAULT_EXPENSE = ['food', 'home', 'transport', 'leisure', 'health', 'clothes', 'subs', 'other'];

// Devuelve { ok, state, categories, currency, exists } o { ok:false, reason }
export function readHuchas() {
  let txt;
  try { txt = localStorage.getItem(KEY); } catch (e) { return { ok: false, reason: 'storage', error: e }; }
  if (!txt) {
    return {
      ok: true, exists: false, state: null, currency: 'EUR',
      categories: DEFAULT_EXPENSE.map((id) => ({ id, name: null })),
    };
  }
  let raw;
  try { raw = JSON.parse(txt); } catch (e) { return { ok: false, reason: 'corrupt' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw.tx !== undefined && !Array.isArray(raw.tx))) {
    return { ok: false, reason: 'corrupt' };
  }
  const cats = Array.isArray(raw.categories)
    ? raw.categories.filter((c) => c && typeof c.id === 'string' && c.kind !== 'income').map((c) => ({ id: c.id, name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : null }))
    : DEFAULT_EXPENSE.map((id) => ({ id, name: null }));
  return { ok: true, exists: true, state: raw, currency: typeof raw.currency === 'string' ? raw.currency : 'EUR', categories: cats };
}

function hid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Añade un gasto. amount en unidades (12.5), date ISO, cat id, note texto.
export function addExpense({ amount, date, cat, note, lang }) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, reason: 'amount' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date))) return { ok: false, reason: 'date' };
  const read = readHuchas();
  if (!read.ok) return read;
  if (!read.categories.some((c) => c.id === cat)) return { ok: false, reason: 'cat' };
  const tx = { id: hid(), type: 'expense', amount: cents, cat, date, note: String(note || '').slice(0, 120) };
  const state = read.exists ? read.state : { v: 1, lang: lang === 'en' ? 'en' : 'es', currency: 'EUR', tx: [] };
  if (!Array.isArray(state.tx)) state.tx = [];
  state.tx.push(tx);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    return { ok: false, reason: 'storage', error: e };
  }
  // Comprobación: se vuelve a leer y se busca el movimiento.
  const back = readHuchas();
  const found = back.ok && back.exists && back.state.tx.some((x) => x.id === tx.id && x.amount === cents);
  return found ? { ok: true, tx } : { ok: false, reason: 'verify' };
}

// ¿Sigue en Huchas un movimiento enviado antes?
export function stillThere(txId) {
  const r = readHuchas();
  return !!(r.ok && r.exists && Array.isArray(r.state.tx) && r.state.tx.some((x) => x.id === txId));
}

// CSV con las mismas columnas y formato que exporta Huchas (separador ; y coma decimal en
// español; , y punto en inglés; BOM para Excel; importe firmado sin comillas).
export function huchasCSV({ amount, date, catName, currency, note }, t, lang) {
  const sep = lang === 'en' ? ',' : ';';
  const dec = lang === 'en' ? '.' : ',';
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n\r;,]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['csv.date', 'csv.type', 'csv.category', 'csv.amount', 'csv.currency', 'csv.note'].map((k) => esc(t(k))).join(sep);
  const amt = '-' + Number(amount).toFixed(2).replace('.', dec);
  const row = [esc(date), esc(t('csv.expense')), esc(catName), amt, esc(currency), esc(note)].join(sep);
  return '﻿' + head + '\r\n' + row + '\r\n';
}
