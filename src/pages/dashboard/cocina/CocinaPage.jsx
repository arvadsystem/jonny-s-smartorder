import { useEffect, useMemo, useState } from 'react';
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
  matchesKitchenOrder
} from './utils/cocinaHelpers';
import './styles/cocina.css';

export default function CocinaPage() {
  const [search, setSearch] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [confirmState, setConfirmState] = useState({
    pedido: null,
    action: null
  });
  const [now, setNow] = useState(() => Date.now());

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
    mutatingIds
  } = useCocina({
    selectedSucursalId
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredPedidos = useMemo(
    () => pedidos.filter((pedido) => matchesKitchenOrder(pedido, search)),
    [pedidos, search]
  );
  const groupedPedidos = useMemo(() => groupOrdersByColumn(filteredPedidos), [filteredPedidos]);
  const stats = useMemo(() => buildCocinaStats(filteredPedidos), [filteredPedidos]);

  const handleConfirmAction = async () => {
    if (!confirmState.pedido || !confirmState.action) return;

    try {
      await advancePedido(confirmState.pedido, confirmState.action.nextStatus);
      setConfirmState({ pedido: null, action: null });
      if (selectedPedido?.id_pedido === confirmState.pedido.id_pedido) {
        if (confirmState.action.nextStatus === 'COMPLETADO') {
          setSelectedPedido(null);
        } else {
          setSelectedPedido((current) =>
            current
              ? {
                  ...current,
                  estado_codigo: confirmState.action.nextStatus
                }
              : current
          );
        }
      }
    } catch {
      // El hook ya gestiona el feedback visual.
    }
  };

  return (
    <div className="cocina-page">
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 mb-3">
        <CocinaToolbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => refreshBoard({ silent: true }).catch(() => {})}
          refreshing={refreshing}
        />

        <CocinaStats stats={stats} />

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <CocinaSucursalTabs
            sucursales={sucursales}
            selectedSucursalId={selectedSucursalId}
            onSelectSucursal={setSelectedSucursalId}
          />

          {loading ? (
            <div className="inv-catpro-loading" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando pedidos de cocina...</span>
            </div>
          ) : (
            <CocinaBoard
              groupedPedidos={groupedPedidos}
              now={now}
              mutatingIds={mutatingIds}
              onOpenDetail={setSelectedPedido}
              onOpenConfirm={(pedido, action) => setConfirmState({ pedido, action })}
            />
          )}
        </div>
      </div>

      <CocinaDetailModal
        open={Boolean(selectedPedido)}
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
