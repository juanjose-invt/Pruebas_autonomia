// Gráficos en HTML y SVG, sin librerías.

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Barras por categoría con marca de presupuesto. Escala común para comparar longitudes.
export function categoryBars(rows, { fmt, t }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budget)));
  return `<ul class="bars">${rows.map((r) => {
    const w = (r.spent / max) * 100;
    const tick = r.budget > 0 ? (r.budget / max) * 100 : null;
    const over = r.budget > 0 && r.spent > r.budget;
    const detail = r.budget > 0 ? `${t('charts.of')} ${fmt(r.budget)}` : t('charts.nobudget');
    return `<li class="bar-row${over ? ' over' : ''}">
      <span class="bar-name">${escapeHtml(r.name)}</span>
      <span class="bar-val"><b>${fmt(r.spent)}</b> <span>${detail}</span></span>
      <span class="bar-track" aria-hidden="true">
        <span class="bar-fill" style="width:${w.toFixed(2)}%;background:${r.color}"></span>
        ${tick === null ? '' : `<span class="bar-tick" style="left:${tick.toFixed(2)}%"></span>`}
      </span>
    </li>`;
  }).join('')}</ul>`;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 3, 4, 5, 7.5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

// Gasto acumulado del mes, con la línea del presupuesto total.
export function dailyLine({ days, cum, lastDay, budget, width, fmt, labelBudget }) {
  const W = Math.max(280, Math.round(width)), H = 210;
  const L = 8, R = 8, T = 26, B = 28;
  const top = niceMax(Math.max(cum[lastDay - 1] || 0, budget) / 100) * 100;
  const x = (d) => L + ((d - 1) / Math.max(1, days - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  let path = '';
  for (let d = 1; d <= lastDay; d++) path += `${d === 1 ? 'M' : 'L'}${x(d).toFixed(1)} ${y(cum[d - 1]).toFixed(1)}`;
  const area = `${path}L${x(lastDay).toFixed(1)} ${y(0)}L${x(1)} ${y(0)}Z`;
  const ticks = [1, 8, 15, 22, days].filter((d, i, a) => a.indexOf(d) === i);
  const end = cum[lastDay - 1] || 0;
  const ex = x(lastDay), ey = y(end);
  const anchor = ex > W - 90 ? 'end' : 'start';
  const lx = anchor === 'end' ? ex - 8 : ex + 8;
  const overBudget = budget > 0 && end > budget;
  return `<svg class="line" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeHtml(fmt(end))}">
    <line class="ax" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
    ${budget > 0 ? `<line class="budget" x1="${L}" x2="${W - R}" y1="${y(budget).toFixed(1)}" y2="${y(budget).toFixed(1)}"/>
    <text class="budget-t" x="${L}" y="${(y(budget) - 6).toFixed(1)}">${escapeHtml(labelBudget)} ${escapeHtml(fmt(budget))}</text>` : ''}
    <path class="area" d="${area}"/>
    <path class="stroke${overBudget ? ' over' : ''}" d="${path}"/>
    <circle class="dot${overBudget ? ' over' : ''}" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5"/>
    <text class="end-t" x="${lx.toFixed(1)}" y="${(ey - 9).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(fmt(end))}</text>
    ${ticks.map((d) => `<text class="tick" x="${x(d).toFixed(1)}" y="${H - 8}" text-anchor="${d === 1 ? 'start' : d === days ? 'end' : 'middle'}">${d}</text>`).join('')}
  </svg>`;
}

// Ingresos y gastos de los últimos meses, en barras emparejadas.
export function monthBars({ months, width, fmtShort, labels }) {
  const W = Math.max(280, Math.round(width)), H = 220;
  const L = 4, R = 4, T = 40, B = 30;
  const top = niceMax(Math.max(1, ...months.map((m) => Math.max(m.income, m.expense))) / 100) * 100;
  const slot = (W - L - R) / months.length;
  const bw = Math.min(30, slot * 0.3);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const base = y(0);
  const small = slot < 70;
  return `<svg class="months" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeHtml(labels.title)}">
    <g class="legend"><rect class="inc" x="${L}" y="6" width="12" height="12" rx="2"/><text x="${L + 18}" y="16">${escapeHtml(labels.income)}</text>
    <rect class="exp" x="${L + 110}" y="6" width="12" height="12" rx="2"/><text x="${L + 128}" y="16">${escapeHtml(labels.expense)}</text></g>
    <line class="ax" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>
    ${months.map((m, i) => {
      const cx = L + slot * (i + 0.5);
      const hi = Math.max(0, base - y(m.income)), he = Math.max(0, base - y(m.expense));
      return `<g class="${m.current ? 'cur' : ''}">
        <rect class="inc" x="${(cx - bw - 1.5).toFixed(1)}" y="${(base - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="3"><title>${escapeHtml(labels.income)}: ${escapeHtml(m.incomeFull)}</title></rect>
        <rect class="exp" x="${(cx + 1.5).toFixed(1)}" y="${(base - he).toFixed(1)}" width="${bw.toFixed(1)}" height="${he.toFixed(1)}" rx="3"><title>${escapeHtml(labels.expense)}: ${escapeHtml(m.expenseFull)}</title></rect>
        ${small ? '' : `<text class="val" x="${cx.toFixed(1)}" y="${(Math.min(base - hi, base - he) - 6).toFixed(1)}" text-anchor="middle">${escapeHtml(fmtShort(m.income - m.expense, true))}</text>`}
        <text class="tick" x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle">${escapeHtml(m.label)}</text>
      </g>`;
    }).join('')}
  </svg>`;
}

export { escapeHtml };
