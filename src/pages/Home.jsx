import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function Home() {
  const { state } = useData();
  const branding = state?.brandingConfig || {};

  return (
    <div>
      <div className="hero-band">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="badge-logo" style={{ width: 52, height: 52 }}>
            {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" /> : 'HOUSSE'}
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1.05 }}>
            ¿Hoy qué
            <br />
            te provoca?
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#e8b98a' }}>{branding.name || 'The Club Housse'} · Comidas Rápidas</div>
        </div>
        <Link to="/menu" className="btn-pill btn-orange" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
          Ver el menú de hoy →
        </Link>
      </div>

      <div style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5c4a3a' }}>
          Sandwiches, salchipapas, pan cook y mucho más — pide para domicilio, para recoger, o siéntate a comer en el local.
          El menú de hoy está siempre a un clic.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <div className="chip-tab" style={{ pointerEvents: 'none' }}>Domicilio</div>
          <div className="chip-tab" style={{ pointerEvents: 'none' }}>Recoger</div>
          <div className="chip-tab" style={{ pointerEvents: 'none' }}>Comer aquí</div>
        </div>
      </div>
    </div>
  );
}
