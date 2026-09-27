export function formatCurrency(input) {
  const digits = String(input).replace(/\D/g, '');
  return `$ ${parseInt(digits || '0', 10).toLocaleString('es-CO')}`;
}

export function parseCurrencyNumber(formatted) {
  return parseInt(String(formatted).replace(/\D/g, ''), 10) || 0;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function nombreDiaHoy() {
  return DIAS[new Date().getDay()];
}

export function fechaHoyBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function newCartKey() {
  return 'c' + Date.now() + Math.random().toString(36).slice(2, 7);
}
