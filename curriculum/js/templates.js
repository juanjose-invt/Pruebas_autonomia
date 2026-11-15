// Plantillas del currículum. Cada una decide estructura y énfasis (orden de secciones, qué va en la
// columna lateral, cómo se pintan competencias, idiomas, fechas y la franja de datos clave), no solo el color.

export const FONTS = [
  { id: 'source-sans-3', css: 'Source Sans 3', kind: { es: 'Sin remates, neutra', en: 'Sans serif, neutral' }, adj: 1 },
  { id: 'source-serif-4', css: 'Source Serif 4', kind: { es: 'Con remates, seria', en: 'Serif, formal' }, adj: 0.97 },
  { id: 'libre-franklin', css: 'Libre Franklin', kind: { es: 'Sin remates, actual', en: 'Sans serif, contemporary' }, adj: 0.94 },
  { id: 'eb-garamond', css: 'EB Garamond', kind: { es: 'Con remates, clásica', en: 'Serif, classic' }, adj: 1.1 },
  { id: 'bitter', css: 'Bitter', kind: { es: 'Remates rectos, cálida', en: 'Slab serif, warm' }, adj: 0.94 },
  { id: 'atkinson-hyperlegible', css: 'Atkinson Hyperlegible', kind: { es: 'Muy fácil de leer', en: 'Very easy to read' }, adj: 0.97 },
];
export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

export const ACCENTS = [
  ['#1F3A5F', { es: 'Azul marino', en: 'Navy' }],
  ['#1D4E89', { es: 'Azul', en: 'Blue' }],
  ['#0F6B6B', { es: 'Verde azulado', en: 'Teal' }],
  ['#2F6B3C', { es: 'Verde', en: 'Green' }],
  ['#7A2E3A', { es: 'Burdeos', en: 'Burgundy' }],
  ['#9B2C5E', { es: 'Frambuesa', en: 'Raspberry' }],
  ['#6B2D5C', { es: 'Ciruela', en: 'Plum' }],
  ['#3B3FA0', { es: 'Añil', en: 'Indigo' }],
  ['#A8480F', { es: 'Teja', en: 'Rust' }],
  ['#33415C', { es: 'Pizarra', en: 'Slate' }],
  ['#1A1A1A', { es: 'Negro', en: 'Black' }],
];

// Tipos de sección. kind: text | entries | langs | skills | facts | list
export const SECTION_DEFS = {
  profile: { kind: 'text' },
  experience: { kind: 'entries' },
  education: { kind: 'entries' },
  languages: { kind: 'langs' },
  skills: { kind: 'skills' },
  courses: { kind: 'entries', compact: true, single: true },
  driving: { kind: 'facts' },
  volunteering: { kind: 'entries' },
  projects: { kind: 'entries' },
  references: { kind: 'entries', compact: true, noDates: true },
  // Propias de un sector
  availability: { kind: 'facts', sector: true },
  registration: { kind: 'facts', sector: true },
  achievements: { kind: 'list', sector: true },
  permits: { kind: 'facts', sector: true },
  machinery: { kind: 'list', sector: true },
  qualifications: { kind: 'facts', sector: true },
};
export const BASE_KEYS = ['profile', 'experience', 'education', 'languages', 'skills', 'courses', 'driving', 'volunteering', 'projects', 'references'];
const BASE_ON = ['profile', 'experience', 'education', 'languages', 'skills', 'courses', 'driving'];

const D = ['profile', 'experience', 'education', 'languages', 'skills', 'courses', 'driving', 'volunteering', 'projects', 'references'];

export const TEMPLATES = [
  {
    id: 'clasica', group: 'gen', sample: 'general',
    name: { es: 'Clásica', en: 'Classic' },
    desc: { es: 'Una columna, nombre centrado y letra con remates. Vale para casi todo.', en: 'One column, centred name and a serif face. Works almost anywhere.' },
    font: 'source-serif-4', accent: '#1F3A5F', cols: 1, side: 'right', sideStyle: 'plain',
    head: 'center', titles: 'rule', entry: 'right', skills: 'inline', langs: 'text', photo: false, photoShape: 'rect',
    order: D, sideKeys: ['languages', 'skills', 'driving', 'courses'],
  },
  {
    id: 'moderna', group: 'gen', sample: 'general',
    name: { es: 'Moderna', en: 'Modern' },
    desc: { es: 'Banda lateral de color con foto, contacto e idiomas; la experiencia en línea de tiempo.', en: 'Coloured side band with photo, contact and languages; experience as a timeline.' },
    font: 'libre-franklin', accent: '#0F6B6B', cols: 2, side: 'left', sideStyle: 'solid',
    head: 'left', headIn: 'main', contactIn: 'side', photoIn: 'side',
    titles: 'bar', entry: 'timeline', skills: 'tags', langs: 'dots', photo: true, photoShape: 'round',
    order: ['profile', 'experience', 'education', 'projects', 'volunteering', 'courses', 'references', 'languages', 'skills', 'driving'],
    sideKeys: ['languages', 'skills', 'driving'],
  },
  {
    id: 'compacta', group: 'gen', sample: 'general',
    name: { es: 'Compacta', en: 'Compact' },
    desc: { es: 'Pensada para que quepa en una página: letra pequeña, poco margen y fechas a la izquierda.', en: 'Built to fit one page: small type, narrow margins and dates on the left.' },
    font: 'source-sans-3', accent: '#33415C', cols: 2, side: 'right', sideStyle: 'plain',
    head: 'split', titles: 'upper', entry: 'left', skills: 'inline', langs: 'text', photo: false, photoShape: 'rect',
    size: 's', density: 'tight', margins: 'narrow',
    order: D, sideKeys: ['skills', 'languages', 'courses', 'driving'],
  },
  {
    id: 'sobria', group: 'gen', sample: 'general',
    name: { es: 'Sobria para filtros automáticos', en: 'Plain, for automatic screening' },
    desc: { es: 'Una sola columna, sin foto, sin color ni adornos y con títulos corrientes. Fácil de leer por los programas que filtran currículums.', en: 'A single column, no photo, colour or decoration, and ordinary headings. Easy for screening software to read.' },
    font: 'source-sans-3', accent: '#1A1A1A', cols: 1, fixedCols: true, noPhoto: true, plain: true,
    head: 'plain', titles: 'plain', entry: 'inline', skills: 'inline', langs: 'text', photo: false, contactLabels: true,
    order: ['profile', 'experience', 'education', 'skills', 'languages', 'courses', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: [],
  },
  {
    id: 'europea', group: 'eu', sample: 'general',
    name: { es: 'Estilo europeo', en: 'European style' },
    desc: { es: 'Estructura conocida en toda Europa: datos personales con rótulos, títulos a la izquierda e idiomas con la escala A1–C2.', en: 'A structure recognised across Europe: labelled personal details, headings on the left and languages on the A1–C2 scale.' },
    font: 'source-sans-3', accent: '#1D4E89', cols: 1, fixedCols: true, layout: 'label',
    head: 'euro', titles: 'label', entry: 'stack', skills: 'grid', langs: 'scale', photo: true, photoShape: 'rect', contactLabels: true,
    order: ['profile', 'experience', 'education', 'languages', 'skills', 'driving', 'courses', 'volunteering', 'projects', 'references'],
    sideKeys: [],
  },
  {
    id: 'hosteleria', group: 'sec', sample: 'hosteleria',
    name: { es: 'Hostelería y turismo', en: 'Hospitality and tourism' },
    desc: { es: 'Disponibilidad y turnos arriba del todo, idiomas bien visibles y la experiencia en frases cortas.', en: 'Availability and shifts right at the top, languages in plain sight and experience in short lines.' },
    font: 'bitter', accent: '#7A2E3A', cols: 2, side: 'left', sideStyle: 'tint',
    head: 'band', titles: 'bar', entry: 'right', skills: 'tags', langs: 'dots', photo: true, photoShape: 'round',
    strip: ['availability', 'driving'],
    order: ['profile', 'availability', 'experience', 'languages', 'skills', 'courses', 'education', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: ['languages', 'skills', 'courses'], extra: ['availability'],
  },
  {
    id: 'comercio', group: 'sec', sample: 'comercio',
    name: { es: 'Comercio y atención al cliente', en: 'Retail and customer service' },
    desc: { es: 'Los logros van justo después del perfil, con las competencias como etiquetas en una columna.', en: 'Achievements come straight after the profile, with skills as labels in a side column.' },
    font: 'libre-franklin', accent: '#9B2C5E', cols: 2, side: 'right', sideStyle: 'tint',
    head: 'left', titles: 'bar', entry: 'right', skills: 'tags', langs: 'dots', photo: true, photoShape: 'round',
    order: ['profile', 'achievements', 'experience', 'education', 'skills', 'languages', 'availability', 'courses', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: ['skills', 'languages', 'availability', 'driving', 'courses'], extra: ['achievements', 'availability'],
  },
  {
    id: 'sanidad', group: 'sec', sample: 'sanidad',
    name: { es: 'Sanidad y cuidados', en: 'Health and care' },
    desc: { es: 'La titulación y la colegiación van primero; los cursos, con sus horas, tienen sitio propio.', en: 'Qualifications and registration come first; courses, with their hours, get their own space.' },
    font: 'source-sans-3', accent: '#0F6B6B', cols: 1, side: 'right', sideStyle: 'tint',
    head: 'split', titles: 'fill', entry: 'left', skills: 'inline', langs: 'text', photo: false, photoShape: 'rect',
    courseTable: true,
    order: ['profile', 'education', 'registration', 'experience', 'courses', 'languages', 'skills', 'availability', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: ['registration', 'languages', 'skills', 'availability', 'driving'], extra: ['registration', 'availability'],
  },
  {
    id: 'administracion', group: 'sec', sample: 'general',
    name: { es: 'Administración y oficina', en: 'Administration and office' },
    desc: { es: 'Ordenada y formal: fechas a la izquierda, programas informáticos por grupos e idiomas en tabla.', en: 'Tidy and formal: dates on the left, software by group and languages in a table.' },
    font: 'source-serif-4', accent: '#33415C', cols: 1, side: 'right', sideStyle: 'plain',
    head: 'left', titles: 'rule', entry: 'left', skills: 'grid', langs: 'table', photo: false, photoShape: 'rect',
    titleKeys: { skills: 'tools' },
    order: ['profile', 'experience', 'education', 'skills', 'languages', 'courses', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: ['skills', 'languages', 'driving'],
  },
  {
    id: 'tecnologia', group: 'sec', sample: 'tecnologia',
    name: { es: 'Tecnología', en: 'Technology' },
    desc: { es: 'Las tecnologías por grupos van arriba; los proyectos, antes que la formación. Sin foto.', en: 'Technologies by group sit at the top; projects come before education. No photo.' },
    font: 'atkinson-hyperlegible', accent: '#3B3FA0', cols: 1, side: 'right', sideStyle: 'tint',
    head: 'left', titles: 'upper', entry: 'right', skills: 'grid', langs: 'text', photo: false, photoShape: 'rect',
    titleKeys: { skills: 'tech' },
    order: ['profile', 'skills', 'experience', 'projects', 'education', 'courses', 'languages', 'volunteering', 'driving', 'references'],
    sideKeys: ['skills', 'languages', 'courses'], on: ['projects'], off: ['driving'],
  },
  {
    id: 'oficios', group: 'sec', sample: 'oficios',
    name: { es: 'Construcción y oficios', en: 'Construction and trades' },
    desc: { es: 'Letra grande. Carnés y formación en prevención lo primero, con la maquinaria que manejas a la vista.', en: 'Large type. Cards and safety training first, with the machinery you operate in plain sight.' },
    font: 'atkinson-hyperlegible', accent: '#A8480F', cols: 1, side: 'right', sideStyle: 'tint',
    head: 'band', titles: 'fill', entry: 'right', skills: 'list', langs: 'text', photo: false, photoShape: 'rect', size: 'l',
    strip: ['driving'], listStyle: 'tags',
    order: ['profile', 'permits', 'experience', 'machinery', 'education', 'courses', 'skills', 'languages', 'driving', 'volunteering', 'projects', 'references'],
    sideKeys: ['permits', 'machinery', 'skills', 'languages'], extra: ['permits', 'machinery'], off: ['profile'],
  },
  {
    id: 'educacion', group: 'sec', sample: 'educacion',
    name: { es: 'Educación', en: 'Education' },
    desc: { es: 'La formación y las habilitaciones abren la hoja; después la experiencia docente y los proyectos educativos.', en: 'Education and qualifications open the page, followed by teaching experience and teaching projects.' },
    font: 'eb-garamond', accent: '#6B2D5C', cols: 1, side: 'right', sideStyle: 'plain',
    head: 'center', titles: 'center', entry: 'right', skills: 'inline', langs: 'table', photo: false, photoShape: 'rect',
    titleKeys: { projects: 'eduprojects' },
    order: ['profile', 'education', 'qualifications', 'experience', 'languages', 'courses', 'projects', 'volunteering', 'skills', 'driving', 'references'],
    sideKeys: ['qualifications', 'languages', 'skills'], extra: ['qualifications'], on: ['projects'],
  },
  {
    id: 'logistica', group: 'sec', sample: 'logistica',
    name: { es: 'Logística y transporte', en: 'Logistics and transport' },
    desc: { es: 'Permisos de conducir y disponibilidad en una franja bajo el nombre; vehículos y maquinaria en la columna.', en: 'Driving licences and availability in a strip under your name; vehicles and equipment in the side column.' },
    font: 'source-sans-3', accent: '#1D4E89', cols: 2, side: 'left', sideStyle: 'tint',
    head: 'left', titles: 'upper', entry: 'right', skills: 'list', langs: 'text', photo: false, photoShape: 'rect',
    strip: ['driving', 'availability'], titleKeys: { machinery: 'vehicles' }, listStyle: 'bullets',
    order: ['profile', 'driving', 'availability', 'experience', 'machinery', 'courses', 'education', 'languages', 'skills', 'volunteering', 'projects', 'references'],
    sideKeys: ['machinery', 'courses', 'languages', 'skills'], extra: ['availability', 'machinery'],
  },
];
export const tplById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
export const GROUPS = [
  ['gen', { es: 'Para cualquier trabajo', en: 'For any job' }],
  ['eu', { es: 'Estilo europeo', en: 'European style' }],
  ['sec', { es: 'Por sector', en: 'By sector' }],
];

let seq = 0;
export const uid = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export function newSection(key, extra = {}) {
  const def = SECTION_DEFS[key] || { kind: extra.kind || 'entries' };
  const s = { id: uid(), key, kind: def.kind, title: '', on: true };
  if (def.kind === 'text' || def.kind === 'list') s.text = '';
  else s.items = [];
  return Object.assign(s, extra);
}

export function sectionEmpty(s) {
  if (s.kind === 'text' || s.kind === 'list') return !(s.text || '').trim();
  return !(s.items || []).some((it) => Object.entries(it).some(([k, v]) => k !== 'id' && typeof v === 'string' && v.trim()));
}

export function newCV(tplId, name) {
  const cv = {
    id: uid(), name, created: Date.now(), updated: Date.now(),
    template: tplId, country: 'es', docLang: 'es',
    design: { accent: '', font: '', size: 'm', margins: 'normal', density: 'normal', columns: 1, photo: true, dateFormat: 'num', page: 'a4' },
    personal: { firstName: '', lastName: '', title: '', phone: '', email: '', city: '', web: '', linkedin: '', birth: '', nationality: '', permit: '', photo: '' },
    sections: BASE_KEYS.map((k) => newSection(k, { on: BASE_ON.includes(k) })),
  };
  applyTemplate(cv, tplId, true);
  return cv;
}

// Cambiar de plantilla reordena las secciones, añade las propias del sector y pone su diseño de partida.
export function applyTemplate(cv, tplId, fresh = false) {
  const prev = tplById(cv.template);
  const t = tplById(tplId);
  cv.template = t.id;
  // Quita las secciones de sector vacías que proponía la plantilla anterior y esta no usa.
  cv.sections = cv.sections.filter((s) => !(SECTION_DEFS[s.key]?.sector && sectionEmpty(s) && !(t.extra || []).includes(s.key)));
  for (const k of t.extra || []) if (!cv.sections.some((s) => s.key === k)) cv.sections.push(newSection(k));
  for (const k of t.on || []) { const s = cv.sections.find((x) => x.key === k); if (s && (fresh || sectionEmpty(s))) s.on = true; }
  if (fresh) for (const k of t.off || []) { const s = cv.sections.find((x) => x.key === k); if (s) s.on = false; }
  const pos = (s) => { const i = t.order.indexOf(s.key); return i < 0 ? 999 : i; };
  cv.sections = cv.sections.map((s, i) => [s, i]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map((x) => x[0]);
  const d = cv.design;
  d.accent = t.accent; d.font = t.font; d.columns = t.cols;
  d.size = t.size || 'm'; d.density = t.density || 'normal'; d.margins = t.margins || 'normal';
  if (fresh || prev.photo !== t.photo) d.photo = !!t.photo;
  if (t.noPhoto) d.photo = false;
  return cv;
}
