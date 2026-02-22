import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

const PermisosContext = createContext(null);

export const PermisosProvider = ({ children }) => {
  const [permisos, setPermisos] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const loadPermisos = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/seguridad/permisos", "GET");
      setPermisos(new Set(data?.permisos || []));
    } catch {
      // Si falla, dejamos vacío (no rompe UI)
      setPermisos(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermisos();
  }, []);

  const value = useMemo(() => {
    const can = (perm) => permisos.has(perm);
    return { can, permisos, loading, reload: loadPermisos };
  }, [permisos, loading]);

  return <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>;
};

export const usePermisos = () => {
  const ctx = useContext(PermisosContext);
  if (!ctx) throw new Error("usePermisos debe usarse dentro de PermisosProvider");
  return ctx;
};