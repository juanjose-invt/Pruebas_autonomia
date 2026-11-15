// Rótulos del DOCUMENTO (el currículum), independientes del idioma de la app.
// Orden de cada lista: es, en, fr, de, pt, it.

export const DOC_LANGS = [
  ['es', 'Español'], ['en', 'English'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['pt', 'Português'], ['it', 'Italiano'],
];
const IDX = { es: 0, en: 1, fr: 2, de: 3, pt: 4, it: 5 };

const L = {
  profile: ['Perfil', 'Profile', 'Profil', 'Profil', 'Perfil', 'Profilo'],
  experience: ['Experiencia laboral', 'Work experience', 'Expérience professionnelle', 'Berufserfahrung', 'Experiência profissional', 'Esperienza lavorativa'],
  education: ['Formación', 'Education', 'Formation', 'Ausbildung', 'Formação', 'Istruzione e formazione'],
  languages: ['Idiomas', 'Languages', 'Langues', 'Sprachen', 'Línguas', 'Lingue'],
  skills: ['Competencias', 'Skills', 'Compétences', 'Kenntnisse', 'Competências', 'Competenze'],
  courses: ['Cursos y certificados', 'Courses and certificates', 'Cours et certificats', 'Kurse und Zertifikate', 'Cursos e certificados', 'Corsi e certificati'],
  driving: ['Carné de conducir', 'Driving licence', 'Permis de conduire', 'Führerschein', 'Carta de condução', 'Patente di guida'],
  volunteering: ['Voluntariado', 'Volunteering', 'Bénévolat', 'Ehrenamt', 'Voluntariado', 'Volontariato'],
  projects: ['Proyectos', 'Projects', 'Projets', 'Projekte', 'Projetos', 'Progetti'],
  references: ['Referencias', 'References', 'Références', 'Referenzen', 'Referências', 'Referenze'],
  availability: ['Disponibilidad', 'Availability', 'Disponibilité', 'Verfügbarkeit', 'Disponibilidade', 'Disponibilità'],
  registration: ['Colegiación y habilitaciones', 'Registration and licences', 'Inscription et habilitations', 'Zulassungen und Registrierung', 'Inscrição e habilitações', 'Iscrizione e abilitazioni'],
  achievements: ['Logros', 'Achievements', 'Réalisations', 'Erfolge', 'Resultados', 'Risultati'],
  permits: ['Carnés y prevención', 'Cards and safety training', 'Habilitations et sécurité', 'Nachweise und Arbeitssicherheit', 'Cartões e segurança', 'Abilitazioni e sicurezza'],
  machinery: ['Maquinaria y herramientas', 'Machinery and tools', 'Machines et outils', 'Maschinen und Werkzeuge', 'Máquinas e ferramentas', 'Macchinari e attrezzi'],
  vehicles: ['Vehículos y maquinaria', 'Vehicles and equipment', 'Véhicules et engins', 'Fahrzeuge und Geräte', 'Veículos e equipamentos', 'Veicoli e mezzi'],
  qualifications: ['Habilitaciones y especialidades', 'Qualifications and specialisms', 'Habilitations et spécialités', 'Lehrbefähigungen und Fachgebiete', 'Habilitações e especialidades', 'Abilitazioni e specializzazioni'],
  tools: ['Herramientas informáticas', 'Software and tools', 'Outils informatiques', 'EDV-Kenntnisse', 'Ferramentas informáticas', 'Strumenti informatici'],
  tech: ['Tecnologías', 'Technologies', 'Technologies', 'Technologien', 'Tecnologias', 'Tecnologie'],
  eduprojects: ['Proyectos educativos', 'Teaching projects', 'Projets pédagogiques', 'Pädagogische Projekte', 'Projetos educativos', 'Progetti didattici'],
  custom: ['Otros datos', 'Additional information', 'Informations complémentaires', 'Weitere Angaben', 'Outras informações', 'Altre informazioni'],
  contact: ['Contacto', 'Contact', 'Contact', 'Kontakt', 'Contacto', 'Contatti'],
  personal: ['Datos personales', 'Personal details', 'Informations personnelles', 'Persönliche Daten', 'Dados pessoais', 'Dati personali'],
  phone: ['Teléfono', 'Phone', 'Téléphone', 'Telefon', 'Telefone', 'Telefono'],
  email: ['Correo', 'Email', 'E-mail', 'E-Mail', 'E-mail', 'E-mail'],
  location: ['Localidad', 'Location', 'Ville', 'Wohnort', 'Localidade', 'Località'],
  web: ['Web', 'Website', 'Site web', 'Website', 'Website', 'Sito web'],
  linkedin: ['LinkedIn', 'LinkedIn', 'LinkedIn', 'LinkedIn', 'LinkedIn', 'LinkedIn'],
  birth: ['Fecha de nacimiento', 'Date of birth', 'Date de naissance', 'Geburtsdatum', 'Data de nascimento', 'Data di nascita'],
  nationality: ['Nacionalidad', 'Nationality', 'Nationalité', 'Staatsangehörigkeit', 'Nacionalidade', 'Nazionalità'],
  permit: ['Permiso de trabajo', 'Work permit', 'Permis de travail', 'Arbeitserlaubnis', 'Autorização de trabalho', 'Permesso di lavoro'],
  present: ['Actualidad', 'Present', 'Aujourd’hui', 'heute', 'Atualidade', 'Presente'],
  native: ['Lengua materna', 'Native', 'Langue maternelle', 'Muttersprache', 'Língua materna', 'Madrelingua'],
  A1: ['Principiante', 'Beginner', 'Débutant', 'Anfänger', 'Iniciante', 'Principiante'],
  A2: ['Básico', 'Elementary', 'Élémentaire', 'Grundkenntnisse', 'Básico', 'Elementare'],
  B1: ['Intermedio', 'Intermediate', 'Intermédiaire', 'Mittelstufe', 'Intermédio', 'Intermedio'],
  B2: ['Intermedio alto', 'Upper intermediate', 'Intermédiaire avancé', 'Gute Mittelstufe', 'Intermédio alto', 'Intermedio superiore'],
  C1: ['Avanzado', 'Advanced', 'Avancé', 'Fortgeschritten', 'Avançado', 'Avanzato'],
  C2: ['Dominio', 'Proficient', 'Maîtrise', 'Annähernd muttersprachlich', 'Proficiente', 'Padronanza'],
  thLang: ['Idioma', 'Language', 'Langue', 'Sprache', 'Língua', 'Lingua'],
  thLevel: ['Nivel', 'Level', 'Niveau', 'Niveau', 'Nível', 'Livello'],
  thCert: ['Certificado', 'Certificate', 'Certificat', 'Zertifikat', 'Certificado', 'Certificato'],
};

export function dl(key, lang) {
  const row = L[key];
  if (!row) return key;
  return row[IDX[lang] ?? 0] ?? row[0];
}
export const hasLabel = (key) => !!L[key];

export const LEVELS = ['native', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const levelRank = (lv) => (lv === 'native' ? 6 : Math.max(0, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(lv) + 1));

// Fechas: se guardan como "AAAA" o "AAAA-MM".
const monthCache = {};
function monthName(lang, m, style) {
  const k = lang + style + m;
  if (!monthCache[k]) {
    let s;
    try { s = new Intl.DateTimeFormat(lang, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2020, m - 1, 15))); }
    catch { s = String(m).padStart(2, '0'); }
    monthCache[k] = s.replace(/\.$/, '');
  }
  return monthCache[k];
}
export function fmtDate(value, fmt, lang) {
  if (!value) return '';
  const [y, m] = String(value).split('-');
  const mi = parseInt(m, 10);
  if (!mi || fmt === 'year') return y;
  if (fmt === 'num') return String(mi).padStart(2, '0') + '/' + y;
  if (fmt === 'long') return monthName(lang, mi, 'long') + ' ' + y;
  return monthName(lang, mi, 'short') + ' ' + y;
}
export function fmtRange(item, fmt, lang) {
  const a = fmtDate(item.start, fmt, lang);
  const b = item.current ? dl('present', lang) : fmtDate(item.end, fmt, lang);
  if (a && b) return a + ' – ' + b;
  return a || b || '';
}
