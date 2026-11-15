// Recetas de la casa. Cada una se define con porcentajes de panadero y un plan de tiempos;
// los gramos y los pasos se generan a partir de ahí (calc.js y steps.js).
// Las cifras son orientativas y están dentro de los rangos habituales del oficio:
// no proceden de ninguna norma ni de ningún autor concreto.

const FLOUR = {
  media: {
    es: 'Harina de trigo tipo 00 o panadera de fuerza media (12–13 % de proteína; si el saco indica W, entre 260 y 300).',
    en: 'Type 00 or bread flour of medium strength (12–13% protein; if the bag states W, between 260 and 300).',
  },
  fuerte: {
    es: 'Harina de fuerza (13–14 % de proteína; W 300–350 si el saco lo indica). Aguanta mejor las fermentaciones largas.',
    en: 'Strong bread flour (13–14% protein; W 300–350 if stated). It copes better with long fermentations.',
  },
  comun: {
    es: 'Harina de trigo común de repostería o de todo uso (9–11 % de proteína). No hace falta fuerza.',
    en: 'Plain or all-purpose wheat flour (9–11% protein). Strength is not needed.',
  },
};

const OVEN = {
  napo: {
    bakeTemp: { es: '430–480 °C en horno de pizza; en horno doméstico, al máximo (250–300 °C)', en: '430–480 °C in a pizza oven; in a home oven, as hot as it goes (250–300 °C)' },
    bakeTime: { es: '60–90 s en horno de pizza; 5–8 min en horno doméstico', en: '60–90 s in a pizza oven; 5–8 min in a home oven' },
    surface: { es: 'piedra o acero bien precalentados', en: 'a well-preheated stone or steel' },
    bakeMin: 8, preheat: 45,
  },
};

export const STYLES = ['napolitana', 'ny', 'bandeja', 'sarten', 'casera', 'fina'];
export const METHODS = ['directa', 'biga', 'poolish', 'fria', 'rapida', 'sin'];
export const SHAPES = ['round', 'pan-rect', 'pan-round', 'rolled'];

const base = {
  builtin: true, oil: 0, sugar: 0, yeast: 0, pref: 'none', prefFlour: 0, prefHyd: 0, prefYeast: 0, shape: 'round',
  plan: {},
};
const mk = (r) => ({ ...base, ...r, plan: { prefMin: 0, autolyse: 0, knead: 12, folds: 0, foldEvery: 20, bulk: 0, cold: 0, coldStage: 'balls', proof: 0, rest: 0, ...r.plan } });

export const BUILTIN = [
  mk({
    id: 'napolitana-directa',
    name: { es: 'Napolitana directa', en: 'Direct Neapolitan' },
    blurb: { es: 'La masa de referencia: harina, agua, sal y muy poca levadura. Se amasa por la mañana y se cena con ella.', en: 'The reference dough: flour, water, salt and very little yeast. Knead in the morning, eat it at dinner.' },
    style: 'napolitana', method: 'directa',
    pizzas: 4, ball: 260, hydration: 62, salt: 2.8, leaven: 'fresh', yeast: 0.15,
    size: { es: '28–32 cm', en: '28–32 cm' },
    flour: FLOUR.media, waterTemp: 'cool',
    plan: { knead: 15, bulk: 120, bulkRange: [90, 180], proof: 480, proofRange: [360, 600] },
    ...OVEN.napo,
    notes: {
      es: 'Con tan poca levadura, la temperatura manda: a 20–22 °C estos tiempos cuadran; si la cocina está a más de 25 °C, baja la levadura a la mitad o acorta el reposo de las bolas.',
      en: 'With this little yeast, temperature rules: these times fit at 20–22 °C; if the kitchen is above 25 °C, halve the yeast or shorten the proof.',
    },
  }),
  mk({
    id: 'napolitana-biga',
    name: { es: 'Napolitana con biga', en: 'Neapolitan with biga' },
    blurb: { es: 'Un prefermento seco hecho la víspera da un borde muy aireado y aroma a pan.', en: 'A stiff preferment made the day before gives a very airy rim and a bready aroma.' },
    style: 'napolitana', method: 'biga',
    pizzas: 4, ball: 270, hydration: 68, salt: 2.8, leaven: 'fresh', yeast: 0,
    pref: 'biga', prefFlour: 40, prefHyd: 45, prefYeast: 1,
    size: { es: '28–32 cm', en: '28–32 cm' },
    flour: FLOUR.fuerte, waterTemp: 'cool',
    plan: { prefMin: 960, prefRange: [840, 1200], prefTemp: { es: '16–18 °C (un lugar fresco de la casa)', en: '16–18 °C (a cool spot in the house)' }, knead: 15, bulk: 45, bulkRange: [30, 60], proof: 240, proofRange: [180, 300] },
    ...OVEN.napo,
    notes: {
      es: 'La biga no se amasa: se deja en grumos. Si tu casa pasa de 20 °C, tenla 2–3 h fuera y el resto en la parte menos fría de la nevera.',
      en: 'Biga is not kneaded: leave it in loose lumps. If your house is above 20 °C, keep it out for 2–3 h and the rest of the time in the least cold part of the fridge.',
    },
  }),
  mk({
    id: 'napolitana-poolish',
    name: { es: 'Napolitana con poolish', en: 'Neapolitan with poolish' },
    blurb: { es: 'Un prefermento líquido a partes iguales de harina y agua: masa extensible y borde ligero.', en: 'A liquid preferment of equal parts flour and water: an extensible dough and a light rim.' },
    style: 'napolitana', method: 'poolish',
    pizzas: 4, ball: 265, hydration: 67, salt: 2.8, leaven: 'fresh', yeast: 0.1,
    pref: 'poolish', prefFlour: 30, prefHyd: 100, prefYeast: 0.2,
    size: { es: '28–32 cm', en: '28–32 cm' },
    flour: FLOUR.media, waterTemp: 'cool',
    plan: { prefMin: 720, prefRange: [600, 900], prefTemp: { es: '18–20 °C', en: '18–20 °C' }, knead: 15, bulk: 60, bulkRange: [45, 90], proof: 240, proofRange: [180, 360] },
    ...OVEN.napo,
    notes: {
      es: 'El poolish está en su punto cuando la superficie, llena de burbujas, empieza a hundirse por el centro. Con calor llega antes: vigílalo a partir de las 9 h.',
      en: 'Poolish is ready when the bubbly surface starts to dip in the centre. In warm weather it gets there sooner: check it from 9 h on.',
    },
  }),
  mk({
    id: 'fria-48',
    name: { es: 'Larga en frío, 48 horas', en: 'Long cold ferment, 48 hours' },
    blurb: { es: 'Las bolas maduran dos días en la nevera. Más sabor, más digestible y sin prisas el día de la cena.', en: 'The dough balls mature for two days in the fridge. More flavour and no rush on the day.' },
    style: 'napolitana', method: 'fria',
    pizzas: 4, ball: 265, hydration: 65, salt: 2.8, leaven: 'fresh', yeast: 0.2,
    size: { es: '28–32 cm', en: '28–32 cm' },
    flour: FLOUR.fuerte, waterTemp: 'cool',
    plan: { autolyse: 30, knead: 12, bulk: 60, bulkRange: [45, 90], cold: 2880, coldRange: [1440, 4320], coldStage: 'balls', proof: 180, proofRange: [120, 240] },
    ...OVEN.napo,
    notes: {
      es: 'Entre 24 y 72 h de nevera funciona. Para 24 h sube la levadura hacia el 0,3 %; para 72 h bájala hacia el 0,1 %.',
      en: 'Anything from 24 to 72 h in the fridge works. For 24 h raise the yeast towards 0.3%; for 72 h lower it towards 0.1%.',
    },
  }),
  mk({
    id: 'nueva-york',
    name: { es: 'Tipo Nueva York', en: 'New York style' },
    blurb: { es: 'Grande, fina y flexible, con algo de aceite y azúcar para dorarse bien en un horno doméstico.', en: 'Large, thin and foldable, with a little oil and sugar so it browns well in a home oven.' },
    style: 'ny', method: 'fria',
    pizzas: 2, ball: 300, hydration: 63, salt: 2.5, oil: 2.5, sugar: 1.5, leaven: 'instant', yeast: 0.4,
    size: { es: '30–33 cm', en: '30–33 cm (12–13 in)' },
    flour: FLOUR.fuerte, waterTemp: 'cool',
    plan: { knead: 10, bulk: 30, bulkRange: [20, 60], cold: 2880, coldRange: [1440, 4320], coldStage: 'balls', proof: 90, proofRange: [60, 150] },
    bakeTemp: { es: '260–290 °C (el máximo de un horno doméstico)', en: '260–290 °C (as hot as a home oven goes)' },
    bakeTime: { es: '6–9 min', en: '6–9 min' },
    surface: { es: 'acero o piedra en la parte alta del horno', en: 'a steel or stone in the upper part of the oven' },
    bakeMin: 8, preheat: 60,
    notes: {
      es: 'Para una pizza de 35–36 cm usa bolas de unos 400 g. El queso habitual es mozzarella seca (de bloque), no fresca.',
      en: 'For a 14 in pizza use balls of about 400 g. The usual cheese is low-moisture mozzarella, not fresh.',
    },
  }),
  mk({
    id: 'romana-bandeja',
    name: { es: 'Romana en bandeja', en: 'Roman pan pizza' },
    blurb: { es: 'Muy hidratada, sin amasado: se trabaja con pliegues y fermenta un día en frío. Miga alveolada y base crujiente.', en: 'Very wet and never kneaded: built with folds and a day in the fridge. Open crumb, crisp base.' },
    style: 'bandeja', method: 'fria',
    pizzas: 1, ball: 650, hydration: 80, salt: 2.5, oil: 2.5, leaven: 'fresh', yeast: 0.6,
    shape: 'pan-rect',
    size: { es: 'bandeja de 30 × 40 cm', en: '30 × 40 cm tray' },
    flour: FLOUR.fuerte, waterTemp: 'cool',
    plan: { autolyse: 30, knead: 0, folds: 3, foldEvery: 20, bulk: 0, cold: 1440, coldRange: [1080, 2880], coldStage: 'bulk', proof: 150, proofRange: [120, 210] },
    bakeTemp: { es: '250 °C, calor arriba y abajo', en: '250 °C, top and bottom heat' },
    bakeTime: { es: '12–15 min en la base del horno y 5–8 min más a media altura con los ingredientes', en: '12–15 min on the oven floor, then 5–8 min more on the middle shelf with the toppings' },
    surface: { es: 'la bandeja, apoyada en la base del horno', en: 'the tray, set on the floor of the oven' },
    bakeMin: 20, preheat: 30,
    notes: {
      es: 'Regla práctica para otro molde: 0,5–0,6 g de masa por cm² de bandeja. Mójate las manos para manejarla; no añadas harina.',
      en: 'Rule of thumb for another tray: 0.5–0.6 g of dough per cm² of tray. Wet your hands to handle it; do not add flour.',
    },
  }),
  mk({
    id: 'sarten',
    name: { es: 'De sartén, gruesa y crujiente', en: 'Skillet pan pizza' },
    blurb: { es: 'Fermenta en la propia sartén de hierro y se fríe en su aceite: borde de queso tostado y miga esponjosa.', en: 'It proofs in the cast-iron skillet itself and fries in its oil: a toasted cheese edge and a fluffy crumb.' },
    style: 'sarten', method: 'rapida',
    pizzas: 1, ball: 420, hydration: 72, salt: 2.3, oil: 3, leaven: 'instant', yeast: 0.6,
    shape: 'pan-round',
    size: { es: 'sartén de hierro de 26 cm', en: '26 cm (10 in) cast-iron skillet' },
    flour: FLOUR.fuerte, waterTemp: 'warm',
    plan: { knead: 0, folds: 3, foldEvery: 20, bulk: 120, bulkRange: [90, 180], proof: 90, proofRange: [60, 120] },
    bakeTemp: { es: '250–260 °C', en: '250–260 °C' },
    bakeTime: { es: '12–16 min', en: '12–16 min' },
    surface: { es: 'la sartén, en la parte baja del horno', en: 'the skillet, on the lowest shelf' },
    bakeMin: 15, preheat: 30,
    notes: {
      es: 'Si la base queda pálida, termina 1–2 min con la sartén al fuego. El mango quema: usa siempre un paño.',
      en: 'If the base is pale, finish for 1–2 min with the skillet on the hob. The handle is hot: always use a cloth.',
    },
  }),
  mk({
    id: 'rapida',
    name: { es: 'Rápida para hoy', en: 'Quick same-day dough' },
    blurb: { es: 'De la harina a la mesa en unas tres horas. Más levadura y agua templada; menos aroma, pero cumple.', en: 'From flour to table in about three hours. More yeast and warm water; less aroma, but it delivers.' },
    style: 'casera', method: 'rapida',
    pizzas: 3, ball: 250, hydration: 60, salt: 2.5, oil: 2, leaven: 'fresh', yeast: 1.5,
    size: { es: '26–28 cm', en: '26–28 cm' },
    flour: FLOUR.media, waterTemp: 'warm',
    plan: { knead: 10, bulk: 75, bulkRange: [60, 90], proof: 75, proofRange: [60, 120] },
    bakeTemp: { es: '250 °C o el máximo del horno', en: '250 °C or as hot as the oven goes' },
    bakeTime: { es: '8–10 min', en: '8–10 min' },
    surface: { es: 'una bandeja precalentada, piedra o acero', en: 'a preheated tray, stone or steel' },
    bakeMin: 9, preheat: 30,
    notes: {
      es: 'Si solo tienes dos horas, sube la levadura fresca al 2 % y deja la masa en el sitio más templado de la cocina.',
      en: 'If you only have two hours, raise the fresh yeast to 2% and keep the dough in the warmest spot of the kitchen.',
    },
  }),
  mk({
    id: 'sin-impulsor',
    name: { es: 'Sin levadura, con impulsor', en: 'No yeast, with baking powder' },
    blurb: { es: 'Para cuando no hay levadura ni tiempo: sube en el horno gracias al polvo de hornear. Miga tierna, tipo pan plano.', en: 'For when there is no yeast and no time: it rises in the oven thanks to baking powder. A tender, flatbread-like crumb.' },
    style: 'casera', method: 'sin',
    pizzas: 2, ball: 230, hydration: 58, salt: 2, oil: 6, leaven: 'powder', yeast: 4,
    shape: 'rolled',
    size: { es: '24–26 cm', en: '24–26 cm' },
    flour: FLOUR.comun, waterTemp: 'cool',
    plan: { knead: 4, rest: 20, restRange: [15, 30] },
    bakeTemp: { es: '230–250 °C', en: '230–250 °C' },
    bakeTime: { es: '10–12 min', en: '10–12 min' },
    surface: { es: 'una bandeja precalentada', en: 'a preheated tray' },
    bakeMin: 11, preheat: 20,
    notes: {
      es: 'No fermenta: no esperes alveolos ni sabor a masa madurada. Amasa lo justo; si trabajas de más, el impulsor pierde fuerza y la masa se endurece.',
      en: 'It does not ferment: do not expect an open crumb or matured flavour. Knead just enough; overworking weakens the baking powder and toughens the dough.',
    },
  }),
  mk({
    id: 'sin-fina',
    name: { es: 'Sin levadura, fina y crujiente', en: 'No yeast, thin and crisp' },
    blurb: { es: 'Solo harina, agua, aceite y sal, estirada con rodillo hasta casi transparentar. Base de galleta.', en: 'Just flour, water, oil and salt, rolled until almost see-through. A cracker-like base.' },
    style: 'fina', method: 'sin',
    pizzas: 2, ball: 160, hydration: 50, salt: 2, oil: 8, leaven: 'none', yeast: 0,
    shape: 'rolled',
    size: { es: '26–28 cm, 2 mm de grosor', en: '26–28 cm, 2 mm thick' },
    flour: FLOUR.comun, waterTemp: 'cool',
    plan: { knead: 6, rest: 30, restRange: [20, 60] },
    bakeTemp: { es: '250 °C o el máximo del horno', en: '250 °C or as hot as the oven goes' },
    bakeTime: { es: '6–8 min', en: '6–8 min' },
    surface: { es: 'una bandeja precalentada o piedra', en: 'a preheated tray or stone' },
    bakeMin: 7, preheat: 20,
    notes: {
      es: 'El reposo no es fermentación: relaja el gluten para que el rodillo no la encoja. Pon poca salsa; con humedad deja de crujir.',
      en: 'The rest is not fermentation: it relaxes the gluten so the dough does not spring back under the pin. Go easy on the sauce; moisture kills the crunch.',
    },
  }),
];

// Receta en blanco para el configurador.
export function blankRecipe(lang) {
  return mk({
    id: '', builtin: false,
    name: lang === 'en' ? 'My dough' : 'Mi masa',
    blurb: '',
    style: 'casera', method: 'directa',
    pizzas: 4, ball: 250, hydration: 62, salt: 2.5, leaven: 'fresh', yeast: 0.3,
    size: '28 cm', flour: '', waterTemp: 'cool',
    plan: { knead: 12, bulk: 120, proof: 240 },
    bakeTemp: lang === 'en' ? '250 °C or as hot as the oven goes' : '250 °C o el máximo del horno',
    bakeTime: '6–9 min',
    surface: lang === 'en' ? 'a preheated stone, steel or tray' : 'piedra, acero o bandeja precalentados',
    bakeMin: 8, preheat: 40,
    notes: '',
  });
}
