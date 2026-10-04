import { useEffect, useState } from 'react';
import { useData } from '../../../context/DataContext';
import { getConfigStatus, calcularEnvio } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';
import { card, input, label, heading, smallBtn } from '../adminStyles';

const badge = (color, bg) => ({ color, background: bg, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 });

export default function Envio() {
  const { state, save } = useData();
  const cfg = state.deliveryFeeConfig;
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(cfg);
  const [guardado, setGuardado] = useState('');
  const [prueba, setPrueba] = useState('');
  const [resultado, setResultado] = useState(null);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    getConfigStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const setTramo = (i, campo, valor) =>
    setForm((f) => ({ ...f, tramos: f.tramos.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) }));

  const guardar = async (e) => {
    e.preventDefault();
    const tramos = form.tramos
      .map((t) => ({ hastaKm: Number(String(t.hastaKm).replace(',', '.')), precio: Number(String(t.precio).replace(/\D/g, '')) }))
      .filter((t) => t.hastaKm > 0 && t.precio >= 0)
      .sort((a, b) => a.hastaKm - b.hastaKm);
    if (tramos.length === 0) {
      setGuardado('Agrega al menos un tramo de distancia con su precio.');
      return;
    }
    const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
    await save({
      deliveryFeeConfig: {
        enabled: !!form.enabled,
        ciudad: form.ciudad,
        maxKm: Number(String(form.maxKm).replace(',', '.')) || 12,
        origen: { direccion: form.origen.direccion.trim(), lat: num(form.origen.lat), lng: num(form.origen.lng) },
        tramos,
      },
    });
    setForm((f) => ({ ...f, tramos }));
    setGuardado('✅ Guardado.');
    setTimeout(() => setGuardado(''), 3000);
  };

  const probar = async (e) => {
    e.preventDefault();
    if (!prueba.trim()) return;
    setProbando(true);
    setResultado(null);
    try {
      setResultado(await calcularEnvio(prueba.trim()));
    } catch {
      setResultado({ ok: false, error: 'No se pudo conectar con el servidor.' });
    }
    setProbando(false);
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Domicilio por distancia</h2>
        <p style={{ fontSize: 13, color: '#6b5a4d' }}>
          El cliente escribe su dirección, el sistema la ubica en el mapa, mide la distancia desde el local y cobra el domicilio según los tramos de abajo.
        </p>
        <p style={{ fontSize: 13 }}>
          <strong>Conexión con Google Maps: </strong>
          {status === null ? (
            <span style={badge('#8a7a6a', '#f0eae2')}>Verificando…</span>
          ) : status.mapsConfigured ? (
            <span style={badge('#1a7a3d', '#e3f5e9')}>✅ Conectada</span>
          ) : (
            <span style={badge('var(--brand-danger)', '#fdeceb')}>⚠️ Falta conectar</span>
          )}
        </p>
        {status && !status.mapsConfigured && (
          <div style={{ background: '#fff8ef', border: '1px solid var(--brand-card-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#5c4a3a', lineHeight: 1.6 }}>
            <strong>Para conectarla (cuando estés listo):</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              <li>En Google Cloud crea un proyecto y activa la facturación (pide tarjeta; tiene un cupo gratis mensual).</li>
              <li>Activa estas dos APIs: <strong>Geocoding API</strong> y <strong>Routes API</strong>.</li>
              <li>Crea una clave de API y restríngela a esas dos APIs.</li>
              <li>En Easypanel → esta app → Environment agrega <code>GOOGLE_MAPS_API_KEY</code> con esa clave y vuelve a desplegar.</li>
              <li>Vuelve aquí, prueba una dirección abajo y, si todo sale bien, marca "Activar".</li>
            </ol>
            <div style={{ marginTop: 6 }}>Mientras no esté conectada, el sitio sigue cobrando el domicilio como siempre.</div>
          </div>
        )}
      </div>

      <form onSubmit={guardar}>
        <div style={card}>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            <strong>Activar el cobro de domicilio por distancia</strong>
          </label>
          <p style={{ fontSize: 12, color: '#8a7a6a', marginTop: 0 }}>
            Solo tiene efecto si Google Maps está conectado. Los clientes que piden a domicilio deberán calcular su domicilio antes de enviar el pedido.
          </p>

          <label style={label}>
            Dirección del local (punto de partida)
            <input style={input} value={form.origen.direccion} onChange={(e) => setForm((f) => ({ ...f, origen: { ...f.origen, direccion: e.target.value } }))} />
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ ...label, flex: 1, minWidth: 140 }}>
              Latitud (opcional, más exacto)
              <input style={input} inputMode="decimal" value={form.origen.lat ?? ''} onChange={(e) => setForm((f) => ({ ...f, origen: { ...f.origen, lat: e.target.value } }))} placeholder="3.4416" />
            </label>
            <label style={{ ...label, flex: 1, minWidth: 140 }}>
              Longitud (opcional)
              <input style={input} inputMode="decimal" value={form.origen.lng ?? ''} onChange={(e) => setForm((f) => ({ ...f, origen: { ...f.origen, lng: e.target.value } }))} placeholder="-76.4793" />
            </label>
          </div>
          <p style={{ fontSize: 12, color: '#8a7a6a', marginTop: 0 }}>Si dejas latitud y longitud vacías, se ubica solo con la dirección. Para máxima precisión, copia las coordenadas del local desde Google Maps (clic derecho sobre el punto).</p>

          <label style={label}>
            Ciudad (se agrega a las direcciones con números)
            <input style={input} value={form.ciudad} onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))} />
          </label>
        </div>

        <div style={card}>
          <h3 style={{ ...heading, fontSize: 17 }}>Precio según la distancia</h3>
          <p style={{ fontSize: 12, color: '#8a7a6a' }}>
            Cada fila dice: "hasta X km cobra $Y". Se usa la primera fila que cubra la distancia por calles. Más lejos que la distancia máxima, no se reparte a domicilio.
          </p>
          {form.tramos.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#6b5a4d' }}>Hasta</span>
              <input style={{ ...input, width: 90 }} inputMode="decimal" value={t.hastaKm} onChange={(e) => setTramo(i, 'hastaKm', e.target.value)} />
              <span style={{ fontSize: 13, color: '#6b5a4d' }}>km cobra $</span>
              <input style={{ ...input, width: 110 }} inputMode="numeric" value={t.precio} onChange={(e) => setTramo(i, 'precio', e.target.value)} />
              <button type="button" style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => setForm((f) => ({ ...f, tramos: f.tramos.filter((_, j) => j !== i) }))}>
                Quitar
              </button>
            </div>
          ))}
          <button type="button" style={smallBtn} onClick={() => setForm((f) => ({ ...f, tramos: [...f.tramos, { hastaKm: '', precio: '' }] }))}>
            + Agregar tramo
          </button>
          <label style={{ ...label, marginTop: 14, maxWidth: 260 }}>
            Distancia máxima de reparto (km)
            <input style={input} inputMode="decimal" value={form.maxKm} onChange={(e) => setForm((f) => ({ ...f, maxKm: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-pill btn-orange">Guardar</button>
            {guardado && <span style={{ fontSize: 13, color: '#1a7a3d' }}>{guardado}</span>}
          </div>
        </div>
      </form>

      <div style={card}>
        <h3 style={{ ...heading, fontSize: 17 }}>Probar una dirección</h3>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>Escribe cualquier dirección (incluso muy lejos, como una ciudad) y mira cuánto cobraría. No crea ningún pedido.</p>
        <form onSubmit={probar} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: 1, minWidth: 220 }} value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="Ej. Cra 26 # 94-10, Marroquín I" />
          <button type="submit" className="btn-pill btn-orange" disabled={probando}>{probando ? 'Calculando…' : 'Calcular'}</button>
        </form>
        {resultado && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#4a3c30', lineHeight: 1.7 }}>
            {resultado.ok ? (
              <>
                <div><strong>Ubicación:</strong> {resultado.direccion}{resultado.aproximada ? ' (aproximada)' : ''}</div>
                {resultado.barrio && <div><strong>Barrio:</strong> {resultado.barrio}</div>}
                <div>
                  <strong>Distancia:</strong> {String(resultado.distanciaKm).replace('.', ',')} km {resultado.metodo === 'ruta' ? 'por calles' : '(en línea recta, no hay ruta)'}
                  {resultado.minutos ? ` · unos ${resultado.minutos} min` : ''}
                </div>
                <div>
                  <strong>Domicilio:</strong> {resultado.fueraDeZona ? <span style={{ color: 'var(--brand-danger)' }}>Fuera de la zona de reparto</span> : formatCurrency(resultado.costo)}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--brand-danger)' }}>{resultado.error || 'No se pudo calcular.'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
