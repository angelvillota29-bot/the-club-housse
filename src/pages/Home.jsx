import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function Home() {
  const { state } = useData();
  const branding = state?.brandingConfig || {};

  return (
    <div>
      <div className="hero-band">
        <div style={{ marginTop: 4 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1.05 }}>
            ¿Hoy qué
            <br />
            te provoca?
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#e8b98a' }}>{branding.name || 'The Club Housse'} · Comidas Rápidas</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link to="/menu" className="btn-pill btn-orange" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Ver el menú de hoy →
          </Link>
          <Link
            to="/menu"
            state={{ tipoEntrega: 'domicilio' }}
            className="btn-pill"
            style={{ display: 'inline-block', textDecoration: 'none', background: 'transparent', border: '2px solid var(--brand-cream)', color: 'var(--brand-cream)' }}
          >
            Haz tu pedido ya
          </Link>
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5c4a3a' }}>
          Sandwiches, salchipapas, pan cook y mucho más — pide para domicilio, para recoger, o siéntate a comer en el local.
          El menú de hoy está siempre a un clic.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Link to="/menu" state={{ tipoEntrega: 'domicilio' }} className="chip-tab" style={{ textDecoration: 'none' }}>
            Domicilio
          </Link>
          <Link to="/menu" state={{ tipoEntrega: 'recoger' }} className="chip-tab" style={{ textDecoration: 'none' }}>
            Recoger
          </Link>
          <Link to="/menu" state={{ tipoEntrega: 'comer_aqui' }} className="chip-tab" style={{ textDecoration: 'none' }}>
            Comer aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
