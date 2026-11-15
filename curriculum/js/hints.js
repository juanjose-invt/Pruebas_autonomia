// Ayudas «qué poner aquí»: rótulos de cada tipo de sección y consejos con ejemplos por sector.
// Todos los ejemplos son inventados.

import { getLang } from './i18n.js';

const L = (es, en) => ({ es, en });
const pick = (o) => (o ? o[getLang()] || o.es : '');

// Rótulos de los campos de cada sección con entradas.
const ENTRY = {
  experience: {
    add: L('Añadir un trabajo', 'Add a job'), title: L('Puesto', 'Job title'), org: L('Empresa', 'Employer'), place: L('Lugar', 'Place'),
    desc: L('Qué hacías y qué conseguiste', 'What you did and achieved'),
    orgHint: L('El nombre de la empresa o «Autónomo».', 'The employer’s name, or “Self-employed”.'), placeHint: L('Ciudad, o «En remoto».', 'City, or “Remote”.'),
    descHint: L('Una tarea o logro por línea; cada línea sale como un punto. Si puedes, pon cifras.', 'One task or achievement per line; each line becomes a bullet. Use numbers if you can.'),
  },
  education: {
    add: L('Añadir estudios', 'Add a qualification'), title: L('Título', 'Qualification'), org: L('Centro', 'School or college'), place: L('Lugar', 'Place'),
    desc: L('Detalles (opcional)', 'Details (optional)'),
    titleHint: L('Ej.: Técnico en Gestión Administrativa, Graduado en ESO', 'E.g. Vocational Certificate in Administration, Secondary school certificate'),
    orgHint: L('Instituto, universidad o academia.', 'School, university or academy.'),
    descHint: L('Solo si aporta: una mención, las prácticas, la nota si es buena.', 'Only if it adds something: a specialism, a placement, a good grade.'),
  },
  courses: {
    add: L('Añadir curso o certificado', 'Add a course or certificate'), title: L('Curso o certificado', 'Course or certificate'), org: L('Entidad que lo imparte', 'Provider'), place: L('Horas o detalle (opcional)', 'Hours or detail (optional)'),
    titleHint: L('Ej.: Manipulación de alimentos, Carretillero', 'E.g. Food hygiene, Forklift operator'), placeHint: L('Ej.: 40 h', 'E.g. 40 h'), single: true,
  },
  volunteering: {
    add: L('Añadir voluntariado', 'Add volunteering'), title: L('Qué hacías', 'Your role'), org: L('Organización', 'Organisation'), place: L('Lugar', 'Place'),
    desc: L('Qué hiciste', 'What you did'), titleHint: L('Ej.: Monitora de tiempo libre', 'E.g. Youth activity leader'),
    descHint: L('Una línea por tarea. Cuenta mucho si tienes poca experiencia laboral.', 'One line per task. It counts a lot if you have little work experience.'),
  },
  projects: {
    add: L('Añadir proyecto', 'Add a project'), title: L('Proyecto', 'Project'), org: L('Tu papel', 'Your role'), place: L('Enlace (opcional)', 'Link (optional)'),
    desc: L('En qué consistía y qué resultado tuvo', 'What it was and how it turned out'), titleHint: L('Ej.: Página web de una asociación', 'E.g. Website for a local association'),
    descHint: L('Una o dos líneas. Di qué hiciste tú.', 'One or two lines. Say what you did.'),
  },
  references: {
    add: L('Añadir referencia', 'Add a referee'), title: L('Nombre', 'Name'), org: L('Cargo y empresa', 'Position and employer'), place: L('Teléfono o correo', 'Phone or email'),
    titleHint: L('Pide permiso a la persona antes de poner sus datos.', 'Ask the person before adding their details.'), noDates: true,
  },
  custom: {
    add: L('Añadir elemento', 'Add an item'), title: L('Título', 'Title'), org: L('Subtítulo (opcional)', 'Subtitle (optional)'), place: L('Lugar o detalle (opcional)', 'Place or detail (optional)'),
    desc: L('Descripción (opcional)', 'Description (optional)'), descHint: L('Una línea por idea.', 'One line per idea.'),
  },
};
export function entryLabels(key) {
  const e = ENTRY[key] || ENTRY.custom;
  const o = {};
  for (const [k, v] of Object.entries(e)) o[k] = typeof v === 'object' ? pick(v) : v;
  return o;
}

// Rótulos para secciones de datos sueltos y listas.
const FACTS = {
  driving: { label: L('Permiso', 'Licence'), value: L('Detalle (opcional)', 'Detail (optional)'), hint: L('Ej.: «Permiso B» y, al lado, «Vehículo propio».', 'E.g. “Category B” and, next to it, “Own car”.') },
  availability: { label: L('Qué', 'What'), value: L('Tu disponibilidad', 'Your availability'), hint: L('Ej.: «Turnos» y «Mañana, tarde y fines de semana»; «Incorporación» e «Inmediata».', 'E.g. “Shifts” and “Mornings, evenings and weekends”; “Start” and “Immediately”.') },
  registration: { label: L('Qué', 'What'), value: L('Detalle', 'Detail'), hint: L('Ej.: «Colegiación» y «Colegio profesional de tu provincia»; «Titulación» y «Homologada».', 'E.g. “Registration” and “Professional body in your area”; “Qualification” and “Recognised”.') },
  permits: { label: L('Carné o formación', 'Card or training'), value: L('Detalle (opcional)', 'Detail (optional)'), hint: L('Ej.: «Prevención de riesgos» y «Curso de 20 h»; «Trabajos en altura».', 'E.g. “Site safety” and “20-hour course”; “Working at height”.') },
  qualifications: { label: L('Qué', 'What'), value: L('Detalle', 'Detail'), hint: L('Ej.: «Especialidad» y «Educación Primaria»; «Habilitación lingüística» e «Inglés».', 'E.g. “Specialism” and “Primary Education”; “Language accreditation” and “English”.') },
};
export function factLabels(key) {
  const f = FACTS[key] || { label: L('Dato', 'Item'), value: L('Detalle (opcional)', 'Detail (optional)'), hint: L('Un dato por fila.', 'One item per row.') };
  return { label: pick(f.label), value: pick(f.value), hint: pick(f.hint) };
}
const LISTS = {
  achievements: L('Un logro por línea, con cifras si puedes. Ej.: «Mejor valoración de clientes de la tienda dos trimestres seguidos».', 'One achievement per line, with numbers if you can. E.g. “Highest customer rating in the shop two quarters running”.'),
  machinery: L('Una máquina, herramienta o vehículo por línea. Ej.: «Carretilla retráctil».', 'One machine, tool or vehicle per line. E.g. “Reach truck”.'),
};
export const listHint = (key) => pick(LISTS[key]) || pick(L('Escribe una cosa por línea.', 'Write one thing per line.'));

// Consejos por sector: puesto, perfil, tareas y competencias.
const SECTOR = {
  gen: {
    title: L('Ej.: Administrativa, Dependiente, Electricista', 'E.g. Office administrator, Sales assistant, Electrician'),
    profile: L('Di quién eres en el trabajo, cuánta experiencia tienes y qué se te da bien.', 'Say who you are at work, how much experience you have and what you are good at.'),
    profileEx: L('Administrativa con seis años de experiencia en facturación y atención telefónica. Ordenada y resolutiva. (Texto de ejemplo)', 'Office administrator with six years of experience in invoicing and phone support. Organised and practical. (Example text)'),
    job: L('Ej.: Administrativa, Mozo de almacén', 'E.g. Office administrator, Warehouse operative'),
    descEx: L('Preparaba unas 200 facturas al mes.\nAtendía a clientes por teléfono y correo.', 'Prepared around 200 invoices a month.\nSupported clients by phone and email.'),
    skills: L('Ej.: Hoja de cálculo, Atención al público, Trabajo en equipo', 'E.g. Spreadsheets, Customer care, Teamwork'),
  },
  hosteleria: {
    title: L('Ej.: Camarera de sala, Ayudante de cocina, Recepcionista de hotel', 'E.g. Waitress, Kitchen assistant, Hotel receptionist'),
    profile: L('Cuenta en qué tipo de locales has trabajado, tu ritmo y tu trato con el cliente.', 'Say what kind of venues you have worked in, your pace and how you deal with customers.'),
    profileEx: L('Camarera con cuatro temporadas en sala y terraza. Rápida, amable y acostumbrada a servicios con mucha gente. (Texto de ejemplo)', 'Waitress with four seasons of floor and terrace service. Quick, friendly and used to busy shifts. (Example text)'),
    job: L('Ej.: Camarera de sala, Cocinero', 'E.g. Waitress, Cook'),
    descEx: L('Atendía un rango de 8 mesas en comidas y cenas.\nCobraba en caja y cerraba turno.', 'Looked after 8 tables at lunch and dinner.\nHandled payments and closed the shift.'),
    skills: L('Ej.: Servicio en sala, Caja, Coctelería, Alérgenos', 'E.g. Table service, Till, Cocktails, Allergens'),
  },
  comercio: {
    title: L('Ej.: Dependiente, Cajera, Teleoperador', 'E.g. Sales assistant, Cashier, Call-centre agent'),
    profile: L('Habla de tu trato con el cliente y de un resultado del que estés orgulloso.', 'Talk about how you deal with customers and one result you are proud of.'),
    profileEx: L('Dependiente con cinco años en tienda. Me gusta escuchar al cliente y dar con lo que necesita. (Texto de ejemplo)', 'Sales assistant with five years in shops. I like listening to customers and finding what they need. (Example text)'),
    job: L('Ej.: Dependienta, Reponedor', 'E.g. Sales assistant, Shelf stacker'),
    descEx: L('Atención y venta en tienda.\nCaja, cambios y devoluciones.', 'Customer advice and sales on the shop floor.\nTills, exchanges and returns.'),
    skills: L('Ej.: Venta asesorada, Caja, Reclamaciones, Inventario', 'E.g. Assisted selling, Tills, Complaints, Stock counts'),
  },
  sanidad: {
    title: L('Ej.: Enfermera, Auxiliar de enfermería, Gerocultor', 'E.g. Nurse, Healthcare assistant, Care worker'),
    profile: L('Di en qué servicios o centros has trabajado y cómo es tu trato con pacientes y familias.', 'Say which services or centres you have worked in and how you deal with patients and families.'),
    profileEx: L('Auxiliar de enfermería con experiencia en planta de hospital y en residencia. Cercana y cuidadosa con los protocolos. (Texto de ejemplo)', 'Healthcare assistant with hospital ward and care home experience. Warm, and careful with procedures. (Example text)'),
    job: L('Ej.: Auxiliar de enfermería (pon la unidad en «Lugar»)', 'E.g. Healthcare assistant (put the ward under “Place”)'),
    descEx: L('Planta de traumatología, 28 camas.\nHigiene, movilización y toma de constantes.', 'Orthopaedic ward, 28 beds.\nPersonal care, moving and handling, observations.'),
    skills: L('Ej.: Toma de constantes, Movilización, Historia clínica', 'E.g. Observations, Moving and handling, Patient records'),
  },
  tecnologia: {
    title: L('Ej.: Desarrollador web, Técnica de sistemas, Analista de datos', 'E.g. Web developer, Systems technician, Data analyst'),
    profile: L('Di qué construyes, con qué y qué te importa al hacerlo.', 'Say what you build, what with, and what you care about when doing it.'),
    profileEx: L('Desarrollador web con cuatro años creando aplicaciones para tiendas en línea. Me importa que el código se entienda. (Texto de ejemplo)', 'Web developer with four years building applications for online shops. I care about readable code. (Example text)'),
    job: L('Ej.: Desarrolladora web, Técnico de soporte', 'E.g. Web developer, Support technician'),
    descEx: L('Rehíce el proceso de compra y bajó un 30 % el abandono.\nMantengo una biblioteca de componentes.', 'Rebuilt the checkout flow and cut abandonment by 30%.\nMaintain a component library.'),
    skills: L('Agrupa por tipo. Ej.: grupo «Lenguajes» con JavaScript, SQL', 'Group by type. E.g. a “Languages” group with JavaScript, SQL'),
  },
  oficios: {
    title: L('Ej.: Oficial de primera albañil, Electricista, Fontanero', 'E.g. Skilled bricklayer, Electrician, Plumber'),
    profile: L('Con una frase basta: tu oficio, los años que llevas y el tipo de obra.', 'One sentence is enough: your trade, your years of experience and the kind of work.'),
    profileEx: L('Oficial de albañilería con quince años en obra nueva y reformas. (Texto de ejemplo)', 'Bricklayer with fifteen years on new builds and refurbishments. (Example text)'),
    job: L('Ej.: Oficial de primera, Peón', 'E.g. Skilled tradesperson, Labourer'),
    descEx: L('Obra nueva de viviendas: tabiquería y solados.\nEncargado de una cuadrilla de 4 personas.', 'New-build housing: partitions and flooring.\nLed a crew of 4.'),
    skills: L('Ej.: Alicatado, Lectura de planos, Enlucido', 'E.g. Tiling, Reading drawings, Plastering'),
  },
  educacion: {
    title: L('Ej.: Maestra de Primaria, Profesor de Matemáticas, Educadora infantil', 'E.g. Primary teacher, Maths teacher, Early-years educator'),
    profile: L('Cuenta en qué etapas has dado clase y cómo trabajas en el aula.', 'Say which stages you have taught and how you work in the classroom.'),
    profileEx: L('Maestra de primaria con siete cursos como tutora. Trabajo por proyectos y cuido la relación con las familias. (Texto de ejemplo)', 'Primary teacher with seven years as a class teacher. I teach through projects and work closely with families. (Example text)'),
    job: L('Ej.: Tutora de 3.º de primaria', 'E.g. Year 3 class teacher'),
    descEx: L('Grupo de 24 alumnos.\nCoordino el plan de lectura del centro.', 'Class of 24 pupils.\nCoordinate the school reading plan.'),
    skills: L('Ej.: Aprendizaje cooperativo, Pizarra digital, Tutoría', 'E.g. Cooperative learning, Interactive whiteboards, Pastoral care'),
  },
  logistica: {
    title: L('Ej.: Mozo de almacén, Carretillera, Conductor de reparto', 'E.g. Warehouse operative, Forklift driver, Delivery driver'),
    profile: L('Di tu puesto, los años que llevas y qué máquinas o vehículos manejas.', 'Say your job, your years of experience and what machines or vehicles you operate.'),
    profileEx: L('Mozo de almacén con seis años en preparación de pedidos y carga de camiones. Puntual y cuidadoso con la mercancía. (Texto de ejemplo)', 'Warehouse operative with six years picking orders and loading lorries. Punctual and careful with goods. (Example text)'),
    job: L('Ej.: Carretillero, Repartidora', 'E.g. Forklift driver, Delivery driver'),
    descEx: L('Carga y descarga con carretilla retráctil.\nUnas 180 líneas de pedido por turno.', 'Loading and unloading with a reach truck.\nAround 180 order lines per shift.'),
    skills: L('Ej.: Preparación de pedidos, Lector de radiofrecuencia, Inventario', 'E.g. Order picking, Handheld scanners, Stock counts'),
  },
};
export function sectorHint(tplId, key) {
  const s = SECTOR[tplId] || SECTOR.gen;
  return pick(s[key] || SECTOR.gen[key]);
}
