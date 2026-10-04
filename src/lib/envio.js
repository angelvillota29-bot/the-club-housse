// Domicilio por distancia (Google Maps). Mismos valores por defecto que
// api/_envio.php. Está apagado hasta que se active en Administración >
// Domicilio y exista la clave de Google en el servidor.
export const DEFAULT_ENVIO = {
  enabled: false,
  origen: { direccion: 'Cra 26P10 # 93-60, Marroquín I, Cali', lat: null, lng: null },
  ciudad: 'Cali, Valle del Cauca, Colombia',
  maxKm: 12,
  tramos: [
    { hastaKm: 0.5, precio: 2000 },
    { hastaKm: 1.5, precio: 3000 },
    { hastaKm: 3, precio: 4000 },
    { hastaKm: 5, precio: 6000 },
    { hastaKm: 8, precio: 8000 },
    { hastaKm: 12, precio: 10000 },
  ],
};

export function normalizeEnvio(raw) {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...DEFAULT_ENVIO,
    ...cfg,
    enabled: !!cfg.enabled,
    origen: { ...DEFAULT_ENVIO.origen, ...(cfg.origen && typeof cfg.origen === 'object' ? cfg.origen : {}) },
    tramos: Array.isArray(cfg.tramos) && cfg.tramos.length ? cfg.tramos : DEFAULT_ENVIO.tramos,
  };
}
