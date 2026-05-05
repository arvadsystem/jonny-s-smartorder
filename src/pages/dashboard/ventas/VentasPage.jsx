import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { normalizeCierresCajaTab } from '../../../utils/cierresCajaRouting';
import CajaView from './components/CajaView';
import DescuentosView from './components/DescuentosView';
import PedidosView from './components/PedidosView';
import VentaDetalleModal from './components/VentaDetalleModal';
import VentaOverviewView from './components/VentaOverviewView';
import VentaReversionModal from './components/VentaReversionModal';
import VentasToast from './components/VentasToast';
import { useVentas } from './hooks/useVentas';
import {
  getAllowedTabs,
  MODULE_PRIMARY_PERMISSION,
  PERMISSIONS,
  resolveVentasStatsVisibility
} from '../../../utils/permissions';
import './styles/ventas.css';

const VENTAS_TABS = new Set(['ventas', 'caja', 'pedidos', 'descuentos']);

export default function VentasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAny, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const {
    ventas,
    summary,
    pagination,
    scopeInfo,
    ventasFilters,
    sucursales,
    categorias,
    productos,
    combos,
    recetas,
    descuentosCatalogo,
    tiposDepartamento,
    clientes,
    loading,
    catalogLoading,
    saving,
    detailLoading,
    error,
    catalogErrors,
    toast,
    closeToast,
    setVentasSearch,
    setVentasPage,
    setVentasPageSize,
    setVentasSucursal,
    createVenta,
    getVentaDetail,
    refreshVentas
  } = useVentas();

  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpen, setDetailOpen] = useState(false);
  const [reversionOpen, setReversionOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [selectedVentaReversion, setSelectedVentaReversion] = useState(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('ventas', permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );
  const fallbackTab = allowedTabs[0] || null;
  const canCreateVenta = canAny([PERMISSIONS.VENTAS_CREAR]);
  const canApplyDiscount = canAny([PERMISSIONS.VENTAS_DESCUENTO_APLICAR]);
  const canExportVenta = canAny([PERMISSIONS.VENTAS_EXPORTAR]);
  const canPrintVenta = canAny([PERMISSIONS.VENTAS_IMPRIMIR]);
  const canViewDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_VER]);
  const canCreateReversion = canAny(['VENTAS_REVERSION_CREAR']);
  const canCreateDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_CREAR]);
  const canEditDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_EDITAR]);
  const canToggleDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_ESTADO_CAMBIAR]);
  const userSucursalId = Number.parseInt(
    String(scopeInfo?.userSucursalId ?? user?.id_sucursal ?? ''),
    10
  );
  const statsVisibility = useMemo(
    () => resolveVentasStatsVisibility(user?.roles, { isSuperAdmin }),
    [isSuperAdmin, user?.roles]
  );

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tab = String(searchParams.get('tab') || fallbackTab).toLowerCase();
    return allowedTabs.includes(tab) ? tab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    const rawTab = String(searchParams.get('tab') || '');
    const normalizedRawTab = rawTab
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-');
    if (!normalizedRawTab || VENTAS_TABS.has(normalizedRawTab)) return;

    const cierresTab = normalizeCierresCajaTab(normalizedRawTab);
    if (!cierresTab) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', cierresTab);
    navigate(`/dashboard/cierres-caja?${nextParams.toString()}`, { replace: true });
  }, [navigate, searchParams]);

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

  const openReversionFromDetail = async (ventaBase) => {
    if (!ventaBase?.id_factura) return;
    try {
      const detail = await getVentaDetail(ventaBase.id_factura);
      setSelectedVentaReversion(detail);
      setReversionOpen(true);
    } catch {
      // El hook ya muestra error.
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
          summary={summary}
          pagination={pagination}
          scopeInfo={scopeInfo}
          ventasFilters={ventasFilters}
          sucursales={sucursales}
          loading={loading}
          error={error}
          statsVisibility={statsVisibility}
          onSearchChange={setVentasSearch}
          onPageChange={setVentasPage}
          onPageSizeChange={setVentasPageSize}
          onSucursalChange={setVentasSucursal}
          onOpenDetail={openDetail}
          onGoToCaja={() => goToTab('caja')}
          canCreate={canCreateVenta}
          onOpenReversion={() => {
            setSelectedVentaReversion(null);
            setReversionOpen(true);
          }}
          canReversion={canCreateReversion}
        />
      ) : null}

      {activeTab === 'caja' ? (
        <CajaView
          sucursales={sucursales}
          isSuperAdmin={isSuperAdmin}
          defaultSucursalId={Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
          productos={productos}
          categorias={categorias}
          tiposDepartamento={tiposDepartamento}
          clientes={clientes}
          combos={combos}
          recetas={recetas}
          descuentosCatalogo={descuentosCatalogo}
          canApplyDiscount={canApplyDiscount}
          catalogLoading={catalogLoading}
          catalogErrors={catalogErrors}
          saving={saving}
          onSubmit={handleCreateVenta}
        />
      ) : null}

      {activeTab === 'pedidos' ? <PedidosView /> : null}
      {activeTab === 'descuentos' ? (
        <DescuentosView
          canView={canViewDescuentos}
          canCreate={canCreateDescuentos}
          canEdit={canEditDescuentos}
          canToggle={canToggleDescuentos}
          productos={productos}
          recetas={recetas}
          combos={combos}
          sucursales={sucursales}
          isSuperAdmin={isSuperAdmin}
          defaultSucursalId={Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
        />
      ) : null}

      <VentaDetalleModal
        open={detailOpen}
        venta={selectedVenta}
        loading={detailLoading}
        canReversion={canCreateReversion}
        onOpenReversion={(ventaDetail) => {
          openReversionFromDetail(ventaDetail);
        }}
        canExport={canExportVenta}
        canPrint={canPrintVenta}
        onClose={() => setDetailOpen(false)}
      />

      <VentaReversionModal
        open={reversionOpen}
        onClose={() => {
          setReversionOpen(false);
          setSelectedVentaReversion(null);
        }}
        getVentaDetail={getVentaDetail}
        scopeInfo={scopeInfo}
        sucursales={sucursales}
        selectedVenta={selectedVentaReversion}
        onSuccess={() => {
          refreshVentas?.();
        }}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
