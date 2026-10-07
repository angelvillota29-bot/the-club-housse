import { useEffect, useState } from 'react';
import { useData } from '../../../context/DataContext';
import { formatCurrency } from '../../../lib/format';
import { getConfigStatus } from '../../../lib/api';
import { card, input, label, heading, smallBtn } from '../adminStyles';

const CANAL_LABEL = { pagina: 'Página', chat_web: 'Chat web', whatsapp: 'WhatsApp', telegram: 'Telegram' };

export default function Orders() {
  const { state, save } = useData();
  const orders = [...(state.ordersData || [])].reverse();
  const [resendConfigured, setResendConfigured] = useState(null);

  useEffect(() => {
    getConfigStatus()
      .then((s) => setResendConfigured(s.resendConfigured))
      .catch(() => setResendConfigured(null));
  }, []);

  const toggleEstado = async (id) => {
    const ordersData = state.ordersData.map((o) => (o.id === id ? { ...o, estado: o.estado === 'entregado' ? 'pendiente' : 'entregado' } : o));
    await save({ ordersData });
  };
  const remove = async (id) => {
    if (!confirm('¿Eliminar este pedido de la cola?')) return;
    await save({ ordersData: state.ordersData.filter((o) => o.id !== id) });
  };

  const saveOwnerEmail = async (e) => {
    e.preventDefault();
    await save({ notifyConfig: { ...state.notifyConfig, ownerEmail: e.target.ownerEmail.value.trim() } });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Notificación de pedidos por correo</h2>
        <p style={{ fontSize: 13, color: '#6b5a4d' }}>
          Cuando un cliente confirma un pedido, te avisamos por correo (vía Resend — crea una cuenta gratis en resend.com y saca
          tu API Key en resend.com/api-keys).
        </p>
        <p style={{ fontSize: 13 }}>
          <strong>API Key de Resend: </strong>
          {resendConfigured === null ? (
            <span>Verificando…</span>
          ) : resendConfigured ? (
            <span style={{ color: '#1a7a3d', background: '#e3f5e9', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>✅ Configurada</span>
          ) : (
            <span style={{ color: 'var(--brand-danger)', background: '#fdeceb', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>⚠️ Sin configurar</span>
          )}
        </p>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>
          Por seguridad, esta llave no se guarda ni se pega aquí — se configura como variable de entorno{' '}
          <code>RESEND_API_KEY</code> directamente en tu hosting (Easypanel → tu app → Environment).
        </p>
        <form onSubmit={saveOwnerEmail}>
          <label style={label}>
            Tu correo (para recibir los avisos)
            <input name="ownerEmail" type="email" style={input} defaultValue={state.notifyConfig?.ownerEmail || ''} />
          </label>
          <button type="submit" className="btn-pill btn-orange">
            Guardar
          </button>
        </form>
      </div>

      <div style={card}>
      <h2 style={heading}>Pedidos</h2>
      {orders.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin pedidos en la cola.</p>}
      {orders.map((o) => (
        <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px dashed #eadfce' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <strong style={{ color: 'var(--brand-text-dark)' }}>{o.consecutivo ? `N.º ${String(o.consecutivo).padStart(4, '0')}` : `#${o.id}`} — {o.cliente?.nombre}</strong>
            <span style={{ color: 'var(--brand-orange)' }}>{formatCurrency(o.total)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 2 }}>
            {o.tipoEntrega} · {{ efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata' }[o.metodoPago] || o.metodoPago}{o.comprobantes?.length ? ' (con comprobante)' : ''} · {CANAL_LABEL[o.canal] || o.canal}
            {o.cliente?.direccion ? ` · ${o.cliente.direccion}` : ''} · {o.cliente?.telefono}
          </div>
          <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 4 }}>
            {o.items?.map((it, i) => (
              <span key={i}>{it.cantidad} x {it.name}{it.adiciones?.length ? ` (${it.adiciones.map((a) => `+ ${a.name}`).join(' ')})` : ''}{i < o.items.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            <button style={smallBtn} onClick={() => toggleEstado(o.id)}>{o.estado === 'entregado' ? 'Entregado ✓' : 'Marcar entregado'}</button>
            <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(o.id)}>Eliminar</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
