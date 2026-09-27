import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { card, input, label, listItem, smallBtn, heading } from '../adminStyles';

export default function Users() {
  const { state, save } = useData();
  const [email, setEmail] = useState('');

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
    </div>
  );
}
