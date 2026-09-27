import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ onClose }) {
  const { loginWithGoogle, googleClientId } = useAuth();
  const btnRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!googleClientId) {
      setError('El login con Google todavía no está configurado en este sitio.');
      return;
    }
    if (!window.google?.accounts?.id) {
      setError('No se pudo cargar el login de Google. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (resp) => {
        const ok = await loginWithGoogle(resp.credential);
        if (ok) onClose();
        else setError('No se pudo iniciar sesión. Intenta de nuevo.');
      },
    });
    if (btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', width: 260, locale: 'es' });
    }
  }, [googleClientId, loginWithGoogle, onClose]);

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
          ×
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 0, color: 'var(--brand-text-dark)' }}>
          Iniciar sesión
        </h2>
        <p style={{ fontSize: 13, color: '#6b5a4d' }}>Usa tu cuenta de Google para crear tu cuenta o iniciar sesión.</p>
        <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }} />
        {error && <p style={{ color: 'var(--brand-danger)', fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 320, position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 22, cursor: 'pointer' };
