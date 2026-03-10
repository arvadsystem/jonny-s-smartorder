import React, { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { getFirstAccessibleDashboardPath, PERMISSIONS } from '../../utils/permissions';

const Inicio = () => {
  const { user } = useAuth();
  const { can, isSuperAdmin, loading, permisos } = usePermisos();

  const nombre = user?.nombre_usuario || 'Usuario';
  const canViewDashboard = can(PERMISSIONS.DASHBOARD_VER);
  const fallbackPath = useMemo(
    () => getFirstAccessibleDashboardPath(permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  if (loading) return null;

  if (!canViewDashboard) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <SinPermiso
        permiso={PERMISSIONS.DASHBOARD_VER}
        detalle="No tienes acceso a ningun modulo visible del sistema."
      />
    );
  }

  return (
    <div className="welcome-section fade-in">
      <div className="welcome-card">
        <div className="content">
          <h1>Bienvenido de nuevo, {nombre}.</h1>
          <p>Selecciona una opcion del menu lateral para comenzar a gestionar tu negocio.</p>

          <Link to={fallbackPath || '/dashboard/ventas'}>
            <button className="btn-black">Ir al modulo principal</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Inicio;
