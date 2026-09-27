import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { verifyGoogleLogin, fetchSession, logoutSession, getConfigStatus } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { email, role } | null
  const [googleClientId, setGoogleClientId] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([fetchSession().catch(() => ({ success: false })), getConfigStatus().catch(() => ({}))]).then(
      ([sessionRes, cfg]) => {
        setSession(sessionRes.success ? { email: sessionRes.email, role: sessionRes.role } : null);
        setGoogleClientId(cfg.googleClientId || '');
        setReady(true);
      },
    );
  }, []);

  const loginWithGoogle = async (idToken) => {
    const r = await verifyGoogleLogin(idToken);
    if (r.success) {
      setSession({ email: r.email, role: r.role });
      return true;
    }
    return false;
  };

  const logout = async () => {
    await logoutSession().catch(() => {});
    setSession(null);
  };

  const value = useMemo(() => {
    const role = session?.role || null;
    return {
      user: session?.email || null,
      role,
      isAdmin: role === 'admin' || role === 'superadmin',
      isSuperAdmin: role === 'superadmin',
      googleClientId,
      ready,
      loginWithGoogle,
      logout,
    };
  }, [session, googleClientId, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
