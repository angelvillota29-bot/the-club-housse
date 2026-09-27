import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import SocialFloat from './components/SocialFloat';
import LoginModal from './components/LoginModal';
import PrivacyButton from './components/PrivacyButton';
import TermsButton from './components/TermsButton';
import { useData } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Menu from './pages/Menu';
import About from './pages/About';
import AdminDashboard from './pages/admin/Dashboard';

export default function App() {
  const { loading, error } = useData();
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-cream)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--brand-text-dark)' }}>Cargando el menú…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-cream)' }}>
        <p style={{ color: 'var(--brand-danger)' }}>No se pudo cargar el menú. Intenta recargar la página.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand-cream)' }}>
      <NavBar onOpenLogin={() => setShowLogin(true)} />
      <main>
        {user ? (
          <AdminDashboard />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/acerca-de" element={<About />} />
            <Route path="*" element={<Home />} />
          </Routes>
        )}
      </main>
      <SocialFloat />
      {!user && (
        <>
          <PrivacyButton />
          <TermsButton />
        </>
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
