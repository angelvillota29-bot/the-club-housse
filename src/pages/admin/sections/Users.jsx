import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { card, input, label, listItem, smallBtn, heading } from '../adminStyles';

export default function Users() {
  const { state, save } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    await save({ usersData: [...state.usersData, { email: email.trim(), password: password.trim() }] });
    setEmail('');
    setPassword('');
  };

  const remove = async (userEmail) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await save({ usersData: state.usersData.filter((u) => u.email !== userEmail) });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Crear nuevo usuario</h2>
        <form onSubmit={submit}>
          <label style={label}>
            Correo
            <input type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label style={label}>
            Contraseña
            <input type="password" style={input} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-pill btn-orange">Crear</button>
        </form>
      </div>
      <div style={card}>
        {state.usersData.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin usuarios adicionales.</p>}
        {state.usersData.map((u) => (
          <div key={u.email} style={listItem}>
            <span>{u.email}</span>
            <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(u.email)}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
