// País de destino. Son COSTUMBRES HABITUALES redactadas con prudencia, no normas ni requisitos:
// siempre manda lo que pida cada oferta. "apply" es lo que cambia el botón «Aplicar estas sugerencias»
// (solo los ajustes que aparecen; el resto se deja como esté). "omit" marca campos que allí no se suelen poner.

export const DESTS = [
  {
    id: 'es', name: { es: 'España', en: 'Spain' }, pages: 2, omit: [],
    apply: { page: 'a4', dateFormat: 'num', docLang: 'es' },
    recs: [
      ['photo', { es: 'La foto es frecuente, pero no hace falta. Si la pones, que sea reciente y de aspecto profesional.', en: 'A photo is common but not needed. If you add one, make it recent and professional-looking.' }],
      ['data', { es: 'Suele bastar con nombre, teléfono, correo y localidad. No hace falta el número de documento, el estado civil ni la dirección completa.', en: 'Name, phone, email and town are usually enough. There is no need for an ID number, marital status or full address.' }],
      ['length', { es: 'Lo normal es una página, o dos si tienes mucha experiencia.', en: 'One page is usual, or two if you have a lot of experience.' }],
      ['dates', { es: 'Fechas con mes y año (03/2021), de lo más reciente a lo más antiguo.', en: 'Dates as month and year (03/2021), most recent first.' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['lang', { es: 'En español, salvo que la oferta esté en otro idioma.', en: 'In Spanish, unless the job advert is in another language.' }],
    ],
  },
  {
    id: 'pt-it', name: { es: 'Portugal e Italia', en: 'Portugal and Italy' }, pages: 2, omit: [],
    apply: { page: 'a4', dateFormat: 'num' },
    recs: [
      ['photo', { es: 'La foto es frecuente y opcional.', en: 'A photo is common and optional.' }],
      ['extra', { es: 'En Italia muchas ofertas esperan un currículum con estructura europea: prueba la plantilla «Estilo europeo».', en: 'In Italy many adverts expect a CV with a European structure: try the “European style” template.' }],
      ['length', { es: 'Una o dos páginas.', en: 'One or two pages.' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['lang', { es: 'En el idioma del país, o en inglés si la oferta está en inglés. Puedes cambiar los rótulos a portugués o italiano más abajo.', en: 'In the local language, or in English if the advert is in English. You can switch the headings to Portuguese or Italian below.' }],
    ],
  },
  {
    id: 'fr-be', name: { es: 'Francia, Bélgica y Luxemburgo', en: 'France, Belgium and Luxembourg' }, pages: 2, omit: ['birth'],
    apply: { page: 'a4', dateFormat: 'num', docLang: 'fr' },
    recs: [
      ['photo', { es: 'La foto es opcional: se ve a menudo, pero bastantes empresas prefieren no recibirla.', en: 'A photo is optional: it is often seen, but quite a few employers prefer not to receive one.' }],
      ['data', { es: 'No hace falta la fecha de nacimiento ni el estado civil.', en: 'Date of birth and marital status are not needed.' }],
      ['length', { es: 'Se valora la brevedad: una página si tienes poca experiencia, dos como mucho.', en: 'Brevity is valued: one page if you have little experience, two at most.' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['lang', { es: 'Normalmente en francés. Según la zona y la oferta puede ser neerlandés, alemán o inglés.', en: 'Usually in French. Depending on the region and the advert it may be Dutch, German or English.' }],
    ],
  },
  {
    id: 'dach', name: { es: 'Alemania, Austria y Suiza', en: 'Germany, Austria and Switzerland' }, pages: 2, omit: [],
    apply: { page: 'a4', dateFormat: 'num', docLang: 'de' },
    recs: [
      ['photo', { es: 'Todavía es habitual una foto de aspecto profesional, aunque es opcional.', en: 'A professional-looking photo is still common, although optional.' }],
      ['data', { es: 'Es frecuente ver la fecha de nacimiento; tú decides si la incluyes.', en: 'Date of birth is often included; it is your choice.' }],
      ['extra', { es: 'Se valora un orden cronológico claro, de lo más reciente a lo más antiguo y sin periodos sin explicar.', en: 'A clear timeline is valued, most recent first and without unexplained gaps.' }],
      ['length', { es: 'Una o dos páginas.', en: 'One or two pages.' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['lang', { es: 'En alemán, salvo que la oferta esté en inglés.', en: 'In German, unless the advert is in English.' }],
    ],
  },
  {
    id: 'nl-nord', name: { es: 'Países Bajos y países nórdicos', en: 'Netherlands and Nordic countries' }, pages: 2, omit: ['birth'],
    apply: { page: 'a4', dateFormat: 'short', docLang: 'en' },
    recs: [
      ['photo', { es: 'La foto es opcional y bastantes empresas prefieren no recibirla.', en: 'A photo is optional and quite a few employers prefer not to receive one.' }],
      ['data', { es: 'No hace falta la fecha de nacimiento ni el estado civil.', en: 'Date of birth and marital status are not needed.' }],
      ['length', { es: 'Una o dos páginas, con un tono directo.', en: 'One or two pages, in a direct tone.' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['lang', { es: 'El inglés se acepta en muchas empresas; fíjate en el idioma de la oferta.', en: 'English is accepted by many employers; check the language of the advert.' }],
    ],
  },
  {
    id: 'uk-ie', name: { es: 'Reino Unido e Irlanda', en: 'United Kingdom and Ireland' }, pages: 2, omit: ['photo', 'birth', 'nationality'],
    apply: { photo: false, page: 'a4', dateFormat: 'short', docLang: 'en' },
    recs: [
      ['photo', { es: 'No se suele poner foto.', en: 'A photo is not usually included.' }],
      ['data', { es: 'No se suele incluir la fecha de nacimiento, la nacionalidad ni el estado civil.', en: 'Date of birth, nationality and marital status are not usually included.' }],
      ['length', { es: 'Lo habitual son dos páginas como mucho.', en: 'Two pages at most is usual.' }],
      ['dates', { es: 'Fechas con el mes en letra y el año (Mar 2021).', en: 'Dates with the month in words and the year (Mar 2021).' }],
      ['page', { es: 'Papel de tamaño A4.', en: 'A4 paper size.' }],
      ['extra', { es: 'Es frecuente no dar nombres de referencias y escribir que se facilitarán si se piden.', en: 'It is common not to name referees and to say references are available on request.' }],
      ['lang', { es: 'En inglés.', en: 'In English.' }],
    ],
  },
  {
    id: 'us-ca', name: { es: 'Estados Unidos y Canadá', en: 'United States and Canada' }, pages: 1, omit: ['photo', 'birth', 'nationality'],
    apply: { photo: false, page: 'letter', dateFormat: 'long', docLang: 'en' },
    recs: [
      ['photo', { es: 'No se suele poner foto.', en: 'A photo is not usually included.' }],
      ['data', { es: 'No se suele incluir la edad, la fecha de nacimiento, la nacionalidad ni el estado civil.', en: 'Age, date of birth, nationality and marital status are not usually included.' }],
      ['length', { es: 'Se suele preferir una página; dos si tienes muchos años de experiencia. Allí se le suele llamar «résumé».', en: 'One page is usually preferred; two if you have many years of experience. It is usually called a “résumé” there.' }],
      ['dates', { es: 'Fechas con el mes en letra y el año (March 2021).', en: 'Dates with the month in words and the year (March 2021).' }],
      ['page', { es: 'El papel habitual es el tamaño Carta, no el A4.', en: 'The usual paper is Letter size, not A4.' }],
      ['lang', { es: 'En inglés; en algunas zonas de Canadá, en francés.', en: 'In English; in some parts of Canada, in French.' }],
    ],
  },
  {
    id: 'latam', name: { es: 'Latinoamérica', en: 'Latin America' }, pages: 2, omit: [],
    apply: { docLang: 'es' },
    recs: [
      ['extra', { es: 'Las costumbres cambian bastante de un país a otro: mira ejemplos del país al que vas.', en: 'Customs vary quite a lot between countries: look at examples from the one you are going to.' }],
      ['photo', { es: 'La foto es frecuente en muchos países, pero opcional.', en: 'A photo is common in many countries, but optional.' }],
      ['length', { es: 'Una o dos páginas.', en: 'One or two pages.' }],
      ['page', { es: 'En varios países se usa el tamaño Carta en lugar del A4. Compruébalo antes de imprimir.', en: 'Several countries use Letter size rather than A4. Check before printing.' }],
      ['lang', { es: 'En español; en portugués para Brasil.', en: 'In Spanish; in Portuguese for Brazil.' }],
    ],
  },
  {
    id: 'other', name: { es: 'Otro país', en: 'Another country' }, pages: 2, omit: [],
    apply: { docLang: 'en' },
    recs: [
      ['photo', { es: 'Si no conoces las costumbres del país, lo más prudente suele ser no poner foto ni datos personales de más.', en: 'If you do not know local customs, the cautious choice is usually no photo and no extra personal details.' }],
      ['length', { es: 'Una o dos páginas.', en: 'One or two pages.' }],
      ['page', { es: 'El A4 se usa en casi todo el mundo; el tamaño Carta, sobre todo en Norteamérica.', en: 'A4 is used almost everywhere; Letter size mainly in North America.' }],
      ['lang', { es: 'En el idioma de la oferta. Si no lo hablas, el inglés suele ser la alternativa.', en: 'In the language of the advert. If you do not speak it, English is usually the alternative.' }],
    ],
  },
];
export const destById = (id) => DESTS.find((d) => d.id === id) || DESTS[0];
