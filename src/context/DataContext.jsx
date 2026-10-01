import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAllData, saveAllData, ensureObject } from '../lib/api';
import { fechaHoyBogota } from '../lib/format';

const DataContext = createContext(null);

const DEFAULT_TAKEOUT = { enabled: false, fee: 0, domicilioFee: 0 };
const DEFAULT_OPEN = { mode: 'manual', abiertoManual: true, horario: { start: '', end: '' } };
const DEFAULT_DELIVERY_ZONE = { enabled: false, address: '', carreraFrom: '', carreraTo: '', calleFrom: '', calleTo: '' };

function normalize(raw) {
  const categories = raw.categories || [];
  categories.forEach((c) => {
    if (c.deliveryEnabled === undefined) c.deliveryEnabled = true;
    if (c.exentoEmpaque === undefined) c.exentoEmpaque = false;
  });

  const schedule = raw.schedule || [];
  const hoy = fechaHoyBogota();
  let changed = false;
  const resetStock = (filas) => {
    filas.forEach((f) => {
      if (f.stockDefinido === undefined) f.stockDefinido = f.stock ?? null;
      if (f.stockResetDate === undefined) f.stockResetDate = hoy;
      if (f.stockDefinido !== null && f.stockDefinido !== undefined && f.stockResetDate !== hoy) {
        f.stock = f.stockDefinido;
        f.stockResetDate = hoy;
        changed = true;
      }
    });
  };
  const singleMenuSchedule = Array.isArray(raw.singleMenuSchedule) ? raw.singleMenuSchedule : [];
  resetStock(schedule);
  resetStock(singleMenuSchedule);

  return {
    state: {
      categories,
      dishes: raw.dishes || [],
      schedule,
      menuMode: raw.menuMode === 'unico' ? 'unico' : 'semanal',
      singleMenuSchedule,
      takeoutConfig: ensureObject(raw.takeoutConfig, DEFAULT_TAKEOUT),
      businessOpenConfig: ensureObject(raw.businessOpenConfig, DEFAULT_OPEN),
      deliveryZoneConfig: ensureObject(raw.deliveryZoneConfig, DEFAULT_DELIVERY_ZONE),
      brandingConfig: ensureObject(raw.brandingConfig, {}),
      usersData: raw.usersData || [],
      n8nConfig: ensureObject(raw.n8nConfig, { apiKey: '' }),
      ordersData: raw.ordersData || [],
      notifyConfig: ensureObject(raw.notifyConfig, { resendApiKey: '', ownerEmail: '' }),
      // Nunca se edita desde aquí (eso lo hace set-mesero-credentials.php) --
      // solo necesita viajar de ida y vuelta en cada guardado para que un
      // guardado normal (editar platillos, etc.) no la borre de disco, igual
      // que n8nConfig/notifyConfig.
      meseroAuth: ensureObject(raw.meseroAuth, { usuario: '', passwordHash: '' }),
      // Nunca se edita desde este panel, pero save-data.php SOBRESCRIBE
      // data.json entero (no hace merge) -- si no la reenviamos tal cual en
      // cada guardado, cualquier acción de admin borraría el historial
      // permanente de ventas real del negocio.
      historialPedidos: raw.historialPedidos || [],
    },
    changed,
  };
}

export function DataProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const raw = await loadAllData();
      // El reinicio diario de stock ya lo hace load-data.php del lado del
      // servidor (antes se guardaba de vuelta desde el navegador de
      // CUALQUIER visitante, pero save-data.php ahora exige sesión admin).
      const { state: normalized } = normalize(raw);
      setState(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveAllData(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ state, loading, error, refresh, save }), [state, loading, error, refresh, save]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
