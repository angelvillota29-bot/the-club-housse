import { NavLink, Link, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function NavBar({ onOpenLogin }) {
  const { state } = useData();
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const branding = state?.brandingConfig || {};
  const viewingAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="nav-bar">
      <Link to="/menu" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div className="badge-logo">{branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" /> : 'HOUSSE'}</div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff', fontSize: 16 }}>
          {branding.name || 'The Club Housse'}
        </span>
      </Link>

      {!viewingAdmin && (
        <nav className="nav-links">
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
          {isAdmin ? (
            <Link to="/admin" className="btn-pill btn-orange" style={{ fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
              Administración
            </Link>
          ) : (
            <Link to="/mi-cuenta" className="btn-pill btn-dark" style={{ fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
              Mi cuenta
            </Link>
          )}
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
