import { useCallback, useEffect, useMemo, useState } from 'react';
import cajasService from '../../../../services/cajasService';
import {
  buildCierresStats,
  extractCajasApiMessage,
  normalizeCajaCatalogos,
  normalizeSesion,
  normalizeSesionActiva,
  normalizeSesionDetalle
} from '../utils/cajasHelpers';

const initialCatalogos = Object.freeze({
  cajas: [],
  estados_sesion: [],
  roles_participacion: [],
  tipos_movimiento: [],
  metodos_pago: [],
  resoluciones_cierre: [],
  tipos_arqueo: []
});

export function useCierresCaja() {
  const [catalogos, setCatalogos] = useState(initialCatalogos);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [loadingSesiones, setLoadingSesiones] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success'
  });

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({ show: true, title, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToast((current) => ({ ...current, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => {
      setToast((current) => ({ ...current, show: false }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const loadCatalogos = useCallback(
    async (params = {}) => {
      setLoadingCatalogos(true);
      try {
        const response = await cajasService.getCatalogos(params);
        setCatalogos(normalizeCajaCatalogos(response));
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo cargar la configuracion operativa de cajas.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setLoadingCatalogos(false);
      }
    },
    [openToast]
  );

  const loadSesionActiva = useCallback(
    async (params = {}) => {
      try {
        const response = await cajasService.getSesionActiva(params);
        const normalized = normalizeSesionActiva(response);
        setSesionActiva(normalized);
        return normalized;
      } catch (errorResponse) {
        setSesionActiva(null);
        throw errorResponse;
      }
    },
    []
  );

  const loadSesiones = useCallback(
    async (params = {}) => {
      setLoadingSesiones(true);
      setError('');
      try {
        const response = await cajasService.listSesiones(params);
        const normalized = (Array.isArray(response) ? response : []).map(normalizeSesion);
        setSesiones(normalized);
        return normalized;
      } catch (errorResponse) {
        const message = extractCajasApiMessage(
          errorResponse,
          'No se pudo cargar el historial de sesiones de caja.'
        );
        setSesiones([]);
        setError(message);
        openToast('ERROR', message, 'danger');
        throw errorResponse;
      } finally {
        setLoadingSesiones(false);
      }
    },
    [openToast]
  );

  const getSesionDetalle = useCallback(
    async (idSesionCaja) => {
      setDetailLoading(true);
      try {
        const response = await cajasService.getSesionReporte(idSesionCaja);
        return normalizeSesionDetalle(response);
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo cargar el detalle de la sesion.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setDetailLoading(false);
      }
    },
    [openToast]
  );

  const openSesion = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const response = await cajasService.openSesion(payload);
        openToast(
          'SESION ABIERTA',
          response?.message || 'La sesion de caja se inicio correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo abrir la sesion de caja.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const listUsuariosOperativos = useCallback(
    async (params = {}) => {
      try {
        return await cajasService.listUsuariosOperativos(params);
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo cargar el listado de usuarios operativos.'),
          'danger'
        );
        throw errorResponse;
      }
    },
    [openToast]
  );

  const listCajaCatalogo = useCallback(
    async (params = {}) => {
      try {
        return await cajasService.listCajaCatalogo(params);
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo cargar el catalogo de cajas.'),
          'danger'
        );
        throw errorResponse;
      }
    },
    [openToast]
  );

  const listCajaAsignaciones = useCallback(
    async (params = {}) => {
      try {
        return await cajasService.listAsignaciones(params);
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo cargar las asignaciones de cajas.'),
          'danger'
        );
        throw errorResponse;
      }
    },
    [openToast]
  );

  const createCajaCatalogo = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const response = await cajasService.createCajaCatalogo(payload);
        openToast(
          'CAJA CREADA',
          response?.message || 'La caja se creo correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo crear la caja.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const createCajaAsignacion = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const response = await cajasService.createAsignacion(payload);
        openToast(
          'ASIGNACION CREADA',
          response?.message || 'La asignacion se registro correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo registrar la asignacion.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const updateCajaAsignacion = useCallback(
    async (idAsignacion, payload) => {
      setSaving(true);
      try {
        const response = await cajasService.updateAsignacion(idAsignacion, payload);
        openToast(
          'ASIGNACION ACTUALIZADA',
          response?.message || 'La asignacion se actualizo correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo actualizar la asignacion.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const inactivateCajaAsignacion = useCallback(
    async (idAsignacion) => {
      setSaving(true);
      try {
        const response = await cajasService.inactivateAsignacion(idAsignacion);
        openToast(
          'ASIGNACION INACTIVADA',
          response?.message || 'La asignacion se inactivo correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo inactivar la asignacion.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const closeSesion = useCallback(
    async (idSesionCaja, payload) => {
      setSaving(true);
      try {
        const response = await cajasService.closeSesion(idSesionCaja, payload);
        openToast(
          'CIERRE REGISTRADO',
          response?.message || 'El cierre de caja se registro correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo registrar el cierre de caja.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const editCierre = useCallback(
    async (idCierreCaja, payload) => {
      setSaving(true);
      try {
        const response = await cajasService.editCierre(idCierreCaja, payload);
        openToast(
          'CIERRE ACTUALIZADO',
          response?.message || 'El cierre de caja se actualizo correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo editar el cierre de caja.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const createArqueo = useCallback(
    async (idSesionCaja, payload) => {
      setSaving(true);
      try {
        const response = await cajasService.createArqueo(idSesionCaja, payload);
        openToast(
          'ARQUEO REGISTRADO',
          response?.message || 'El arqueo se registro correctamente.',
          'success'
        );
        return response;
      } catch (errorResponse) {
        openToast(
          'ERROR',
          extractCajasApiMessage(errorResponse, 'No se pudo registrar el arqueo.'),
          'danger'
        );
        throw errorResponse;
      } finally {
        setSaving(false);
      }
    },
    [openToast]
  );

  const stats = useMemo(
    () => buildCierresStats({ sesiones, sesionActiva }),
    [sesionActiva, sesiones]
  );

  return {
    catalogos,
    sesionActiva,
    sesiones,
    stats,
    loadingCatalogos,
    loadingSesiones,
    detailLoading,
    saving,
    error,
    toast,
    openToast,
    closeToast,
    loadCatalogos,
    loadSesionActiva,
    loadSesiones,
    listUsuariosOperativos,
    listCajaCatalogo,
    listCajaAsignaciones,
    getSesionDetalle,
    openSesion,
    createCajaCatalogo,
    createCajaAsignacion,
    updateCajaAsignacion,
    inactivateCajaAsignacion,
    closeSesion,
    editCierre,
    createArqueo
  };
}
