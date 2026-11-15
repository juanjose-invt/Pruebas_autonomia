// Textos de la interfaz en español e inglés.
const STRINGS = {
  es: {
    appName: 'Corcho',
    boardTitleLabel: 'Nombre del tablero',
    addColumn: 'Columna',
    addColumnLong: 'Añadir columna',
    export: 'Exportar',
    import: 'Importar',
    exportLong: 'Exportar el tablero en JSON',
    importLong: 'Importar un tablero desde JSON',
    language: 'Idioma',
    addNote: 'Añadir nota',
    newNotePlaceholder: 'Escribe la nota y pulsa Intro',
    newColumnPlaceholder: 'Nombre de la columna',
    emptyColumn: 'Sin notas. Suelta una aquí o añade la primera.',
    emptyBoard: 'El corcho está vacío. Añade una columna para empezar.',
    columnOptions: 'Opciones de la columna {name}',
    rename: 'Renombrar',
    moveLeft: 'Mover a la izquierda',
    moveRight: 'Mover a la derecha',
    deleteColumn: 'Borrar columna',
    columnName: 'Nombre de la columna',
    noteCount: '{n} notas',
    noteCountOne: '1 nota',
    editorTitle: 'Editar nota',
    fieldTitle: 'Título',
    fieldNotes: 'Detalles',
    fieldColor: 'Color del pósit',
    fieldLabels: 'Etiquetas',
    fieldDue: 'Fecha límite',
    fieldColumn: 'Columna',
    fieldPosition: 'Posición',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    clearDate: 'Quitar fecha',
    renameLabels: 'Renombrar etiquetas',
    doneRenaming: 'Listo',
    labelName: 'Nombre de la etiqueta {color}',
    save: 'Guardar',
    cancel: 'Cancelar',
    deleteNote: 'Borrar nota',
    undo: 'Deshacer',
    noteDeleted: 'Nota borrada',
    columnDeleted: 'Columna borrada',
    boardImported: 'Tablero importado',
    boardExported: 'Tablero exportado',
    importError: 'Ese archivo no es un tablero válido. Elige un JSON exportado desde aquí.',
    saveError: 'No se ha podido guardar en este navegador. Exporta el tablero para no perder cambios.',
    untitled: 'Sin título',
    dueOverdue: 'Venció el {date}',
    dueToday: 'Vence hoy',
    dueTomorrow: 'Vence mañana',
    dueSoon: 'Vence el {date}',
    dueLater: 'Para el {date}',
    noteHint: 'Intro para editar. Espacio para cogerla y moverla con las flechas.',
    kbGrabbed: 'Nota cogida. Muévela con las flechas, Espacio para soltar, Escape para cancelar.',
    kbMoved: '{column}, posición {pos} de {total}',
    kbDropped: 'Nota soltada en {column}',
    kbCancelled: 'Movimiento cancelado',
    colors: { yellow: 'Amarillo', pink: 'Rosa', green: 'Verde', blue: 'Azul', orange: 'Naranja', lilac: 'Lila' },
    tagColors: { red: 'roja', orange: 'naranja', green: 'verde', blue: 'azul', purple: 'morada', graphite: 'gris' },
    signature: 'by innovativecode',
    signatureLabel: 'by innovativecode, volver al inicio',
  },
  en: {
    appName: 'Corkboard',
    boardTitleLabel: 'Board name',
    addColumn: 'Column',
    addColumnLong: 'Add column',
    export: 'Export',
    import: 'Import',
    exportLong: 'Export the board as JSON',
    importLong: 'Import a board from JSON',
    language: 'Language',
    addNote: 'Add note',
    newNotePlaceholder: 'Write the note and press Enter',
    newColumnPlaceholder: 'Column name',
    emptyColumn: 'No notes. Drop one here or add the first.',
    emptyBoard: 'The board is empty. Add a column to get started.',
    columnOptions: 'Options for column {name}',
    rename: 'Rename',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    deleteColumn: 'Delete column',
    columnName: 'Column name',
    noteCount: '{n} notes',
    noteCountOne: '1 note',
    editorTitle: 'Edit note',
    fieldTitle: 'Title',
    fieldNotes: 'Details',
    fieldColor: 'Note colour',
    fieldLabels: 'Labels',
    fieldDue: 'Due date',
    fieldColumn: 'Column',
    fieldPosition: 'Position',
    moveUp: 'Move up',
    moveDown: 'Move down',
    clearDate: 'Remove date',
    renameLabels: 'Rename labels',
    doneRenaming: 'Done',
    labelName: 'Name of the {color} label',
    save: 'Save',
    cancel: 'Cancel',
    deleteNote: 'Delete note',
    undo: 'Undo',
    noteDeleted: 'Note deleted',
    columnDeleted: 'Column deleted',
    boardImported: 'Board imported',
    boardExported: 'Board exported',
    importError: 'That file is not a valid board. Choose a JSON exported from here.',
    saveError: 'Could not save in this browser. Export the board so you do not lose changes.',
    untitled: 'Untitled',
    dueOverdue: 'Was due {date}',
    dueToday: 'Due today',
    dueTomorrow: 'Due tomorrow',
    dueSoon: 'Due {date}',
    dueLater: 'By {date}',
    noteHint: 'Enter to edit. Space to pick it up and move it with the arrow keys.',
    kbGrabbed: 'Note picked up. Move it with the arrow keys, Space to drop, Escape to cancel.',
    kbMoved: '{column}, position {pos} of {total}',
    kbDropped: 'Note dropped in {column}',
    kbCancelled: 'Move cancelled',
    colors: { yellow: 'Yellow', pink: 'Pink', green: 'Green', blue: 'Blue', orange: 'Orange', lilac: 'Lilac' },
    tagColors: { red: 'red', orange: 'orange', green: 'green', blue: 'blue', purple: 'purple', graphite: 'grey' },
    signature: 'by innovativecode',
    signatureLabel: 'by innovativecode, back to home',
  },
};

const KEY = 'kanban.lang';
let lang = 'es';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'es' || saved === 'en') lang = saved;
} catch { /* sin almacenamiento: se queda en español */ }

export const getLang = () => lang;

export function setLang(next) {
  if (next !== 'es' && next !== 'en') return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* no pasa nada */ }
}

export function t(key, vars) {
  let s = key.split('.').reduce((o, k) => (o == null ? o : o[k]), STRINGS[lang]);
  if (s == null) s = key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

// Aplica los textos a los elementos estáticos marcados en el HTML.
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)); });
}
