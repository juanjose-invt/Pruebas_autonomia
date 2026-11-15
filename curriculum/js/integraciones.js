// PUNTO DE INTEGRACIÓN FUTURO: enviar o compartir el currículum por un servicio externo.
//
// Hoy la aplicación no envía nada a ningún sitio: el PDF se crea en el dispositivo y solo se descarga.
// Esta función se llama justo después de crear el PDF (ver exportPdf en app.js) y, a propósito, no hace nada.
//
// Qué habría que conectar aquí cuando exista un servicio:
//   - Compartir desde el propio dispositivo (sin servidor): navigator.share({ files: [new File([blob], filename)] }),
//     comprobando antes navigator.canShare. No necesita claves; solo un botón «Compartir» en la interfaz.
//   - Enviar por correo o a un portal de empleo: haría falta un servidor propio (o un servicio de envío)
//     que reciba el PDF por POST (multipart/form-data) con el destinatario; nunca claves en este código.
//   - Enlace público al currículum: subir el PDF a un almacenamiento y devolver la dirección.
// En cualquiera de los casos: pedir permiso expreso antes de que el archivo salga del dispositivo
// y decir con claridad a dónde va. La foto y los datos personales son del usuario.
//
// eslint-disable-next-line no-unused-vars
export function afterPdfReady({ blob, filename, cv }) {
  // Ejemplo (desactivado) de lo que iría aquí:
  //
  // const file = new File([blob], filename, { type: 'application/pdf' });
  // if (navigator.canShare && navigator.canShare({ files: [file] })) {
  //   await navigator.share({ files: [file], title: filename });
  // }
  //
  // await fetch('https://servicio-propio.example/enviar', { method: 'POST', body: formDataConElPdf });
}
