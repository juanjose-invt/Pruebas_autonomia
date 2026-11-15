// Matemática de panadero. Todo sale de porcentajes sobre la harina total (= 100 %).
// Sin dependencias del DOM: se puede probar con Node.

export const LEAVENS = ['fresh', 'dry', 'instant', 'powder', 'none'];
// Equivalencia orientativa entre levaduras de panadería (fresca = 1).
export const YEAST_FACTOR = { fresh: 1, dry: 0.4, instant: 0.33 };

// Rangos habituales del oficio; fuera de ellos la calculadora avisa, no bloquea.
export const RANGES = {
  hydration: { round: [55, 72], pan: [65, 85], rolled: [45, 62] },
  salt: [1.8, 3.2],
  oil: [0, 10],
  sugar: [0, 3],
  yeast: { fresh: [0.03, 3], dry: [0.02, 1.2], instant: [0.01, 1], powder: [2, 6] },
  prefFlour: [10, 100],
  prefHyd: { biga: [40, 55], poolish: [90, 110] },
  prefYeast: { fresh: [0.05, 1.5], dry: [0.02, 0.6], instant: [0.02, 0.5] },
};

export function convertYeast(pct, from, to) {
  if (!(from in YEAST_FACTOR) || !(to in YEAST_FACTOR)) return pct;
  return (pct / YEAST_FACTOR[from]) * YEAST_FACTOR[to];
}

// Redondeo de cocina: gramos enteros para lo grande, décimas o centésimas para lo pequeño.
export function roundG(g) {
  if (g >= 30) return Math.round(g);
  if (g >= 1) return Math.round(g * 10) / 10;
  return Math.round(g * 100) / 100;
}

export function fmtG(g, lang = 'es') {
  const dec = g >= 30 || Number.isInteger(g) ? 0 : g >= 1 ? 1 : 2;
  return g.toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false }) + ' g';
}

export function fmtPct(p, lang = 'es') {
  const dec = p >= 10 ? (Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1) : p >= 1 ? (Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1) : 2;
  const s = p.toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 0, maximumFractionDigits: Math.max(dec, p < 1 ? 2 : 1) });
  return lang === 'en' ? s + '%' : s + ' %';
}

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// Devuelve cantidades exactas y redondeadas. La tabla que se muestra suma exactamente `total`.
export function compute(r) {
  const pizzas = Math.max(1, Math.round(num(r.pizzas, 1)));
  const ball = Math.max(1, num(r.ball, 250));
  const target = pizzas * ball;
  const hasYeast = r.leaven !== 'none';
  const hasPref = r.pref && r.pref !== 'none' && r.leaven !== 'powder' && hasYeast;
  const prefFlourPct = hasPref ? Math.min(100, Math.max(0, num(r.prefFlour))) : 0;
  const prefHyd = hasPref ? num(r.prefHyd) : 0;
  const hydration = num(r.hydration);
  const prefWaterPct = (prefFlourPct * prefHyd) / 100;
  const prefYeastPct = hasPref ? (prefFlourPct * num(r.prefYeast)) / 100 : 0; // sobre harina total
  const mainYeastPct = hasYeast ? num(r.yeast) : 0;
  const pct = {
    flour: 100,
    water: hydration,
    salt: num(r.salt),
    oil: num(r.oil),
    sugar: num(r.sugar),
    yeast: mainYeastPct + prefYeastPct,
  };
  const sumPct = pct.flour + pct.water + pct.salt + pct.oil + pct.sugar + pct.yeast;
  const flourExact = target / (sumPct / 100);
  const exact = {};
  for (const k of Object.keys(pct)) exact[k] = (flourExact * pct[k]) / 100;

  // Redondeo por partes, de modo que prefermento + masa final = totales mostrados.
  const flour = roundG(flourExact);
  const water = roundG(exact.water);
  const prefFlour = hasPref ? roundG((flourExact * prefFlourPct) / 100) : 0;
  const prefWater = hasPref ? Math.min(water, roundG((flourExact * prefWaterPct) / 100)) : 0;
  const prefYeast = hasPref ? roundG((flourExact * prefYeastPct) / 100) : 0;
  const mainYeast = mainYeastPct > 0 ? roundG((flourExact * mainYeastPct) / 100) : 0;
  const salt = roundG(exact.salt);
  const oil = pct.oil > 0 ? roundG(exact.oil) : 0;
  const sugar = pct.sugar > 0 ? roundG(exact.sugar) : 0;
  const fix = (n) => Math.round(n * 100) / 100;
  const g = {
    flour, water, salt, oil, sugar,
    yeast: fix(prefYeast + mainYeast),
    prefFlour, prefWater, prefYeast,
    prefTotal: fix(prefFlour + prefWater + prefYeast),
    mainFlour: fix(flour - prefFlour),
    mainWater: fix(water - prefWater),
    mainYeast,
  };
  const total = fix(g.flour + g.water + g.salt + g.oil + g.sugar + g.yeast);
  return {
    pizzas, ball, target, total, sumPct, pct, exact, g, hasPref, hasYeast,
    prefFlourPct, prefWaterPct, prefYeastPct, mainYeastPct,
    mainWaterPct: hydration - prefWaterPct,
    perBall: total / pizzas,
  };
}

// Avisos de rango: devuelve claves de i18n con sus datos.
export function warnings(r) {
  const out = [];
  const shapeKind = r.shape === 'pan-rect' || r.shape === 'pan-round' ? 'pan' : r.shape === 'rolled' ? 'rolled' : 'round';
  const chk = (key, v, range) => {
    if (v < range[0] || v > range[1]) out.push({ key, lo: range[0], hi: range[1] });
  };
  chk('hydration', num(r.hydration), RANGES.hydration[shapeKind]);
  chk('salt', num(r.salt), RANGES.salt);
  chk('oil', num(r.oil), RANGES.oil);
  chk('sugar', num(r.sugar), RANGES.sugar);
  if (r.leaven !== 'none') {
    const hasPref = r.pref && r.pref !== 'none' && r.leaven !== 'powder';
    if (!hasPref || num(r.yeast) > 0) {
      const range = RANGES.yeast[r.leaven];
      if (range) chk('yeast', num(r.yeast), range);
    }
    if (hasPref) {
      chk('prefFlour', num(r.prefFlour), RANGES.prefFlour);
      chk('prefHyd', num(r.prefHyd), RANGES.prefHyd[r.pref]);
      const py = RANGES.prefYeast[r.leaven];
      if (py) chk('prefYeast', num(r.prefYeast), py);
      const c = compute(r);
      if (c.mainWaterPct < 0) out.push({ key: 'prefWater' });
    }
  }
  return out;
}

export function fmtDuration(min, lang = 'es') {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 48 && m === 0 && h % 24 === 0) return lang === 'en' ? `${h / 24} days` : `${h / 24} días`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
