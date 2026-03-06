import { createContext, useEffect, useState } from 'react';
import authService from '../services/authService';
import { perfilService } from '../services/perfilService';

export const AuthContext = createContext();

const normalizePhoto = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const enrichUserWithPerfil = async (usuario) => {
  if (!usuario || typeof usuario !== 'object') return usuario ?? null;

  try {
    const perfilData = await perfilService.getPerfil();
    const fotoPerfil = normalizePhoto(perfilData?.perfil?.foto_perfil);
    return { ...usuario, foto_perfil: fotoPerfil };
  } catch {
    return usuario;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al cargar la app: si hay cookie válida, recupera el usuario
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await authService.me();
        const baseUser = data?.usuario ?? null;
        const nextUser = await enrichUserWithPerfil(baseUser);
        if (!cancelled) setUser(nextUser);
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
    const baseUser = usuario ?? null;
    setUser(baseUser);

    if (!baseUser || typeof baseUser !== 'object') return;

    void (async () => {
      const nextUser = await enrichUserWithPerfil(baseUser);

      setUser((current) => {
        if (!current || typeof current !== 'object') return current;
        if (String(current.id_usuario ?? '') !== String(baseUser.id_usuario ?? '')) return current;
        return nextUser;
      });
    })();
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
