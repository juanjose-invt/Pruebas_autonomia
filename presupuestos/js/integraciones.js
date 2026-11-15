// =====================================================================================
// PUNTOS DE INTEGRACIÓN CON SERVIDOR (DESACTIVADOS)
// -------------------------------------------------------------------------------------
// Hoy esta app NO tiene servidor ni envía correos: el registro (correo + empresa o nombre)
// y los presupuestos se guardan SOLO en el navegador (localStorage), y la interfaz lo dice
// así de claro. Este archivo reúne los dos sitios donde, en el futuro, saldrían datos del
// dispositivo. Las funciones existen y la app las llama, pero el envío real está COMENTADO.
//
// ANTES DE ACTIVAR CUALQUIERA DE LOS DOS ENVÍOS hará falta, como mínimo:
//   1. Consentimiento explícito: una casilla SIN marcar por defecto en el formulario de
//      registro (y otra al enviar al cliente), con su texto, guardando fecha y versión.
//   2. Texto legal de protección de datos (RGPD/LOPDGDD): responsable del tratamiento,
//      finalidad, base jurídica, plazo de conservación, destinatarios y derechos, con
//      enlace a la política de privacidad. Si se usan los correos para comunicaciones
//      comerciales de Ofiza, consentimiento aparte para ello.
//   3. Cambiar los textos de la interfaz que hoy dicen «no sale de este dispositivo»
//      (claves 'reg.privacy' y 'foot.local' en js/i18n.js) para que sigan siendo ciertos.
//   4. Permitir el origen del servidor en la cabecera CSP de index.html (connect-src) y
//      decidir qué pasa sin conexión (cola de envíos pendientes en el service worker).
// =====================================================================================

// const ENDPOINT_CONTACTOS = 'https://api.ofiza.es/v1/leads/presupuestos';   // ← por definir
// const ENDPOINT_ENVIO_PRESUPUESTO = 'https://api.ofiza.es/v1/quotes/send'; // ← por definir

/**
 * 1) REGISTRO DE CONTACTO
 * Se llama cuando la persona rellena el formulario de «Antes de empezar».
 * Hoy: no hace nada fuera del dispositivo (el registro ya se ha guardado en local).
 *
 * Para conectarlo: un endpoint HTTPS propio (no un servicio de terceros desde el
 * navegador con clave expuesta) que reciba { email, nombre, empresa, autonomo, idioma,
 * consentimiento: { fecha, versionTexto } } y lo guarde en el CRM o la lista de Ofiza.
 * Sin clave en el cliente; proteger con límite de peticiones y validación en servidor.
 */
export async function enviarContacto(lead) {
  // if (!lead.consentimiento) return { enviado: false, motivo: 'sin-consentimiento' };
  // try {
  //   const res = await fetch(ENDPOINT_CONTACTOS, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       email: lead.email,
  //       nombre: lead.freelancer ? lead.name : null,
  //       empresa: lead.freelancer ? null : lead.company,
  //       autonomo: lead.freelancer,
  //       idioma: lead.lang,
  //       consentimiento: lead.consentimiento, // { fecha, versionTexto }
  //       origen: 'generador-presupuestos',
  //     }),
  //   });
  //   return { enviado: res.ok };
  // } catch {
  //   return { enviado: false, motivo: 'sin-conexion' }; // reintentar más tarde
  // }
  void lead;
  return { enviado: false, motivo: 'sin-servidor' };
}

/**
 * 2) ENVIAR EL PRESUPUESTO POR CORREO AL CLIENTE
 * Hoy no existe en la interfaz: el PDF se descarga y la persona lo envía por su cuenta.
 *
 * Para conectarlo: un endpoint que reciba el PDF (Blob generado en js/pdf.js), el correo
 * del cliente, el asunto y un mensaje, y lo envíe con un proveedor transaccional
 * (configurado en el servidor, con SPF/DKIM del dominio emisor). En la interfaz haría
 * falta un botón «Enviar al cliente» en el editor con un diálogo de confirmación que
 * muestre a quién se envía, y el aviso legal de que el correo del cliente se tratará
 * para ese envío (base jurídica: ejecución del encargo del emisor).
 */
export async function enviarPresupuestoPorCorreo({ pdfBlob, quote, para, asunto, mensaje }) {
  // const form = new FormData();
  // form.append('pdf', pdfBlob, `${quote.number}.pdf`);
  // form.append('para', para);
  // form.append('asunto', asunto);
  // form.append('mensaje', mensaje);
  // form.append('emisor', JSON.stringify(quote.issuer));
  // const res = await fetch(ENDPOINT_ENVIO_PRESUPUESTO, { method: 'POST', body: form });
  // return { enviado: res.ok };
  void pdfBlob; void quote; void para; void asunto; void mensaje;
  return { enviado: false, motivo: 'sin-servidor' };
}
