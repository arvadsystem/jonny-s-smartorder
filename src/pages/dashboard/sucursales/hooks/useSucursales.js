import { useCallback, useEffect, useState } from 'react';
import { sucursalesApi } from '../services/sucursalesApi';
import { extractApiMessage, normalizeSucursalRecord } from '../utils/sucursalHelpers';

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};

export const useSucursales = () => {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingEstadoId, setTogglingEstadoId] = useState(null);
  const [toast, setToast] = useState(initialToast);

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
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await sucursalesApi.list();
      const rows = Array.isArray(data) ? data.map(normalizeSucursalRecord) : [];
      setSucursales(rows);
      return rows;
    } catch (err) {
      const msg = extractApiMessage(err, 'NO SE PUDIERON CARGAR LAS SUCURSALES');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [openToast]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const createSucursal = useCallback(async (payload) => {
    setSaving(true);
    setError('');
    try {
      await sucursalesApi.create(payload);
      await refresh();
      openToast('CREADO', 'LA SUCURSAL SE CREO CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = extractApiMessage(err, 'NO SE PUDO CREAR LA SUCURSAL');
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [openToast, refresh]);

  const updateSucursal = useCallback(async (id, payload) => {
    const idNum = Number(id ?? 0);
    if (!idNum) throw new Error('ID DE SUCURSAL INVALIDO');
    setSaving(true);
    setError('');
    try {
      await sucursalesApi.updateFull(idNum, payload);
      setSucursales((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) =>
          Number(item?.id_sucursal ?? 0) === idNum ? normalizeSucursalRecord({ ...item, ...payload }) : item
        )
      );
      openToast('ACTUALIZADO', 'LA SUCURSAL SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = extractApiMessage(err, 'NO SE PUDO ACTUALIZAR LA SUCURSAL');
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [openToast]);

  const toggleSucursalEstado = useCallback(async (sucursal, nextEstado) => {
    const idNum = Number(sucursal?.id_sucursal ?? 0);
    if (!idNum || togglingEstadoId) return;

    setTogglingEstadoId(idNum);
    setError('');
    try {
      await sucursalesApi.toggleEstado(idNum, !!nextEstado);
      setSucursales((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) =>
          Number(item?.id_sucursal ?? 0) === idNum ? { ...item, estado: !!nextEstado } : item
        )
      );
      openToast('ESTADO ACTUALIZADO', `LA SUCURSAL FUE ${nextEstado ? 'ACTIVADA' : 'INACTIVADA'}.`, 'success');
    } catch (err) {
      const msg = extractApiMessage(err, 'NO SE PUDO ACTUALIZAR EL ESTADO');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setTogglingEstadoId(null);
    }
  }, [openToast, togglingEstadoId]);

  const deleteSucursal = useCallback(async (sucursal) => {
    const idNum = Number(sucursal?.id_sucursal ?? 0);
    if (!idNum) throw new Error('ID DE SUCURSAL INVALIDO');

    setDeletingId(idNum);
    setError('');
    try {
      await sucursalesApi.remove(idNum);
      setSucursales((prev) => (Array.isArray(prev) ? prev : []).filter((item) => Number(item?.id_sucursal ?? 0) !== idNum));
      openToast('ELIMINADO', 'LA SUCURSAL SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = extractApiMessage(err, 'NO SE PUDO ELIMINAR LA SUCURSAL');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setDeletingId(null);
    }
  }, [openToast]);

  return {
    sucursales,
    loading,
    error,
    setError,
    saving,
    deletingId,
    togglingEstadoId,
    toast,
    openToast,
    closeToast,
    refresh,
    createSucursal,
    updateSucursal,
    toggleSucursalEstado,
    deleteSucursal
  };
};
