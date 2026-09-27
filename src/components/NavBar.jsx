import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function NavBar({ onOpenLogin }) {
  const { state } = useData();
  const { user, logout } = useAuth();
  const branding = state?.brandingConfig || {};

  return (
    <div className="nav-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="badge-logo">{branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" /> : 'HOUSSE'}</div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff', fontSize: 16 }}>
          {branding.name || 'The Club Housse'}
        </span>
      </div>

      {!user && (
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Inicio
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => (isActive ? 'active' : '')}>
            Menú
          </NavLink>
          <NavLink to="/acerca-de" className={({ isActive }) => (isActive ? 'active' : '')}>
            Acerca de
          </NavLink>
        </nav>
      )}

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="nav-user-email" style={{ fontSize: 12, color: '#e8b98a' }}>
            {user}
          </span>
          <button className="btn-pill btn-dark" style={{ fontSize: 13, padding: '6px 14px' }} onClick={logout}>
            Salir
          </button>
        </div>
      ) : (
        <button className="btn-pill btn-orange" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onOpenLogin}>
          Iniciar sesión
        </button>
      )}
    </div>
  );
}
