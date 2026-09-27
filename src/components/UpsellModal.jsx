import { formatCurrency } from '../lib/format';

// Popup tipo "súmale una adición" que aparece justo después de agregar un
// platillo: sugiere 2-3 platillos más (bebidas u otras adiciones) para
// completar el pedido, referencia de otro restaurante que el usuario pidió
// replicar.
export default function UpsellModal({ addedName, suggestions, onAdd, onClose, onCheckout }) {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Sumaste al pedido</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{addedName}</div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--brand-text-dark)' }}>
            ¿Lo acompañas con algo más?
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map((dish) => (
              <div key={dish.id} style={rowStyle}>
                <div className="dish-img-placeholder" style={{ width: 44, height: 44, margin: 0, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{dish.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--brand-orange)', fontWeight: 700 }}>{formatCurrency(dish.priceWithFees)}</div>
                </div>
                <button onClick={() => onAdd(dish.id)} className="btn-pill btn-orange" style={{ fontSize: 12, padding: '6px 12px' }}>
                  + Agregar
                </button>
              </div>
            ))}
            {suggestions.length === 0 && <p style={{ fontSize: 13, color: '#8a7a6a' }}>No hay más sugerencias por ahora.</p>}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={onClose} className="btn-pill btn-outline" style={{ flex: 1 }}>
              No, gracias
            </button>
            <button onClick={onCheckout} className="btn-pill btn-orange" style={{ flex: 1 }}>
              Ir al checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 };
const cardStyle = { background: '#fff', borderRadius: 16, width: 340, maxWidth: '100%', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' };
const headerStyle = { background: 'var(--brand-orange)', color: 'var(--brand-text-dark)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const closeBtnStyle = { background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 20, cursor: 'pointer', lineHeight: 1 };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--brand-card-border)', borderRadius: 10, padding: 8 };
