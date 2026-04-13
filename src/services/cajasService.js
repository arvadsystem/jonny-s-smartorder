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
