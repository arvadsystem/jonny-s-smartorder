import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import CocinaBoard from './components/CocinaBoard';
import CocinaConfirmModal from './components/CocinaConfirmModal';
import CocinaDetailModal from './components/CocinaDetailModal';
import CocinaStats from './components/CocinaStats';
import CocinaSucursalTabs from './components/CocinaSucursalTabs';
import CocinaToast from './components/CocinaToast';
import CocinaToolbar from './components/CocinaToolbar';
import { useCocina } from './hooks/useCocina';
import {
  buildCocinaStats,
  groupOrdersByColumn,
  matchesKitchenOrder,
  resolveOrderColumnKey
} from './utils/cocinaHelpers';
import './styles/cocina.css';

export default function CocinaPage() {
  const { canAny, isSuperAdmin } = usePermisos();
  const [search, setSearch] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [confirmState, setConfirmState] = useState({ pedido: null, action: null });
  const [now, setNow] = useState(() => Date.now());
  const pageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canSearch = canAny([PERMISSIONS.COCINA_BUSCAR]);
  const canRefresh = canAny([PERMISSIONS.COCINA_ACTUALIZAR_TABLERO]);
  const canViewDetail = canAny([PERMISSIONS.COCINA_DETALLE_VER]);
  const canFilterSucursal = canAny([PERMISSIONS.COCINA_FILTRAR_SUCURSAL]);
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
    includeSucursalesCatalog: canFilterSucursal || isSuperAdmin
  });

  // Timer para mostrar temporizadores en vivo (1s)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sincronizar permisos: si pierde permiso de filtrado, resetear sucursal
  useEffect(() => {
    if (!canFilterSucursal && !isSuperAdmin && selectedSucursalId !== null) {
      setSelectedSucursalId(null);
    }
  }, [canFilterSucursal, isSuperAdmin, selectedSucursalId]);

  // Limpiar búsqueda si pierde permiso
  useEffect(() => {
    if (!canSearch && search) setSearch('');
  }, [canSearch, search]);

  // Notificación sonora cuando llegan pedidos nuevos
  const prevPedidosCountRef = useRef(pedidos.length);
  useEffect(() => {
    if (pedidos.length > prevPedidosCountRef.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } catch { /* sin audio: no pasa nada */ }
    }
    prevPedidosCountRef.current = pedidos.length;
  }, [pedidos.length]);

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
  const stats = useMemo(() => buildCocinaStats(filteredPedidos), [filteredPedidos]);

  const canAdvancePedido = useCallback(
    (pedido) => {
      if (isSuperAdmin) return true;
      const columnKey = resolveOrderColumnKey(pedido);
      if (columnKey === 'PENDIENTES') return canStartPedido;
      if (columnKey === 'EN_PREPARACION') return canMarkReady;
      if (columnKey === 'LISTOS_PARA_ENTREGA') return canDeliverPedido;
      return false;
    },
    [isSuperAdmin, canStartPedido, canMarkReady, canDeliverPedido]
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
    <div className="cocina-page" ref={pageRef}>
      <div className="kds-root">
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

        <CocinaStats stats={stats} />

        {error ? (
          <div className="kds-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill" />
            {error}
          </div>
        ) : null}

        <CocinaSucursalTabs
          sucursales={sucursales}
          selectedSucursalId={selectedSucursalId}
          canFilter={canFilterSucursal || isSuperAdmin}
          onSelectSucursal={(value) => {
            if (!canFilterSucursal && !isSuperAdmin) return;
            setSelectedSucursalId(value);
          }}
        />

        {loading ? (
          <div className="kds-loading" role="status" aria-live="polite">
            <div className="kds-spinner" aria-hidden="true" />
            <span>Cargando tablero de cocina...</span>
          </div>
        ) : (
          <CocinaBoard
            canAdvancePedido={canAdvancePedido}
            isSuperAdmin={isSuperAdmin}
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
