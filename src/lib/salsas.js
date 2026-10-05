// Salsas que el cliente puede elegir (sin costo) en los productos que las piden,
// por defecto las salchipapas. Se editan en Administración > Salsas.
// Mismos valores por defecto que opcionesSalsas() en api/place-order.php.
export const DEFAULT_SALSAS = { opciones: ['Rosada', 'De ajo', 'De piña', 'Roja'] };

export function normalizeSalsas(raw) {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const opciones = Array.isArray(cfg.opciones) ? cfg.opciones.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim()) : DEFAULT_SALSAS.opciones;
  return { opciones };
}
