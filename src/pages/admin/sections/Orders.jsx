import { useData } from '../../../context/DataContext';
import { formatCurrency } from '../../../lib/format';
import { card, heading, smallBtn } from '../adminStyles';

const CANAL_LABEL = { pagina: 'Página', chat_web: 'Chat web', whatsapp: 'WhatsApp', telegram: 'Telegram' };

export default function Orders() {
  const { state, save } = useData();
  const orders = [...(state.ordersData || [])].reverse();

  const toggleEstado = async (id) => {
    const ordersData = state.ordersData.map((o) => (o.id === id ? { ...o, estado: o.estado === 'entregado' ? 'pendiente' : 'entregado' } : o));
    await save({ ordersData });
  };
  const remove = async (id) => {
    if (!confirm('¿Eliminar este pedido de la cola?')) return;
    await save({ ordersData: state.ordersData.filter((o) => o.id !== id) });
  };

  return (
    <div style={card}>
      <h2 style={heading}>Pedidos</h2>
      {orders.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin pedidos en la cola.</p>}
      {orders.map((o) => (
        <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px dashed #eadfce' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <strong style={{ color: 'var(--brand-text-dark)' }}>#{o.id} — {o.cliente?.nombre}</strong>
            <span style={{ color: 'var(--brand-orange)' }}>{formatCurrency(o.total)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 2 }}>
            {o.tipoEntrega} · {o.metodoPago} · {CANAL_LABEL[o.canal] || o.canal}
            {o.cliente?.direccion ? ` · ${o.cliente.direccion}` : ''} · {o.cliente?.telefono}
          </div>
          <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 4 }}>
            {o.items?.map((it, i) => (
              <span key={i}>{it.cantidad} x {it.name}{i < o.items.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            <button style={smallBtn} onClick={() => toggleEstado(o.id)}>{o.estado === 'entregado' ? 'Entregado ✓' : 'Marcar entregado'}</button>
            <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(o.id)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
