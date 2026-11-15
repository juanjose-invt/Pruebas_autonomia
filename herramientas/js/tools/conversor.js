import { h, icon, tr, getLang, store, say, copy, fmtNum } from '../core.js';

const T = {
  es: {
    cat: { longitud: 'Longitud', peso: 'Peso', temperatura: 'Temperatura', volumen: 'Volumen', superficie: 'Superficie', velocidad: 'Velocidad', datos: 'Datos', tiempo: 'Tiempo', presion: 'Presión', energia: 'Energía' },
    categoria: 'Magnitud', valor: 'Valor', de: 'De', a: 'A', invertir: 'Invertir unidades', resultado: 'Resultado',
    copiar: 'Copiar resultado', copiado: 'Resultado copiado', noCopia: 'No se pudo copiar',
    todas: 'En todas las unidades', usar: 'Convertir a', vacio: 'Escribe un número', noNum: 'Eso no es un número',
    u: {
      mm: 'milímetros', cm: 'centímetros', m: 'metros', km: 'kilómetros', in: 'pulgadas', ft: 'pies', yd: 'yardas', mi: 'millas', nmi: 'millas náuticas',
      mg: 'miligramos', g: 'gramos', kg: 'kilogramos', t: 'toneladas', oz: 'onzas', lb: 'libras', st: 'stones',
      C: 'Celsius', F: 'Fahrenheit', K: 'kelvin',
      ml: 'mililitros', cl: 'centilitros', l: 'litros', m3: 'metros cúbicos', tsp: 'cucharaditas', tbsp: 'cucharadas', cup: 'tazas (EE. UU.)', floz: 'onzas líquidas (EE. UU.)', pt: 'pintas (EE. UU.)', gal: 'galones (EE. UU.)', ptuk: 'pintas (R. U.)', galuk: 'galones (R. U.)',
      cm2: 'centímetros cuadrados', m2: 'metros cuadrados', ha: 'hectáreas', km2: 'kilómetros cuadrados', in2: 'pulgadas cuadradas', ft2: 'pies cuadrados', yd2: 'yardas cuadradas', ac: 'acres', mi2: 'millas cuadradas',
      ms: 'metros por segundo', kmh: 'kilómetros por hora', mph: 'millas por hora', kn: 'nudos', fts: 'pies por segundo',
      bit: 'bits', B: 'bytes', kB: 'kilobytes', MB: 'megabytes', GB: 'gigabytes', TB: 'terabytes', KiB: 'kibibytes', MiB: 'mebibytes', GiB: 'gibibytes', TiB: 'tebibytes',
      msec: 'milisegundos', s: 'segundos', min: 'minutos', h: 'horas', d: 'días', wk: 'semanas', yr: 'años',
      Pa: 'pascales', kPa: 'kilopascales', bar: 'bares', atm: 'atmósferas', psi: 'libras por pulgada²', mmHg: 'milímetros de mercurio',
      J: 'julios', kJ: 'kilojulios', cal: 'calorías', kcal: 'kilocalorías', Wh: 'vatios hora', kWh: 'kilovatios hora',
    },
  },
  en: {
    cat: { longitud: 'Length', peso: 'Weight', temperatura: 'Temperature', volumen: 'Volume', superficie: 'Area', velocidad: 'Speed', datos: 'Data', tiempo: 'Time', presion: 'Pressure', energia: 'Energy' },
    categoria: 'Quantity', valor: 'Value', de: 'From', a: 'To', invertir: 'Swap units', resultado: 'Result',
    copiar: 'Copy result', copiado: 'Result copied', noCopia: 'Could not copy',
    todas: 'In every unit', usar: 'Convert to', vacio: 'Type a number', noNum: 'That is not a number',
    u: {
      mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres', in: 'inches', ft: 'feet', yd: 'yards', mi: 'miles', nmi: 'nautical miles',
      mg: 'milligrams', g: 'grams', kg: 'kilograms', t: 'tonnes', oz: 'ounces', lb: 'pounds', st: 'stones',
      C: 'Celsius', F: 'Fahrenheit', K: 'kelvin',
      ml: 'millilitres', cl: 'centilitres', l: 'litres', m3: 'cubic metres', tsp: 'teaspoons', tbsp: 'tablespoons', cup: 'cups (US)', floz: 'fluid ounces (US)', pt: 'pints (US)', gal: 'gallons (US)', ptuk: 'pints (UK)', galuk: 'gallons (UK)',
      cm2: 'square centimetres', m2: 'square metres', ha: 'hectares', km2: 'square kilometres', in2: 'square inches', ft2: 'square feet', yd2: 'square yards', ac: 'acres', mi2: 'square miles',
      ms: 'metres per second', kmh: 'kilometres per hour', mph: 'miles per hour', kn: 'knots', fts: 'feet per second',
      bit: 'bits', B: 'bytes', kB: 'kilobytes', MB: 'megabytes', GB: 'gigabytes', TB: 'terabytes', KiB: 'kibibytes', MiB: 'mebibytes', GiB: 'gibibytes', TiB: 'tebibytes',
      msec: 'milliseconds', s: 'seconds', min: 'minutes', h: 'hours', d: 'days', wk: 'weeks', yr: 'years',
      Pa: 'pascals', kPa: 'kilopascals', bar: 'bar', atm: 'atmospheres', psi: 'pounds per square inch', mmHg: 'millimetres of mercury',
      J: 'joules', kJ: 'kilojoules', cal: 'calories', kcal: 'kilocalories', Wh: 'watt hours', kWh: 'kilowatt hours',
    },
  },
};

// [id, símbolo, factor a la unidad base]. Temperatura se trata aparte.
const CATS = {
  longitud: { base: 'm', de: 'km', a: 'mi', u: [['mm', 'mm', 0.001], ['cm', 'cm', 0.01], ['m', 'm', 1], ['km', 'km', 1000], ['in', 'in', 0.0254], ['ft', 'ft', 0.3048], ['yd', 'yd', 0.9144], ['mi', 'mi', 1609.344], ['nmi', 'nmi', 1852]] },
  peso: { de: 'kg', a: 'lb', u: [['mg', 'mg', 1e-6], ['g', 'g', 0.001], ['kg', 'kg', 1], ['t', 't', 1000], ['oz', 'oz', 0.028349523125], ['lb', 'lb', 0.45359237], ['st', 'st', 6.35029318]] },
  temperatura: { de: 'C', a: 'F', u: [['C', '°C'], ['F', '°F'], ['K', 'K']] },
  volumen: { de: 'l', a: 'gal', u: [['ml', 'ml', 0.001], ['cl', 'cl', 0.01], ['l', 'l', 1], ['m3', 'm³', 1000], ['tsp', 'tsp', 0.00492892159375], ['tbsp', 'tbsp', 0.01478676478125], ['floz', 'fl oz', 0.0295735295625], ['cup', 'cup', 0.2365882365], ['pt', 'pt', 0.473176473], ['gal', 'gal', 3.785411784], ['ptuk', 'pt UK', 0.56826125], ['galuk', 'gal UK', 4.54609]] },
  superficie: { de: 'm2', a: 'ft2', u: [['cm2', 'cm²', 1e-4], ['m2', 'm²', 1], ['ha', 'ha', 1e4], ['km2', 'km²', 1e6], ['in2', 'in²', 0.00064516], ['ft2', 'ft²', 0.09290304], ['yd2', 'yd²', 0.83612736], ['ac', 'ac', 4046.8564224], ['mi2', 'mi²', 2589988.110336]] },
  velocidad: { de: 'kmh', a: 'mph', u: [['ms', 'm/s', 1], ['kmh', 'km/h', 1 / 3.6], ['mph', 'mph', 0.44704], ['kn', 'kn', 1852 / 3600], ['fts', 'ft/s', 0.3048]] },
  datos: { de: 'GB', a: 'GiB', u: [['bit', 'bit', 0.125], ['B', 'B', 1], ['kB', 'kB', 1e3], ['MB', 'MB', 1e6], ['GB', 'GB', 1e9], ['TB', 'TB', 1e12], ['KiB', 'KiB', 1024], ['MiB', 'MiB', 1024 ** 2], ['GiB', 'GiB', 1024 ** 3], ['TiB', 'TiB', 1024 ** 4]] },
  tiempo: { de: 'h', a: 'min', u: [['msec', 'ms', 0.001], ['s', 's', 1], ['min', 'min', 60], ['h', 'h', 3600], ['d', 'd', 86400], ['wk', 'wk', 604800], ['yr', 'yr', 31557600]] },
  presion: { de: 'bar', a: 'psi', u: [['Pa', 'Pa', 1], ['kPa', 'kPa', 1000], ['bar', 'bar', 1e5], ['atm', 'atm', 101325], ['psi', 'psi', 6894.757293168], ['mmHg', 'mmHg', 133.322387415]] },
  energia: { de: 'kcal', a: 'kJ', u: [['J', 'J', 1], ['kJ', 'kJ', 1000], ['cal', 'cal', 4.184], ['kcal', 'kcal', 4184], ['Wh', 'Wh', 3600], ['kWh', 'kWh', 3.6e6]] },
};

const aKelvin = { C: (v) => v + 273.15, F: (v) => (v - 32) * 5 / 9 + 273.15, K: (v) => v };
const deKelvin = { C: (k) => k - 273.15, F: (k) => (k - 273.15) * 9 / 5 + 32, K: (k) => k };

export function convertir(cat, valor, de, a) {
  if (cat === 'temperatura') return deKelvin[a](aKelvin[de](valor));
  const u = CATS[cat].u;
  const f = (id) => u.find((x) => x[0] === id)[2];
  return valor * f(de) / f(a);
}

/** Acepta coma o punto decimal y separadores de miles con espacio. */
export function leerNumero(txt) {
  let s = String(txt).trim().replace(/[\s ']/g, '').replace(/−/g, '-');
  if (s === '') return null;
  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    const dec = Math.max(coma, punto);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  } else s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

function formato(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    const [m, e] = n.toExponential(5).split('e');
    return `${fmtNum(Number(m), { maximumFractionDigits: 5 })} × 10${superindice(Number(e))}`;
  }
  // Redondea a 10 cifras significativas para ocultar el ruido de coma flotante.
  return fmtNum(Number(n.toPrecision(10)), { maximumSignificantDigits: 10 });
}
const superindice = (e) => String(e).replace(/./g, (c) => ({ '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }[c]));

export function mount(raiz) {
  const t = tr(T);
  const st = Object.assign({ cat: 'longitud', txt: '1', pares: {} }, store.get('conversor', {}));
  if (!CATS[st.cat]) st.cat = 'longitud';
  const par = () => (st.pares[st.cat] ||= { de: CATS[st.cat].de, a: CATS[st.cat].a });
  const guardar = () => store.set('conversor', st);

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t.categoria },
    Object.keys(CATS).map((c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === st.cat), dataset: { cat: c },
      onclick: () => { st.cat = c; for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.cat === c)); llenar(); pintar(); guardar(); } }, t.cat[c])));

  const entrada = h('input', { class: 'conv__num', id: 'conv-valor', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done', value: st.txt, 'aria-describedby': 'conv-error',
    oninput: () => { st.txt = entrada.value; pintar(); guardar(); }, onfocus: () => entrada.select() });
  const selDe = h('select', { class: 'sel', id: 'conv-de', 'aria-label': t.de, onchange: () => { par().de = selDe.value; pintar(); guardar(); } });
  const selA = h('select', { class: 'sel', id: 'conv-a', 'aria-label': t.a, onchange: () => { par().a = selA.value; pintar(); guardar(); } });
  const salida = h('output', { class: 'conv__res', id: 'conv-resultado', for: 'conv-valor conv-de conv-a' });
  const error = h('p', { class: 'conv__error', id: 'conv-error' });
  const lista = h('ul', { class: 'conv__lista' });
  let ultimo = '';

  const invertir = h('button', { type: 'button', class: 'btn btn--acero conv__inv', 'aria-label': t.invertir, title: t.invertir,
    onclick: () => { const p = par(); [p.de, p.a] = [p.a, p.de]; selDe.value = p.de; selA.value = p.a; pintar(); guardar(); } }, icon('cambiar', 24));
  const btnCopiar = h('button', { type: 'button', class: 'btn btn--rojo', onclick: async () => { say(await copy(ultimo) ? t.copiado : t.noCopia); } }, icon('copiar', 20), t.copiar);

  function llenar() {
    const ops = () => CATS[st.cat].u.map(([id, sim]) => h('option', { value: id }, `${t.u[id]} (${sim})`));
    selDe.replaceChildren(...ops());
    selA.replaceChildren(...ops());
    const p = par();
    selDe.value = p.de; selA.value = p.a;
  }

  function pintar() {
    const p = par();
    const n = leerNumero(st.txt);
    const valido = n !== null && Number.isFinite(n);
    error.textContent = n === null ? t.vacio : Number.isNaN(n) ? t.noNum : '';
    entrada.setAttribute('aria-invalid', String(Number.isNaN(n)));
    const sim = (id) => CATS[st.cat].u.find((x) => x[0] === id)[1];
    const r = valido ? convertir(st.cat, n, p.de, p.a) : NaN;
    ultimo = valido ? formato(r) : '';
    salida.replaceChildren(h('span', { class: 'conv__cifra' }, valido ? formato(r) : '—'), ' ', h('span', { class: 'conv__sim' }, sim(p.a)));
    btnCopiar.disabled = !valido;
    lista.replaceChildren(...CATS[st.cat].u.map(([id, s]) => h('li', null,
      h('button', { type: 'button', class: 'conv__fila', 'aria-pressed': String(id === p.a), 'aria-label': `${t.usar} ${t.u[id]}`,
        onclick: () => { p.a = id; selA.value = id; pintar(); guardar(); } },
        h('span', { class: 'conv__fn' }, t.u[id]),
        h('span', { class: 'conv__fv' }, valido ? formato(convertir(st.cat, n, p.de, id)) : '—', ' ', h('span', { class: 'conv__sim' }, s))))));
  }

  llenar();
  pintar();
  raiz.append(
    chips,
    h('div', { class: 'conv' },
      h('div', { class: 'conv__lado' },
        h('label', { class: 'rot', for: 'conv-valor' }, t.de),
        entrada, selDe, error),
      invertir,
      h('div', { class: 'conv__lado conv__lado--a' },
        h('span', { class: 'rot' }, t.a),
        salida, selA, btnCopiar)),
    h('h2', { class: 'sub' }, t.todas),
    lista,
  );
  void getLang;
}
