// Reglas de dominio del menú de The Club Housse -- porteadas del script.js
// real: sin combos/roles, con tipoEntrega (domicilio/recoger/comer_aqui) y
// businessOpenConfig en vez de franjas de comida.
import { parseCurrencyNumber, timeToMinutes } from './format';

export function getMenuItemForDay(state, dishId, day) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return null;
  const sched =
    state.menuMode === 'unico'
      ? state.singleMenuSchedule.find((s) => s.dishId === dishId)
      : state.schedule.find((s) => s.day === day && s.dishId === dishId);
  if (!sched) return null;
  return { id: dish.id, name: dish.name, price: dish.price, scheduleId: sched.id, available: sched.available, stock: sched.stock };
}

export function categoryForDish(state, dishId) {
  const dish = state.dishes.find((d) => d.id === dishId);
  return state.categories.find((c) => c.id === dish?.categoryId) || null;
}

// Cargo de empaque por platillo (skip en comer_aqui, si takeout está
// deshabilitado, o si la categoría está exenta).
export function empaqueFeeFor(takeoutConfig, cat, tipoEntrega) {
  if (!takeoutConfig.enabled || tipoEntrega === 'comer_aqui' || cat?.exentoEmpaque) return 0;
  return takeoutConfig.fee || 0;
}

// Cargo de domicilio: una sola vez por pedido, solo si tipoEntrega === 'domicilio'.
export function domicilioFeeFor(takeoutConfig, tipoEntrega) {
  return tipoEntrega === 'domicilio' ? takeoutConfig.domicilioFee || 0 : 0;
}

export function isBusinessOpen(businessOpenConfig) {
  if (!businessOpenConfig) return true;
  if (businessOpenConfig.mode === 'manual') return !!businessOpenConfig.abiertoManual;
  const { start, end } = businessOpenConfig.horario || {};
  if (!start || !end) return true;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s <= e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

// Tipo de cada categoría. Si la categoría trae la marca explícita (se puede
// cambiar en Administración > Categorías) manda esa; si no, se deduce del
// nombre para que el menú actual funcione sin tener que editar nada.
//   agrupada       -> variantes en UNA sola tarjeta con una sola foto
//   personalizable -> cada producto se puede pedir con adicionales
//   esAdicion      -> son los adicionales (no se piden sueltos)
//   esBebida       -> se ofrecen como sugerencia al confirmar el pedido
const normNombre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const FAMILIAS = ['salchipapas', 'burguer', 'burger', 'hamburguesas', 'perros', 'colitas'];
const BEBIDAS = ['bebidas', 'gaseosas'];
const SALSAS_ELEGIR = ['salchipapas']; // el cliente elige las salsas (sin costo)
const SALSAS_CASA = ['burguer', 'burger', 'hamburguesas', 'perros', 'colitas']; // llevan salsas de la casa

export function categoryKind(cat) {
  const n = normNombre(cat?.name);
  const pick = (campo, porDefecto) => (cat && cat[campo] !== undefined && cat[campo] !== null ? !!cat[campo] : porDefecto);
  return {
    agrupada: pick('agrupada', FAMILIAS.includes(n)),
    personalizable: pick('personalizable', FAMILIAS.includes(n)),
    esAdicion: pick('esAdicion', n === 'adiciones'),
    esBebida: pick('esBebida', BEBIDAS.includes(n)),
    salsas: pick('salsas', SALSAS_ELEGIR.includes(n)),
    salsasCasa: SALSAS_CASA.includes(n),
  };
}

export function buildPublicMenu(state, day, tipoEntrega) {
  const esUnico = state.menuMode === 'unico';
  const items = esUnico ? state.singleMenuSchedule : state.schedule.filter((s) => s.day === day);

  return state.categories
    .map((cat) => {
      const dishes = items
        .filter((s) => state.dishes.find((d) => d.id === s.dishId)?.categoryId === cat.id)
        .map((s) => {
          const dish = state.dishes.find((d) => d.id === s.dishId);
          if (!dish) return null;
          const isSoldOut = s.available === false || s.stock === 0;
          const extra = empaqueFeeFor(state.takeoutConfig, cat, tipoEntrega);
          const priceWithFees = String(parseCurrencyNumber(dish.price) + extra);
          return { ...dish, available: s.available, stock: s.stock, isSoldOut, priceWithFees };
        })
        .filter(Boolean);
      return { category: cat, dishes, kind: categoryKind(cat) };
    })
    .filter((group) => group.dishes.length > 0);
}
