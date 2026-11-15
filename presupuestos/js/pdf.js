// Generación del PDF en el propio dispositivo con jsPDF (vendor/jspdf.umd.min.js, MIT).
// Texto vectorial con Figtree y Mohave incrustadas (TTF convertidas desde @fontsource, OFL).
import { t, money, num, date } from './i18n.js';
import { totals, lineAmount, parseNum } from './calc.js';
import { addDaysISO } from './store.js';

const FONT_FILES = {
  'figtree-400.ttf': ['Figtree', 'normal'],
  'figtree-600.ttf': ['Figtree', 'bold'],
  'mohave-300.ttf': ['Mohave', 'normal'],
};
let fontCache = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const entries = await Promise.all(Object.keys(FONT_FILES).map(async (file) => {
    const res = await fetch(`fonts/pdf/${file}`);
    if (!res.ok) throw new Error('font ' + file);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return [file, btoa(bin)];
  }));
  fontCache = Object.fromEntries(entries);
  return fontCache;
}

// Las fuentes del PDF llevan el juego latino; lo que quede fuera se aproxima sin tildes.
const SAFE = /[^\u0009\u000A\u000D -~ -ÿıŒœ–—‘’‚“”„•…€™−]/g;
const SAFE_ONE = new RegExp(SAFE.source);
function safe(s) {
  return String(s ?? '').replace(SAFE, (ch) => {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return base && !SAFE_ONE.test(base) ? base : '';
  });
}

// Paleta de ofiza.es (modo claro: el papel siempre es claro).
const C = {
  ink: [11, 20, 17],          // --ofz-on-surface
  variant: [100, 107, 104],   // --ofz-on-surface-variant
  subtle: [126, 133, 130],
  outline: [222, 227, 225],   // --ofz-outline
  muted: [240, 243, 242],     // --ofz-surface-muted
  verde: [0, 96, 69],         // #006045
  oscuro: [13, 37, 30],       // #0d251e
  menta: [204, 255, 239],     // #ccffef
};

// jsPDF (≈420 KB) solo se carga la primera vez que se genera un PDF.
let jspdfReady = null;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jspdfReady) {
    jspdfReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => resolve(window.jspdf);
      s.onerror = () => { jspdfReady = null; reject(new Error('jspdf')); };
      document.head.appendChild(s);
    });
  }
  return jspdfReady;
}

export async function buildPdf(quote) {
  const { jsPDF } = await loadJsPdf();
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (const [file, [name, style]] of Object.entries(FONT_FILES)) {
    doc.addFileToVFS(file, fonts[file]);
    doc.addFont(file, name, style);
  }
  const kindLabel = quote.kind === 'proforma' ? t('kind.proforma') : t('kind.quote');
  doc.setProperties({
    title: `${kindLabel} ${quote.number}`,
    subject: kindLabel,
    author: safe(quote.issuer?.name || ''),
    creator: 'Presupuestos de Ofiza',
  });

  const W = 210, H = 297, M = 18, R = W - M;
  const FOOT = 282;
  const sum = totals(quote);
  const iss = quote.issuer || {};
  const cli = quote.client || {};

  const font = (family, style, size, color) => {
    doc.setFont(family, style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const text = (s, x, y, opts) => doc.text(safe(s), x, y, opts);
  const lines = (s, w) => doc.splitTextToSize(safe(s), w);
  const LH = (pt, k = 1.38) => pt * 0.3528 * k; // altura de línea en mm

  // ---------- Cabecera ----------
  let yL = M;
  if (iss.logo && iss.logo.data) {
    const maxW = 46, maxH = 20;
    const ratio = Math.min(maxW / iss.logo.w, maxH / iss.logo.h);
    const w = iss.logo.w * ratio, h = iss.logo.h * ratio;
    try {
      doc.addImage(iss.logo.data, iss.logo.data.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, yL, w, h);
      yL += h + 5;
    } catch { /* imagen ilegible: se omite */ }
  }
  font('Figtree', 'bold', 11.5, C.ink);
  for (const l of lines(iss.name || '', 88)) { yL += LH(11.5); text(l, M, yL); }
  font('Figtree', 'normal', 8.8, C.variant);
  const issLines = [];
  if (iss.nif) issLines.push(`${t('doc.nif')} ${iss.nif}`);
  if (iss.address) issLines.push(...String(iss.address).split('\n'));
  if (iss.email) issLines.push(iss.email);
  if (iss.phone) issLines.push(iss.phone);
  for (const raw of issLines) for (const l of lines(raw, 88)) { yL += LH(8.8, 1.45); text(l, M, yL); }

  let yR = M + 9;
  font('Mohave', 'normal', 32, C.oscuro);
  text(kindLabel, R, yR, { align: 'right' });
  yR += 8;
  const meta = [
    [t('doc.number'), quote.number],
    [t('doc.date'), date(quote.date)],
    [t('doc.validUntil'), date(addDaysISO(quote.date, quote.validDays))],
  ];
  for (const [k, v] of meta) {
    font('Figtree', 'normal', 8.8, C.variant);
    const vw = (doc.setFont('Figtree', 'bold'), doc.getTextWidth(safe(v)));
    font('Figtree', 'bold', 8.8, C.ink);
    text(v, R, yR, { align: 'right' });
    font('Figtree', 'normal', 8.8, C.variant);
    text(k, R - vw - 2.5, yR, { align: 'right' });
    yR += LH(8.8, 1.6);
  }

  // ---------- Cliente ----------
  let y = Math.max(yL, yR) + 9;
  const cliRows = [];
  if (cli.nif) cliRows.push(`${t('doc.nif')} ${cli.nif}`);
  if (cli.address) cliRows.push(...String(cli.address).split('\n'));
  if (cli.email) cliRows.push(cli.email);
  font('Figtree', 'bold', 11, C.ink);
  const cliName = lines(cli.name || '', 96);
  font('Figtree', 'normal', 8.8, C.variant);
  const cliLines = cliRows.flatMap((r) => lines(r, 96));
  const boxH = 7 + LH(8) + cliName.length * LH(11) + cliLines.length * LH(8.8, 1.45) + 3;
  doc.setFillColor(...C.muted);
  doc.roundedRect(M, y, 104, boxH, 2.5, 2.5, 'F');
  let yc = y + 6.5;
  font('Figtree', 'bold', 8, C.verde);
  text(t('doc.to'), M + 5, yc);
  font('Figtree', 'bold', 11, C.ink);
  for (const l of cliName) { yc += LH(11); text(l, M + 5, yc); }
  font('Figtree', 'normal', 8.8, C.variant);
  for (const l of cliLines) { yc += LH(8.8, 1.45); text(l, M + 5, yc); }
  y += boxH + 10;

  // ---------- Tabla de conceptos ----------
  const col = { desc: M, qty: 126, price: 150, disc: 166, amount: R };
  const descW = 88;
  const tableHead = () => {
    font('Figtree', 'bold', 8, C.verde);
    text(t('f.desc'), col.desc, y);
    text(t('f.qty'), col.qty, y, { align: 'right' });
    text(t('f.price'), col.price, y, { align: 'right' });
    text(t('f.disc'), col.disc, y, { align: 'right' });
    text(t('f.amount'), col.amount, y, { align: 'right' });
    y += 2.6;
    doc.setDrawColor(...C.verde); doc.setLineWidth(0.35); doc.line(M, y, R, y);
    y += 5.6;
  };
  const newPage = () => {
    doc.addPage();
    y = M + 4;
  };
  tableHead();
  const rows = (quote.lines || []).filter((l) => String(l.desc || '').trim() || parseNum(l.price));
  for (const l of rows) {
    font('Figtree', 'normal', 9.5, C.ink);
    const d = lines(l.desc || '', descW);
    const h = d.length * LH(9.5, 1.35);
    if (y + h > FOOT - 8) { newPage(); tableHead(); }
    font('Figtree', 'normal', 9.5, C.ink);
    d.forEach((s, i) => text(s, col.desc, y + i * LH(9.5, 1.35)));
    font('Figtree', 'normal', 9.5, C.variant);
    text(num(parseNum(l.qty)), col.qty, y, { align: 'right' });
    text(money(parseNum(l.price)), col.price, y, { align: 'right' });
    const disc = parseNum(l.disc);
    text(disc ? `${num(disc)} %` : '', col.disc, y, { align: 'right' });
    font('Figtree', 'bold', 9.5, C.ink);
    text(money(lineAmount(l)), col.amount, y, { align: 'right' });
    y += h - LH(9.5, 1.35) + 3.2;
    doc.setDrawColor(...C.outline); doc.setLineWidth(0.2); doc.line(M, y, R, y);
    y += 5.4;
  }

  // ---------- Totales ----------
  const tRows = [[t('t.base'), money(sum.base)], [t('t.vat', { r: num(sum.vatRate) }), money(sum.vat)]];
  if (quote.irpfOn) tRows.push([t('t.irpf', { r: num(sum.irpfRate) }), money(-sum.irpf)]);
  const totH = tRows.length * 6 + 16;
  if (y + totH > FOOT - 4) { newPage(); }
  const tx = R - 84;
  y += 1;
  for (const [k, v] of tRows) {
    font('Figtree', 'normal', 9.5, C.variant); text(k, tx + 4, y);
    font('Figtree', 'normal', 9.5, C.ink); text(v, R - 4, y, { align: 'right' });
    y += 6;
  }
  y -= 1;
  doc.setFillColor(...C.oscuro);
  doc.roundedRect(tx, y, 84, 13, 2.5, 2.5, 'F');
  font('Figtree', 'bold', 10, C.menta); text(t('t.total'), tx + 4, y + 8.3);
  font('Figtree', 'bold', 15, C.menta); text(money(sum.total), R - 4, y + 8.8, { align: 'right' });
  y += 13 + 11;

  // ---------- Notas y condiciones ----------
  const block = (label, body) => {
    if (!String(body || '').trim()) return;
    font('Figtree', 'normal', 9, C.variant);
    const ls = lines(body, W - 2 * M);
    if (y + 6 > FOOT - 4) newPage();
    font('Figtree', 'bold', 8, C.verde); text(label, M, y); y += LH(9, 1.6);
    font('Figtree', 'normal', 9, C.variant);
    for (const l of ls) {
      if (y > FOOT - 6) newPage();
      text(l, M, y); y += LH(9, 1.45);
    }
    y += 5;
  };
  block(t('doc.notes'), quote.notes);
  block(t('doc.terms'), quote.terms);

  // ---------- Pie en todas las páginas ----------
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.outline); doc.setLineWidth(0.2); doc.line(M, FOOT + 2, R, FOOT + 2);
    font('Figtree', 'normal', 7.5, C.subtle);
    text(`${kindLabel} ${quote.number}`, M, FOOT + 7);
    text(t('doc.madeWith'), W / 2, FOOT + 7, { align: 'center' });
    text(t('doc.page', { p, n }), R, FOOT + 7, { align: 'right' });
  }
  void H;
  return doc.output('blob');
}

export function pdfFileName(quote) {
  const kind = quote.kind === 'proforma' ? t('kind.proforma') : t('kind.quote');
  const who = (quote.client?.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${kind}-${quote.number}${who ? '-' + who : ''}.pdf`.replace(/\s+/g, '-');
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
