// Ayudantes del pago: nombres, número de recibo y la foto del comprobante.

export const PAGO_LABEL = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata' };

// Consecutivo del recibo con ceros a la izquierda: 7 -> "0007".
export function numeroRecibo(consecutivo) {
  const n = Number(consecutivo);
  return Number.isFinite(n) && n > 0 ? String(n).padStart(4, '0') : '';
}

const LIMITE_BYTES = 1.8 * 1024 * 1024; // el servidor acepta hasta 3 MB, pero PHP suele cortar en 2 MB

// Reduce la foto del celular (varios MB) a una imagen JPEG liviana antes de
// subirla. Si el navegador no puede leerla, se manda tal cual siempre que sea chica.
export async function prepararFoto(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('Elige una foto o captura de pantalla.');
  try {
    const bmp = await createImageBitmap(file);
    const lado = Math.max(bmp.width, bmp.height);
    const k = lado > 1400 ? 1400 / lado : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * k));
    canvas.height = Math.max(1, Math.round(bmp.height * k));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const calidad of [0.82, 0.65, 0.5]) {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', calidad));
      if (blob && blob.size <= LIMITE_BYTES) return blob;
    }
  } catch {
    // cae al envío directo
  }
  if (file.size <= LIMITE_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  throw new Error('No se pudo preparar la foto. Prueba con una captura de pantalla.');
}

// Pedido por Nequi/Daviplata que todavía no tiene comprobante: se recuerda en
// este navegador 3 días para que el cliente pueda adjuntarlo después de pagar.
const CLAVE_PENDIENTE = 'housse_comprobante_pendiente';

export function guardarPendiente(datos) {
  try {
    localStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...datos, at: Date.now() }));
  } catch {
    // sin almacenamiento: el cliente igual puede adjuntar en el momento
  }
}

export function leerPendiente() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PENDIENTE) || 'null');
    if (!p || !p.orderId || !p.token || Date.now() - (p.at || 0) > 3 * 86400000) return null;
    return p;
  } catch {
    return null;
  }
}

export function borrarPendiente() {
  try {
    localStorage.removeItem(CLAVE_PENDIENTE);
  } catch {
    // nada
  }
}
