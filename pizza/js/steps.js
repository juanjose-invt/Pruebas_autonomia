// Genera los pasos de una receta a partir de su método y su plan de tiempos.
// Cada paso lleva un `type` (qué escena 3D le corresponde), una duración en minutos y,
// si es una espera, un temporizador. Las cantidades se insertan ya calculadas.
import { compute, fmtG, fmtDuration } from './calc.js';

export const STEP_TYPES = ['mix', 'autolyse', 'knead', 'fold', 'ball', 'ferment', 'stretch', 'bake'];

const T = {
  es: {
    yeastName: { fresh: 'levadura fresca', dry: 'levadura seca activa', instant: 'levadura seca instantánea', powder: 'impulsor químico (polvo de hornear)' },
    prefName: { biga: 'biga', poolish: 'poolish' },
    prefThe: { biga: 'la biga', poolish: 'el poolish' },
    prefAll: { biga: 'toda la biga', poolish: 'todo el poolish' },
    water: { cool: 'agua fresca (18–20 °C)', warm: 'agua templada (28–30 °C)' },
    room: 'a temperatura ambiente (20–24 °C)',
    fridge: 'en la nevera (unos 4 °C)',
    prefmix: {
      title: (p) => `Preparar ${p.prefThe}`,
      biga: (p) => `Disuelve ${p.prefYeast} de ${p.yeastName} en ${p.prefWater} de agua fresca. Añade ${p.prefFlour} de harina y mezcla solo hasta que no quede harina seca. No amases: la biga se queda en grumos sueltos y ásperos.`,
      poolish: (p) => `Disuelve ${p.prefYeast} de ${p.yeastName} en ${p.prefWater} de agua fresca. Añade ${p.prefFlour} de harina y bate con una cuchara hasta tener una crema espesa sin grumos. Usa un tarro con el triple de volumen y marca el nivel.`,
    },
    prefferment: {
      title: (p) => `Fermentar ${p.prefThe}`,
      biga: (p) => `Tapa el recipiente y déjalo a ${p.prefTemp}. Estará lista cuando huela a yogur y a fruta madura y los grumos se hayan hinchado y pegado entre sí.`,
      poolish: (p) => `Tapa el tarro y déjalo a ${p.prefTemp}. Estará listo cuando haya doblado, la superficie esté cubierta de burbujas y empiece a hundirse por el centro.`,
    },
    mix: {
      title: 'Mezclar',
      direct: (p) => `En un bol amplio, disuelve ${p.mainYeast} de ${p.yeastName}${p.sugarBit} en ${p.mainWater} de ${p.waterName}. Añade ${p.mainFlour} de harina y mezcla con la mano en garra, girando el bol, hasta que no quede harina seca.`,
      pref: (p) => `Pon en un bol amplio ${p.mainWater} de ${p.waterName} y deshaz dentro ${p.prefAll}${p.mainYeastBit}${p.sugarBit}. Añade ${p.mainFlour} de harina y mezcla con la mano en garra hasta que no quede harina seca.`,
      auto: (p) => `En un bol amplio, mezcla solo ${p.mainFlour} de harina con ${p.mainWater} de ${p.waterName}, con la mano en garra, hasta que no quede harina seca. Todavía sin levadura ni sal.`,
      powder: (p) => `En un bol, mezcla en seco ${p.mainFlour} de harina con ${p.mainYeast} de ${p.yeastName} y ${p.salt} de sal. Añade ${p.mainWater} de ${p.waterName}${p.oilBit} y remueve hasta formar una masa basta.`,
      none: (p) => `En un bol, mezcla ${p.mainFlour} de harina con ${p.salt} de sal. Añade ${p.mainWater} de ${p.waterName}${p.oilBit} y remueve hasta formar una masa basta.`,
    },
    autolyse: {
      title: 'Autólisis',
      text: () => 'Tapa el bol y deja la mezcla en reposo. La harina absorbe el agua y el gluten empieza a formarse solo: después la masa se amasa en menos tiempo y se estira mejor.',
    },
    salt: {
      title: 'Añadir sal y terminar la mezcla',
      text: (p) => `Reparte por encima ${p.addBits}. Con la mano mojada, pellizca y dobla la masa dentro del bol durante un par de minutos hasta que todo quede integrado. Quedará pegajosa: es lo normal con tanta agua.`,
    },
    knead: {
      title: 'Amasar',
      text: (p) => `${p.addSentence}Amasa sobre la encimera sin harina: empuja la masa hacia delante con la base de la palma, recógela doblándola hacia ti y gírala un cuarto de vuelta. Sigue hasta que quede lisa, elástica y se despegue de la mesa.`,
      short: (p) => `Vuelca la masa en la encimera y amasa lo justo, ${p.kneadMin} min, hasta que quede uniforme: empuja con la base de la palma, dobla y gira. No busques elasticidad.`,
    },
    fold: {
      title: 'Pliegues',
      text: (p) => `Haz ${p.folds} tandas de pliegues, una cada ${p.foldEvery} min. En cada tanda, con la mano mojada: coge un borde de la masa, estíralo hacia arriba sin romperlo y dóblalo sobre el centro; gira el bol un cuarto y repite hasta dar la vuelta completa. Tapa entre tandas.`,
    },
    bulk: {
      title: 'Primera fermentación',
      text: (p) => `Tapa el bol y deja la masa en bloque ${p.room}. Debe hincharse y ablandarse, sin llegar a doblar.`,
    },
    coldBulk: {
      title: 'Fermentación en frío',
      text: (p) => `Pasa la masa a un recipiente con tapa ligeramente aceitado y guárdala ${p.fridge}. Crecerá despacio y ganará sabor.`,
    },
    ball: {
      title: 'Formar las bolas',
      text: (p) => `Divide la masa en ${p.pieces}. Para cada una: dobla los bordes hacia el centro, dale la vuelta y arrástrala en círculos sobre la encimera con las manos en cuenco, hasta que la superficie quede tensa y lisa y el cierre, abajo.`,
      one: () => 'Vuelca la masa en la encimera. Dobla los bordes hacia el centro, dale la vuelta y arrástrala en círculos con las manos en cuenco hasta que la superficie quede tensa y lisa.',
    },
    coldBalls: {
      title: 'Maduración en frío',
      text: (p) => `Coloca las bolas separadas en una bandeja con tapa o en recipientes ligeramente aceitados y guárdalas ${p.fridge}.`,
    },
    proof: {
      title: 'Fermentar las bolas',
      text: (p) => `Deja las bolas tapadas ${p.room}. Están listas cuando casi han doblado y, al hundir un dedo enharinado, la huella vuelve despacio.`,
      temper: (p) => `Saca las bolas de la nevera y déjalas tapadas ${p.room}. Están listas cuando han perdido el frío, se ven hinchadas y la huella de un dedo vuelve despacio.`,
    },
    stretch: {
      title: 'Estirar',
      round: (p) => `Enharina la bola por las dos caras. Presiona con las yemas desde el centro hacia fuera, sin pisar el último centímetro: el gas se desplaza al borde y forma la cornisa. Gira y sigue abriendo hasta ${p.size}. Nada de rodillo.`,
      ny: (p) => `Enharina la bola. Marca el borde con las yemas y aplana el centro; después levántala y estírala sobre los nudillos, girándola, hasta ${p.size}. El borde queda fino pero marcado.`,
      rolled: (p) => `Enharina la encimera y estira cada pieza con el rodillo, del centro hacia fuera y girándola, hasta ${p.size}. Si se encoge, déjala reposar 5 min y sigue.`,
    },
    pan: {
      title: 'Pasar al molde',
      text: (p) => `Unta el molde con aceite (${p.size}). Vuelca la masa con cuidado y extiéndela con las yemas, del centro hacia las esquinas, sin aplastar el gas. Si se encoge, espera 10 min y termina de llevarla a los bordes.`,
    },
    panProof: {
      title: 'Fermentar en el molde',
      text: (p) => `Tapa el molde y deja la masa ${p.room} hasta que esté hinchada, con burbujas visibles, y tiemble al mover el molde.`,
    },
    rest: {
      title: 'Reposo',
      text: () => 'Haz una bola, tápala con el bol boca abajo y déjala reposar. No fermenta: el gluten se relaja y luego se estira sin encogerse.',
    },
    bake: {
      title: 'Hornear',
      round: (p) => `Con el horno encendido al menos ${p.preheat} min antes: cubre la pizza y hornéala sobre ${p.surface}, a ${p.bakeTemp}, durante ${p.bakeTime}. Gírala a mitad de cocción. Está cuando el borde se ha hinchado y tiene manchas tostadas.`,
      pan: (p) => `Con el horno encendido al menos ${p.preheat} min antes: hornea en ${p.surface}, a ${p.bakeTemp}, durante ${p.bakeTime}. Está cuando la base se despega sola y suena crujiente al rascarla.`,
      rolled: (p) => `Con el horno encendido al menos ${p.preheat} min antes: pasa la base a ${p.surface}, cúbrela con pocos ingredientes y hornea a ${p.bakeTemp} durante ${p.bakeTime}, hasta que el borde esté dorado.`,
    },
    and: ' y ',
    pieces: (n, g) => (n === 1 ? `una pieza de ${g}` : `${n} piezas de ${g}`),
    saltOf: (g) => `${g} de sal`, oilOf: (g) => `${g} de aceite de oliva`, sugarOf: (g) => `${g} de azúcar`,
    yeastDissolved: (g, name) => `${g} de ${name} disuelta en una cucharada de agua`,
    addSentence: (list) => `Añade ${list} y mezcla hasta integrarlo. `,
    sugarBit: (g) => ` y ${g} de azúcar`,
    oilBit: (g) => ` y ${g} de aceite de oliva`,
    mainYeastBit: (g, name) => `, junto con ${g} de ${name}`,
  },
  en: {
    yeastName: { fresh: 'fresh yeast', dry: 'active dry yeast', instant: 'instant dry yeast', powder: 'baking powder' },
    prefName: { biga: 'biga', poolish: 'poolish' },
    prefThe: { biga: 'the biga', poolish: 'the poolish' },
    prefAll: { biga: 'all the biga', poolish: 'all the poolish' },
    water: { cool: 'cool water (18–20 °C)', warm: 'lukewarm water (28–30 °C)' },
    room: 'at room temperature (20–24 °C)',
    fridge: 'in the fridge (about 4 °C)',
    prefmix: {
      title: (p) => `Make ${p.prefThe}`,
      biga: (p) => `Dissolve ${p.prefYeast} of ${p.yeastName} in ${p.prefWater} of cool water. Add ${p.prefFlour} of flour and mix only until no dry flour is left. Do not knead: biga stays in loose, rough lumps.`,
      poolish: (p) => `Dissolve ${p.prefYeast} of ${p.yeastName} in ${p.prefWater} of cool water. Add ${p.prefFlour} of flour and beat with a spoon into a thick, lump-free batter. Use a jar three times the volume and mark the level.`,
    },
    prefferment: {
      title: (p) => `Ferment ${p.prefThe}`,
      biga: (p) => `Cover the container and leave it at ${p.prefTemp}. It is ready when it smells of yoghurt and ripe fruit and the lumps have swollen and stuck together.`,
      poolish: (p) => `Cover the jar and leave it at ${p.prefTemp}. It is ready when it has doubled, the surface is covered in bubbles and it starts to dip in the centre.`,
    },
    mix: {
      title: 'Mix',
      direct: (p) => `In a large bowl, dissolve ${p.mainYeast} of ${p.yeastName}${p.sugarBit} in ${p.mainWater} of ${p.waterName}. Add ${p.mainFlour} of flour and mix with a claw-shaped hand, turning the bowl, until no dry flour is left.`,
      pref: (p) => `Put ${p.mainWater} of ${p.waterName} in a large bowl and break up ${p.prefAll} in it${p.mainYeastBit}${p.sugarBit}. Add ${p.mainFlour} of flour and mix with a claw-shaped hand until no dry flour is left.`,
      auto: (p) => `In a large bowl, mix only ${p.mainFlour} of flour with ${p.mainWater} of ${p.waterName}, with a claw-shaped hand, until no dry flour is left. No yeast or salt yet.`,
      powder: (p) => `In a bowl, stir ${p.mainFlour} of flour with ${p.mainYeast} of ${p.yeastName} and ${p.salt} of salt. Add ${p.mainWater} of ${p.waterName}${p.oilBit} and stir into a rough dough.`,
      none: (p) => `In a bowl, stir ${p.mainFlour} of flour with ${p.salt} of salt. Add ${p.mainWater} of ${p.waterName}${p.oilBit} and stir into a rough dough.`,
    },
    autolyse: {
      title: 'Autolyse',
      text: () => 'Cover the bowl and let the mixture rest. The flour absorbs the water and gluten starts forming by itself: the dough will then need less kneading and stretch more easily.',
    },
    salt: {
      title: 'Add the salt and finish mixing',
      text: (p) => `Scatter ${p.addBits} over the dough. With a wet hand, pinch and fold the dough in the bowl for a couple of minutes until everything is worked in. It will be sticky: that is normal with this much water.`,
    },
    knead: {
      title: 'Knead',
      text: (p) => `${p.addSentence}Knead on the worktop without flour: push the dough away with the heel of your hand, fold it back towards you and give it a quarter turn. Keep going until it is smooth, elastic and comes away from the surface.`,
      short: (p) => `Tip the dough onto the worktop and knead just enough, ${p.kneadMin} min, until even: push with the heel of your hand, fold and turn. You are not after elasticity.`,
    },
    fold: {
      title: 'Folds',
      text: (p) => `Do ${p.folds} rounds of folds, one every ${p.foldEvery} min. In each round, with a wet hand: take one edge of the dough, stretch it upwards without tearing and fold it over the centre; give the bowl a quarter turn and repeat all the way round. Cover between rounds.`,
    },
    bulk: {
      title: 'Bulk fermentation',
      text: (p) => `Cover the bowl and leave the dough in one piece ${p.room}. It should puff up and soften, without quite doubling.`,
    },
    coldBulk: {
      title: 'Cold fermentation',
      text: (p) => `Move the dough to a lightly oiled lidded container and keep it ${p.fridge}. It will grow slowly and gain flavour.`,
    },
    ball: {
      title: 'Shape the dough balls',
      text: (p) => `Divide the dough into ${p.pieces}. For each one: fold the edges into the centre, turn it over and drag it in circles on the worktop with cupped hands, until the surface is tight and smooth and the seam is underneath.`,
      one: () => 'Tip the dough onto the worktop. Fold the edges into the centre, turn it over and drag it in circles with cupped hands until the surface is tight and smooth.',
    },
    coldBalls: {
      title: 'Cold maturation',
      text: (p) => `Set the balls apart in a lidded tray or lightly oiled containers and keep them ${p.fridge}.`,
    },
    proof: {
      title: 'Proof the dough balls',
      text: (p) => `Leave the balls covered ${p.room}. They are ready when they have almost doubled and a floured fingertip leaves a dent that springs back slowly.`,
      temper: (p) => `Take the balls out of the fridge and leave them covered ${p.room}. They are ready when they have lost the chill, look puffy and a fingertip dent springs back slowly.`,
    },
    stretch: {
      title: 'Stretch',
      round: (p) => `Flour the ball on both sides. Press with your fingertips from the centre outwards, staying off the last centimetre: the gas moves to the edge and forms the rim. Turn and keep opening it to ${p.size}. No rolling pin.`,
      ny: (p) => `Flour the ball. Mark the rim with your fingertips and flatten the centre; then lift it and stretch it over your knuckles, turning it, to ${p.size}. The rim stays thin but defined.`,
      rolled: (p) => `Flour the worktop and roll out each piece, from the centre outwards and turning it, to ${p.size}. If it springs back, let it rest for 5 min and carry on.`,
    },
    pan: {
      title: 'Move to the pan',
      text: (p) => `Oil the pan (${p.size}). Tip the dough in gently and spread it with your fingertips, from the centre to the corners, without knocking out the gas. If it springs back, wait 10 min and finish easing it to the edges.`,
    },
    panProof: {
      title: 'Proof in the pan',
      text: (p) => `Cover the pan and leave the dough ${p.room} until puffy, with visible bubbles, and it wobbles when you move the pan.`,
    },
    rest: {
      title: 'Rest',
      text: () => 'Shape into a ball, cover it with the upturned bowl and let it rest. It does not ferment: the gluten relaxes so it will roll out without springing back.',
    },
    bake: {
      title: 'Bake',
      round: (p) => `With the oven on for at least ${p.preheat} min beforehand: top the pizza and bake it on ${p.surface}, at ${p.bakeTemp}, for ${p.bakeTime}. Turn it halfway. It is done when the rim has puffed up and shows toasted spots.`,
      pan: (p) => `With the oven on for at least ${p.preheat} min beforehand: bake in ${p.surface}, at ${p.bakeTemp}, for ${p.bakeTime}. It is done when the base releases by itself and sounds crisp when scraped.`,
      rolled: (p) => `With the oven on for at least ${p.preheat} min beforehand: move the base to ${p.surface}, top it sparingly and bake at ${p.bakeTemp} for ${p.bakeTime}, until the edge is golden.`,
    },
    and: ' and ',
    pieces: (n, g) => (n === 1 ? `one piece of ${g}` : `${n} pieces of ${g}`),
    saltOf: (g) => `${g} of salt`, oilOf: (g) => `${g} of olive oil`, sugarOf: (g) => `${g} of sugar`,
    yeastDissolved: (g, name) => `${g} of ${name} dissolved in a spoonful of water`,
    addSentence: (list) => `Add ${list} and mix until worked in. `,
    sugarBit: (g) => ` and ${g} of sugar`,
    oilBit: (g) => ` and ${g} of olive oil`,
    mainYeastBit: (g, name) => `, along with ${g} of ${name}`,
  },
};

export const loc = (v, lang) => (v == null ? '' : typeof v === 'string' ? v : v[lang] ?? v.es ?? '');

function joinList(items, and) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + and + items[items.length - 1];
}

export const isPan = (r) => r.shape === 'pan-rect' || r.shape === 'pan-round';

// Pasos generados. `overrides` permite al planificador alargar o acortar las esperas.
export function buildSteps(r, lang = 'es', overrides = {}) {
  if (Array.isArray(r.steps) && r.steps.length) {
    return r.steps.map((s, i) => ({ ...s, id: s.id || 'c' + i, minutes: overrides[s.id || 'c' + i] ?? s.minutes, custom: true }));
  }
  const L = T[lang] || T.es;
  const c = compute(r);
  const g = (v) => fmtG(v, lang);
  const pl = r.plan || {};
  const pan = isPan(r);
  const leavened = r.leaven !== 'none' && r.leaven !== 'powder';
  const wet = pl.knead === 0 || (pl.knead == null && r.hydration >= 72);
  const p = {
    yeastName: L.yeastName[r.leaven] || '',
    prefName: L.prefName[r.pref] || '', prefThe: L.prefThe[r.pref] || '', prefAll: L.prefAll[r.pref] || '',
    waterName: L.water[r.waterTemp === 'warm' ? 'warm' : 'cool'],
    mainFlour: g(c.g.mainFlour), mainWater: g(c.g.mainWater), mainYeast: g(c.g.mainYeast),
    prefFlour: g(c.g.prefFlour), prefWater: g(c.g.prefWater), prefYeast: g(c.g.prefYeast),
    salt: g(c.g.salt),
    sugarBit: c.g.sugar > 0 ? L.sugarBit(g(c.g.sugar)) : '',
    oilBit: c.g.oil > 0 ? L.oilBit(g(c.g.oil)) : '',
    mainYeastBit: c.g.mainYeast > 0 ? L.mainYeastBit(g(c.g.mainYeast), L.yeastName[r.leaven]) : '',
    prefTemp: loc(pl.prefTemp, lang) || (lang === 'en' ? '18–20 °C' : '18–20 °C'),
    room: L.room, fridge: L.fridge,
    folds: pl.folds, foldEvery: pl.foldEvery, kneadMin: pl.knead,
    pieces: L.pieces(c.pizzas, g(roundBall(c))),
    size: loc(r.size, lang) || (lang === 'en' ? 'the size you want' : 'el tamaño que quieras'),
    preheat: r.preheat || 30,
    surface: loc(r.surface, lang), bakeTemp: loc(r.bakeTemp, lang), bakeTime: loc(r.bakeTime, lang),
  };
  const steps = [];
  const add = (id, type, title, text, minutes, o = {}) => steps.push({ id, type, title, text, minutes: overrides[id] ?? minutes, ...o });
  const wait = (key, range) => ({ wait: true, flex: key, range: range || null });

  if (c.hasPref) {
    add('prefmix', 'mix', L.prefmix.title(p), L.prefmix[r.pref](p), 10, { variant: r.pref });
    add('prefferment', 'ferment', L.prefferment.title(p), L.prefferment[r.pref](p), pl.prefMin || 720, { variant: r.pref === 'poolish' ? 'jar' : 'biga', ...wait('prefMin', pl.prefRange) });
  }

  if (!leavened) {
    add('mix', 'mix', L.mix.title, (r.leaven === 'powder' ? L.mix.powder : L.mix.none)(p), 5, {});
    if (pl.knead > 0) add('knead', 'knead', L.knead.title, L.knead.short(p), pl.knead);
    if (pl.rest > 0) add('rest', 'autolyse', L.rest.title, L.rest.text(p), pl.rest, { variant: 'rest', ...wait('rest', pl.restRange) });
  } else {
    const auto = pl.autolyse > 0;
    const mixText = auto ? L.mix.auto(p) : c.hasPref ? L.mix.pref(p) : L.mix.direct(p);
    add('mix', 'mix', L.mix.title, mixText, 10, {});
    if (auto) add('autolyse', 'autolyse', L.autolyse.title, L.autolyse.text(p), pl.autolyse, wait('autolyse', [20, 60]));
    // Lo que falta por añadir tras la mezcla.
    const bits = [];
    if (auto && c.hasPref) bits.push(p.prefAll);
    if (auto && c.g.mainYeast > 0) bits.push(L.yeastDissolved(p.mainYeast, p.yeastName));
    if (auto && c.g.sugar > 0) bits.push(L.sugarOf(g(c.g.sugar)));
    bits.push(L.saltOf(p.salt));
    if (c.g.oil > 0) bits.push(L.oilOf(g(c.g.oil)));
    const list = joinList(bits, L.and);
    if (wet) {
      add('salt', 'mix', L.salt.title, L.salt.text({ ...p, addBits: list }), 5, { variant: 'pinch' });
    } else {
      add('knead', 'knead', L.knead.title, L.knead.text({ ...p, addSentence: L.addSentence(list) }), pl.knead || 12);
    }
    if (pl.folds > 0) {
      add('fold', 'fold', L.fold.title, L.fold.text(p), pl.folds * pl.foldEvery, { timerMin: pl.foldEvery, rounds: pl.folds, wait: true });
    }
    if (pl.bulk > 0) add('bulk', 'ferment', L.bulk.title, L.bulk.text(p), pl.bulk, { variant: 'bowl', ...wait('bulk', pl.bulkRange) });
    if (pl.cold > 0 && pl.coldStage === 'bulk') {
      add('cold', 'ferment', L.coldBulk.title, L.coldBulk.text(p), pl.cold, { variant: 'bowl', cold: true, ...wait('cold', pl.coldRange) });
    }
    if (pan) {
      add('pan', 'stretch', L.pan.title, L.pan.text(p), 10, { variant: r.shape });
      if (pl.proof > 0) add('proof', 'ferment', L.panProof.title, L.panProof.text(p), pl.proof, { variant: r.shape, ...wait('proof', pl.proofRange) });
    } else {
      add('ball', 'ball', L.ball.title, c.pizzas === 1 ? L.ball.one(p) : L.ball.text(p), 10);
      const coldBalls = pl.cold > 0 && pl.coldStage !== 'bulk';
      if (coldBalls) add('cold', 'ferment', L.coldBalls.title, L.coldBalls.text(p), pl.cold, { variant: 'ball', cold: true, ...wait('cold', pl.coldRange) });
      if (pl.proof > 0) {
        const afterCold = pl.cold > 0;
        add('proof', 'ferment', L.proof.title, (afterCold ? L.proof.temper : L.proof.text)(p), pl.proof, { variant: 'ball', ...wait('proof', pl.proofRange) });
      }
    }
  }
  if (!pan) {
    const kind = r.shape === 'rolled' ? 'rolled' : r.style === 'ny' ? 'ny' : 'round';
    add('stretch', 'stretch', L.stretch.title, L.stretch[kind](p), 5, { variant: r.shape === 'rolled' ? 'rolled' : 'round' });
  }
  const bk = pan ? 'pan' : r.shape === 'rolled' ? 'rolled' : 'round';
  add('bake', 'bake', L.bake.title, L.bake[bk](p), r.bakeMin || 8, { variant: pan ? r.shape : 'round', timerMin: r.bakeMin || 8, wait: true });
  return steps;
}

function roundBall(c) {
  const b = c.total / c.pizzas;
  return Math.round(b);
}

export function totalMinutes(steps) {
  return steps.reduce((a, s) => a + (+s.minutes || 0), 0);
}

// Planificador: de la hora de comer hacia atrás.
export function schedule(steps, eatAt, preheat = 0) {
  let t = eatAt.getTime();
  const out = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const end = t;
    t -= (+steps[i].minutes || 0) * 60000;
    out.unshift({ step: steps[i], index: i, start: new Date(t), end: new Date(end) });
  }
  const bake = out[out.length - 1];
  const oven = preheat > 0 && bake ? new Date(bake.start.getTime() - preheat * 60000) : null;
  return { items: out, start: new Date(t), oven };
}

export { fmtDuration };
