import { useState } from 'react';
import { formatCurrency } from '../lib/format';

export default function CartPanel({ cart, subtotal, onQty, onRemove, onCheckout }) {
  const [expanded, setExpanded] = useState(false);
  if (cart.length === 0) return null;

  const platos = cart.reduce((sum, i) => sum + i.cantidad, 0);

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={miniStyle}>
        🛒 {platos} · {formatCurrency(subtotal)}
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
        {cart.map((item) => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px dashed #eadfce' }}>
            <span style={{ fontSize: 14 }}>
              {item.cantidad} x {item.name}
            </span>
            <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {formatCurrency(item.price * item.cantidad)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onQty(item.key, -1)} style={smallBtn}>-</button>
              <button onClick={() => onQty(item.key, 1)} style={smallBtn}>+</button>
              <button onClick={() => onRemove(item.key)} style={{ ...smallBtn, color: 'var(--brand-danger)' }}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--brand-card-border)' }}>
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
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 -6px 24px rgba(0,0,0,0.15)',
};
const smallBtn = { background: 'transparent', border: '1px solid #e2cfb4', color: 'var(--brand-text-dark)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 13 };
