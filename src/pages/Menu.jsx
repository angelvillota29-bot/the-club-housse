import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useCart } from '../hooks/useCart';
import { buildPublicMenu, isBusinessOpen } from '../lib/menu';
import { formatCurrency, nombreDiaHoy } from '../lib/format';
import CartPanel from '../components/CartPanel';
import CheckoutModal from '../components/CheckoutModal';
import UpsellModal from '../components/UpsellModal';
import { placeOrder } from '../lib/api';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Menu() {
  const { state, refresh } = useData();
  const cartState = useCart(state);
  const [day, setDay] = useState(nombreDiaHoy());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [upsell, setUpsell] = useState(null);

  const esUnico = state.menuMode === 'unico';
  const esHoy = esUnico || day === nombreDiaHoy();
  const open = isBusinessOpen(state.businessOpenConfig);

  const groups = useMemo(() => buildPublicMenu(state, day, 'recoger'), [state, day]);
  const allAvailableDishes = useMemo(() => groups.flatMap((g) => g.dishes).filter((d) => !d.isSoldOut), [groups]);

  const handleAdd = (dishId) => {
    const dish = allAvailableDishes.find((d) => d.id === dishId);
    cartState.addToCart(dishId, day);
    const others = allAvailableDishes.filter((d) => d.id !== dishId && !cartState.cart.some((c) => c.dishId === d.id)).slice(0, 3);
    if (dish && others.length > 0) {
      setUpsell({ addedName: dish.name, suggestions: others });
    }
  };

  const submitOrder = async ({ nombre, direccion, telefono, nota, tipoEntrega, metodoPago }) => {
    const payload = {
      day: esUnico ? undefined : day,
      tipoEntrega,
      cliente: { nombre, direccion, telefono, nota },
      canal: 'pagina',
      metodoPago,
      menuMode: state.menuMode,
      items: cartState.cart.map((i) => ({ dishId: i.dishId, cantidad: i.cantidad })),
    };
    const result = await placeOrder(payload);
    if (result.success) {
      setCheckoutOpen(false);
      setConfirmedOrder(result);
      cartState.clearCart();
      await refresh();
    }
    return result;
  };

  return (
    <div style={{ padding: '20px 20px 220px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--brand-text-dark)', margin: 0 }}>
        Menú de Hoy
      </h1>
      <p style={{ fontSize: 13, color: '#a68f78', marginTop: 4 }}>{state.brandingConfig?.name || 'The Club Housse'}</p>

      {!open && (
        <div style={{ marginTop: 12, background: '#fdeceb', color: 'var(--brand-danger)', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          Estamos cerrados en este momento — puedes ver el menú, pero no se pueden confirmar pedidos.
        </div>
      )}

      {!esUnico && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {DIAS.map((d) => (
            <button key={d} onClick={() => setDay(d)} className={`chip-tab ${d === day ? 'active' : ''}`} style={{ flex: '0 0 auto', minWidth: 88 }}>
              {d}
            </button>
          ))}
        </div>
      )}

      {!esHoy && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--brand-orange-deep)' }}>
          📅 Viendo el menú de <strong>{day}</strong> — solo puedes pedir del día de hoy (<strong>{nombreDiaHoy()}</strong>).
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        {groups.length === 0 && <p style={{ color: '#a68f78', fontSize: 14 }}>No hay platillos para este día.</p>}
        {groups.map(({ category, dishes }) => (
          <div key={category.id} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, margin: 0, color: 'var(--brand-text-dark)' }}>
                {category.name}
              </h2>
              {category.deliveryEnabled === false && <span style={{ fontSize: 11, color: 'var(--brand-danger)' }}>No disponible a domicilio</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {dishes.map((dish) => (
                <div key={dish.id} className="dish-card" style={{ opacity: dish.isSoldOut ? 0.5 : 1 }}>
                  {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} /> : <div className="dish-img-placeholder" />}
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--brand-text-dark)' }}>{dish.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13 }}>
                      {formatCurrency(dish.priceWithFees)}
                    </span>
                    {!dish.isSoldOut && esHoy && open && (
                      <button onClick={() => handleAdd(dish.id)} className="btn-pill btn-orange" style={{ fontSize: 11, padding: '4px 10px' }}>
                        + Agregar
                      </button>
                    )}
                  </div>
                  {dish.isSoldOut && <div style={{ fontSize: 11, color: 'var(--brand-danger)', marginTop: 4 }}>Agotado</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CartPanel cart={cartState.cart} subtotal={cartState.subtotal} onQty={cartState.changeQty} onRemove={cartState.removeItem} onCheckout={() => setCheckoutOpen(true)} />

      {upsell && (
        <UpsellModal
          addedName={upsell.addedName}
          suggestions={upsell.suggestions}
          onAdd={(dishId) => {
            cartState.addToCart(dishId, day);
            setUpsell(null);
          }}
          onClose={() => setUpsell(null)}
          onCheckout={() => {
            setUpsell(null);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && <CheckoutModal totalsForEntrega={cartState.totalsForEntrega} onClose={() => setCheckoutOpen(false)} onSubmit={submitOrder} />}

      {confirmedOrder && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, borderColor: '#25d366' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#1a7a3d', fontSize: 22, marginTop: 0 }}>¡Pedido recibido!</h3>
            <p style={{ fontSize: 14, color: '#5c4a3a' }}>
              Tu pedido #{confirmedOrder.orderId} por {formatCurrency(confirmedOrder.total)} fue recibido.
            </p>
            <button className="btn-pill btn-orange" onClick={() => setConfirmedOrder(null)}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 340, maxWidth: '100%' };
