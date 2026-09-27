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

export async function placeOrder(payload) {
  const res = await fetch('api/place-order.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getConfigStatus() {
  const res = await fetch('api/config-status.php');
  return res.json();
}

export function ensureObject(val, fallback) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  return fallback;
}
