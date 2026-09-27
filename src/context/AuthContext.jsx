import { createContext, useContext, useMemo, useState } from 'react';
import { useData } from './DataContext';

const AuthContext = createContext(null);
const SUPREME_ADMIN_EMAIL = 'angelvillota4@gmail.com';

export function AuthProvider({ children }) {
  const { state } = useData();
  const [user, setUser] = useState(null);

  const login = (email, password) => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const match = state?.usersData?.find((u) => u.email === trimmedEmail && u.password === trimmedPassword);
    if (match || (trimmedEmail === SUPREME_ADMIN_EMAIL && trimmedPassword === '1234')) {
      setUser(trimmedEmail);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  const value = useMemo(() => ({ user, login, logout, isSuperAdmin: user === SUPREME_ADMIN_EMAIL }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
