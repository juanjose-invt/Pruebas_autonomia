// Ejemplos para el muestrario y para "Rellenar con un ejemplo". Todo es inventado a propósito:
// personas, empresas, centros, teléfonos y correos no existen.

import { uid } from './templates.js';

const E = (title, org, place, start, end, desc = '') => ({ title, org, place, start, end: end === 'now' ? '' : end, current: end === 'now', desc });
const LG = (name, level, note = '') => ({ name, level, note });
const SK = (label, text) => ({ label, text });
const F = (label, value) => ({ label, value });

const S = {
  general: {
    es: {
      p: ['Marta', 'Ejemplo Ficticio', 'Administrativa', 'Villaejemplo (Provincia inventada)'],
      profile: 'Administrativa con seis años de experiencia en facturación, atención telefónica y archivo. Ordenada, resolutiva y acostumbrada a trabajar con plazos. Este texto es un ejemplo inventado.',
      experience: [
        E('Administrativa', 'Gestoría Ejemplo (ficticia)', 'Villaejemplo', '2021-03', 'now', 'Preparo y envío unas 200 facturas al mes sin incidencias.\nAtiendo a clientes por teléfono y correo.\nOrganicé el archivo digital de la oficina.'),
        E('Auxiliar administrativa', 'Suministros Inventados, S. L.', 'Villaejemplo', '2018-09', '2021-02', 'Registro de pedidos y albaranes.\nApoyo en el cierre mensual de contabilidad.'),
      ],
      education: [E('Técnico Superior en Administración y Finanzas', 'Instituto Ejemplo (ficticio)', 'Villaejemplo', '2016-09', '2018-06', '')],
      languages: [LG('Español', 'native'), LG('Inglés', 'B2', 'Certificado de ejemplo'), LG('Francés', 'A2')],
      skills: [SK('Ofimática', 'Hoja de cálculo, procesador de textos, correo y agenda'), SK('Gestión', 'Facturación, archivo, atención telefónica')],
      courses: [E('Contabilidad básica para pymes', 'Centro de Formación Ejemplo', '40 h', '', '2022', '')],
      driving: [F('Permiso B', 'Vehículo propio')],
    },
    en: {
      p: ['Marta', 'Example Fictional', 'Office administrator', 'Sampleton (invented county)'],
      profile: 'Office administrator with six years of experience in invoicing, phone support and filing. Organised, practical and used to deadlines. This text is an invented example.',
      experience: [
        E('Office administrator', 'Example Accountants (fictional)', 'Sampleton', '2021-03', 'now', 'Prepare and send around 200 invoices a month without errors.\nSupport clients by phone and email.\nSet up the office digital filing system.'),
        E('Administrative assistant', 'Invented Supplies Ltd', 'Sampleton', '2018-09', '2021-02', 'Logged orders and delivery notes.\nSupported the monthly accounts close.'),
      ],
      education: [E('Higher Certificate in Administration and Finance', 'Example College (fictional)', 'Sampleton', '2016-09', '2018-06', '')],
      languages: [LG('Spanish', 'native'), LG('English', 'B2', 'Example certificate'), LG('French', 'A2')],
      skills: [SK('Office software', 'Spreadsheets, word processing, email and calendar'), SK('Admin', 'Invoicing, filing, phone support')],
      courses: [E('Basic bookkeeping for small businesses', 'Example Training Centre', '40 h', '', '2022', '')],
      driving: [F('Category B', 'Own car')],
    },
  },
  hosteleria: {
    es: {
      p: ['Lucía', 'Ejemplo Ficticio', 'Camarera de sala', 'Playa Inventada (Provincia inventada)'],
      profile: 'Camarera con cuatro temporadas en sala y terraza. Rápida, amable y acostumbrada a servicios con mucha gente. Este texto es un ejemplo inventado.',
      availability: [F('Incorporación', 'Inmediata'), F('Turnos', 'Mañana, tarde y fines de semana'), F('Jornada', 'Completa o parcial')],
      experience: [
        E('Camarera de sala', 'Restaurante Ejemplo (ficticio)', 'Playa Inventada', '2022-04', 'now', 'Atiendo un rango de 8 mesas en comidas y cenas.\nTomo comandas con terminal y cobro en caja.\nRecomiendo vinos y platos del día.'),
        E('Ayudante de camarera', 'Hotel Inventado', 'Playa Inventada', '2020-06', '2021-09', 'Desayunos tipo bufé para 150 huéspedes.\nMontaje de salones para eventos.'),
      ],
      languages: [LG('Español', 'native'), LG('Inglés', 'B2'), LG('Alemán', 'A2')],
      skills: [SK('', 'Servicio en sala, Terminal de comandas, Caja, Coctelería básica, Trato con el cliente')],
      courses: [E('Manipulación de alimentos', 'Centro de Formación Ejemplo', '', '', '2023', ''), E('Alérgenos en restauración', 'Centro de Formación Ejemplo', '10 h', '', '2023', '')],
      education: [E('Técnico en Servicios en Restauración', 'Instituto Ejemplo (ficticio)', 'Playa Inventada', '2018-09', '2020-06', '')],
      driving: [F('Permiso B', 'Vehículo propio')],
    },
    en: {
      p: ['Lucía', 'Example Fictional', 'Waitress', 'Invented Beach (made-up county)'],
      profile: 'Waitress with four seasons of floor and terrace service. Quick, friendly and comfortable in busy shifts. This text is an invented example.',
      availability: [F('Start', 'Immediately'), F('Shifts', 'Mornings, evenings and weekends'), F('Hours', 'Full or part time')],
      experience: [
        E('Waitress', 'Example Restaurant (fictional)', 'Invented Beach', '2022-04', 'now', 'Look after a section of 8 tables at lunch and dinner.\nTake orders on a handheld terminal and handle payments.\nRecommend wines and daily specials.'),
        E('Assistant waitress', 'Invented Hotel', 'Invented Beach', '2020-06', '2021-09', 'Buffet breakfasts for 150 guests.\nSet up function rooms for events.'),
      ],
      languages: [LG('Spanish', 'native'), LG('English', 'B2'), LG('German', 'A2')],
      skills: [SK('', 'Table service, Order terminals, Till, Basic cocktails, Customer care')],
      courses: [E('Food hygiene', 'Example Training Centre', '', '', '2023', ''), E('Allergens in catering', 'Example Training Centre', '10 h', '', '2023', '')],
      education: [E('Vocational Certificate in Restaurant Service', 'Example College (fictional)', 'Invented Beach', '2018-09', '2020-06', '')],
      driving: [F('Category B', 'Own car')],
    },
  },
  comercio: {
    es: {
      p: ['Daniel', 'Ejemplo Ficticio', 'Dependiente y atención al cliente', 'Ciudad Inventada'],
      profile: 'Dependiente con cinco años en tienda de moda y electrónica. Me gusta escuchar al cliente y dar con lo que necesita. Este texto es un ejemplo inventado.',
      achievements: 'Mejor valoración de clientes de la tienda durante dos trimestres seguidos.\nFormé a 4 compañeros nuevos en caja y devoluciones.\nReduje a la mitad las colas en rebajas reorganizando la zona de cobro.',
      experience: [
        E('Dependiente', 'Tienda Ejemplo (ficticia)', 'Ciudad Inventada', '2021-02', 'now', 'Atención y asesoramiento en tienda.\nCobro en caja, cambios y devoluciones.\nReposición y montaje de escaparates.'),
        E('Teleoperador de atención al cliente', 'Servicios Inventados, S. A.', 'Ciudad Inventada', '2019-01', '2021-01', 'Unas 60 llamadas al día de consultas y reclamaciones.\nRegistro de cada caso en el programa de gestión.'),
      ],
      education: [E('Técnico en Actividades Comerciales', 'Instituto Ejemplo (ficticio)', 'Ciudad Inventada', '2016-09', '2018-06', '')],
      skills: [SK('', 'Venta asesorada, Caja y arqueo, Reclamaciones, Escaparatismo, Inventario')],
      languages: [LG('Español', 'native'), LG('Inglés', 'B1')],
      availability: [F('Horario', 'Turnos rotativos y festivos')],
    },
    en: {
      p: ['Daniel', 'Example Fictional', 'Sales assistant and customer service', 'Invented City'],
      profile: 'Sales assistant with five years in fashion and electronics shops. I like listening to customers and finding what they need. This text is an invented example.',
      achievements: 'Highest customer rating in the shop for two quarters in a row.\nTrained 4 new colleagues on tills and returns.\nHalved queues during sales by reorganising the checkout area.',
      experience: [
        E('Sales assistant', 'Example Shop (fictional)', 'Invented City', '2021-02', 'now', 'Customer advice on the shop floor.\nTills, exchanges and returns.\nRestocking and window displays.'),
        E('Customer service agent', 'Invented Services plc', 'Invented City', '2019-01', '2021-01', 'Around 60 calls a day with queries and complaints.\nLogged each case in the management system.'),
      ],
      education: [E('Vocational Certificate in Retail', 'Example College (fictional)', 'Invented City', '2016-09', '2018-06', '')],
      skills: [SK('', 'Assisted selling, Tills and cashing up, Complaints, Window dressing, Stock counts')],
      languages: [LG('Spanish', 'native'), LG('English', 'B1')],
      availability: [F('Hours', 'Rotating shifts and bank holidays')],
    },
  },
  sanidad: {
    es: {
      p: ['Elena', 'Ejemplo Ficticio', 'Técnica en Cuidados Auxiliares de Enfermería', 'Villaejemplo'],
      profile: 'Auxiliar de enfermería con experiencia en planta de hospital y en residencia de mayores. Cercana con pacientes y familias, y cuidadosa con los protocolos. Este texto es un ejemplo inventado.',
      education: [E('Técnico en Cuidados Auxiliares de Enfermería', 'Instituto Ejemplo (ficticio)', 'Villaejemplo', '2015-09', '2017-06', 'Prácticas en planta de medicina interna.')],
      registration: [F('Titulación', 'Homologada en España'), F('Bolsa de empleo', 'Inscrita (dato de ejemplo)')],
      experience: [
        E('Auxiliar de enfermería', 'Hospital Ejemplo (ficticio)', 'Villaejemplo', '2020-01', 'now', 'Planta de traumatología, 28 camas.\nHigiene, movilización y toma de constantes.\nApoyo a enfermería en curas y registros.'),
        E('Gerocultora', 'Residencia Inventada', 'Villaejemplo', '2017-09', '2019-12', 'Cuidado diario de 12 residentes.\nAcompañamiento en comidas y paseos.'),
      ],
      courses: [E('Movilización de pacientes', 'Centro de Formación Ejemplo', '30 h', '', '2023', ''), E('Primeros auxilios', 'Centro de Formación Ejemplo', '20 h', '', '2021', '')],
      languages: [LG('Español', 'native'), LG('Inglés', 'B1')],
      skills: [SK('', 'Toma de constantes, Higiene y movilización, Registro en historia clínica, Trato con familias')],
      availability: [F('Turnos', 'Rotatorio, noches incluidas')],
    },
    en: {
      p: ['Elena', 'Example Fictional', 'Healthcare assistant', 'Sampleton'],
      profile: 'Healthcare assistant with experience on hospital wards and in a care home. Warm with patients and families, and careful with procedures. This text is an invented example.',
      education: [E('Vocational Certificate in Auxiliary Nursing Care', 'Example College (fictional)', 'Sampleton', '2015-09', '2017-06', 'Placement on a general medicine ward.')],
      registration: [F('Qualification', 'Recognised in Spain'), F('Staff bank', 'Registered (example data)')],
      experience: [
        E('Healthcare assistant', 'Example Hospital (fictional)', 'Sampleton', '2020-01', 'now', 'Orthopaedic ward, 28 beds.\nPersonal care, moving and handling, observations.\nSupport nurses with dressings and records.'),
        E('Care assistant', 'Invented Care Home', 'Sampleton', '2017-09', '2019-12', 'Daily care for 12 residents.\nSupport at mealtimes and on walks.'),
      ],
      courses: [E('Moving and handling', 'Example Training Centre', '30 h', '', '2023', ''), E('First aid', 'Example Training Centre', '20 h', '', '2021', '')],
      languages: [LG('Spanish', 'native'), LG('English', 'B1')],
      skills: [SK('', 'Observations, Personal care, Patient records, Working with families')],
      availability: [F('Shifts', 'Rotating, including nights')],
    },
  },
  tecnologia: {
    es: {
      p: ['Pablo', 'Ejemplo Ficticio', 'Desarrollador web', 'Ciudad Inventada'],
      profile: 'Desarrollador web con cuatro años creando aplicaciones para tiendas en línea. Me importa que el código se entienda y que la página cargue rápido. Este texto es un ejemplo inventado.',
      skills: [SK('Lenguajes', 'JavaScript, TypeScript, HTML, CSS, SQL'), SK('Herramientas', 'Control de versiones, pruebas automáticas, integración continua'), SK('Otros', 'Accesibilidad web, metodologías ágiles')],
      experience: [
        E('Desarrollador web', 'Estudio Ejemplo (ficticio)', 'En remoto', '2022-05', 'now', 'Rehíce el proceso de compra y bajó un 30 % el abandono del carrito.\nMantengo una biblioteca de componentes que usan 3 equipos.'),
        E('Programador júnior', 'Tecnologías Inventadas, S. L.', 'Ciudad Inventada', '2020-09', '2022-04', 'Corrección de errores y pruebas en una aplicación de reservas.'),
      ],
      projects: [E('Buscador de recetas (proyecto inventado)', 'Proyecto personal', 'ejemplo.example/recetas', '', '2023', 'Aplicación que funciona sin conexión, con unas 2.000 visitas al mes.')],
      education: [E('Técnico Superior en Desarrollo de Aplicaciones Web', 'Instituto Ejemplo (ficticio)', 'Ciudad Inventada', '2018-09', '2020-06', '')],
      languages: [LG('Español', 'native'), LG('Inglés', 'C1')],
    },
    en: {
      p: ['Pablo', 'Example Fictional', 'Web developer', 'Invented City'],
      profile: 'Web developer with four years building applications for online shops. I care about readable code and pages that load fast. This text is an invented example.',
      skills: [SK('Languages', 'JavaScript, TypeScript, HTML, CSS, SQL'), SK('Tooling', 'Version control, automated testing, continuous integration'), SK('Other', 'Web accessibility, agile methods')],
      experience: [
        E('Web developer', 'Example Studio (fictional)', 'Remote', '2022-05', 'now', 'Rebuilt the checkout flow and cut basket abandonment by 30%.\nMaintain a component library used by 3 teams.'),
        E('Junior developer', 'Invented Technologies Ltd', 'Invented City', '2020-09', '2022-04', 'Bug fixing and testing on a booking application.'),
      ],
      projects: [E('Recipe finder (invented project)', 'Personal project', 'example.example/recipes', '', '2023', 'Works offline; around 2,000 visits a month.')],
      education: [E('Higher Certificate in Web Application Development', 'Example College (fictional)', 'Invented City', '2018-09', '2020-06', '')],
      languages: [LG('Spanish', 'native'), LG('English', 'C1')],
    },
  },
  oficios: {
    es: {
      p: ['Antonio', 'Ejemplo Ficticio', 'Oficial de primera albañil', 'Villaejemplo'],
      profile: 'Oficial de albañilería con quince años en obra nueva y reformas. Este texto es un ejemplo inventado.',
      permits: [F('Prevención de riesgos', 'Curso de albañilería, 20 h'), F('Trabajos en altura', 'Formación específica'), F('Plataformas elevadoras', 'Carné de operador')],
      experience: [
        E('Oficial de primera', 'Construcciones Ejemplo (ficticia)', 'Villaejemplo', '2016-02', 'now', 'Obra nueva de viviendas: cerramientos, tabiquería y solados.\nEncargado de una cuadrilla de 4 personas.\nReplanteo a partir de planos.'),
        E('Oficial de segunda', 'Reformas Inventadas, S. L.', 'Villaejemplo', '2009-03', '2016-01', 'Reformas de baños y cocinas.\nAlicatado y enlucido.'),
      ],
      machinery: 'Hormigonera\nRadial y rozadora\nNivel láser\nAndamio tubular\nMiniexcavadora',
      education: [E('Graduado en Educación Secundaria', 'Instituto Ejemplo (ficticio)', 'Villaejemplo', '', '2005', '')],
      driving: [F('Permiso B', 'Vehículo propio'), F('Permiso C', '')],
      languages: [LG('Español', 'native')],
    },
    en: {
      p: ['Antonio', 'Example Fictional', 'Skilled bricklayer', 'Sampleton'],
      profile: 'Bricklayer with fifteen years on new builds and refurbishments. This text is an invented example.',
      permits: [F('Site safety', 'Bricklaying course, 20 h'), F('Working at height', 'Specific training'), F('Elevating platforms', 'Operator card')],
      experience: [
        E('Skilled bricklayer', 'Example Construction (fictional)', 'Sampleton', '2016-02', 'now', 'New-build housing: walls, partitions and flooring.\nLead a crew of 4.\nSetting out from drawings.'),
        E('Bricklayer', 'Invented Refurbishments Ltd', 'Sampleton', '2009-03', '2016-01', 'Bathroom and kitchen refits.\nTiling and plastering.'),
      ],
      machinery: 'Cement mixer\nAngle grinder and wall chaser\nLaser level\nTube scaffolding\nMini digger',
      education: [E('Secondary school certificate', 'Example School (fictional)', 'Sampleton', '', '2005', '')],
      driving: [F('Category B', 'Own vehicle'), F('Category C', '')],
      languages: [LG('Spanish', 'native')],
    },
  },
  educacion: {
    es: {
      p: ['Carmen', 'Ejemplo Ficticio', 'Maestra de Educación Primaria', 'Villaejemplo'],
      profile: 'Maestra de primaria con siete cursos de experiencia como tutora. Trabajo por proyectos y cuido mucho la relación con las familias. Este texto es un ejemplo inventado.',
      education: [E('Grado en Educación Primaria', 'Universidad Ejemplo (ficticia)', 'Ciudad Inventada', '2012-09', '2016-06', 'Mención en lengua extranjera.')],
      qualifications: [F('Especialidad', 'Educación Primaria e Inglés'), F('Habilitación lingüística', 'Inglés (dato de ejemplo)')],
      experience: [
        E('Tutora de 3.º y 4.º de primaria', 'Colegio Ejemplo (ficticio)', 'Villaejemplo', '2019-09', 'now', 'Grupo de 24 alumnos.\nCoordino el plan de lectura del centro.'),
        E('Maestra de apoyo', 'Colegio Inventado', 'Ciudad Inventada', '2016-09', '2019-06', 'Refuerzo de lengua y matemáticas en pequeños grupos.'),
      ],
      languages: [LG('Español', 'native'), LG('Inglés', 'C1', 'Certificado de ejemplo')],
      courses: [E('Aprendizaje cooperativo en el aula', 'Centro de Profesorado Ejemplo', '30 h', '', '2022', '')],
      projects: [E('Huerto escolar (proyecto inventado)', 'Coordinadora', '', '2021', '2023', 'Proyecto de centro con seis grupos y la colaboración de las familias.')],
    },
    en: {
      p: ['Carmen', 'Example Fictional', 'Primary school teacher', 'Sampleton'],
      profile: 'Primary teacher with seven school years as a class teacher. I teach through projects and work closely with families. This text is an invented example.',
      education: [E('Degree in Primary Education', 'Example University (fictional)', 'Invented City', '2012-09', '2016-06', 'Specialism in foreign languages.')],
      qualifications: [F('Specialism', 'Primary Education and English'), F('Language accreditation', 'English (example data)')],
      experience: [
        E('Class teacher, years 3 and 4', 'Example School (fictional)', 'Sampleton', '2019-09', 'now', 'Class of 24 pupils.\nCoordinate the school reading plan.'),
        E('Support teacher', 'Invented School', 'Invented City', '2016-09', '2019-06', 'Small-group support in language and maths.'),
      ],
      languages: [LG('Spanish', 'native'), LG('English', 'C1', 'Example certificate')],
      courses: [E('Cooperative learning in the classroom', 'Example Teachers’ Centre', '30 h', '', '2022', '')],
      projects: [E('School garden (invented project)', 'Coordinator', '', '2021', '2023', 'Whole-school project with six classes and help from families.')],
    },
  },
  logistica: {
    es: {
      p: ['Javier', 'Ejemplo Ficticio', 'Mozo de almacén y carretillero', 'Polígono Inventado (Villaejemplo)'],
      profile: 'Mozo de almacén con seis años en preparación de pedidos y carga de camiones. Puntual y cuidadoso con la mercancía. Este texto es un ejemplo inventado.',
      driving: [F('Permisos', 'B y C'), F('Vehículo', 'Propio')],
      availability: [F('Turnos', 'Mañana, tarde o noche'), F('Movilidad', 'Toda la provincia')],
      experience: [
        E('Carretillero', 'Logística Ejemplo (ficticia)', 'Villaejemplo', '2020-03', 'now', 'Carga y descarga con carretilla frontal y retráctil.\nUbicación de palés con lector de radiofrecuencia.\nCero incidencias de mercancía en el último año.'),
        E('Preparador de pedidos', 'Almacenes Inventados, S. A.', 'Villaejemplo', '2018-01', '2020-02', 'Unas 180 líneas de pedido por turno.\nEtiquetado y retractilado.'),
      ],
      machinery: 'Carretilla frontal\nCarretilla retráctil\nTranspaleta eléctrica\nFurgoneta hasta 3.500 kg',
      courses: [E('Operador de carretillas elevadoras', 'Centro de Formación Ejemplo', '', '', '2019', '')],
      education: [E('Graduado en Educación Secundaria', 'Instituto Ejemplo (ficticio)', 'Villaejemplo', '', '2015', '')],
      languages: [LG('Español', 'native'), LG('Inglés', 'A2')],
    },
    en: {
      p: ['Javier', 'Example Fictional', 'Warehouse operative and forklift driver', 'Invented Estate (Sampleton)'],
      profile: 'Warehouse operative with six years picking orders and loading lorries. Punctual and careful with goods. This text is an invented example.',
      driving: [F('Licences', 'B and C'), F('Vehicle', 'Own')],
      availability: [F('Shifts', 'Mornings, evenings or nights'), F('Travel', 'Whole county')],
      experience: [
        E('Forklift driver', 'Example Logistics (fictional)', 'Sampleton', '2020-03', 'now', 'Loading and unloading with counterbalance and reach trucks.\nPallet put-away with a handheld scanner.\nNo damaged-goods incidents in the last year.'),
        E('Order picker', 'Invented Warehouses plc', 'Sampleton', '2018-01', '2020-02', 'Around 180 order lines per shift.\nLabelling and shrink-wrapping.'),
      ],
      machinery: 'Counterbalance forklift\nReach truck\nElectric pallet truck\nVan up to 3,500 kg',
      courses: [E('Forklift operator', 'Example Training Centre', '', '', '2019', '')],
      education: [E('Secondary school certificate', 'Example School (fictional)', 'Sampleton', '', '2015', '')],
      languages: [LG('Spanish', 'native'), LG('English', 'A2')],
    },
  },
};

// Vuelca un ejemplo dentro de un currículum (solo el contenido; no toca plantilla ni diseño).
export function fillSample(cv, sampleId, lang) {
  const set = S[sampleId] || S.general;
  const d = set[lang === 'es' ? 'es' : 'en'];
  const [firstName, lastName, title, city] = d.p;
  Object.assign(cv.personal, {
    firstName, lastName, title, city,
    phone: '600 000 000', email: 'nombre@ejemplo.example',
    web: sampleId === 'tecnologia' ? 'ejemplo.example' : '', linkedin: '',
  });
  for (const s of cv.sections) {
    const v = d[s.key];
    if (v === undefined) continue;
    if (s.kind === 'text' || s.kind === 'list') s.text = v;
    else s.items = v.map((it) => ({ id: uid(), ...it }));
    s.on = true;
  }
  return cv;
}

// Retrato de ejemplo: una silueta dibujada, claramente no es una persona real.
export const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><rect width="200" height="250" fill="#DCE3DE"/><circle cx="100" cy="98" r="44" fill="#9FB0A7"/><path d="M22 250c4-56 36-88 78-88s74 32 78 88z" fill="#9FB0A7"/></svg>');
