import { useMemo, useState } from 'react';
import { formatCurrency } from '../lib/format';
import TermsButton from './TermsButton';
import NequiPago from './NequiPago';

export default function CheckoutModal({ totalsForEntrega, onClose, onSubmit, initialTipoEntrega }) {
  const [tipoEntrega, setTipoEntrega] = useState(initialTipoEntrega || 'domicilio');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '', nota: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const totals = useMemo(() => totalsForEntrega(tipoEntrega), [totalsForEntrega, tipoEntrega]);
  const needsAddress = tipoEntrega === 'domicilio';
  const needsPhone = tipoEntrega !== 'comer_aqui';

  const submit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }
    if (needsAddress && !form.direccion.trim()) {
      setError('La dirección es obligatoria para domicilio.');
      return;
    }
    setSending(true);
    setError('');
    const result = await onSubmit({ ...form, tipoEntrega, metodoPago });
    setSending(false);
    if (!result?.success) {
      setError(result?.error || 'No se pudo procesar el pedido.');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
          ×
        </button>
        <h2 style={titleStyle}>Confirmar tu pedido</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            Tipo de entrega
            <select value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)} style={inputStyle}>
              <option value="domicilio">Domicilio</option>
              <option value="recoger">Recoger en el local</option>
              <option value="comer_aqui">Comer aquí</option>
            </select>
          </label>

          <label style={labelStyle}>
            Nombre
            <input required value={form.nombre} onChange={set('nombre')} style={inputStyle} />
          </label>
          {needsAddress && (
            <label style={labelStyle}>
              Dirección de entrega
              <input required value={form.direccion} onChange={set('direccion')} style={inputStyle} />
            </label>
          )}
          {needsPhone && (
            <label style={labelStyle}>
              Teléfono
              <input required type="tel" value={form.telefono} onChange={set('telefono')} style={inputStyle} />
            </label>
          )}
          <label style={labelStyle}>
            Nota (opcional)
            <input value={form.nota} onChange={set('nota')} placeholder="Ej. sin cebolla" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Método de pago
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={inputStyle}>
              <option value="efectivo">Efectivo</option>
              <option value="nequi">Nequi / Daviplata</option>
            </select>
          </label>

          {metodoPago === 'nequi' && <NequiPago total={totals.total} />}

          <div style={totalsBox}>
            <div style={totalsRow}><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            {totals.empaque > 0 && <div style={totalsRow}><span>Empaque</span><span>{formatCurrency(totals.empaque)}</span></div>}
            {totals.domicilio > 0 && <div style={totalsRow}><span>Domicilio</span><span>{formatCurrency(totals.domicilio)}</span></div>}
            <div style={{ ...totalsRow, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4 }}><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
          </div>

          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              Acepto los{' '}
              <button type="button" onClick={() => setShowTerms(true)} style={linkBtnStyle}>
                términos y condiciones
              </button>
            </span>
          </label>

          {error && <p style={{ color: 'var(--brand-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" className="btn-pill btn-orange" disabled={sending} style={{ marginTop: 6 }}>
            {sending ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </form>
      </div>
      {showTerms && <TermsButton inline onClose={() => setShowTerms(false)} />}
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 380, maxWidth: '100%', maxHeight: '78vh', overflowY: 'auto', position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 22, cursor: 'pointer' };
const titleStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 0, color: 'var(--brand-text-dark)' };
const labelStyle = { fontSize: 13, color: '#6b5a4d', display: 'flex', flexDirection: 'column', gap: 4 };
const inputStyle = { padding: '9px 10px', borderRadius: 8, border: '1px solid #e2cfb4', background: '#fffdfa', fontSize: 14 };
const linkBtnStyle = { background: 'none', border: 'none', padding: 0, color: 'var(--brand-orange)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 };
const totalsBox = { background: 'var(--brand-card-tint)', borderRadius: 10, padding: '10px 12px', fontSize: 13 };
const totalsRow = { display: 'flex', justifyContent: 'space-between', padding: '2px 0' };
