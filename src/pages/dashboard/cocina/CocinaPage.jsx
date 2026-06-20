import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { normalizeRoleName, PERMISSIONS } from '../../../utils/permissions';
import CocinaBoard from './components/CocinaBoard';
import CocinaConfirmModal from './components/CocinaConfirmModal';
import CocinaDetailModal from './components/CocinaDetailModal';
import CocinaInventoryAlertsModal from './components/CocinaInventoryAlertsModal';
import CocinaSucursalTabs from './components/CocinaSucursalTabs';
import CocinaToast from './components/CocinaToast';
import CocinaToolbar from './components/CocinaToolbar';
import { cocinaApi } from './services/cocinaApi';
import { useCocina } from './hooks/useCocina';
import {
  groupOrdersByColumn,
  matchesKitchenOrder,
  resolveOrderColumnKey
} from './utils/cocinaHelpers';
import './styles/cocina.css';

const SCREEN_MODE_ROLES = new Set([
  'P_COCINA',
  'PANTALLA_COCINA',
  'PANTALLA_DE_COCINA'
]);
const COCINA_OPERATIVA_ROLES = new Set(['COCINA', 'COCINERA']);

const isPantallaCocinaRole = (roles) =>
  (Array.isArray(roles) ? roles : []).some((role) => SCREEN_MODE_ROLES.has(normalizeRoleName(role)));
const isCocinaOperativaRole = (roles) =>
  (Array.isArray(roles) ? roles : []).some((role) => COCINA_OPERATIVA_ROLES.has(normalizeRoleName(role)));
const shouldAdvanceWithoutConfirm = (action) =>
  ['EN_PREPARACION', 'LISTO_PARA_ENTREGA'].includes(action?.nextStatus);

export default function CocinaPage() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const [search, setSearch] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [inventoryAlertsState, setInventoryAlertsState] = useState({
    open: false,
    pedido: null,
    loading: false,
    error: '',
    alertas: []
  });
  const [confirmState, setConfirmState] = useState({ pedido: null, action: null });
  const [now, setNow] = useState(() => Date.now());
  const pageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPantallaCocina = useMemo(() => isPantallaCocinaRole(user?.roles), [user?.roles]);
  const isCocinaOperativa = useMemo(() => isCocinaOperativaRole(user?.roles), [user?.roles]);
  const pageClassName = [
    'cocina-page',
    isPantallaCocina ? 'cocina-page--tv-mode' : '',
    isCocinaOperativa && !isPantallaCocina ? 'cocina-page--operator-mode' : ''
  ].filter(Boolean).join(' ');
  const canSelectSucursalInCocina = isSuperAdmin;
  const toastPolicy = useMemo(
    () => ({
      hideAll: isPantallaCocina,
      hideSystem: isPantallaCocina || (!isSuperAdmin && isCocinaOperativa),
      hideAdminWarnings: isPantallaCocina || (!isSuperAdmin && isCocinaOperativa),
      hideOperationalSuccess: isPantallaCocina || (!isSuperAdmin && isCocinaOperativa)
    }),
    [isCocinaOperativa, isPantallaCocina, isSuperAdmin]
  );
  const audioMode = useMemo(() => {
    if (isPantallaCocina) return 'pantalla';
    if (!isSuperAdmin && isCocinaOperativa) return 'cocina';
    return 'none';
  }, [isCocinaOperativa, isPantallaCocina, isSuperAdmin]);

  const canSearch = !isPantallaCocina && canAny([PERMISSIONS.COCINA_BUSCAR]);
  const canRefresh = !isPantallaCocina && canAny([PERMISSIONS.COCINA_ACTUALIZAR_TABLERO]);
  const canViewDetail = canAny([PERMISSIONS.COCINA_DETALLE_VER]);
  const canStartPedido = canAny([PERMISSIONS.COCINA_PEDIDO_INICIAR]);
  const canMarkReady = canAny([PERMISSIONS.COCINA_PEDIDO_MARCAR_LISTO]);
  const canDeliverPedido = canAny([PERMISSIONS.COCINA_PEDIDO_ENTREGAR]);

  const {
    pedidos,
    sucursales,
    loading,
    refreshing,
    saving,
    error,
    toast,
    closeToast,
    refreshBoard,
    advancePedido,
    mutatingIds,
    isRealtimeConnected
  } = useCocina({
    selectedSucursalId,
    includeSucursalesCatalog: canSelectSucursalInCocina,
    toastPolicy,
    audioMode,
    requireSucursalSelection: canSelectSucursalInCocina
  });

  // Timer para mostrar temporizadores en vivo (1s)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sincronizar permisos: si pierde permiso de filtrado, resetear sucursal
  useEffect(() => {
    if (!canSelectSucursalInCocina && selectedSucursalId !== null) {
      setSelectedSucursalId(null);
    }
  }, [canSelectSucursalInCocina, selectedSucursalId]);

  useEffect(() => {
    if (!canSelectSucursalInCocina) return;
    if (!Array.isArray(sucursales) || sucursales.length === 0) return;
    if (selectedSucursalId) return;
    const firstSucursalId = Number(sucursales[0]?.id_sucursal ?? 0);
    if (firstSucursalId > 0) {
      setSelectedSucursalId(firstSucursalId);
    }
  }, [canSelectSucursalInCocina, selectedSucursalId, sucursales]);

  // Limpiar búsqueda si pierde permiso
  useEffect(() => {
    if (!canSearch && search) setSearch('');
  }, [canSearch, search]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await pageRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const filteredPedidos = useMemo(
    () => pedidos.filter((pedido) => matchesKitchenOrder(pedido, canSearch ? search : '')),
    [canSearch, pedidos, search]
  );
  const tvClockLabel = useMemo(
    () =>
      new Date(now).toLocaleTimeString('es-HN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
    [now]
  );
  const groupedPedidos = useMemo(() => groupOrdersByColumn(filteredPedidos), [filteredPedidos]);

  const canAdvancePedido = useCallback(
    (pedido) => {
      if (isPantallaCocina) return false;
      if (isSuperAdmin) return true;
      const columnKey = resolveOrderColumnKey(pedido);
      if (columnKey === 'PENDIENTES') return canStartPedido;
      if (columnKey === 'EN_PREPARACION') return canMarkReady;
      if (columnKey === 'LISTOS_PARA_ENTREGA') return canDeliverPedido;
      return false;
    },
    [isPantallaCocina, isSuperAdmin, canStartPedido, canMarkReady, canDeliverPedido]
  );

  const runPedidoAction = useCallback(async (pedido, action) => {
    if (!pedido || !action?.nextStatus) return;
    if (!canAdvancePedido(pedido) && action.nextStatus !== 'NO_ENTREGADO') return;
    if (mutatingIds?.has?.(pedido.id_pedido)) return;

    try {
      await advancePedido(pedido, action.nextStatus);
      setConfirmState({ pedido: null, action: null });
      if (selectedPedido?.id_pedido === pedido.id_pedido) {
        if (['COMPLETADO', 'NO_ENTREGADO'].includes(action.nextStatus)) {
          setSelectedPedido(null);
        } else {
          setSelectedPedido((current) =>
            current
              ? {
                  ...current,
                  estado_codigo: action.nextStatus,
                  columna_kds: resolveOrderColumnKey({
                    columna_kds: current.columna_kds,
                    estado_codigo: action.nextStatus
                  })
                }
              : current
          );
        }
      }
    } catch { /* el hook ya gestiona el feedback */ }
  }, [advancePedido, canAdvancePedido, mutatingIds, selectedPedido]);

  const handleConfirmAction = useCallback(async () => {
    await runPedidoAction(confirmState.pedido, confirmState.action);
  }, [confirmState, runPedidoAction]);

  const handleOpenConfirm = useCallback((pedido, action) => {
    if (!pedido || !action?.nextStatus) return;
    if (!canAdvancePedido(pedido) && action.nextStatus !== 'NO_ENTREGADO') return;
    if (mutatingIds?.has?.(pedido.id_pedido)) return;
    if (shouldAdvanceWithoutConfirm(action)) {
      runPedidoAction(pedido, action);
      return;
    }
    setConfirmState({ pedido, action });
  }, [canAdvancePedido, mutatingIds, runPedidoAction]);

  const handleOpenInventoryAlerts = useCallback(async (pedido) => {
    if (!pedido?.id_pedido) return;
    setInventoryAlertsState({
      open: true,
      pedido,
      loading: true,
      error: '',
      alertas: []
    });

    try {
      const response = await cocinaApi.getInventarioAlertas(pedido.id_pedido);
      setInventoryAlertsState({
        open: true,
        pedido,
        loading: false,
        error: '',
        alertas: Array.isArray(response?.alertas) ? response.alertas : []
      });
    } catch {
      setInventoryAlertsState({
        open: true,
        pedido,
        loading: false,
        error: 'No se pudieron cargar las alertas.',
        alertas: []
      });
    }
  }, []);

  const handleCloseInventoryAlerts = useCallback(() => {
    setInventoryAlertsState({
      open: false,
      pedido: null,
      loading: false,
      error: '',
      alertas: []
    });
  }, []);

  return (
    <div className={pageClassName} ref={pageRef}>
      <div className="kds-root">
        {isPantallaCocina ? (
          <header className="kds-tv-header">
            <div className="kds-tv-header__title">Kitchen Display</div>
            <div className={`kds-realtime kds-realtime--tv ${isRealtimeConnected ? 'is-connected' : ''}`}>
              <span className="kds-realtime__dot" />
              <span>{isRealtimeConnected ? 'En tiempo real' : 'Reconectando...'}</span>
              <span className="kds-tv-header__clock" aria-label="Hora actual">
                · {tvClockLabel}
              </span>
            </div>
          </header>
        ) : (
          <CocinaToolbar
            search={search}
            onSearchChange={setSearch}
            canRefresh={canRefresh}
            canSearch={canSearch}
            isRealtimeConnected={isRealtimeConnected}
            isFullscreen={isFullscreen}
            onRefresh={() => {
              if (!canRefresh) return;
              refreshBoard({ silent: true }).catch(() => {});
            }}
            onToggleFullscreen={toggleFullscreen}
            refreshing={refreshing}
          />
        )}

        {error ? (
          <div className="kds-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill" />
            {error}
          </div>
        ) : null}

        {!isPantallaCocina && canSelectSucursalInCocina ? (
          <CocinaSucursalTabs
            sucursales={sucursales}
            selectedSucursalId={selectedSucursalId}
            canFilter
            allowAllOption={false}
            onSelectSucursal={(value) => {
              if (!canSelectSucursalInCocina) return;
              setSelectedSucursalId(value);
            }}
          />
        ) : null}

        {loading ? (
          <div className="kds-loading" role="status" aria-live="polite">
            <div className="kds-spinner" aria-hidden="true" />
            <span>Cargando tablero de cocina...</span>
          </div>
        ) : (
          <CocinaBoard
            canAdvancePedido={canAdvancePedido}
            isSuperAdmin={isSuperAdmin && !isPantallaCocina}
            canOpenDetail={canViewDetail}
            canDeliverPedido={canDeliverPedido}
            groupedPedidos={groupedPedidos}
            now={now}
            isScreenMode={isPantallaCocina}
            mutatingIds={mutatingIds}
            onOpenDetail={(pedido) => {
              if (!canViewDetail) return;
              setSelectedPedido(pedido);
            }}
            onOpenInventoryAlerts={handleOpenInventoryAlerts}
            onOpenConfirm={handleOpenConfirm}
          />
        )}
      </div>

      <CocinaDetailModal
        open={Boolean(selectedPedido) && canViewDetail}
        pedido={selectedPedido}
        now={now}
        onClose={() => setSelectedPedido(null)}
      />

      <CocinaConfirmModal
        open={Boolean(confirmState.pedido && confirmState.action)}
        pedido={confirmState.pedido}
        action={confirmState.action}
        saving={saving}
        onCancel={() => setConfirmState({ pedido: null, action: null })}
        onConfirm={handleConfirmAction}
      />

      <CocinaInventoryAlertsModal
        open={inventoryAlertsState.open}
        pedido={inventoryAlertsState.pedido}
        alertas={inventoryAlertsState.alertas}
        loading={inventoryAlertsState.loading}
        error={inventoryAlertsState.error}
        onClose={handleCloseInventoryAlerts}
      />

      <CocinaToast toast={toast} onClose={closeToast} />
    </div>
  );
}
