import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { getFirstAccessibleDashboardPath, PERMISSIONS } from '../../utils/permissions';
import KpiGrid from './inicio/components/KpiGrid';
import AlertsPanel from './inicio/components/AlertsPanel';
import OperationsSnapshot from './inicio/components/OperationsSnapshot';
import QuickActions from './inicio/components/QuickActions';
import { useInicioDashboardData } from './inicio/hooks/useInicioDashboardData';
import './inicio/inicio-dashboard.css';

const Inicio = () => {
  const { user } = useAuth();
  const { can, isSuperAdmin, loading, permisos } = usePermisos();
  const safeCan = typeof can === 'function' ? can : () => false;

  const nombre = user?.nombre_usuario || 'Usuario';
  const canViewDashboard = safeCan(PERMISSIONS.DASHBOARD_VER);
  const fallbackPath = useMemo(
    () => getFirstAccessibleDashboardPath(permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );
  const {
    loading: loadingDashboard,
    error,
    metrics,
    alerts,
    refresh,
    lastUpdatedAt
  } = useInicioDashboardData({ can: safeCan, isSuperAdmin });
  const updateLabel = useMemo(() => {
    if (!lastUpdatedAt) return 'Sin sincronizacion';
    return lastUpdatedAt.toLocaleTimeString();
  }, [lastUpdatedAt]);

  if (loading) {
    return (
      <div className="p-4 text-center text-muted" role="status" aria-live="polite">
        Cargando permisos del dashboard...
      </div>
    );
  }

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
    <div className="inicio-dashboard fade-in">
      <section className="inicio-hero">
        <div className="inicio-hero__top">
          <span className="inicio-hero__badge">
            <i className="bi bi-activity" aria-hidden="true" />
            Centro operativo
          </span>
          <button
            type="button"
            className="inicio-hero__refresh"
            onClick={refresh}
            disabled={loadingDashboard}
            aria-label="Actualizar metricas"
          >
            <i className={`bi ${loadingDashboard ? 'bi-arrow-repeat' : 'bi-arrow-clockwise'}`} />
          </button>
        </div>
        <h1>Panel ejecutivo, {nombre}</h1>
        <p>Vista global del negocio para priorizar ventas, cocina e inventario en segundos.</p>
        <p>Ultima actualizacion: {updateLabel}</p>
      </section>

      {error ? <div className="inicio-inline-message is-error">{error}</div> : null}

      <KpiGrid metrics={metrics} />

      <div className="inicio-panels-grid">
        <AlertsPanel alerts={alerts} />
        <OperationsSnapshot metrics={metrics} />
      </div>

      <QuickActions can={can} permissions={PERMISSIONS} />
    </div>
  );
};

export default Inicio;
