import { useState } from 'react';
import { formatCurrency } from '../lib/format';
import { precioUnitarioLinea } from '../hooks/useCart';

// adiciones: [{ dishId, name, price }] disponibles para elegir en cada producto
// personalizable. bebidas: [{ dishId, name, price }] sugeridas para agregar.
export default function CartPanel({ cart, subtotal, adiciones = [], bebidas = [], onQty, onRemove, onToggleAdicion, onAddBebida, onCheckout }) {
  const [expanded, setExpanded] = useState(false);
  const [lineaAbierta, setLineaAbierta] = useState(null); // key de la línea con el selector de adicionales abierto
  const [verBebidas, setVerBebidas] = useState(false);
  if (cart.length === 0) return null;

  const platos = cart.reduce((sum, i) => sum + i.cantidad, 0);
  const hayPersonalizables = cart.some((i) => i.personalizable) && adiciones.length > 0;

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={miniStyle}>
        <span>🛒 {platos} · {formatCurrency(subtotal)}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#e8b98a', marginTop: 2 }}>
          {hayPersonalizables ? 'Toca para elegir adicionales y bebida' : 'Toca para ver tu pedido'}
        </span>
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Tu pedido</h3>
        <button onClick={() => setExpanded(false)} className="btn-pill btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}>
          ▼ Minimizar
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {cart.map((item) => {
          const abierta = lineaAbierta === item.key;
          const extras = item.adiciones || [];
          return (
            <div key={item.key} style={{ padding: '8px 0', borderBottom: '1px dashed #eadfce' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: item.personalizable ? 700 : 400 }}>
                  {item.personalizable ? item.name : `${item.cantidad} x ${item.name}`}
                </span>
                <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-display)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {formatCurrency(precioUnitarioLinea(item) * item.cantidad)}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {!item.personalizable && (
                    <>
                      <button onClick={() => onQty(item.key, -1)} style={smallBtn} aria-label="Quitar uno">-</button>
                      <button onClick={() => onQty(item.key, 1)} style={smallBtn} aria-label="Agregar uno">+</button>
                    </>
                  )}
                  <button onClick={() => onRemove(item.key)} style={{ ...smallBtn, color: 'var(--brand-danger)' }} aria-label="Quitar del pedido">×</button>
                </div>
              </div>

              {item.personalizable && (
                <>
                  {extras.length > 0 && (
                    <div style={{ fontSize: 12, color: '#6b5a4d', marginTop: 3 }}>
                      {extras.map((a) => `+ ${a.name}`).join('  ')}
                      <span style={{ color: '#a68f78' }}> (adicionales {formatCurrency(extras.reduce((s, a) => s + a.price, 0))})</span>
                    </div>
                  )}
                  {adiciones.length > 0 && (
                    <button onClick={() => setLineaAbierta(abierta ? null : item.key)} className="btn-pill btn-outline" style={{ fontSize: 12, padding: '4px 12px', marginTop: 6 }}>
                      {abierta ? '▲ Listo' : extras.length > 0 ? '✏️ Cambiar adicionales' : '➕ Adicionales'}
                    </button>
                  )}
                  {abierta && (
                    <div style={adicionesBox}>
                      <div style={{ fontSize: 12, color: '#6b5a4d', marginBottom: 6 }}>Elige todos los que quieras para este producto:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 6 }}>
                        {adiciones.map((a) => {
                          const marcada = extras.some((e) => e.dishId === a.dishId);
                          return (
                            <button
                              key={a.dishId}
                              type="button"
                              onClick={() => onToggleAdicion(item.key, a)}
                              style={{ ...chipStyle, ...(marcada ? chipOn : null) }}
                              aria-pressed={marcada}
                            >
                              <span>{marcada ? '✓ ' : ''}{a.name}</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(a.price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {bebidas.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setVerBebidas((v) => !v)} className="btn-pill btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>
              🥤 {verBebidas ? 'Ocultar bebidas' : '¿Quieres agregar una bebida?'}
            </button>
            {verBebidas && (
              <div style={{ ...adicionesBox, marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 6 }}>
                  {bebidas.map((b) => {
                    const enCarrito = cart.filter((i) => i.dishId === b.dishId).reduce((s, i) => s + i.cantidad, 0);
                    return (
                      <button key={b.dishId} type="button" onClick={() => onAddBebida(b.dishId)} style={{ ...chipStyle, ...(enCarrito ? chipOn : null) }}>
                        <span>{b.name}{enCarrito ? ` ×${enCarrito}` : ''}</span>
                        <span style={{ fontWeight: 700 }}>+ {formatCurrency(b.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cart-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--brand-card-border)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>Subtotal: {formatCurrency(subtotal)}</span>
        <button onClick={onCheckout} className="btn-pill btn-orange">
          Confirmar pedido
        </button>
      </div>
    </div>
  );
}

const miniStyle = {
  position: 'fixed',
  left: 20,
  right: 20,
  bottom: 20,
  maxWidth: 460,
  margin: '0 auto',
  background: 'var(--brand-dark)',
  color: 'var(--brand-gold)',
  border: 'none',
  borderRadius: 20,
  padding: '10px 18px',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 15,
  boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
  zIndex: 30,
  cursor: 'pointer',
};
const panelStyle = {
  position: 'fixed',
  left: 16,
  right: 16,
  bottom: 16,
  maxWidth: 460,
  margin: '0 auto',
  background: '#fff',
  border: '2px solid var(--brand-card-border)',
  borderRadius: 16,
  padding: 16,
  zIndex: 60,
  maxHeight: '78vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 -6px 24px rgba(0,0,0,0.15)',
};
const smallBtn = { background: 'transparent', border: '1px solid #e2cfb4', color: 'var(--brand-text-dark)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 13 };
const adicionesBox = { background: 'var(--brand-card-tint)', borderRadius: 10, padding: 10, marginTop: 8 };
const chipStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  textAlign: 'left',
  fontSize: 12,
  padding: '7px 9px',
  borderRadius: 8,
  border: '1.5px solid #e2cfb4',
  background: '#fff',
  color: 'var(--brand-text-dark)',
  cursor: 'pointer',
};
const chipOn = { borderColor: 'var(--brand-orange)', background: '#fff1e2' };
