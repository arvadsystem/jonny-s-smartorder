import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  buildPermissionSet,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isSuperAdminRoleList,
  normalizePermissions
} from '../utils/permissions';

const PermisosContext = createContext(null);

export const PermisosProvider = ({ children }) => {
  const { user } = useAuth();
  const [permisos, setPermisos] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = useMemo(() => isSuperAdminRoleList(user?.roles), [user?.roles]);

  const hydrateFromRemote = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/seguridad/permisos', 'GET');
      setPermisos(buildPermissionSet(data?.permisos));
    } catch {
      setPermisos(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const idUsuario = Number.parseInt(String(user?.id_usuario ?? ''), 10);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      setPermisos(new Set());
      setLoading(false);
      return;
    }

    const userPermisos = normalizePermissions(user?.permisos);
    if (userPermisos.length > 0) {
      setPermisos(new Set(userPermisos));
      setLoading(false);
      return;
    }

    void hydrateFromRemote();
  }, [hydrateFromRemote, user?.id_usuario, user?.permisos]);

  const value = useMemo(() => {
    const permissionOptions = { isSuperAdmin };
    const can = (permiso) => hasPermission(permisos, permiso, permissionOptions);
    const canAny = (required) => hasAnyPermission(permisos, required, permissionOptions);
    const canAll = (required) => hasAllPermissions(permisos, required, permissionOptions);

    return {
      can,
      canAny,
      canAll,
      isSuperAdmin,
      permisos,
      loading,
      reload: hydrateFromRemote
    };
  }, [hydrateFromRemote, isSuperAdmin, loading, permisos]);

  return <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>;
};

export const usePermisos = () => {
  const ctx = useContext(PermisosContext);
  if (!ctx) throw new Error('usePermisos debe usarse dentro de PermisosProvider');
  return ctx;
};