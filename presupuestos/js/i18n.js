// Textos de la interfaz y del PDF en español (por defecto) e inglés.
import { load, save } from './store.js';

const ES = {
  'app.name': 'Presupuestos',
  'app.by': 'de Ofiza',
  'nav.quotes': 'Presupuestos',
  'nav.clients': 'Clientes',
  'nav.main': 'Secciones',
  'lang.label': 'Idioma',

  'home.title': 'Tus presupuestos',
  'home.lead': 'Rellena los datos, mira el documento mientras escribes y descárgalo en PDF. Todo se guarda en este dispositivo.',
  'home.new': 'Nuevo presupuesto',
  'home.empty.title': 'Aún no hay presupuestos',
  'home.empty.text': 'Empieza por el primero: tus datos, los del cliente y lo que vas a hacer. El PDF sale listo para enviar.',
  'home.empty.cta': 'Hacer mi primer presupuesto',
  'home.count': '{n} guardados',
  'home.count1': '1 guardado',

  'plan.title': 'Plan gratuito',
  'plan.used': 'Has creado {n} de 3 presupuestos gratis',
  'plan.left': 'Te quedan {n}',
  'plan.left1': 'Te queda 1',
  'plan.none': 'Ya no te quedan presupuestos nuevos',
  'plan.note': 'Cuentan los que creas, aunque luego los borres. Los que ya tienes siempre podrás abrirlos, editarlos y descargarlos.',
  'plan.unregistered': 'Gratis para 3 presupuestos. Solo te pedimos un correo y tu nombre o el de tu empresa.',

  'ofiza.nudge': '¿Quieres facturar y cobrar también?',
  'ofiza.nudgeLink': 'Conoce Ofiza',
  'ofiza.side': '¿Te lo aceptan? Con Ofiza lo conviertes en factura y lo cobras desde el móvil.',

  'row.edit': 'Editar',
  'row.duplicate': 'Duplicar',
  'row.pdf': 'Descargar PDF',
  'row.delete': 'Borrar',
  'row.validUntil': 'válido hasta {d}',
  'row.noClient': 'Sin cliente',

  'kind.quote': 'Presupuesto',
  'kind.proforma': 'Proforma',

  'clients.title': 'Clientes',
  'clients.lead': 'Se guardan solos al hacer un presupuesto. También puedes añadirlos aquí.',
  'clients.new': 'Nuevo cliente',
  'clients.empty.title': 'Aún no hay clientes',
  'clients.empty.text': 'Cuando guardes un presupuesto, su cliente aparecerá aquí para reutilizarlo.',
  'clients.quotes': '{n} presupuestos',
  'clients.quotes1': '1 presupuesto',
  'clients.quotes0': 'Sin presupuestos',
  'clients.edit': 'Editar cliente',
  'clients.delete': 'Borrar cliente',
  'clients.save': 'Guardar cliente',
  'clients.saved': 'Cliente guardado',
  'clients.deleted': 'Cliente borrado',
  'clients.confirmDelete': '¿Borrar a {name}?',
  'clients.confirmDeleteText': 'Los presupuestos que ya tiene conservan sus datos.',

  'reg.title': 'Antes de empezar',
  'reg.lead': 'El generador es gratis para 3 presupuestos. Dinos quién eres:',
  'reg.email': 'Correo electrónico',
  'reg.company': 'Nombre de la empresa',
  'reg.name': 'Tu nombre',
  'reg.freelancer': 'Soy autónomo',
  'reg.freelancerHint': 'Te pediremos tu nombre en lugar del de la empresa.',
  'reg.privacy': 'Estos datos se guardan solo en este dispositivo. No se envían a ningún servidor ni a Ofiza.',
  'reg.submit': 'Empezar mi presupuesto',
  'reg.cancel': 'Ahora no',
  'reg.errEmail': 'Escribe un correo válido, por ejemplo nombre@dominio.es.',
  'reg.errName': 'Escribe tu nombre.',
  'reg.errCompany': 'Escribe el nombre de la empresa.',

  'limit.title': 'Ya has creado tus 3 presupuestos gratis',
  'limit.lead': 'Si presupuestas a menudo, Ofiza es la app que hemos hecho para autónomos y pequeñas empresas: presupuesto, factura y cobro desde el móvil, el mismo día que terminas el trabajo.',
  'limit.p1t': 'Presupuesto',
  'limit.p1': 'Lo preparas en el móvil delante del cliente.',
  'limit.p2t': 'Factura',
  'limit.p2': 'Cuando lo acepta, pasa a factura sin volver a escribirlo.',
  'limit.p3t': 'Cobro',
  'limit.p3': 'Y lo cobras al terminar, sin esperar a fin de mes.',
  'limit.cta': 'Conocer Ofiza',
  'limit.back': 'Volver a mis presupuestos',
  'limit.keep': 'Tus presupuestos siguen aquí: puedes abrirlos, editarlos y descargar su PDF cuando quieras.',

  'ed.newTitle': 'Nuevo presupuesto',
  'ed.back': 'Mis presupuestos',
  'ed.save': 'Guardar',
  'ed.saved': 'Guardado',
  'ed.pdf': 'Descargar PDF',
  'ed.pdfDone': 'PDF descargado',
  'ed.pdfFail': 'No se ha podido generar el PDF. Vuelve a intentarlo.',
  'ed.tabEdit': 'Editar',
  'ed.tabPreview': 'Vista previa',
  'ed.unsaved': 'Tienes cambios sin guardar',
  'ed.unsavedText': 'Si sales ahora, se perderán.',
  'ed.leave': 'Salir sin guardar',
  'ed.stay': 'Seguir editando',
  'ed.fix': 'Revisa los campos marcados.',
  'ed.notFound': 'Ese presupuesto ya no existe.',

  'sec.doc': 'Documento',
  'sec.issuer': 'Tus datos',
  'sec.client': 'Cliente',
  'sec.lines': 'Conceptos',
  'sec.taxes': 'Impuestos y total',
  'sec.notes': 'Notas y condiciones',

  'f.kind': 'Tipo de documento',
  'f.number': 'Número',
  'f.date': 'Fecha',
  'f.valid': 'Validez',
  'f.validDays': '{n} días',
  'f.logo': 'Logotipo',
  'f.logoAdd': 'Subir logotipo',
  'f.logoChange': 'Cambiar',
  'f.logoRemove': 'Quitar',
  'f.logoHint': 'PNG o JPG. Se queda en este dispositivo.',
  'f.logoErr': 'No se ha podido leer esa imagen. Prueba con un PNG o JPG.',
  'f.issuerName': 'Nombre o empresa',
  'f.nif': 'NIF / CIF',
  'f.address': 'Dirección',
  'f.email': 'Correo',
  'f.phone': 'Teléfono',
  'f.remember': 'Usar estos datos en mis próximos presupuestos',
  'f.savedClient': 'Cliente guardado',
  'f.savedClientNone': 'Elegir un cliente guardado',
  'f.clientName': 'Nombre o empresa del cliente',
  'f.desc': 'Descripción',
  'f.qty': 'Cant.',
  'f.price': 'Precio',
  'f.disc': 'Dto. %',
  'f.amount': 'Importe',
  'f.addLine': 'Añadir concepto',
  'f.removeLine': 'Quitar concepto',
  'f.descPh': 'Qué vas a hacer o entregar',
  'f.vat': 'IVA',
  'f.vatOther': 'Otro',
  'f.irpf': 'Aplicar retención de IRPF',
  'f.irpfRate': 'Retención',
  'f.notes': 'Notas',
  'f.notesPh': 'Detalles del trabajo, plazos, materiales incluidos…',
  'f.terms': 'Condiciones',
  'f.termsPh': 'Forma de pago, anticipo, garantía…',
  'f.required': 'Obligatorio',
  'f.lineRequired': 'Añade al menos un concepto con descripción.',

  't.base': 'Base imponible',
  't.vat': 'IVA ({r} %)',
  't.irpf': 'Retención IRPF ({r} %)',
  't.total': 'Total',

  'doc.number': 'Nº',
  'doc.date': 'Fecha',
  'doc.validUntil': 'Válido hasta',
  'doc.to': 'Cliente',
  'doc.from': 'Emisor',
  'doc.notes': 'Notas',
  'doc.terms': 'Condiciones',
  'doc.page': 'Página {p} de {n}',
  'doc.madeWith': 'Hecho con el generador gratuito de Ofiza (ofiza.es)',
  'doc.empty': 'Aún no hay conceptos',
  'doc.nif': 'NIF',

  'c.cancel': 'Cancelar',
  'c.delete': 'Borrar',
  'c.close': 'Cerrar',
  'q.confirmDelete': '¿Borrar el presupuesto {num}?',
  'q.confirmDeleteText': 'No se puede deshacer. Borrarlo no te devuelve un presupuesto gratis.',
  'q.deleted': 'Presupuesto borrado',
  'q.duplicated': 'Presupuesto duplicado',

  'foot.local': 'Tus datos no salen de este dispositivo: no hay servidor ni cuentas.',
  'foot.notInvoice': 'Sirve para presupuestos y proformas. No es un programa de facturación.',
  'foot.ofiza': 'Ofiza',
  'foot.by': 'by innovativecode',
  'offline': 'Sin conexión: todo sigue funcionando.',
};

const EN = {
  'app.name': 'Quotes',
  'app.by': 'by Ofiza',
  'nav.quotes': 'Quotes',
  'nav.clients': 'Clients',
  'nav.main': 'Sections',
  'lang.label': 'Language',

  'home.title': 'Your quotes',
  'home.lead': 'Fill in the details, watch the document take shape as you type and download it as a PDF. Everything stays on this device.',
  'home.new': 'New quote',
  'home.empty.title': 'No quotes yet',
  'home.empty.text': 'Start with the first one: your details, your client’s and the work. The PDF comes out ready to send.',
  'home.empty.cta': 'Make my first quote',
  'home.count': '{n} saved',
  'home.count1': '1 saved',

  'plan.title': 'Free plan',
  'plan.used': 'You have created {n} of 3 free quotes',
  'plan.left': '{n} left',
  'plan.left1': '1 left',
  'plan.none': 'No new quotes left',
  'plan.note': 'Every quote you create counts, even if you delete it later. You can always open, edit and download the ones you have.',
  'plan.unregistered': 'Free for 3 quotes. We only ask for an email and your name or your company’s.',

  'ofiza.nudge': 'Want to invoice and get paid too?',
  'ofiza.nudgeLink': 'Meet Ofiza',
  'ofiza.side': 'Accepted? With Ofiza you turn it into an invoice and get paid from your phone.',

  'row.edit': 'Edit',
  'row.duplicate': 'Duplicate',
  'row.pdf': 'Download PDF',
  'row.delete': 'Delete',
  'row.validUntil': 'valid until {d}',
  'row.noClient': 'No client',

  'kind.quote': 'Quote',
  'kind.proforma': 'Pro forma',

  'clients.title': 'Clients',
  'clients.lead': 'They are saved automatically when you make a quote. You can also add them here.',
  'clients.new': 'New client',
  'clients.empty.title': 'No clients yet',
  'clients.empty.text': 'When you save a quote, its client shows up here so you can reuse it.',
  'clients.quotes': '{n} quotes',
  'clients.quotes1': '1 quote',
  'clients.quotes0': 'No quotes',
  'clients.edit': 'Edit client',
  'clients.delete': 'Delete client',
  'clients.save': 'Save client',
  'clients.saved': 'Client saved',
  'clients.deleted': 'Client deleted',
  'clients.confirmDelete': 'Delete {name}?',
  'clients.confirmDeleteText': 'Their existing quotes keep their details.',

  'reg.title': 'Before you start',
  'reg.lead': 'The generator is free for 3 quotes. Tell us who you are:',
  'reg.email': 'Email',
  'reg.company': 'Company name',
  'reg.name': 'Your name',
  'reg.freelancer': 'I’m self-employed',
  'reg.freelancerHint': 'We’ll ask for your name instead of a company name.',
  'reg.privacy': 'These details are stored only on this device. They are not sent to any server or to Ofiza.',
  'reg.submit': 'Start my quote',
  'reg.cancel': 'Not now',
  'reg.errEmail': 'Enter a valid email, for example name@domain.com.',
  'reg.errName': 'Enter your name.',
  'reg.errCompany': 'Enter the company name.',

  'limit.title': 'You have created your 3 free quotes',
  'limit.lead': 'If you quote often, Ofiza is the app we built for the self-employed and small businesses: quote, invoice and payment from your phone, the same day you finish the job.',
  'limit.p1t': 'Quote',
  'limit.p1': 'Prepare it on your phone in front of the client.',
  'limit.p2t': 'Invoice',
  'limit.p2': 'Once accepted, it becomes an invoice without retyping.',
  'limit.p3t': 'Payment',
  'limit.p3': 'And you get paid when you finish, not at the end of the month.',
  'limit.cta': 'Meet Ofiza',
  'limit.back': 'Back to my quotes',
  'limit.keep': 'Your quotes are still here: open, edit and download their PDF whenever you like.',

  'ed.newTitle': 'New quote',
  'ed.back': 'My quotes',
  'ed.save': 'Save',
  'ed.saved': 'Saved',
  'ed.pdf': 'Download PDF',
  'ed.pdfDone': 'PDF downloaded',
  'ed.pdfFail': 'The PDF could not be generated. Try again.',
  'ed.tabEdit': 'Edit',
  'ed.tabPreview': 'Preview',
  'ed.unsaved': 'You have unsaved changes',
  'ed.unsavedText': 'If you leave now, they will be lost.',
  'ed.leave': 'Leave without saving',
  'ed.stay': 'Keep editing',
  'ed.fix': 'Check the highlighted fields.',
  'ed.notFound': 'That quote no longer exists.',

  'sec.doc': 'Document',
  'sec.issuer': 'Your details',
  'sec.client': 'Client',
  'sec.lines': 'Items',
  'sec.taxes': 'Taxes and total',
  'sec.notes': 'Notes and terms',

  'f.kind': 'Document type',
  'f.number': 'Number',
  'f.date': 'Date',
  'f.valid': 'Valid for',
  'f.validDays': '{n} days',
  'f.logo': 'Logo',
  'f.logoAdd': 'Upload logo',
  'f.logoChange': 'Change',
  'f.logoRemove': 'Remove',
  'f.logoHint': 'PNG or JPG. It stays on this device.',
  'f.logoErr': 'That image could not be read. Try a PNG or JPG.',
  'f.issuerName': 'Name or company',
  'f.nif': 'Tax ID',
  'f.address': 'Address',
  'f.email': 'Email',
  'f.phone': 'Phone',
  'f.remember': 'Use these details in my next quotes',
  'f.savedClient': 'Saved client',
  'f.savedClientNone': 'Choose a saved client',
  'f.clientName': 'Client name or company',
  'f.desc': 'Description',
  'f.qty': 'Qty',
  'f.price': 'Price',
  'f.disc': 'Disc. %',
  'f.amount': 'Amount',
  'f.addLine': 'Add item',
  'f.removeLine': 'Remove item',
  'f.descPh': 'What you will do or deliver',
  'f.vat': 'VAT',
  'f.vatOther': 'Other',
  'f.irpf': 'Apply IRPF withholding',
  'f.irpfRate': 'Withholding',
  'f.notes': 'Notes',
  'f.notesPh': 'Job details, timings, materials included…',
  'f.terms': 'Terms',
  'f.termsPh': 'Payment method, deposit, warranty…',
  'f.required': 'Required',
  'f.lineRequired': 'Add at least one item with a description.',

  't.base': 'Subtotal',
  't.vat': 'VAT ({r} %)',
  't.irpf': 'IRPF withholding ({r} %)',
  't.total': 'Total',

  'doc.number': 'No.',
  'doc.date': 'Date',
  'doc.validUntil': 'Valid until',
  'doc.to': 'Client',
  'doc.from': 'From',
  'doc.notes': 'Notes',
  'doc.terms': 'Terms',
  'doc.page': 'Page {p} of {n}',
  'doc.madeWith': 'Made with Ofiza’s free quote generator (ofiza.es)',
  'doc.empty': 'No items yet',
  'doc.nif': 'Tax ID',

  'c.cancel': 'Cancel',
  'c.delete': 'Delete',
  'c.close': 'Close',
  'q.confirmDelete': 'Delete quote {num}?',
  'q.confirmDeleteText': 'This cannot be undone. Deleting it does not give you a free quote back.',
  'q.deleted': 'Quote deleted',
  'q.duplicated': 'Quote duplicated',

  'foot.local': 'Your data never leaves this device: no server, no accounts.',
  'foot.notInvoice': 'Made for quotes and pro forma documents. It is not invoicing software.',
  'foot.ofiza': 'Ofiza',
  'foot.by': 'by innovativecode',
  'offline': 'Offline: everything keeps working.',
};

const DICTS = { es: ES, en: EN };
let lang = load('lang', null) || 'es';
if (!DICTS[lang]) lang = 'es';

export function getLang() { return lang; }
export function setLang(l) {
  if (!DICTS[l]) return;
  lang = l;
  save('lang', l);
}

export function t(key, vars) {
  let s = (DICTS[lang] && DICTS[lang][key]) ?? ES[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, String(vars[k]));
  return s;
}

// Importes: se formatean a mano para que la pantalla y el PDF coincidan
// (Intl en es-ES no agrupa los miles en cifras de cuatro dígitos).
export function money(n, l = lang) {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const sep = l === 'es' ? '.' : ',';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (l === 'es') return `${neg ? '−' : ''}${grouped},${dec} €`;
  return `${neg ? '−' : ''}€${grouped}.${dec}`;
}

export function num(n, l = lang) {
  const r = Math.round(n * 1000) / 1000;
  let s = String(r);
  if (l === 'es') s = s.replace('.', ',');
  return s;
}

export function date(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
