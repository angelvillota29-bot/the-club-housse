import { useRef, useState } from 'react';
import { subirComprobante } from '../lib/api';
import { prepararFoto, borrarPendiente } from '../lib/pago';

// Para quien pagó por Nequi o Daviplata: adjunta la captura del pago. Queda
// guardada en el pedido para que la caja pueda comprobar el pago; el cliente
// puede agregar otra si la primera salió mal (hasta 3), pero no borrarla.
export default function ComprobanteSubida({ orderId, token, onGuardado }) {
  const input = useRef(null);
  const [estado, setEstado] = useState('idle'); // idle | subiendo | listo
  const [guardados, setGuardados] = useState(0);
  const [error, setError] = useState('');

  const elegir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setEstado('subiendo');
    try {
      const foto = await prepararFoto(archivo);
      const r = await subirComprobante(orderId, token, foto);
      if (!r.success) throw new Error(r.error || 'No se pudo guardar la foto.');
      setGuardados((n) => n + 1);
      setEstado('listo');
      borrarPendiente();
      onGuardado?.();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la foto.');
      setEstado(guardados > 0 ? 'listo' : 'idle');
    }
  };

  return (
    <div style={caja}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--brand-text-dark)' }}>
        {estado === 'listo' ? '✓ Comprobante guardado' : 'Adjunta tu comprobante de pago'}
      </div>
      <p style={{ fontSize: 12, color: '#6b5a4d', margin: '4px 0 8px' }}>
        {estado === 'listo'
          ? 'Gracias. El restaurante lo revisará para confirmar tu pedido.'
          : 'Cuando hayas pagado, sube la captura de pantalla del pago. Así confirmamos tu pedido más rápido.'}
      </p>
      <input ref={input} type="file" accept="image/*" onChange={elegir} style={{ display: 'none' }} />
      {guardados < 3 && (
        <button type="button" className="btn-pill btn-outline" disabled={estado === 'subiendo'} onClick={() => input.current?.click()} style={{ fontSize: 13 }}>
          {estado === 'subiendo' ? 'Subiendo…' : estado === 'listo' ? 'Agregar otra foto' : '📎 Adjuntar comprobante'}
        </button>
      )}
      {error && <p style={{ color: 'var(--brand-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

const caja = { background: '#fff8ee', border: '1.5px dashed var(--brand-card-border)', borderRadius: 12, padding: '10px 12px', textAlign: 'center', marginTop: 10 };
