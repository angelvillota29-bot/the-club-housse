import { useState } from 'react';
import { useData } from '../context/DataContext';
import { isSafeHttpUrl } from '../lib/format';
import PrivacyButton from '../components/PrivacyButton';
import TermsButton from '../components/TermsButton';

export default function About() {
  const { state } = useData();
  const branding = state?.brandingConfig || {};
  const name = branding.name || 'The Club Housse';
  const [verDatos, setVerDatos] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);

  // Canales de contacto como enlaces de texto (ya no hay botones flotantes).
  const canales = [];
  if (branding.whatsappNumber) {
    canales.push({ label: 'WhatsApp', href: `https://wa.me/${String(branding.whatsappNumber).replace(/\D/g, '')}?text=${encodeURIComponent(branding.whatsappMessage || '')}` });
  }
  if (isSafeHttpUrl(branding.telegramUrl)) canales.push({ label: 'Telegram', href: branding.telegramUrl });
  if (isSafeHttpUrl(branding.instagramUrl)) canales.push({ label: 'Instagram', href: branding.instagramUrl });
  if (isSafeHttpUrl(branding.xUrl)) canales.push({ label: 'X', href: branding.xUrl });

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
        {canales.length > 0 && (
          <div>
            <div style={etiqueta}>Escríbenos</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {canales.map((c) => (
                <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className="btn-pill btn-outline" style={{ textDecoration: 'none', fontSize: 13, padding: '6px 14px' }}>
                  {c.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--brand-card-border)' }}>
        <div style={etiqueta}>Información legal</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn-pill btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => setVerDatos(true)}>
            🔒 Tus datos
          </button>
          <button className="btn-pill btn-outline" style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => setVerTerminos(true)}>
            📋 Términos y condiciones
          </button>
        </div>
      </div>

      {verDatos && <PrivacyButton inline onClose={() => setVerDatos(false)} />}
      {verTerminos && <TermsButton inline onClose={() => setVerTerminos(false)} />}
    </div>
  );
}

const etiqueta = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a68f78' };

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={etiqueta}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--brand-text-dark)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
