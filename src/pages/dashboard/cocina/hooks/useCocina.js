import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import sucursalesService from '../../../../services/sucursalesService';
import { cocinaApi } from '../services/cocinaApi';
import {
  applyKitchenTransition,
  filterActiveSucursales,
  normalizeKitchenOrder
} from '../utils/cocinaHelpers';

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};

const extractApiMessage = (error, fallbackMessage) => {
  if (error?.data && typeof error.data === 'object') {
    if (error.data.message) return error.data.message;
    if (error.data.mensaje) return error.data.mensaje;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

export const useCocina = ({ selectedSucursalId }) => {
  const [pedidos, setPedidos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(initialToast);
  const [mutatingIds, setMutatingIds] = useState([]);

  const mutatingIdsRef = useRef(mutatingIds);
  mutatingIdsRef.current = mutatingIds;

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({
      show: true,
      title: String(title || ''),
      message: String(message || ''),
      variant
    });
  }, []);

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
    const response = await sucursalesService.getAll();
    const rows = filterActiveSucursales(response);
    setSucursales(rows);
    return rows;
  }, []);

  const loadPedidos = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await cocinaApi.listPedidos({
          id_sucursal: selectedSucursalId || undefined
        });
        const rows = (Array.isArray(response) ? response : []).map(normalizeKitchenOrder);
        setPedidos(rows);
        setError('');
        return rows;
      } catch (loadError) {
        const message = extractApiMessage(loadError, 'No se pudieron cargar los pedidos de cocina.');
        setError(message);
        if (!silent) {
          openToast('ERROR', message, 'danger');
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
    [openToast, selectedSucursalId]
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

  const advancePedido = useCallback(
    async (pedido, estadoDestino) => {
      const idPedido = Number(pedido?.id_pedido ?? 0);
      if (!idPedido || !estadoDestino) return null;

      setSaving(true);
      setMutatingIds((current) => [...new Set([...current, idPedido])]);

      try {
        const response = await cocinaApi.updateEstado(idPedido, estadoDestino);
        setPedidos((current) => applyKitchenTransition(current, idPedido, estadoDestino));
        openToast('PEDIDO ACTUALIZADO', response?.message || 'Estado actualizado correctamente.', 'success');
        refreshBoard({ silent: true }).catch(() => {});
        return response;
      } catch (saveError) {
        const message = extractApiMessage(saveError, 'No se pudo actualizar el pedido.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw saveError;
      } finally {
        setSaving(false);
        setMutatingIds((current) => current.filter((value) => value !== idPedido));
      }
    },
    [openToast, refreshBoard]
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
      mutatingIds
    }),
    [
      advancePedido,
      closeToast,
      error,
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
