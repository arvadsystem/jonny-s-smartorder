import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import sucursalesService from '../../../../services/sucursalesService';
import { cocinaApi } from '../services/cocinaApi';
import { supabase } from '../../../../lib/supabaseClient';
import {
  applyKitchenTransition,
  filterActiveSucursales,
  normalizeKitchenOrder,
  resolveOrderColumnKey
} from '../utils/cocinaHelpers';
import { createCocinaAudioManager } from '../utils/cocinaAudio';

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success',
  origin: 'system',
  code: ''
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /cannot read/i,
  /internal server error/i,
  /syntax error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /sql/i,
  /stack/i
];

const isTechnicalMessage = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(raw));
};

const extractApiMessage = (error, fallbackMessage) => {
  if (error?.data && typeof error.data === 'object') {
    const backendMessage = String(error.data.message || error.data.mensaje || '').trim();
    if (backendMessage && !isTechnicalMessage(backendMessage)) return backendMessage;
  }

  if (typeof error?.message === 'string' && error.message.trim() && !isTechnicalMessage(error.message)) {
    return error.message.trim();
  }

  return fallbackMessage;
};

export const useCocina = ({
  selectedSucursalId,
  includeSucursalesCatalog = true,
  toastPolicy = {},
  audioMode = 'none',
  requireSucursalSelection = false
}) => {
  const [pedidos, setPedidos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(initialToast);
  const [mutatingIds, setMutatingIds] = useState([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const audioManagerRef = useRef(null);
  const knownPedidoIdsRef = useRef(new Set());
  const pendingReminderTimersRef = useRef(new Map());
  const hasAudioBaselineRef = useRef(false);
  const latestPedidosRef = useRef([]);
  const demandBaselineCountRef = useRef(null);
  const isAudioEnabled = audioMode === 'cocina' || audioMode === 'pantalla';
  const isCocinaOperativeAudio = audioMode === 'cocina';

  const enrichPedidosWithTiming = useCallback((rows) => {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    return normalizedRows.map((pedido) => ({
      ...pedido,
      // AM: Prioriza minutos oficiales del pedido y usa fallback seguro solo si no son validos.
      expected_minutes_kds:
        Number.isFinite(Number(pedido?.kds_expected_minutes)) && Number(pedido?.kds_expected_minutes) > 0
          ? Number(pedido.kds_expected_minutes)
          : 20,
      // AM: Base del temporizador prioriza kds_started_at para alinear contador/alerta visual.
      kds_timer_base_at:
        pedido?.kds_started_at ||
        pedido?.visible_en_cocina_at ||
        pedido?.fecha_hora_facturacion ||
        pedido?.fecha_hora_pedido ||
        null
    }));
  }, []);

  const mutatingIdsRef = useRef(mutatingIds);
  mutatingIdsRef.current = mutatingIds;
  latestPedidosRef.current = pedidos;

  useEffect(() => {
    if (!isAudioEnabled) {
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
      }
      return undefined;
    }

    audioManagerRef.current = createCocinaAudioManager();
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
      }
    };
  }, [isAudioEnabled]);

  useEffect(() => {
    if (!isAudioEnabled) {
      pendingReminderTimersRef.current.forEach((timer) => window.clearInterval(timer));
      pendingReminderTimersRef.current.clear();
      knownPedidoIdsRef.current.clear();
      hasAudioBaselineRef.current = false;
      demandBaselineCountRef.current = null;
      return undefined;
    }

    const isActiveForKds = (pedido) => {
      const columnKey = resolveOrderColumnKey(pedido);
      return columnKey === 'PENDIENTES' || columnKey === 'EN_PREPARACION';
    };

    const isPending = (pedido) => resolveOrderColumnKey(pedido) === 'PENDIENTES';
    const activePedidos = pedidos.filter(isActiveForKds);
    const activeCount = activePedidos.length;
    const pendingPedidos = activePedidos.filter(isPending);
    const pendingIds = new Set(pendingPedidos.map((pedido) => Number(pedido?.id_pedido ?? 0)).filter(Boolean));

    if (demandBaselineCountRef.current === null) {
      demandBaselineCountRef.current = activeCount;
    } else {
      const previous = Number(demandBaselineCountRef.current ?? 0);
      if (previous <= 15 && activeCount > 15) {
        audioManagerRef.current?.playAltaDemanda();
      }
      demandBaselineCountRef.current = activeCount;
    }

    const knownIds = knownPedidoIdsRef.current;
    pendingPedidos.forEach((pedido) => {
      const idPedido = Number(pedido?.id_pedido ?? 0);
      if (!idPedido) return;

      const alreadyKnown = knownIds.has(idPedido);
      if (!alreadyKnown) {
        knownIds.add(idPedido);
        if (hasAudioBaselineRef.current) {
          audioManagerRef.current?.playNuevoPedido();
        }
      }

      if (pendingReminderTimersRef.current.has(idPedido)) return;
      const timer = window.setInterval(() => {
        const currentPedido = latestPedidosRef.current.find(
          (candidate) => Number(candidate?.id_pedido ?? 0) === idPedido
        );
        if (!currentPedido || !isPending(currentPedido)) {
          const intervalId = pendingReminderTimersRef.current.get(idPedido);
          if (intervalId) window.clearInterval(intervalId);
          pendingReminderTimersRef.current.delete(idPedido);
          return;
        }
        audioManagerRef.current?.playNuevoPedido();
      }, 5 * 60 * 1000);
      pendingReminderTimersRef.current.set(idPedido, timer);
    });

    [...pendingReminderTimersRef.current.keys()].forEach((idPedido) => {
      if (pendingIds.has(idPedido)) return;
      const timer = pendingReminderTimersRef.current.get(idPedido);
      if (timer) window.clearInterval(timer);
      pendingReminderTimersRef.current.delete(idPedido);
    });

    hasAudioBaselineRef.current = true;

    return undefined;
  }, [isAudioEnabled, pedidos]);

  useEffect(() => () => {
    pendingReminderTimersRef.current.forEach((timer) => window.clearInterval(timer));
    pendingReminderTimersRef.current.clear();
  }, []);

  const openToast = useCallback((title, message, variant = 'success', options = {}) => {
    const origin = String(options?.origin || 'system');
    const code = String(options?.code || '');
    if (toastPolicy?.hideAll) return;
    if (toastPolicy?.hideSystem && origin !== 'user-action') return;
    if (toastPolicy?.hideAdminWarnings && code === 'ADMIN_WARNING') return;
    if (toastPolicy?.hideOperationalSuccess && code === 'ACTION_SUCCESS') return;

    setToast({
      show: true,
      title: String(title || ''),
      message: String(message || ''),
      variant,
      origin,
      code
    });
  }, [toastPolicy?.hideAdminWarnings, toastPolicy?.hideAll, toastPolicy?.hideOperationalSuccess, toastPolicy?.hideSystem]);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const loadSucursales = useCallback(async () => {
    if (!includeSucursalesCatalog) {
      setSucursales([]);
      return [];
    }
    const response = await sucursalesService.getAll();
    const rows = filterActiveSucursales(response);
    setSucursales(rows);
    return rows;
  }, [includeSucursalesCatalog]);

  const loadPedidos = useCallback(
    async ({ silent = false } = {}) => {
      if (requireSucursalSelection && !selectedSucursalId) {
        setPedidos([]);
        setError('');
        setLoading(false);
        setRefreshing(false);
        return [];
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await cocinaApi.listPedidos({
          id_sucursal: selectedSucursalId || undefined
        });
        const rows = enrichPedidosWithTiming((Array.isArray(response) ? response : []).map(normalizeKitchenOrder));
        setPedidos(rows);
        setError('');
        return rows;
      } catch (loadError) {
        const message = extractApiMessage(loadError, 'No se pudieron cargar los pedidos de cocina.');
        setError(message);
        if (!silent) {
          openToast('ERROR', message, 'danger', { origin: 'system', code: 'LOAD_ERROR' });
        }
        throw loadError;
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [enrichPedidosWithTiming, openToast, selectedSucursalId]
  );

  useEffect(() => {
    Promise.allSettled([loadSucursales(), loadPedidos()]);
  }, [loadPedidos, loadSucursales]);

  const refreshBoard = useCallback(
    async ({ silent = true } = {}) => loadPedidos({ silent }),
    [loadPedidos]
  );

  const pollBoard = useEffectEvent(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (mutatingIdsRef.current.length > 0) return;
    refreshBoard({ silent: true }).catch(() => {});
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      pollBoard();
    }, 7000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollBoard();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollBoard]);

  useEffect(() => {
    // Suscripción Realtime a cambios en la tabla 'pedidos'
    const channel = supabase
      .channel('cocina-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos'
        },
        (payload) => {
          // Si el pedido cambiado pertenece a la sucursal seleccionada (o si estamos viendo todas), refrescamos.
          // El refreshBoard ya maneja el filtro de sucursal.
          const changedRecord = payload.new || payload.old;
          const idSucursalChanged = Number(changedRecord?.id_sucursal ?? 0);

          if (!selectedSucursalId || idSucursalChanged === Number(selectedSucursalId)) {
            refreshBoard({ silent: true }).catch(() => {});
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshBoard, selectedSucursalId]);

  const advancePedido = useCallback(
    async (pedido, estadoDestino) => {
      const idPedido = Number(pedido?.id_pedido ?? 0);
      if (!idPedido || !estadoDestino) return null;

      setSaving(true);
      setMutatingIds((current) => [...new Set([...current, idPedido])]);

      try {
        const response = await cocinaApi.updateEstado(idPedido, estadoDestino);
        setPedidos((current) => applyKitchenTransition(current, idPedido, estadoDestino));
        if (response?.warning_code === 'STOCK_INSUFICIENTE_PERMITIDO') {
          openToast('INVENTARIO EN NEGATIVO', 'El pedido inició preparación, pero algunos insumos quedaron en negativo.', 'warning', {
            origin: 'user-action',
            code: 'ACTION_WARNING'
          });
        } else if (response?.warning_code === 'CONFIGURACION_INVENTARIO_INCOMPLETA') {
          openToast('PEDIDO LISTO', 'Pedido marcado como listo correctamente.', 'success', {
            origin: 'user-action',
            code: 'ADMIN_WARNING'
          });
          if (isCocinaOperativeAudio) {
            audioManagerRef.current?.playPedidoListo();
          }
        } else if (response?.warning_detail?.code === 'FALTANTE_COCINA') {
          openToast('PEDIDO LISTO', 'Pedido marcado como listo correctamente.', 'success', {
            origin: 'user-action',
            code: 'ADMIN_WARNING'
          });
          if (isCocinaOperativeAudio) {
            audioManagerRef.current?.playPedidoListo();
          }
        } else {
          openToast('PEDIDO ACTUALIZADO', response?.message || 'Estado actualizado correctamente.', 'success', {
            origin: 'user-action',
            code: 'ACTION_SUCCESS'
          });
          if (isCocinaOperativeAudio && String(estadoDestino || '').toUpperCase() === 'LISTO_PARA_ENTREGA') {
            audioManagerRef.current?.playPedidoListo();
          }
        }
        refreshBoard({ silent: true }).catch(() => {});
        return response;
      } catch (saveError) {
        const message = extractApiMessage(saveError, 'No se pudo actualizar el pedido.');
        setError(message);
        openToast('ERROR', message, 'danger', { origin: 'user-action', code: 'ACTION_ERROR' });
        throw saveError;
      } finally {
        setSaving(false);
        setMutatingIds((current) => current.filter((value) => value !== idPedido));
      }
    },
    [isCocinaOperativeAudio, openToast, refreshBoard]
  );

  return useMemo(
    () => ({
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
    }),
    [
      advancePedido,
      closeToast,
      error,
      isRealtimeConnected,
      loading,
      mutatingIds,
      pedidos,
      refreshing,
      refreshBoard,
      saving,
      sucursales,
      toast
    ]
  );
};

