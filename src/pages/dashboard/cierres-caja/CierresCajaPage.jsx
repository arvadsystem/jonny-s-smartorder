import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { normalizeCierresCajaTab } from '../../../utils/cierresCajaRouting';
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from '../../../utils/permissions';
import CierresCajaView from '../ventas/components/cierres/CierresCajaView';
import CierresCajaHistorialView from './components/CierresCajaHistorialView';
import CierresCajaAsignacionesView from './components/CierresCajaAsignacionesView';
import '../ventas/styles/ventas.css';
import '../ventas/styles/cierres-caja.css';
import '../fidelizacion/styles/fidelizacion.css';

export default function CierresCajaPage() {
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const [searchParams, setSearchParams] = useSearchParams();

  const allowedTabs = useMemo(
    () => getAllowedTabs('cierres-caja', permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0] || null;

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tab = normalizeCierresCajaTab(searchParams.get('tab') || fallbackTab) || fallbackTab;
    return allowedTabs.includes(tab) ? tab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    if (permisosLoading || !fallbackTab) return;
    const rawTab = String(searchParams.get('tab') || '');
    const normalizedTab = normalizeCierresCajaTab(rawTab);
    const hasAllowedTab = normalizedTab && allowedTabs.includes(normalizedTab);
    const shouldKeepCurrent = hasAllowedTab && normalizedTab === rawTab;
    if (shouldKeepCurrent) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', hasAllowedTab ? normalizedTab : fallbackTab);
    setSearchParams(nextParams, { replace: true });
  }, [allowedTabs, fallbackTab, permisosLoading, searchParams, setSearchParams]);

  if (permisosLoading) return null;

  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION['cierres-caja']}
        detalle="No tienes acceso a ningun submodulo de Cierres de caja."
      />
    );
  }

  return (
    <>
      {activeTab === 'operacion' ? <CierresCajaView /> : null}
      {activeTab === 'cierres-historial' ? <CierresCajaHistorialView /> : null}
      {activeTab === 'asignaciones' ? <CierresCajaAsignacionesView /> : null}
    </>
  );
}
