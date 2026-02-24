import { createContext, useEffect, useState } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al cargar la app: si hay cookie válida, recupera el usuario
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await authService.me();
        if (!cancelled) setUser(data?.usuario ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

      useEffect(() => {
      const handler = () => setUser(null);
      window.addEventListener('auth:logout', handler);
      return () => window.removeEventListener('auth:logout', handler);
    }, []);

  const login = (usuario) => {
    setUser(usuario);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // aunque falle la llamada, igual cerramos sesión en UI
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
