// Mismo backend PHP de siempre, sin tocarlo: solo cambia quién lo consume.

export async function loadAllData() {
  const res = await fetch('api/load-data.php?_=' + Date.now(), { cache: 'no-store' });
  return res.json();
}

export async function saveAllData(payload) {
  const res = await fetch('api/save-data.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('api/upload-image.php', { method: 'POST', body: formData });
  const result = await res.json();
  return result.success ? result.url : null;
}

export async function calcularEnvio(direccion) {
  const res = await fetch('api/calcular-envio.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direccion }),
  });
  return res.json();
}

// Si el pedido es por Nequi/Daviplata viaja como formulario: el pedido en "payload"
// y la foto del comprobante en "comprobante" (el servidor no lo acepta sin ella).
export async function placeOrder(payload, foto) {
  let init;
  if (foto) {
    const f = new FormData();
    f.append('payload', JSON.stringify(payload));
    f.append('comprobante', foto, 'comprobante.jpg');
    init = { method: 'POST', body: f };
  } else {
    init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  }
  const res = await fetch('api/place-order.php', init);
  try {
    return await res.json();
  } catch {
    return { success: false, error: 'No se pudo enviar el pedido. Intenta de nuevo.' };
  }
}

export async function getConfigStatus() {
  const res = await fetch('api/config-status.php');
  return res.json();
}

export async function verifyGoogleLogin(idToken) {
  const res = await fetch('api/verify-google.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  return res.json();
}

export async function loginMesero(usuario, clave) {
  const res = await fetch('api/login-mesero.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, clave }),
  });
  return res.json();
}

export async function setMeseroCredentials(usuario, clave) {
  const res = await fetch('api/set-mesero-credentials.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, clave }),
  });
  return res.json();
}

export async function fetchSession() {
  const res = await fetch('api/me.php', { cache: 'no-store' });
  return res.json();
}

export async function logoutSession() {
  const res = await fetch('api/logout.php', { method: 'POST' });
  return res.json();
}

export async function fetchMisPedidos() {
  const res = await fetch('api/mis-pedidos.php', { cache: 'no-store' });
  return res.json();
}

export async function eliminarCuenta() {
  const res = await fetch('api/eliminar-cuenta.php', { method: 'POST' });
  return res.json();
}

export function ensureObject(val, fallback) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  return fallback;
}
