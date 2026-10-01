import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ onClose }) {
  const { loginWithGoogle, loginMesero, googleClientId } = useAuth();
  const btnRef = useRef(null);
  const [error, setError] = useState('');
  const [modoMesero, setModoMesero] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);

  const submitMesero = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    const r = await loginMesero(usuario.trim(), clave);
    setEnviando(false);
    if (r.ok) onClose();
    else setError(r.error);
  };

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

        <p style={{ fontSize: 13, color: '#6b5a4d', display: modoMesero ? 'none' : 'block' }}>
          Usa tu cuenta de Google para crear tu cuenta o iniciar sesión.
        </p>
        <div ref={btnRef} style={{ display: modoMesero ? 'none' : 'flex', justifyContent: 'center', margin: '14px 0' }} />

        {modoMesero && (
          <form onSubmit={submitMesero}>
            <label style={{ fontSize: 13, color: '#6b5a4d', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              Usuario
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 13, color: '#6b5a4d', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              Clave
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required style={inputStyle} />
            </label>
            <button type="submit" className="btn-pill btn-orange" disabled={enviando} style={{ width: '100%' }}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {error && <p style={{ color: 'var(--brand-danger)', fontSize: 13 }}>{error}</p>}

        <button
          type="button"
          onClick={() => {
            setModoMesero((v) => !v);
            setError('');
          }}
          style={{ background: 'transparent', border: 'none', color: '#8a7a6a', fontSize: 12, cursor: 'pointer', marginTop: 10, textDecoration: 'underline', padding: 0 }}
        >
          {modoMesero ? '← Volver al login normal' : '¿Eres mesero? Inicia sesión aquí'}
        </button>
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 320, position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 22, cursor: 'pointer' };
const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e2cfb4', background: '#fffdfa', color: 'var(--brand-text-dark)', fontSize: 14, width: '100%', boxSizing: 'border-box' };
