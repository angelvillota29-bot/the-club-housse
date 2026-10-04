import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import { buildPublicMenu, isBusinessOpen } from '../lib/menu';
import { formatCurrency, nombreDiaHoy, parseCurrencyNumber } from '../lib/format';
import CartPanel from '../components/CartPanel';
import CheckoutModal from '../components/CheckoutModal';
import NequiPago from '../components/NequiPago';
import { placeOrder } from '../lib/api';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Menu() {
  const { state, refresh } = useData();
  const { user } = useAuth();
  const location = useLocation();
  const cartState = useCart(state);
  const [day, setDay] = useState(nombreDiaHoy());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const esUnico = state.menuMode === 'unico';
  const esHoy = esUnico || day === nombreDiaHoy();
  const open = isBusinessOpen(state.businessOpenConfig);

  const groups = useMemo(() => buildPublicMenu(state, day, 'recoger'), [state, day]);

  const handleAdd = (dishId) => {
    cartState.addToCart(dishId, day);
  };

  // Adicionales y bebidas que se ofrecen dentro del carrito, tomados del mismo
  // menú de hoy (solo lo que no está agotado).
  const aOpcion = (d) => ({ dishId: d.id, name: d.name, price: parseCurrencyNumber(d.price) });
  const adiciones = useMemo(() => groups.filter((g) => g.kind.esAdicion).flatMap((g) => g.dishes.filter((d) => !d.isSoldOut).map(aOpcion)), [groups]);
  const bebidas = useMemo(() => groups.filter((g) => g.kind.esBebida).flatMap((g) => g.dishes.filter((d) => !d.isSoldOut).map(aOpcion)), [groups]);
  const puedePedir = esHoy && open;

  // Orden en pantalla: primero la comida; al final del todo las bebidas y
  // gaseosas, y de último los adicionales, para que no estorben al elegir.
  const gruposOrdenados = useMemo(
    () => [
      ...groups.filter((g) => !g.kind.esBebida && !g.kind.esAdicion),
      ...groups.filter((g) => g.kind.esBebida && !g.kind.esAdicion),
      ...groups.filter((g) => g.kind.esAdicion),
    ],
    [groups],
  );

  const submitOrder = async ({ nombre, direccion, telefono, nota, tipoEntrega, metodoPago, envioToken }) => {
    const payload = {
      day: esUnico ? undefined : day,
      tipoEntrega,
      cliente: { nombre, direccion, telefono, nota },
      canal: 'pagina',
      metodoPago,
      envioToken: envioToken || undefined,
      menuMode: state.menuMode,
      items: cartState.cart.map((i) => ({ dishId: i.dishId, cantidad: i.cantidad, adiciones: (i.adiciones || []).map((a) => a.dishId) })),
      accountEmail: user || undefined,
    };
    const result = await placeOrder(payload);
    if (result.success) {
      setCheckoutOpen(false);
      setConfirmedOrder({ ...result, metodoPago });
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
        {gruposOrdenados.map(({ category, dishes, kind }) => {
          if (kind.esAdicion) return <AdicionesInfo key={category.id} category={category} dishes={dishes} />;
          if (kind.esBebida) return <FamilyCard key={category.id} category={category} dishes={dishes} puedePedir={puedePedir} onAdd={handleAdd} sinFoto />;
          if (kind.agrupada) return <FamilyCard key={category.id} category={category} dishes={dishes} puedePedir={puedePedir} onAdd={handleAdd} />;
          return (
            <div key={category.id} style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <h2 style={tituloCategoria}>{category.name}</h2>
                {category.deliveryEnabled === false && <span style={{ fontSize: 11, color: 'var(--brand-danger)' }}>No disponible a domicilio</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                {dishes.map((dish) => (
                  <div key={dish.id} className="dish-card" style={{ opacity: dish.isSoldOut ? 0.5 : 1 }}>
                    {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} /> : <div className="dish-img-placeholder" />}
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--brand-text-dark)' }}>{dish.name}</div>
                    {dish.desc && <div style={{ fontSize: 11, color: '#a68f78', marginTop: 2 }}>{dish.desc}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {formatCurrency(dish.priceWithFees)}
                      </span>
                      {!dish.isSoldOut && puedePedir && (
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
          );
        })}
      </div>

      <CartPanel
        cart={cartState.cart}
        subtotal={cartState.subtotal}
        adiciones={adiciones}
        bebidas={bebidas}
        onQty={cartState.changeQty}
        onRemove={cartState.removeItem}
        onToggleAdicion={cartState.toggleAdicion}
        onAddBebida={handleAdd}
        onCheckout={() => setCheckoutOpen(true)}
      />

      {checkoutOpen && (
        <CheckoutModal
          totalsForEntrega={cartState.totalsForEntrega}
          envioActivo={!!state.deliveryFeeConfig?.enabled}
          initialTipoEntrega={location.state?.tipoEntrega}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={submitOrder}
        />
      )}

      {confirmedOrder && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, borderColor: '#25d366' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#1a7a3d', fontSize: 22, marginTop: 0 }}>¡Pedido recibido!</h3>
            <p style={{ fontSize: 14, color: '#5c4a3a' }}>
              Tu pedido #{confirmedOrder.orderId} por {formatCurrency(confirmedOrder.total)} fue recibido.
            </p>
            {confirmedOrder.metodoPago === 'nequi' && <NequiPago total={confirmedOrder.total} />}
            <button className="btn-pill btn-orange" onClick={() => setConfirmedOrder(null)}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Foto propia de una familia (sándwich cubano para las colitas, que son como un
// sándwich). Si la categoría trae su propia imagen, esa tiene prioridad.
const FOTOS_FAMILIA = { colitas: '/familia-colitas.jpg' };

// Familia de productos con variantes (salchipapas, burguers, perros, colitas):
// UNA sola tarjeta con UNA sola foto y la lista de variantes con su precio.
function FamilyCard({ category, dishes, puedePedir, onAdd, sinFoto }) {
  const foto = sinFoto ? null : category.imageUrl || FOTOS_FAMILIA[String(category.name).toLowerCase().trim()] || dishes.find((d) => d.imageUrl)?.imageUrl;
  return (
    <section className="family-card" style={{ marginBottom: 26 }}>
      {!sinFoto && (foto ? <img className="family-photo" src={foto} alt={category.name} /> : <div className="family-photo dish-img-placeholder" />)}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={tituloCategoria}>{category.name}</h2>
          {category.deliveryEnabled === false && <span style={{ fontSize: 11, color: 'var(--brand-danger)' }}>No disponible a domicilio</span>}
        </div>
        {!sinFoto && (
          <p style={{ fontSize: 12, color: '#a68f78', margin: '2px 0 6px' }}>
            Elige la que más te provoque{puedePedir ? ' y agrégala; luego podrás ponerle adicionales.' : '.'}
          </p>
        )}
      </div>
      <ul className="family-list">
        {dishes.map((dish) => (
          <li key={dish.id} className="family-row" style={{ opacity: dish.isSoldOut ? 0.5 : 1 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--brand-text-dark)' }}>{dish.name}</div>
              {dish.desc && <div style={{ fontSize: 11, color: '#a68f78', marginTop: 1 }}>{dish.desc}</div>}
              {dish.isSoldOut && <div style={{ fontSize: 11, color: 'var(--brand-danger)', marginTop: 2 }}>Agotado</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap' }}>
                {formatCurrency(dish.priceWithFees)}
              </span>
              {!dish.isSoldOut && puedePedir && (
                <button onClick={() => onAdd(dish.id)} className="btn-pill btn-orange" style={{ fontSize: 12, padding: '5px 12px' }}>
                  + Agregar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Lista informativa de adicionales: no se piden sueltos, se eligen producto por
// producto al revisar el pedido.
function AdicionesInfo({ category, dishes }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={tituloCategoria}>{category.name}</h2>
      <p style={{ fontSize: 12, color: '#a68f78', margin: '2px 0 10px' }}>Se eligen en tu pedido, producto por producto (salchipapas, burguers, perros y colitas).</p>
      <ul className="adiciones-lista">
        {dishes.map((d) => (
          <li key={d.id} style={{ opacity: d.isSoldOut ? 0.5 : 1 }}>
            <span>{d.name}</span>
            <strong>{formatCurrency(d.price)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

const tituloCategoria = { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, margin: 0, color: 'var(--brand-text-dark)' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 340, maxWidth: '100%' };
