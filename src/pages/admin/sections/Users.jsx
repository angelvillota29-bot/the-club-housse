import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { setMeseroCredentials } from '../../../lib/api';
import { card, input, label, listItem, smallBtn, heading } from '../adminStyles';

export default function Users() {
  const { state, save } = useData();
  const [email, setEmail] = useState('');
  const [meseroUsuario, setMeseroUsuario] = useState('');
  const [meseroClave, setMeseroClave] = useState('');
  const [meseroMsg, setMeseroMsg] = useState('');
  const [guardandoMesero, setGuardandoMesero] = useState(false);

  const submitMesero = async (e) => {
    e.preventDefault();
    setGuardandoMesero(true);
    setMeseroMsg('');
    const r = await setMeseroCredentials(meseroUsuario.trim(), meseroClave);
    setGuardandoMesero(false);
    if (r.success) {
      setMeseroMsg('Guardado. Ya pueden entrar con este usuario y clave.');
      setMeseroClave('');
    } else {
      setMeseroMsg(r.error || 'No se pudo guardar');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || state.usersData.some((u) => u.email === trimmed)) {
      setEmail('');
      return;
    }
    await save({ usersData: [...state.usersData, { email: trimmed }] });
    setEmail('');
  };

  const remove = async (userEmail) => {
    if (!confirm('¿Eliminar este administrador?')) return;
    await save({ usersData: state.usersData.filter((u) => u.email !== userEmail) });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Agregar administrador</h2>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>
          Esta persona podrá entrar con su propia cuenta de Google (ya no con contraseña) y verá el panel de administración
          básico -- sin Pedidos, Conexión N8N ni Usuarios.
        </p>
        <form onSubmit={submit}>
          <label style={label}>
            Correo de Google
            <input type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button type="submit" className="btn-pill btn-orange">
            Agregar
          </button>
        </form>
      </div>
      <div style={card}>
        {state.usersData.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin administradores adicionales.</p>}
        {state.usersData.map((u) => (
          <div key={u.email} style={listItem}>
            <span>{u.email}</span>
            <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(u.email)}>
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={heading}>Acceso de meseros</h2>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>
          Un solo usuario y clave para todo el personal (no es una cuenta de Google). Con esto entran a hacer pedidos sin
          topar el límite anti-inundación de la página, y no pueden ver ni cambiar nada del panel de administración.
          Guardar una nueva clave reemplaza la anterior.
        </p>
        <form onSubmit={submitMesero}>
          <label style={label}>
            Usuario
            <input type="text" style={input} value={meseroUsuario} onChange={(e) => setMeseroUsuario(e.target.value)} required />
          </label>
          <label style={label}>
            Clave (mínimo 6 caracteres)
            <input type="password" style={input} value={meseroClave} onChange={(e) => setMeseroClave(e.target.value)} minLength={6} required />
          </label>
          <button type="submit" className="btn-pill btn-orange" disabled={guardandoMesero}>
            {guardandoMesero ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
        {meseroMsg && <p style={{ fontSize: 13, color: meseroMsg.startsWith('Guardado') ? 'var(--brand-text-dark)' : 'var(--brand-danger)' }}>{meseroMsg}</p>}
      </div>
    </div>
  );
}
