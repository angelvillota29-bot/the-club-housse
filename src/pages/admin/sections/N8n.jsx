import { useEffect, useState } from 'react';
import { getConfigStatus } from '../../../lib/api';
import { card, heading } from '../adminStyles';

function generarKeySugerida() {
  return 'n8n_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function N8n() {
  const [status, setStatus] = useState(null);
  const [suggested, setSuggested] = useState('');

  useEffect(() => {
    getConfigStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <div style={card}>
      <h2 style={heading}>Conexión API HTTP para N8N</h2>
      <p style={{ fontSize: 13, color: '#6b5a4d' }}>N8N necesita una clave API para leer el menú y modificar el stock de forma segura.</p>

      <p style={{ fontSize: 13 }}>
        <strong>Tu API Key: </strong>
        {status === null ? (
          <span style={badgeStyle('#8a7a6a', '#f0eae2')}>Verificando…</span>
        ) : status.n8nConfigured ? (
          <span style={badgeStyle('#1a7a3d', '#e3f5e9')}>✅ Configurada</span>
        ) : (
          <span style={badgeStyle('var(--brand-danger)', '#fdeceb')}>⚠️ Sin configurar</span>
        )}
      </p>

      <p style={{ fontSize: 12, color: '#8a7a6a' }}>
        Por seguridad, esta llave no se genera ni se guarda desde la página (así nadie puede verla consultando la página) — se
        configura como variable de entorno <code>N8N_API_KEY</code> directamente en tu hosting (Easypanel → tu app →
        Environment). Usa ese MISMO valor en el header <code>Authorization</code> de tus flujos de N8N.
      </p>

      <button type="button" className="btn-pill btn-outline" onClick={() => setSuggested(generarKeySugerida())}>
        Sugerir una key nueva (solo para copiar)
      </button>
      {suggested && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: '#6b5a4d', display: 'block', marginBottom: 4 }}>
            Cópiala y pégala en Easypanel como N8N_API_KEY
          </label>
          <input readOnly value={suggested} onFocus={(e) => e.target.select()} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2cfb4', fontSize: 13 }} />
        </div>
      )}

      <h3 style={{ ...heading, fontSize: 16, marginTop: 22 }}>1. Consultar el menú</h3>
      <p style={{ fontSize: 13 }}>
        Método <code>GET</code>, URL: <code>/api/get-menu.php</code>, Header: <code>Authorization: Bearer [TU_KEY]</code>
      </p>
      <p style={{ fontSize: 13 }}>
        Devuelve el menú organizado por día, con nombre, precio, descripción, categoría, disponibilidad a domicilio, stock,
        estado de agotado, el cargo de empaque ya calculado por platillo, si el negocio está abierto ahora mismo
        (<code>abierto</code>), y la config de "para llevar"/zona de domicilio.
      </p>
      <p style={{ fontSize: 13 }}>
        <strong>Parámetro opcional:</strong> <code>?day=Lunes</code> trae solo ese día; <code>?day=today</code> trae el día
        actual. Sin el parámetro, trae los 7 días.
      </p>
      <p style={{ fontSize: 13 }}>
        Ejemplo para "el menú de hoy": <code>/api/get-menu.php?day=today</code>
      </p>
      <p style={{ fontSize: 13 }}>
        <strong>Zona de domicilio:</strong> la respuesta incluye <code>deliveryZoneConfig</code> con la dirección del local y
        el rango de carreras/calles a las que sí se hace domicilio (si lo configuraste en "Disponibilidad"). Este dato solo
        llega hasta acá, protegido con tu API Key — nunca se muestra en la página pública.
      </p>

      <h3 style={{ ...heading, fontSize: 16, marginTop: 22 }}>2. Actualizar stock de un platillo</h3>
      <p style={{ fontSize: 13 }}>
        Método <code>POST</code>, URL: <code>/api/update-stock.php</code>, Header: <code>Authorization: Bearer [TU_KEY]</code>,
        Body: <code>{'{ "id": 1, "stock": 19 }'}</code> — el <code>id</code> es el <code>scheduleId</code> que devuelve
        get-menu.php, no el id del platillo.
      </p>
    </div>
  );
}

function badgeStyle(color, bg) {
  return { color, background: bg, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 };
}
