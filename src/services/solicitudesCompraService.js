import { apiFetch } from './api';

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

export const buildSolicitudesCompraQuery = (path, options = {}, allowed = []) => {
  const params = new URLSearchParams();
  allowed.forEach((key) => {
    const value = options?.[key];
    if (hasValue(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

const CATALOG_FILTERS = ['id_almacen', 'tipo', 'buscar', 'solo_stock_bajo', 'page', 'limit'];
const LIST_FILTERS = ['estado', 'id_sucursal', 'id_almacen', 'fecha_desde', 'fecha_hasta', 'page', 'limit'];
const PROVIDER_FILTERS = ['buscar', 'page', 'limit'];

export const solicitudesCompraService = {
  getCatalogo: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra/catalogo', options, CATALOG_FILTERS), 'GET'),
  crearSolicitud: (payload) => apiFetch('/solicitudes_compra', 'POST', payload),
  getSolicitudes: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra', options, LIST_FILTERS), 'GET'),
  getSolicitudById: (id) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}`, 'GET'),
  getProveedores: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra/proveedores', options, PROVIDER_FILTERS), 'GET'),
  aprobarSolicitud: (id, payload) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/aprobar`, 'PUT', payload),
  rechazarSolicitud: (id, payload) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/rechazar`, 'PUT', payload)
};
