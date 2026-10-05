import { useCallback, useState } from 'react';
import { newCartKey, parseCurrencyNumber } from '../lib/format';
import { getMenuItemForDay, categoryForDish, categoryKind, empaqueFeeFor, domicilioFeeFor } from '../lib/menu';

// El carrito es plano: platillo + cantidad. Los productos "personalizables"
// (salchipapas, burguers, perros, colitas) NO se juntan en una sola línea: cada
// unidad es su propia línea, de a uno, para que cada una pueda llevar sus
// propios adicionales (ej. Colita $15.000 + Queso + Nuggets). Los demás
// productos (bebidas, especiales...) sí se agrupan por cantidad.
// Los cargos de empaque/domicilio dependen del tipoEntrega elegido en el
// checkout, no del momento en que se agrega.
export const precioUnitarioLinea = (i) => i.price + (i.adiciones || []).reduce((s, a) => s + a.price, 0);

export function useCart(state) {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback(
    (dishId, day) => {
      const item = getMenuItemForDay(state, dishId, day);
      if (!item || item.available === false || item.stock === 0) {
        alert('Ese platillo ya no está disponible.');
        return;
      }
      const kind = categoryKind(categoryForDish(state, dishId));
      const personalizable = kind.personalizable;
      const nueva = { key: newCartKey(), dishId: item.id, name: item.name, price: parseCurrencyNumber(item.price), cantidad: 1 };
      setCart((prev) => {
        if (personalizable) return [...prev, { ...nueva, personalizable: true, adiciones: [], permiteSalsas: !!kind.salsas, salsas: [] }];
        const existing = prev.find((i) => i.dishId === dishId && !i.personalizable);
        if (existing) {
          return prev.map((i) => (i === existing ? { ...i, cantidad: i.cantidad + 1 } : i));
        }
        return [...prev, nueva];
      });
    },
    [state],
  );

  // Marca/desmarca un adicional de una línea del carrito.
  const toggleAdicion = useCallback((key, adicion) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const tiene = (i.adiciones || []).some((a) => a.dishId === adicion.dishId);
        return { ...i, adiciones: tiene ? i.adiciones.filter((a) => a.dishId !== adicion.dishId) : [...(i.adiciones || []), adicion] };
      }),
    );
  }, []);

  // Marca/desmarca una salsa (sin costo) de una línea del carrito.
  const toggleSalsa = useCallback((key, nombre) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const tiene = (i.salsas || []).includes(nombre);
        return { ...i, salsas: tiene ? i.salsas.filter((s) => s !== nombre) : [...(i.salsas || []), nombre] };
      }),
    );
  }, []);

  const changeQty = useCallback((key, delta) => {
    setCart((prev) => prev.map((i) => (i.key === key && !i.personalizable ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)));
  }, []);

  const removeItem = useCallback((key) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const subtotal = cart.reduce((sum, i) => sum + precioUnitarioLinea(i) * i.cantidad, 0);

  const totalsForEntrega = useCallback(
    (tipoEntrega) => {
      const empaque = cart.reduce((sum, i) => sum + empaqueFeeFor(state.takeoutConfig, categoryForDish(state, i.dishId), tipoEntrega) * i.cantidad, 0);
      const domicilio = cart.length > 0 ? domicilioFeeFor(state.takeoutConfig, tipoEntrega) : 0;
      return { subtotal, empaque, domicilio, total: subtotal + empaque + domicilio };
    },
    [cart, subtotal, state],
  );

  return { cart, addToCart, toggleAdicion, toggleSalsa, changeQty, removeItem, clearCart, subtotal, totalsForEntrega };
}
