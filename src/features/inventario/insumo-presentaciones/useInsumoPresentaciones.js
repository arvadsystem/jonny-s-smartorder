import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { insumoPresentacionesService } from '../../../services/insumoPresentacionesService';

const extractMessage = (error, fallback) => {
  const data = error?.data;
  const backendMessage = data && typeof data === 'object' ? data.message || data.mensaje : '';
  return String(backendMessage || error?.message || fallback || 'No se pudo completar la solicitud.').trim();
};

export const useInsumoPresentaciones = ({ idInsumo, open, onNotify } = {}) => {
  const [presentaciones, setPresentaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingEstadoId, setChangingEstadoId] = useState(null);
  const requestIdRef = useRef(0);

  const safeIdInsumo = useMemo(() => {
    const parsed = Number.parseInt(String(idInsumo ?? ''), 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [idInsumo]);

  const notify = useCallback((title, message, variant = 'success') => {
    if (typeof onNotify === 'function') onNotify(title, message, variant);
  }, [onNotify]);

  const loadPresentaciones = useCallback(async () => {
    if (!safeIdInsumo) {
      setPresentaciones([]);
      setLoading(false);
      setError('');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');

    try {
      const payload = await insumoPresentacionesService.listar(safeIdInsumo);
      if (requestId !== requestIdRef.current) return;
      setPresentaciones(Array.isArray(payload?.presentaciones) ? payload.presentaciones : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = extractMessage(err, 'No se pudieron cargar las presentaciones.');
      setError(message);
      setPresentaciones([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [safeIdInsumo]);

  useEffect(() => {
    if (!open) return;
    void loadPresentaciones();
  }, [loadPresentaciones, open]);

  const savePresentacion = useCallback(async ({ mode, idPresentacion, data }) => {
    if (!safeIdInsumo || saving) return { ok: false, message: 'Insumo invalido.' };
    setSaving(true);
    try {
      if (mode === 'edit') {
        await insumoPresentacionesService.actualizar(safeIdInsumo, idPresentacion, data);
        notify('PRESENTACION ACTUALIZADA', 'Los cambios se guardaron correctamente.', 'success');
      } else {
        await insumoPresentacionesService.crear(safeIdInsumo, data);
        notify('PRESENTACION CREADA', 'La presentacion se agrego correctamente.', 'success');
      }
      await loadPresentaciones();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: extractMessage(err, 'No se pudo guardar la presentacion.') };
    } finally {
      setSaving(false);
    }
  }, [loadPresentaciones, notify, safeIdInsumo, saving]);

  const changeEstado = useCallback(async (presentacion, estado) => {
    const idPresentacion = Number.parseInt(String(presentacion?.id_presentacion ?? ''), 10);
    if (!safeIdInsumo || !Number.isSafeInteger(idPresentacion) || idPresentacion <= 0 || changingEstadoId) {
      return { ok: false, message: 'Presentacion invalida.' };
    }

    setChangingEstadoId(idPresentacion);
    try {
      await insumoPresentacionesService.cambiarEstado(safeIdInsumo, idPresentacion, estado);
      notify(
        estado ? 'PRESENTACION ACTIVADA' : 'PRESENTACION INACTIVADA',
        estado ? 'La presentacion vuelve a estar disponible.' : 'La presentacion quedo inactiva.',
        'success'
      );
      await loadPresentaciones();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: extractMessage(err, 'No se pudo cambiar el estado.') };
    } finally {
      setChangingEstadoId(null);
    }
  }, [changingEstadoId, loadPresentaciones, notify, safeIdInsumo]);

  return {
    presentaciones,
    loading,
    error,
    saving,
    changingEstadoId,
    reload: loadPresentaciones,
    savePresentacion,
    changeEstado
  };
};
