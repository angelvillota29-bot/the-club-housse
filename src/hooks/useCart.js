import { useCallback, useMemo, useState } from 'react';
import { newCartKey, parseCurrencyNumber } from '../lib/format';
import { getMenuItemForDay, categoryForDish, empaqueFeeFor, domicilioFeeFor } from '../lib/menu';

// Sin combos/acompañamientos (House Club los quitó): el carrito es plano,
// platillo + cantidad. Los cargos de empaque/domicilio dependen del
// tipoEntrega elegido en el checkout, no del momento en que se agrega.
export function useCart(state) {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback(
    (dishId, day) => {
      const item = getMenuItemForDay(state, dishId, day);
      if (!item || item.available === false || item.stock === 0) {
        alert('Ese platillo ya no está disponible.');
        return;
      }
      setCart((prev) => {
        const existing = prev.find((i) => i.dishId === dishId);
        if (existing) {
          return prev.map((i) => (i.dishId === dishId ? { ...i, cantidad: i.cantidad + 1 } : i));
        }
        return [...prev, { key: newCartKey(), dishId: item.id, name: item.name, price: parseCurrencyNumber(item.price), cantidad: 1 }];
      });
    },
    [state],
  );

  const changeQty = useCallback((key, delta) => {
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)));
  }, []);

  const removeItem = useCallback((key) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);

  const totalsForEntrega = useCallback(
    (tipoEntrega) => {
      const empaque = cart.reduce((sum, i) => sum + empaqueFeeFor(state.takeoutConfig, categoryForDish(state, i.dishId), tipoEntrega) * i.cantidad, 0);
      const domicilio = cart.length > 0 ? domicilioFeeFor(state.takeoutConfig, tipoEntrega) : 0;
      return { subtotal, empaque, domicilio, total: subtotal + empaque + domicilio };
    },
    [cart, subtotal, state],
  );

  return { cart, addToCart, changeQty, removeItem, clearCart, subtotal, totalsForEntrega };
}
