// Filas de la tabla de ingredientes, compartidas por la ficha, la calculadora y el PDF.
import { fmtG, fmtPct } from './calc.js';
import { t } from './i18n.js';

export function ingredientRows(r, c, lang) {
  const g = c.g, rows = [];
  const row = (label, grams, pct, kind = 'row') => rows.push({ kind, label, value: grams, g: fmtG(grams, lang), pct: pct == null ? '' : fmtPct(pct, lang) });
  const yeastLabel = t('leaven.' + r.leaven);
  if (c.hasPref) {
    rows.push({ kind: 'group', label: t('pref.' + r.pref) });
    row(t('ing.flour'), g.prefFlour, c.prefFlourPct);
    row(t('ing.water'), g.prefWater, c.prefWaterPct);
    row(yeastLabel, g.prefYeast, c.prefYeastPct);
    rows.push({ kind: 'group', label: t('ing.final') });
    row(t('ing.flour'), g.mainFlour, 100 - c.prefFlourPct);
    row(t('ing.water'), g.mainWater, c.mainWaterPct);
    if (g.mainYeast > 0) row(yeastLabel, g.mainYeast, c.mainYeastPct);
  } else {
    row(t('ing.flour'), g.flour, 100);
    row(t('ing.water'), g.water, c.pct.water);
    if (g.mainYeast > 0) row(yeastLabel, g.mainYeast, c.mainYeastPct);
  }
  row(t('ing.salt'), g.salt, c.pct.salt);
  if (g.oil > 0) row(t('ing.oil'), g.oil, c.pct.oil);
  if (g.sugar > 0) row(t('ing.sugar'), g.sugar, c.pct.sugar);
  row(t('ing.total'), c.total, c.sumPct, 'total');
  return rows;
}
