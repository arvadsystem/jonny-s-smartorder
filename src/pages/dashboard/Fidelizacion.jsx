import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { usePermisos } from '../../context/PermisosContext';
import { useAuth } from '../../hooks/useAuth';
import sucursalesService from '../../services/sucursalesService';
import VentasToast from './ventas/components/VentasToast';
import FidelizacionOverview from './fidelizacion/components/FidelizacionOverview';
import FidelizacionCanjesList from './fidelizacion/components/FidelizacionCanjesList';
import ClienteDetalleModal from './fidelizacion/components/ClienteDetalleModal';
import CanjeDetalleModal from './fidelizacion/components/CanjeDetalleModal';
import GenerarCanjeModal from './fidelizacion/components/GenerarCanjeModal';
import ConfiguracionReglasModal from './fidelizacion/components/ConfiguracionReglasModal';
import { useFidelizacion } from './fidelizacion/hooks/useFidelizacion';
import { getAllowedTabs, PERMISSIONS } from '../../utils/permissions';
import { extractApiMessage } from './fidelizacion/utils/fidelizacionHelpers';
import './ventas/styles/ventas.css';
import './fidelizacion/styles/fidelizacion.css';

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export default function FidelizacionPage() {
  const { user } = useAuth();
  const { canAny, canAll, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const {
    panelData,
    clientes,
    clientesMeta,
    canjes,
    canjesMeta,
    loadingPanel,
    loadingClientes,
    loadingCanjes,
    detailLoading,
    saving,
    toast,
    openToast,
    closeToast,
    loadPanel,
    loadClientes,
    loadCanjes,
    getClienteById,
    getClienteCanjeables,
    getConfiguracion,
    saveConfiguracion,
    createCanje,
    getCanjeById
  } = useFidelizacion();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [scopeInitialized, setScopeInitialized] = useState(false);

  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedClienteDetalle, setSelectedClienteDetalle] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [canjeModalOpen, setCanjeModalOpen] = useState(false);
  const [canjeablesData, setCanjeablesData] = useState({ items: [], message: '', saldoCliente: null });

  const [configOpen, setConfigOpen] = useState(false);
  const [configActiva, setConfigActiva] = useState(null);

  const [canjeDetalleOpen, setCanjeDetalleOpen] = useState(false);
  const [selectedCanje, setSelectedCanje] = useState(null);

  const [clientesQuery, setClientesQuery] = useState({
    search: '',
    page: 1,
    limit: 20
  });
  const [canjesQuery, setCanjesQuery] = useState({
    page: 1,
    limit: 20,
    desde: '',
    hasta: '',
    estado: ''
  });

  const allowedTabs = useMemo(
    () => getAllowedTabs('fidelizacion', permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0] || null;
  const canViewPanel = canAny([PERMISSIONS.FIDELIZACION_VER_PANEL]);
  const canViewClientes = canAny([PERMISSIONS.FIDELIZACION_VER_CLIENTES]);
  const canConfigure = canAll([
    PERMISSIONS.FIDELIZACION_VER_PANEL,
    PERMISSIONS.FIDELIZACION_CONFIGURAR_REGLAS,
    PERMISSIONS.FIDELIZACION_GESTIONAR_PRODUCTOS_CANJEABLES
  ]);
  const canCanjear = canAny([PERMISSIONS.FIDELIZACION_CANJEAR_PRESENCIAL]);
  const canUseCanjeFlow = canCanjear && canViewClientes;
  const canViewCanjes = canAny([PERMISSIONS.FIDELIZACION_VER_CANJES]);
  const canScopeMulti =
    isSuperAdmin || canAny([PERMISSIONS.FIDELIZACION_VER_MULTISUCURSAL]);
  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tab = String(searchParams.get('tab') || fallbackTab).toLowerCase();
    return allowedTabs.includes(tab) ? tab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  const scopeQuery = useMemo(() => {
    const parsed = Number.parseInt(String(selectedSucursalId || ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
  }, [selectedSucursalId]);

  useEffect(() => {
    if (permisosLoading || !fallbackTab) return;
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (rawTab && allowedTabs.includes(rawTab)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', fallbackTab);
    setSearchParams(nextParams, { replace: true });
  }, [allowedTabs, fallbackTab, permisosLoading, searchParams, setSearchParams]);

  useEffect(() => {
    const isAnyModalOpen = detailOpen || canjeModalOpen || configOpen || canjeDetalleOpen;
    if (!isAnyModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen, canjeDetalleOpen, canjeModalOpen, configOpen]);

  useEffect(() => {
    if (!canScopeMulti) return undefined;

    let ignore = false;
    const loadSucursales = async () => {
      setLoadingSucursales(true);
      try {
        const response = await sucursalesService.getAll();
        if (ignore) return;
        const rows = (Array.isArray(response) ? response : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_sucursal: Number(row?.id_sucursal ?? 0) || null,
            nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
          }))
          .filter((row) => row.id_sucursal && row.nombre_sucursal)
          .sort((a, b) =>
            a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
          );
        setSucursales(rows);
      } catch (error) {
        if (!ignore) {
          openToast('ERROR', extractApiMessage(error, 'No se pudo cargar el catalogo de sucursales.'), 'danger');
        }
      } finally {
        if (!ignore) setLoadingSucursales(false);
      }
    };

    void loadSucursales();
    return () => {
      ignore = true;
    };
  }, [canScopeMulti, openToast]);

  useEffect(() => {
    if (scopeInitialized) return;

    if (Number.isInteger(userSucursalId) && userSucursalId > 0) {
      setSelectedSucursalId(String(userSucursalId));
      setScopeInitialized(true);
      return;
    }

    if (!canScopeMulti) {
      setScopeInitialized(true);
      return;
    }

    if (!loadingSucursales) {
      setScopeInitialized(true);
    }
  }, [canScopeMulti, loadingSucursales, scopeInitialized, userSucursalId]);

  useEffect(() => {
    if (!activeTab) return;

    if (activeTab === 'panel') {
      if (canViewPanel) {
        void loadPanel(scopeQuery);
      }
      if (canViewClientes) {
        void loadClientes({ ...scopeQuery, ...clientesQuery });
      }
    }

    if (activeTab === 'canjes' && canViewCanjes) {
      const params = {
        ...scopeQuery,
        page: canjesQuery.page,
        limit: canjesQuery.limit
      };

      if (canjesQuery.desde) params.desde = canjesQuery.desde;
      if (canjesQuery.hasta) params.hasta = canjesQuery.hasta;
      if (canjesQuery.estado) params.id_estado_canje = canjesQuery.estado;
      void loadCanjes(params);
    }
  }, [
    activeTab,
    canViewCanjes,
    canViewClientes,
    canViewPanel,
    canjesQuery,
    clientesQuery,
    loadCanjes,
    loadClientes,
    loadPanel,
    scopeQuery
  ]);

  const buildScopeQueryByValue = (value) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
  };

  const refreshPanelData = async (scopeOverride = null) => {
    const query = scopeOverride || scopeQuery;
    const tasks = [];
    if (canViewPanel) tasks.push(loadPanel(query));
    if (canViewClientes) tasks.push(loadClientes({ ...query, ...clientesQuery }));
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  };

  const refreshCanjesData = async () => {
    const params = {
      ...scopeQuery,
      page: canjesQuery.page,
      limit: canjesQuery.limit
    };
    if (canjesQuery.desde) params.desde = canjesQuery.desde;
    if (canjesQuery.hasta) params.hasta = canjesQuery.hasta;
    if (canjesQuery.estado) params.id_estado_canje = canjesQuery.estado;
    await loadCanjes(params);
  };

  const openConfiguracion = async () => {
    try {
      const resp = await getConfiguracion(scopeQuery);
      setConfigActiva(resp);
      setConfigOpen(true);
    } catch {
      // El hook ya expone feedback visual.
    }
  };

  const openClienteDetalle = async (cliente) => {
    if (!cliente?.id_cliente || !canViewClientes) return;
    setSelectedCliente(cliente);
    setDetailOpen(true);
    setSelectedClienteDetalle(null);
    try {
      const detail = await getClienteById(cliente.id_cliente, scopeQuery);
      setSelectedClienteDetalle(detail);
    } catch {
      // El hook ya muestra el toast.
    }
  };

  const openCanjeModal = async (cliente) => {
    if (!cliente?.id_cliente || !canUseCanjeFlow) return;
    setSelectedCliente(cliente);
    setCanjeModalOpen(true);
    setCanjeablesData({ items: [], message: '', saldoCliente: null });
    try {
      const payload = await getClienteCanjeables(cliente.id_cliente);
      setCanjeablesData(payload);
    } catch {
      setCanjeModalOpen(false);
      setSelectedCliente(null);
      setCanjeablesData({ items: [], message: '', saldoCliente: null });
    }
  };

  const openCanjeDetalle = async (canje) => {
    if (!canje?.id_canje) return;
    setCanjeDetalleOpen(true);
    setSelectedCanje(null);
    try {
      const detail = await getCanjeById(canje.id_canje, scopeQuery);
      setSelectedCanje(detail);
    } catch {
      setCanjeDetalleOpen(false);
    }
  };

  const handleCreateCanje = async (items, observacion) => {
    if (!selectedCliente?.id_cliente) return null;
    const response = await createCanje({
      id_cliente: selectedCliente.id_cliente,
      items,
      observacion
    });

    setCanjeModalOpen(false);
    if (canViewCanjes) {
      await Promise.all([refreshPanelData(), refreshCanjesData()]);
    } else {
      await refreshPanelData();
    }

    try {
      const detail = await getClienteById(selectedCliente.id_cliente, scopeQuery);
      setSelectedClienteDetalle(detail);
    } catch {
      // El resumen ya fue refrescado.
    }

    return response;
  };

  const handleSaveConfiguracion = async (payload) => {
    const result = await saveConfiguracion(payload);
    const nextSucursalId = result?.id_sucursal ? String(result.id_sucursal) : selectedSucursalId;
    if (nextSucursalId && nextSucursalId !== selectedSucursalId) {
      setSelectedSucursalId(nextSucursalId);
    }
    setConfigOpen(false);
    await refreshPanelData(buildScopeQueryByValue(nextSucursalId));
  };

  if (permisosLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Cargando modulo de fidelizacion...</span>
        </div>
      </div>
    );
  }

  if (!canViewPanel && !activeTab) {
    return (
      <SinPermiso
        title="Acceso Denegado"
        message="No tiene permisos para ver el modulo de Fidelizacion."
      />
    );
  }

  return (
    <>
      <div
        className="ventas-page fade-in"
        style={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0
        }}
      >
        {activeTab === 'panel' ? (
          <FidelizacionOverview
            panelData={panelData}
            clientes={clientes}
            clientesMeta={clientesMeta}
            loadingPanel={loadingPanel}
            loadingClientes={loadingClientes}
            canConfigure={canConfigure}
            canViewClientes={canViewClientes}
            canCanjear={canUseCanjeFlow}
            canSelectSucursal={canScopeMulti}
            selectedSucursalId={selectedSucursalId}
            sucursales={sucursales}
            loadingSucursales={loadingSucursales}
            currentSearch={clientesQuery.search}
            onSearch={(search) => setClientesQuery((prev) => ({ ...prev, page: 1, search }))}
            onPageChange={(page) => setClientesQuery((prev) => ({ ...prev, page }))}
            onSucursalChange={(value) => setSelectedSucursalId(value)}
            onRefresh={refreshPanelData}
            onOpenConfiguracion={openConfiguracion}
            onOpenDetalle={openClienteDetalle}
            onOpenCanje={openCanjeModal}
          />
        ) : null}

        {activeTab === 'canjes' && canViewCanjes ? (
          <FidelizacionCanjesList
            canjes={canjes}
            canjesMeta={canjesMeta}
            loading={loadingCanjes}
            detailLoading={detailLoading && canjeDetalleOpen}
            canSelectSucursal={canScopeMulti}
            selectedSucursalId={selectedSucursalId}
            sucursales={sucursales}
            loadingSucursales={loadingSucursales}
            filters={canjesQuery}
            onFiltersChange={setCanjesQuery}
            onSucursalChange={(value) => setSelectedSucursalId(value)}
            onRefresh={refreshCanjesData}
            onOpenDetalle={openCanjeDetalle}
          />
        ) : null}
      </div>

      <ClienteDetalleModal
        open={detailOpen}
        loading={detailLoading && detailOpen}
        detalle={selectedClienteDetalle}
        fallbackCliente={selectedCliente}
        onClose={() => {
          setDetailOpen(false);
          setSelectedCliente(null);
          setSelectedClienteDetalle(null);
        }}
      />

      <CanjeDetalleModal
        open={canjeDetalleOpen}
        loading={detailLoading && canjeDetalleOpen}
        canje={selectedCanje}
        onClose={() => {
          setCanjeDetalleOpen(false);
          setSelectedCanje(null);
        }}
      />

      <GenerarCanjeModal
        open={canjeModalOpen}
        onClose={() => {
          if (saving) return;
          setCanjeModalOpen(false);
          setSelectedCliente(null);
          setCanjeablesData({ items: [], message: '', saldoCliente: null });
        }}
        cliente={selectedCliente}
        canjeablesData={canjeablesData}
        saving={saving}
        onSubmit={handleCreateCanje}
      />

      <ConfiguracionReglasModal
        show={configOpen}
        onClose={() => {
          if (saving) return;
          setConfigOpen(false);
        }}
        configuracion={configActiva}
        saving={saving}
        selectedSucursalId={selectedSucursalId}
        onSubmit={handleSaveConfiguracion}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
