import { createContext, useState, useEffect } from 'react';

// Creamos el contexto
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Al cargar la app, revisamos si ya hay sesión guardada
  useEffect(() => {
    const storedUser = localStorage.getItem('usuario');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  // 2. Función de Login (Guarda todo)
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('usuario', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  // 3. Función de Logout (CORRIGE HALLAZGO B: Borra todo)
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('usuario');
    localStorage.removeItem('token'); // <--- ¡Aquí borramos el token!
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};