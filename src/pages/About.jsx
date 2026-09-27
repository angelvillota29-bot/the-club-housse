import { useData } from '../context/DataContext';

export default function About() {
  const { state } = useData();
  const branding = state?.brandingConfig || {};
  const name = branding.name || 'The Club Housse';

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--brand-text-dark)' }}>Acerca de {name}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5c4a3a' }}>
        Comidas rápidas hechas al momento — sandwiches, salchipapas, pan cook y más. "¿Hoy qué te provoca?"
      </p>

      <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
        <InfoRow label="Dirección" value={branding.address || 'Cra 26p10 93-60, Marroquín 1 - Comuna 14'} />
        <InfoRow label="Domicilios" value={branding.whatsappNumber || '318 762 8155'} />
        <InfoRow label="Pagos" value="Efectivo, Nequi, Daviplata, Datáfono" />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a68f78' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--brand-text-dark)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
