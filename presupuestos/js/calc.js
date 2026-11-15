// Cálculo de importes. Cada línea se redondea a céntimos y los impuestos se calculan sobre la base.
// toPrecision(12) limpia el ruido binario (28.035 * 100 = 2803.4999…) antes de redondear a la mitad hacia arriba.
export const round2 = (x) => {
  const c = Number((Number(x) * 100).toPrecision(12));
  return (c < 0 ? -Math.round(-c) : Math.round(c)) / 100;
};

/** Lee números escritos con coma o punto decimal ("1.234,5", "12,5", "12.5"). */
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/\s/g, '').replace('€', '').replace('%', '');
  if (!s) return 0;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) {
    s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lc > -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function lineAmount(line) {
  const qty = parseNum(line.qty);
  const price = parseNum(line.price);
  const disc = Math.min(100, Math.max(0, parseNum(line.disc)));
  return round2(qty * price * (1 - disc / 100));
}

export function totals(quote) {
  const base = round2((quote.lines || []).reduce((s, l) => s + lineAmount(l), 0));
  const vatRate = parseNum(quote.vatRate);
  const vat = round2(base * vatRate / 100);
  const irpfRate = quote.irpfOn ? parseNum(quote.irpfRate) : 0;
  const irpf = quote.irpfOn ? round2(base * irpfRate / 100) : 0;
  return { base, vatRate, vat, irpfRate, irpf, total: round2(base + vat - irpf) };
}
