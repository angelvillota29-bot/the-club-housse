import { useState } from 'react';
import { formatCurrency } from '../lib/format';

// Número de Nequi/Daviplata del restaurante y QR (public/nequi-qr.webp).
const NUMERO = '3187527225';
const NUMERO_BONITO = '318 752 7225';

export default function NequiPago({ total, metodo = 'nequi' }) {
  const esDaviplata = metodo === 'daviplata';
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(NUMERO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el número igual está a la vista.
    }
  };

  return (
    <div style={caja}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--brand-text-dark)' }}>{esDaviplata ? 'Paga con Daviplata' : 'Paga con Nequi'}</div>
      <p style={{ fontSize: 13, color: '#5c4a3a', margin: '6px 0' }}>
        {total ? <>Envía <strong>{formatCurrency(total)}</strong> al número</> : 'Envía el pago al número'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 0.5, color: 'var(--brand-text-dark)' }}>{NUMERO_BONITO}</strong>
        <button type="button" onClick={copiar} className="btn-pill btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}>
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      {esDaviplata ? (
        <p style={{ fontSize: 12, color: '#6b5a4d', margin: '10px 0 0' }}>Abre tu app de Daviplata y envía el pago a este número.</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#6b5a4d', margin: '10px 0 6px' }}>O escanea el código QR:</p>
          <img src="/nequi-qr.webp" alt="Código QR para pagar con Nequi — Club Housse" style={{ width: '100%', maxWidth: 230, borderRadius: 10, display: 'block', margin: '0 auto' }} />
        </>
      )}
      <p style={{ fontSize: 11, color: '#a68f78', margin: '8px 0 0' }}>Cuando pagues, adjunta el comprobante para confirmar tu pedido.</p>
    </div>
  );
}

const caja = { background: 'var(--brand-card-tint)', border: '1.5px solid var(--brand-card-border)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' };
