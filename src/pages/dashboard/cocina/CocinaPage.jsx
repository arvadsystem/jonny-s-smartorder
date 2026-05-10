import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { normalizeRoleName, PERMISSIONS } from '../../../utils/permissions';
import CocinaBoard from './components/CocinaBoard';
import CocinaConfirmModal from './components/CocinaConfirmModal';
import CocinaDetailModal from './components/CocinaDetailModal';
import CocinaSucursalTabs from './components/CocinaSucursalTabs';
import CocinaToast from './components/CocinaToast';
import CocinaToolbar from './components/CocinaToolbar';
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

export default function CocinaPage() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const [search, setSearch] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [confirmState, setConfirmState] = useState({ pedido: null, action: null });
  const [now, setNow] = useState(() => Date.now());
  const pageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPantallaCocina = useMemo(() => isPantallaCocinaRole(user?.roles), [user?.roles]);
  const isCocinaOperativa = useMemo(() => isCocinaOperativaRole(user?.roles), [user?.roles]);
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

  const handleConfirmAction = useCallback(async () => {
    if (!confirmState.pedido || !confirmState.action) return;
    if (!canAdvancePedido(confirmState.pedido) && confirmState.action.nextStatus !== 'NO_ENTREGADO') return;

    try {
      await advancePedido(confirmState.pedido, confirmState.action.nextStatus);
      setConfirmState({ pedido: null, action: null });
      if (selectedPedido?.id_pedido === confirmState.pedido.id_pedido) {
        if (['COMPLETADO', 'NO_ENTREGADO'].includes(confirmState.action.nextStatus)) {
          setSelectedPedido(null);
        } else {
          setSelectedPedido((current) =>
            current
              ? {
                  ...current,
                  estado_codigo: confirmState.action.nextStatus,
                  columna_kds: resolveOrderColumnKey({
                    columna_kds: current.columna_kds,
                    estado_codigo: confirmState.action.nextStatus
                  })
                }
              : current
          );
        }
      }
    } catch { /* el hook ya gestiona el feedback */ }
  }, [advancePedido, canAdvancePedido, confirmState, selectedPedido]);

  return (
    <div className={`cocina-page${isPantallaCocina ? ' cocina-page--tv-mode' : ''}`} ref={pageRef}>
      <div className="kds-root">
        {isPantallaCocina ? (
          <header className="kds-tv-header">
            <div className="kds-tv-header__title">Kitchen Display</div>
            <div className={`kds-realtime ${isRealtimeConnected ? 'is-connected' : ''}`}>
              <span className="kds-realtime__dot" />
              <span>{isRealtimeConnected ? 'En tiempo real' : 'Reconectando...'}</span>
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
            mutatingIds={mutatingIds}
            onOpenDetail={(pedido) => {
              if (!canViewDetail) return;
              setSelectedPedido(pedido);
            }}
            onOpenConfirm={(pedido, action) => {
              setConfirmState({ pedido, action });
            }}
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

      <CocinaToast toast={toast} onClose={closeToast} />
    </div>
  );
}
