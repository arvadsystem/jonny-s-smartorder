import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import CajaView from './components/CajaView';
import PedidosView from './components/PedidosView';
import VentaDetalleModal from './components/VentaDetalleModal';
import VentaOverviewView from './components/VentaOverviewView';
import VentasToast from './components/VentasToast';
import { useVentas } from './hooks/useVentas';
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION, PERMISSIONS } from '../../../utils/permissions';
import './styles/ventas.css';

export default function VentasPage() {
  const { canAny, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const {
    ventas,
    categorias,
    productos,
    combos,
    recetas,
    clientes,
    loading,
    catalogLoading,
    saving,
    detailLoading,
    error,
    toast,
    closeToast,
    createVenta,
    getVentaDetail
  } = useVentas();

  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('ventas', permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );
  const fallbackTab = allowedTabs[0] || null;
  const canCreateVenta = canAny([PERMISSIONS.VENTAS_CREAR]);
  const canExportVenta = canAny([PERMISSIONS.VENTAS_EXPORTAR]);
  const canPrintVenta = canAny([PERMISSIONS.VENTAS_IMPRIMIR]);

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tab = String(searchParams.get('tab') || fallbackTab).toLowerCase();
    return allowedTabs.includes(tab) ? tab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    if (permisosLoading || !fallbackTab) return;
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (rawTab && allowedTabs.includes(rawTab)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', fallbackTab);
    setSearchParams(nextParams, { replace: true });
  }, [allowedTabs, fallbackTab, permisosLoading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!detailOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);

  const goToTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabKey);
    setSearchParams(nextParams);
  };

  const openDetail = async (venta) => {
    if (!venta?.id_factura) return;

    setSelectedVenta(venta);
    setDetailOpen(true);

    try {
      const detail = await getVentaDetail(venta.id_factura);
      setSelectedVenta(detail);
    } catch {
      // El hook ya expone el feedback visual.
    }
  };

  const handleCreateVenta = async (payload) => {
    const response = await createVenta(payload);

    if (response?.id_factura) {
      goToTab('ventas');

      try {
        const detail = await getVentaDetail(response.id_factura);
        setSelectedVenta(detail);
        setDetailOpen(true);
      } catch {
        // El listado ya se refresco aunque falle el detalle.
      }
    }

    return response;
  };

  if (permisosLoading) return null;
  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.ventas}
        detalle="No tienes acceso a ningun submodulo de Ventas."
      />
    );
  }

  return (
    <>
      {activeTab === 'ventas' ? (
        <VentaOverviewView
          ventas={ventas}
          loading={loading}
          error={error}
          onOpenDetail={openDetail}
          onGoToCaja={() => goToTab('caja')}
          canCreate={canCreateVenta}
        />
      ) : null}

      {activeTab === 'caja' ? (
        <CajaView
          productos={productos}
          categorias={categorias}
          clientes={clientes}
          combos={combos}
          recetas={recetas}
          catalogLoading={catalogLoading}
          saving={saving}
          onSubmit={handleCreateVenta}
        />
      ) : null}

      {activeTab === 'pedidos' ? <PedidosView /> : null}

      <VentaDetalleModal
        open={detailOpen}
        venta={selectedVenta}
        loading={detailLoading}
        canExport={canExportVenta}
        canPrint={canPrintVenta}
        onClose={() => setDetailOpen(false)}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
