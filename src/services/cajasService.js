import { apiFetch } from './api';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

const getSafeOpenSessions = async (params = {}) => {
  const idSucursal = Number.parseInt(String(params?.id_sucursal ?? ''), 10);
  if (!Number.isInteger(idSucursal) || idSucursal <= 0) return [];

  const attempts = [
    () => apiFetch(`/ventas/cajas/sesiones-abiertas${buildQuery({ id_sucursal: idSucursal })}`, 'GET'),
    () => apiFetch(`/ventas/cajas/sesiones${buildQuery({ id_sucursal: idSucursal })}`, 'GET')
  ];

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      const rows = normalizeRows(response);
      if (!rows.length) continue;
      return rows.filter((item) => {
        const statusCode = String(item?.estado_codigo || '').trim().toUpperCase();
        return !statusCode || statusCode === 'ABIERTA';
      });
    } catch {
      // AM: fallback silencioso entre endpoints de sesiones abiertas.
    }
  }

  return [];
};

const autoAsignarAuxiliarSesionSafe = async (idSesionCaja, payload) => {
  const idSesion = Number.parseInt(String(idSesionCaja ?? ''), 10);
  if (!Number.isInteger(idSesion) || idSesion <= 0) {
    const error = new Error('La sesión de caja seleccionada es inválida.');
    error.code = 'AUTO_AUXILIAR_SESSION_INVALID';
    error.status = 400;
    throw error;
  }

  const canonicalEndpoint = `/ventas/cajas/sesiones/${idSesion}/auto-auxiliar`;
  try {
    return await apiFetch(canonicalEndpoint, 'POST', payload);
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status === 404) {
      const endpointError = new Error('La ruta de autoasignación no está publicada en el backend activo. Verifica que el proceso en :3001 corresponda al repo actualizado.');
      endpointError.code = 'AUTO_AUXILIAR_ENDPOINT_UNAVAILABLE';
      endpointError.status = 404;
      endpointError.data = error?.data || null;
      throw endpointError;
    }
    throw error;
  }
};

const cajasService = {
  getCatalogos: (params = {}) => apiFetch(`/ventas/cajas/catalogos${buildQuery(params)}`, 'GET'),
  listUsuariosOperativos: (params = {}) => apiFetch(`/ventas/cajas/usuarios${buildQuery(params)}`, 'GET'),

  listCajaCatalogo: (params = {}) => apiFetch(`/ventas/cajas/listado${buildQuery(params)}`, 'GET'),

  getCajaCatalogoById: (idCaja) => apiFetch(`/ventas/cajas/listado/${idCaja}`, 'GET'),

  createCajaCatalogo: (payload) => apiFetch('/ventas/cajas/listado', 'POST', payload),

  updateCajaCatalogo: (idCaja, payload) => apiFetch(`/ventas/cajas/listado/${idCaja}`, 'PATCH', payload),

  listAsignaciones: (params = {}) => apiFetch(`/ventas/cajas/asignaciones${buildQuery(params)}`, 'GET'),

  createAsignacion: (payload) => apiFetch('/ventas/cajas/asignaciones', 'POST', payload),

  updateAsignacion: (idAsignacion, payload) =>
    apiFetch(`/ventas/cajas/asignaciones/${idAsignacion}`, 'PATCH', payload),

  inactivateAsignacion: (idAsignacion) =>
    apiFetch(`/ventas/cajas/asignaciones/${idAsignacion}/desactivar`, 'PATCH'),

  getSesionActiva: (params = {}) => apiFetch(`/ventas/cajas/sesion-activa${buildQuery(params)}`, 'GET'),
  getMiAsignacionActiva: () => apiFetch('/ventas/cajas/mi-asignacion-activa', 'GET'),

  listSesiones: (params = {}) => apiFetch(`/ventas/cajas/sesiones${buildQuery(params)}`, 'GET'),
  listSesionesAbiertas: (params = {}) => apiFetch(`/ventas/cajas/sesiones-abiertas${buildQuery(params)}`, 'GET'),
  listSesionesAbiertasSafe: (params = {}) => getSafeOpenSessions(params),

  getSesionById: (idSesionCaja) => apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}`, 'GET'),

  getSesionReporte: (idSesionCaja) => apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/reporte`, 'GET'),

  getReporteCierres: (params = {}) => apiFetch(`/ventas/cajas/reportes/cierres${buildQuery(params)}`, 'GET'),

  openSesion: (payload) => apiFetch('/ventas/cajas/sesiones', 'POST', payload),
  abrirMiSesion: (payload) => apiFetch('/ventas/cajas/mi-sesion/abrir', 'POST', payload),

  closeSesion: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/cerrar`, 'PATCH', payload),
  previewCloseSesion: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/cierre-preview`, 'POST', payload),

  editCierre: (idCierreCaja, payload) =>
    apiFetch(`/ventas/cajas/cierres/${idCierreCaja}`, 'PATCH', payload),

  createArqueo: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/arqueos`, 'POST', payload),

  autoAsignarAuxiliarSesion: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/auto-auxiliar`, 'POST', payload),
  autoAsignarAuxiliarSesionSafe: (idSesionCaja, payload) =>
    autoAsignarAuxiliarSesionSafe(idSesionCaja, payload)
};

export default cajasService;
