import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (login(email, password)) {
      setError('');
      onClose();
      navigate('/admin');
    } else {
      setError('Credenciales inválidas.');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
          ×
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 0, color: 'var(--brand-text-dark)' }}>
          Iniciar sesión
        </h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          </label>
          {error && <p style={{ color: 'var(--brand-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" className="btn-pill btn-orange" style={{ marginTop: 6 }}>
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', width: 320, position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 22, cursor: 'pointer' };
const labelStyle = { fontSize: 13, color: '#6b5a4d', display: 'flex', flexDirection: 'column', gap: 4 };
const inputStyle = { padding: '9px 10px', borderRadius: 8, border: '1px solid #e2cfb4', background: '#fffdfa', fontSize: 14 };
