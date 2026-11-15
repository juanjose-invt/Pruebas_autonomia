// Lectura de CSV: codificación, separador, comillas y saltos de línea dentro de campos.

export class ImportError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

// Decide la codificación del archivo y devuelve el texto.
export function decodeBuffer(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes.length === 0) throw new ImportError('empty');

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 (BOM)' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16 LE' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16 BE' };
  }

  // Firmas de formatos binarios que la gente suele confundir con hojas de cálculo.
  const sig = String.fromCharCode(...bytes.subarray(0, 8));
  if (sig.startsWith('PK\u0003\u0004')) throw new ImportError('zipNotXlsx');
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) throw new ImportError('oldXls');
  if (sig.startsWith('%PDF')) throw new ImportError('binary');

  // UTF-16 sin BOM: muchos ceros en posiciones alternas.
  const probe = bytes.subarray(0, Math.min(bytes.length, 4096));
  let zeros = 0, zerosOdd = 0, ctrl = 0;
  for (let i = 0; i < probe.length; i++) {
    const b = probe[i];
    if (b === 0) { zeros++; if (i % 2 === 1) zerosOdd++; }
    else if (b < 9 || (b > 13 && b < 32 && b !== 27)) ctrl++;
  }
  if (zeros > probe.length * 0.3) {
    if (zerosOdd > zeros * 0.9) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16 LE' };
    if (zerosOdd < zeros * 0.1) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16 BE' };
  }
  if (zeros > 0 || ctrl > probe.length * 0.02) throw new ImportError('binary');

  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    // Excel en Windows suele guardar los CSV en Windows-1252 (Latin-1 ampliado).
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
  }
}

// Analizador con máquina de estados: respeta comillas dobles, "" escapadas y saltos dentro de campos.
export function parseCSV(text, delim, maxRows = Infinity) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  const n = text.length;
  const d = delim.charCodeAt(0);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (inQuotes) {
      if (c === 34) {
        if (text.charCodeAt(i + 1) === 34) { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += text[i];
      }
      continue;
    }
    if (c === 34 && !fieldStarted) { inQuotes = true; fieldStarted = true; continue; }
    if (c === d) { row.push(field); field = ''; fieldStarted = false; continue; }
    if (c === 10 || c === 13) {
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      row.push(field);
      rows.push(row);
      if (rows.length >= maxRows) return rows;
      row = []; field = ''; fieldStarted = false;
      continue;
    }
    field += text[i];
    if (c !== 32 && c !== 9) fieldStarted = true;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const CANDIDATES = [',', ';', '\t', '|'];

// Prueba cada separador sobre las primeras filas y elige el que da un número de columnas estable.
export function detectDelimiter(text) {
  const sample = text.slice(0, 200000);
  let best = { delim: ',', score: -1 };
  for (const delim of CANDIDATES) {
    const rows = parseCSV(sample, delim, 60).filter((r) => r.some((v) => v.trim() !== ''));
    if (rows.length > 1) rows.pop(); // la última puede estar cortada
    if (!rows.length) continue;
    const counts = new Map();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) || 0) + 1);
    let mode = 1, modeN = 0;
    for (const [k, v] of counts) if (v > modeN || (v === modeN && k > mode)) { mode = k; modeN = v; }
    if (mode < 2) continue;
    const consistency = modeN / rows.length;
    const score = consistency * 10 + Math.min(mode, 50) / 50;
    if (score > best.score) best = { delim, score };
  }
  return best.delim;
}

export function readCSVText(text) {
  const clean = text.replace(/^﻿/, '');
  if (!clean.trim()) throw new ImportError('empty');
  const delim = detectDelimiter(clean);
  let rows = parseCSV(clean, delim);
  // Quita filas totalmente vacías.
  rows = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!rows.length) throw new ImportError('empty');
  const width = Math.max(...rows.slice(0, 500).map((r) => r.length));
  if (width < 1) throw new ImportError('empty');
  return { rows, delimiter: delim };
}
