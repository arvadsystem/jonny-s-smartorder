import { useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeVentaDetail } from './utils/ventasHelpers';
import {
  getAllowedTabs,
  MODULE_PRIMARY_PERMISSION,
  PERMISSIONS,
  normalizeRoles,
  resolveVentasStatsVisibility
} from '../../../utils/permissions';
import './styles/ventas.css';

const VENTAS_TABS = new Set(['ventas', 'caja', 'pedidos', 'descuentos']);

const hasCreateVentaDetailPayload = (response) =>
  response?.ticket_ready === true &&
  Number(response?.id_factura || 0) > 0 &&
  Array.isArray(response?.items) &&
  response.items.length > 0;

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
    openToast,
    closeToast,
    setVentasSearch,
    setVentasPage,
    setVentasPageSize,
    setVentasSucursal,
    setVentasFilterPatch,
    clearVentasFilters,
    createVenta,
    createPedidoPendiente,
    registrarPagoPedido,
    getVentaDetail,
    refreshVentas,
    refreshCatalogs,
    refreshClientesCatalog
  } = useVentas();

  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpen, setDetailOpen] = useState(false);
  const [reversionOpen, setReversionOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [selectedVentaReversion, setSelectedVentaReversion] = useState(null);
  const detailRequestRef = useRef(0);

  const isCajeroOnly = useMemo(() => {
    const roles = normalizeRoles(user?.roles);
    const hasAdminRole = roles.some((role) =>
      ['ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN'].includes(role)
    );
    return roles.includes('CAJERO') && !isSuperAdmin && !hasAdminRole;
  }, [isSuperAdmin, user?.roles]);
  const allowedTabs = useMemo(() => {
    const tabs = getAllowedTabs('ventas', permisos, { isSuperAdmin }).map((tab) => tab.key);
    return isCajeroOnly ? tabs.filter((tab) => tab !== 'descuentos') : tabs;
  }, [isCajeroOnly, isSuperAdmin, permisos]);
  const fallbackTab = allowedTabs[0] || null;
  const canCreateVenta = canAny([PERMISSIONS.VENTAS_CREAR]);
  const canApplyDiscount = canAny([PERMISSIONS.VENTAS_DESCUENTO_APLICAR]);
  const canExportVenta = canAny([PERMISSIONS.VENTAS_EXPORTAR]);
  const canPrintVenta = canAny([PERMISSIONS.VENTAS_IMPRIMIR]);
  const canViewDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_VER]);
  const canManageReversionByRole = useMemo(() => {
    const roles = normalizeRoles(user?.roles);
    return isSuperAdmin || roles.some((role) =>
      ['ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN'].includes(role)
    );
  }, [isSuperAdmin, user?.roles]);
  const canCreateReversion = canManageReversionByRole && canAny(['VENTAS_REVERSION_CREAR']);
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

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedVenta(venta);
    setDetailOpen(true);

    try {
      const detail = await getVentaDetail(venta.id_factura);
      if (detailRequestRef.current !== requestId) return;
      setSelectedVenta(detail);
    } catch {
      // El hook ya expone el feedback visual.
    }
  };

  const openReversionFromDetail = async (ventaBase) => {
    if (!canCreateReversion || !ventaBase?.id_factura) return;
    try {
      const detail = await getVentaDetail(ventaBase.id_factura);
      setSelectedVentaReversion(detail);
      setReversionOpen(true);
    } catch {
      // El hook ya muestra error.
    }
  };

  const handleCreateVenta = async (payload, options) => {
    const response = await createVenta(payload, options);

    if (response?.id_factura) {
      goToTab('ventas');

      if (hasCreateVentaDetailPayload(response)) {
        detailRequestRef.current += 1;
        setSelectedVenta(normalizeVentaDetail(response));
        setDetailOpen(true);
        return response;
      }

      try {
        const detail = await getVentaDetail(response.id_factura);
        setSelectedVenta(detail);
        setDetailOpen(true);
      } catch {
        // El hook ya muestra el error del detalle.
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
          onFiltersChange={setVentasFilterPatch}
          onClearFilters={clearVentasFilters}
          onOpenDetail={openDetail}
          onGoToCaja={() => goToTab('caja')}
          canCreate={canCreateVenta}
          onOpenReversion={() => {
            if (!canCreateReversion) return;
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
          onCreatePedidoPendiente={createPedidoPendiente}
          onRegistrarPagoPedido={registrarPagoPedido}
          onCatalogSucursalChange={refreshCatalogs}
          onClientesRefresh={refreshClientesCatalog}
          onNotify={openToast}
        />
      ) : null}

      {activeTab === 'pedidos' ? (
        <PedidosView
          isSuperAdmin={isSuperAdmin}
          sucursales={sucursales}
          defaultSucursalId={Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
          scopeInfo={scopeInfo}
          canPrintVenta={canPrintVenta}
        />
      ) : null}
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
          if (!canCreateReversion) return;
          openReversionFromDetail(ventaDetail);
        }}
        canExport={canExportVenta}
        canPrint={canPrintVenta}
        onClose={() => {
          detailRequestRef.current += 1;
          setDetailOpen(false);
        }}
      />

      {canCreateReversion ? (
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
          onSuccess={(result, refreshedDetail) => {
            void refreshVentas?.({ suppressErrors: true });
            if (refreshedDetail?.id_factura) {
              setSelectedVenta(refreshedDetail);
              setSelectedVentaReversion(refreshedDetail);
              return;
            }
            const idFactura =
              result?.id_factura_original ||
              result?.id_factura ||
              selectedVentaReversion?.id_factura ||
              selectedVenta?.id_factura;
            if (idFactura) {
              void getVentaDetail(idFactura)
                .then((detail) => {
                  setSelectedVenta(detail);
                  setSelectedVentaReversion(detail);
                })
                .catch(() => undefined);
            }
          }}
        />
      ) : null}

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
