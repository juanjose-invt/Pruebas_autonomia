// Conjuntos de datos de ejemplo, inventados. Se generan como texto CSV y pasan por el mismo
// lector que un archivo real, así sirven también de ensayo del importador.

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr, w) => {
  if (!w) return arr[Math.floor(r() * arr.length)];
  const tot = w.reduce((a, b) => a + b, 0);
  let x = r() * tot;
  for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; }
  return arr[arr.length - 1];
};
const pad = (n) => String(n).padStart(2, '0');

export function shopSample(lang) {
  const r = rng(20240611);
  const es = lang !== 'en';
  const head = es ? ['Fecha', 'Tienda', 'Producto', 'Canal', 'Unidades', 'Importe', 'Valoración'] : ['Date', 'Shop', 'Product', 'Channel', 'Units', 'Amount', 'Rating'];
  const shops = es ? ['Pradera Centro', 'Barrio Alto', 'Estación Norte', 'Puesto del Mercado', 'Tienda en línea'] : ['Pradera Centre', 'Upper Quarter', 'North Station', 'Market Stall', 'Online shop'];
  const shopW = [5, 3, 3, 2, 4];
  const products = [
    ['Mezcla Pradera 250 g', 7.9], ['Tueste Claro Nube 250 g', 9.4], ['Descafeinado Lento 250 g', 8.6],
    ['Origen Altamira 500 g', 16.5], ['Molido Fino Faro 250 g', 7.2], ['Cápsulas Compostables x20', 6.8],
    ['Cafetera Pradera 6 tazas', 34.9], ['Taza de Gres', 12.0],
  ];
  const prodW = [9, 5, 3, 3, 6, 6, 1, 2];
  const channels = es ? ['Mostrador', 'Web', 'Mercado'] : ['Counter', 'Web', 'Market'];
  const rows = [head];
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < 3000; i++) {
    // más ventas en otoño e invierno
    let day;
    do { day = Math.floor(r() * 366); } while (r() > 0.55 + 0.45 * Math.cos(((day - 15) / 366) * 2 * Math.PI) ** 2);
    const d = new Date(start + day * 86400000);
    const shop = pick(r, shops, shopW);
    const isOnline = shop === shops[4];
    const isMarket = shop === shops[3];
    const channel = isOnline ? channels[1] : isMarket ? channels[2] : r() < 0.12 ? channels[1] : channels[0];
    const [prod, price] = pick(r, products, prodW);
    const units = 1 + Math.floor(r() ** 2.4 * 6);
    const disc = r() < 0.15 ? 0.9 : 1;
    const amount = Math.round(units * price * disc * 100) / 100;
    const rating = r() < 0.22 ? '' : String(Math.max(1, Math.min(5, Math.round(3.9 + (r() - 0.45) * 2.6))));
    const date = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    const amt = es ? `${amount.toFixed(2).replace('.', ',')} €` : `€${amount.toFixed(2)}`;
    rows.push([date, shop, prod, channel, String(units), amt, rating]);
  }
  rows.sort((a, b) => (a === head ? -1 : b === head ? 1 : a[0].split('/').reverse().join('').localeCompare(b[0].split('/').reverse().join(''))));
  const sep = es ? ';' : ',';
  const q = (v) => (v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((row) => row.map(q).join(sep)).join('\r\n');
}

export function librarySample(lang) {
  const r = rng(19870304);
  const es = lang !== 'en';
  const head = es ? ['Fecha de préstamo', 'Sala', 'Tipo de material', 'Edad del lector', 'Días de préstamo', 'Devuelto con retraso'] : ['Loan date', 'Room', 'Material type', 'Reader age', 'Loan days', 'Returned late'];
  const rooms = es ? ['Infantil', 'Juvenil', 'Adultos', 'Hemeroteca', 'Fonoteca'] : ['Children', 'Youth', 'Adults', 'Periodicals', 'Audio room'];
  const mats = es ? ['Libro', 'Cómic', 'Película', 'Revista', 'Audiolibro'] : ['Book', 'Comic', 'Film', 'Magazine', 'Audiobook'];
  const yes = es ? 'Sí' : 'Yes', no = 'No';
  const rows = [head];
  const start = Date.UTC(2023, 8, 1);
  for (let i = 0; i < 2400; i++) {
    let day;
    do { day = Math.floor(r() * 366); } while (new Date(start + day * 86400000).getUTCDay() === 0 || ((new Date(start + day * 86400000).getUTCMonth() === 7) && r() < 0.6));
    const d = new Date(start + day * 86400000);
    const room = pick(r, rooms, [5, 3, 6, 2, 1]);
    const ri = rooms.indexOf(room);
    const age = ri === 0 ? 4 + Math.floor(r() * 8) : ri === 1 ? 12 + Math.floor(r() * 6) : 18 + Math.floor(r() ** 1.3 * 62);
    const mat = ri === 3 ? mats[3] : ri === 4 ? pick(r, [mats[2], mats[4]]) : pick(r, mats, ri === 0 ? [5, 4, 1, 0, 1] : [7, 2, 2, 1, 1]);
    const days = Math.max(1, Math.round((mat === mats[0] ? 18 : 9) + (r() - 0.4) * 14));
    const late = r() < (days > 20 ? 0.28 : 0.1) ? yes : no;
    rows.push([
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      room, mat, r() < 0.06 ? '' : String(age), String(days), late,
    ]);
  }
  rows.sort((a, b) => (a === head ? -1 : b === head ? 1 : a[0].localeCompare(b[0])));
  return rows.map((row) => row.join(',')).join('\n');
}

export const SAMPLES = [
  { id: 'shop', build: shopSample },
  { id: 'library', build: librarySample },
];
