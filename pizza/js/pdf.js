// Exportación a PDF con jsPDF (vendorizado, se carga solo al exportar).
// Texto vectorial: Abril Fatface incrustada para los rótulos y Helvetica estándar para el cuerpo.
import { compute, fmtG, fmtPct, fmtDuration } from './calc.js';
import { buildSteps, totalMinutes, loc } from './steps.js';
import { t, getLang } from './i18n.js';
import { ingredientRows } from './tables.js';

let libPromise = null;
function loadLib() {
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF')));
      s.onerror = () => { libPromise = null; reject(new Error('jsPDF')); };
      document.head.append(s);
    });
  }
  return libPromise;
}

let fontB64 = null;
async function loadFont() {
  if (fontB64) return fontB64;
  const buf = new Uint8Array(await (await fetch('fonts/abril-fatface-400.ttf')).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  fontB64 = btoa(bin);
  return fontB64;
}

const TOMATO = [197, 48, 30], BASIL = [47, 107, 58], INK = [28, 43, 32], CREAM = [251, 246, 234], MUTE = [92, 104, 94];

export async function buildPdf(r, overrides = {}) {
  const lang = getLang();
  const [JsPDF, font] = await Promise.all([loadLib(), loadFont()]);
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('abril.ttf', font);
  doc.addFont('abril.ttf', 'Abril', 'normal');
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const mx = 18, cw = W - mx * 2;
  const c = compute(r);
  const steps = buildSteps(r, lang, overrides);
  const name = loc(r.name, lang);
  doc.setProperties({ title: name, subject: t('pdf.subject'), creator: 'Impasto' });

  let y = 0;
  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTE);
    doc.text(t('pdf.footer'), mx, H - 13);
    doc.text('Impasto, by innovativecode', mx, H - 8.5);
  };
  const need = (hh) => { if (y + hh > H - 22) { footer(); doc.addPage(); y = 20; } };
  const heading = (text) => {
    need(16); y += 4;
    doc.setFont('Abril', 'normal'); doc.setFontSize(15); doc.setTextColor(...BASIL);
    doc.text(text, mx, y); y += 2.5;
    doc.setDrawColor(...BASIL); doc.setLineWidth(0.4); doc.line(mx, y, W - mx, y); y += 6;
  };
  const para = (text, size = 10, color = INK, lh = 4.8, x = mx, width = cw) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(text, width)) { need(lh); doc.text(line, x, y); y += lh; }
  };

  // Rótulo
  doc.setFont('Abril', 'normal'); doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(name, cw);
  const bandH = 33 + titleLines.length * 10.5;
  doc.setFillColor(...TOMATO); doc.rect(0, 0, W, bandH, 'F');
  doc.setTextColor(...CREAM); doc.setFontSize(11);
  doc.text('Impasto', mx, 13);
  doc.setFontSize(26);
  doc.text(titleLines, mx, 27, { lineHeightFactor: 1.05 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${t('style.' + r.style)}, ${t('method.' + r.method).toLowerCase()}`, mx, bandH - 6);
  y = bandH + 9;
  if (loc(r.blurb, lang)) { para(loc(r.blurb, lang), 10.5, INK, 5.2); y += 2; }

  // Datos clave
  const facts = [
    [t('f.pieces'), `${c.pizzas} × ${fmtG(Math.round(c.total / c.pizzas), lang)}`],
    [t('f.hydration'), fmtPct(r.hydration, lang)],
    [t('f.total'), fmtDuration(totalMinutes(steps), lang)],
    [t('f.size'), loc(r.size, lang) || '-'],
  ];
  const fw = cw / facts.length;
  need(18);
  facts.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
    doc.text(k, mx + i * fw, y);
    doc.setFont('Abril', 'normal'); doc.setFontSize(13); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(v, fw - 3)[0], mx + i * fw, y + 6.5);
  });
  y += 13;

  // Ingredientes
  heading(t('ingredients'));
  const colG = mx + cw - 34, colP = mx + cw;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
  doc.text(t('col.grams'), colG, y, { align: 'right' }); doc.text(t('col.pct'), colP, y, { align: 'right' }); y += 5;
  for (const row of ingredientRows(r, c, lang)) {
    need(6.5);
    if (row.kind === 'group') {
      y += 1.5; doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TOMATO);
      doc.text(row.label, mx, y); y += 5.5; continue;
    }
    const bold = row.kind === 'total';
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
    doc.text(row.label, mx, y);
    doc.text(row.g, colG, y, { align: 'right' });
    if (row.pct) doc.text(row.pct, colP, y, { align: 'right' });
    doc.setDrawColor(215, 207, 188); doc.setLineWidth(0.15); doc.line(mx, y + 1.8, W - mx, y + 1.8);
    y += 6.2;
  }
  y += 1;
  if (loc(r.flour, lang)) para(`${t('flour')}: ${loc(r.flour, lang)}`, 9.5, MUTE, 4.6);

  // Horno
  heading(t('oven'));
  para(`${t('oven.temp')}: ${loc(r.bakeTemp, lang)}`);
  para(`${t('oven.time')}: ${loc(r.bakeTime, lang)}`);
  para(`${t('oven.surface')}: ${loc(r.surface, lang)}. ${t('oven.preheat', { n: r.preheat || 30 })}`);

  // Pasos
  heading(t('steps'));
  steps.forEach((s, i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const lines = doc.splitTextToSize(loc(s.text, lang), cw - 11);
    need(7 + Math.min(lines.length, 3) * 4.8);
    doc.setFont('Abril', 'normal'); doc.setFontSize(13); doc.setTextColor(...TOMATO);
    doc.text(String(i + 1), mx, y + 0.3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK);
    doc.text(loc(s.title, lang), mx + 11, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTE);
    doc.text(fmtDuration(s.minutes, lang), W - mx, y, { align: 'right' });
    y += 5;
    para(loc(s.text, lang), 10, INK, 4.8, mx + 11, cw - 11);
    y += 2.5;
  });

  if (loc(r.notes, lang)) { heading(t('notes')); para(loc(r.notes, lang)); }
  footer();
  return { doc, filename: `impasto-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'receta'}.pdf` };
}

export async function exportPdf(r, overrides) {
  const { doc, filename } = await buildPdf(r, overrides);
  doc.save(filename);
  return filename;
}
