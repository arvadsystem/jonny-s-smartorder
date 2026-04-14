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
    apiFetch(`/ventas/cajas/asignaciones/${idAsignacion}/inactivar`, 'PATCH'),

  getSesionActiva: (params = {}) => apiFetch(`/ventas/cajas/sesion-activa${buildQuery(params)}`, 'GET'),

  listSesiones: (params = {}) => apiFetch(`/ventas/cajas/sesiones${buildQuery(params)}`, 'GET'),

  getSesionById: (idSesionCaja) => apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}`, 'GET'),

  getSesionReporte: (idSesionCaja) => apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/reporte`, 'GET'),

  getReporteCierres: (params = {}) => apiFetch(`/ventas/cajas/reportes/cierres${buildQuery(params)}`, 'GET'),

  openSesion: (payload) => apiFetch('/ventas/cajas/sesiones', 'POST', payload),

  closeSesion: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/cerrar`, 'PATCH', payload),

  createArqueo: (idSesionCaja, payload) =>
    apiFetch(`/ventas/cajas/sesiones/${idSesionCaja}/arqueos`, 'POST', payload)
};

export default cajasService;
