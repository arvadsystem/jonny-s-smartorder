import { useCallback, useEffect, useState } from 'react';
import fidelizacionService from '../../../../services/fidelizacionService';
import {
  extractApiMessage,
  normalizeCanje,
  normalizeCanjeableResponse,
  normalizeCliente,
  normalizeClienteDetalle,
  normalizeConfiguracion,
  normalizeEnvelopeMeta,
  normalizeEnvelopeRows,
  normalizeMovimiento,
  normalizePanelData
} from '../utils/fidelizacionHelpers';

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};

const initialPagination = {
  total: 0,
  page: 1,
  limit: 20
};

export const useFidelizacion = () => {
  const [panelData, setPanelData] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clientesMeta, setClientesMeta] = useState(initialPagination);
  const [canjes, setCanjes] = useState([]);
  const [canjesMeta, setCanjesMeta] = useState(initialPagination);

  const [loadingPanel, setLoadingPanel] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingCanjes, setLoadingCanjes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState('');
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
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const loadPanel = useCallback(async (params = {}) => {
    setLoadingPanel(true);
    try {
      const response = await fidelizacionService.getPanel(params);
      const nextData = normalizePanelData(response);
      setPanelData(nextData);
      return nextData;
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar metricas del panel.');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setLoadingPanel(false);
    }
  }, [openToast]);

  const loadClientes = useCallback(async (params = {}) => {
    setLoadingClientes(true);
    try {
      const response = await fidelizacionService.listClientes(params);
      const rows = normalizeEnvelopeRows(response).map(normalizeCliente);
      setClientes(rows);
      setClientesMeta(normalizeEnvelopeMeta(response, Number(params?.limit) || 20));
      return rows;
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar la lista de clientes.');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setLoadingClientes(false);
    }
  }, [openToast]);

  const loadCanjes = useCallback(async (params = {}) => {
    setLoadingCanjes(true);
    try {
      const response = await fidelizacionService.listCanjes(params);
      const rows = normalizeEnvelopeRows(response).map(normalizeCanje);
      setCanjes(rows);
      setCanjesMeta(normalizeEnvelopeMeta(response, Number(params?.limit) || 20));
      return rows;
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar el historial de canjes.');
      setError(msg);
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setLoadingCanjes(false);
    }
  }, [openToast]);

  const getClienteById = useCallback(async (idCliente, params = {}) => {
    setDetailLoading(true);
    try {
      const response = await fidelizacionService.getClienteById(idCliente, params);
      return normalizeClienteDetalle(response);
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar el detalle del cliente.');
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setDetailLoading(false);
    }
  }, [openToast]);

  const getClienteMovimientos = useCallback(async (idCliente, params = {}) => {
    try {
      const res = await fidelizacionService.getClienteMovimientos(idCliente, params);
      return normalizeEnvelopeRows(res).map(normalizeMovimiento);
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar movimientos del cliente.');
      openToast('ERROR', msg, 'danger');
      throw err;
    }
  }, [openToast]);

  const getClienteCanjeables = useCallback(async (idCliente, params = {}) => {
    try {
      const res = await fidelizacionService.getClienteCanjeables(idCliente, params);
      return normalizeCanjeableResponse(res);
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar los productos canjeables.');
      openToast('ERROR', msg, 'danger');
      throw err;
    }
  }, [openToast]);

  const getConfiguracion = useCallback(async (params = {}) => {
    try {
      const res = await fidelizacionService.getConfiguracion(params);
      return normalizeConfiguracion(res);
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al consultar la configuracion activa.');
      openToast('ERROR', msg, 'danger');
      throw err;
    }
  }, [openToast]);

  const saveConfiguracion = useCallback(async (payload) => {
    setSaving(true);
    try {
      const res = await fidelizacionService.saveConfiguracion(payload);
      const message = extractApiMessage(res, 'Reglas de fidelizacion actualizadas correctamente.');
      openToast('Configuracion actualizada', message, 'success');
      return res?.data ?? res;
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al actualizar las reglas.');
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [openToast]);

  const createCanje = useCallback(async (payload) => {
    setSaving(true);
    try {
      const res = await fidelizacionService.createCanje(payload);
      const responseData = res?.data ?? {};
      openToast(
        'Canje realizado',
        `El canje se registro correctamente (ID: ${responseData.id_canje ?? '-' }).`,
        'success'
      );
      return responseData;
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al procesar el canje.');
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [openToast]);

  const getCanjeById = useCallback(async (idCanje, params = {}) => {
    setDetailLoading(true);
    try {
      const res = await fidelizacionService.getCanjeById(idCanje, params);
      return normalizeCanje(res?.data ?? res);
    } catch (err) {
      const msg = extractApiMessage(err, 'Error al cargar el detalle del canje.');
      openToast('ERROR', msg, 'danger');
      throw err;
    } finally {
      setDetailLoading(false);
    }
  }, [openToast]);

  return {
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
    error,
    toast,
    openToast,
    closeToast,
    loadPanel,
    loadClientes,
    loadCanjes,
    getClienteById,
    getClienteMovimientos,
    getClienteCanjeables,
    getConfiguracion,
    saveConfiguracion,
    createCanje,
    getCanjeById
  };
};
