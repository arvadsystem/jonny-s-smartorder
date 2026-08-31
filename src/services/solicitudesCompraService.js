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
export const LIST_FILTERS = ['estado', 'buscar', 'id_sucursal', 'id_almacen', 'fecha_desde', 'fecha_hasta', 'page', 'limit'];
const PROVIDER_FILTERS = ['buscar', 'page', 'limit'];
const QUICK_CAPTURE_FILTERS = ['estado', 'buscar', 'page', 'limit'];

export const solicitudesCompraService = {
  getCatalogo: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra/catalogo', options, CATALOG_FILTERS), 'GET'),
  crearSolicitud: (payload) => apiFetch('/solicitudes_compra', 'POST', payload, { timeoutMs: 60000 }),
  reconciliarEnvio: (clientRequestId, { signal } = {}) => apiFetch(`/solicitudes_compra/envios/${encodeURIComponent(String(clientRequestId))}`, 'GET', null, { signal }),
  getSolicitudes: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra', options, LIST_FILTERS), 'GET'),
  getSolicitudById: (id) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}`, 'GET'),
  getProveedores: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra/proveedores', options, PROVIDER_FILTERS), 'GET'),
  aprobarSolicitud: (id, payload) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/aprobar`, 'PUT', payload),
  rechazarSolicitud: (id, payload) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/rechazar`, 'PUT', payload),
  recibirSolicitud: (id, payload) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/recibir`, 'POST', payload),
  subirFactura: (id, factura) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/evidencias/factura`, 'POST', { factura }),
  eliminarEvidencia: (id, idEvidencia) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/evidencias/${encodeURIComponent(String(idEvidencia))}`, 'DELETE'),
  getEvidencias: (id) => apiFetch(`/solicitudes_compra/${encodeURIComponent(String(id))}/evidencias`, 'GET'),
  createQuickCapture: () => apiFetch('/solicitudes_compra/capturas-rapidas', 'POST', {}),
  listQuickCaptures: (options) => apiFetch(buildSolicitudesCompraQuery('/solicitudes_compra/capturas-rapidas', options, QUICK_CAPTURE_FILTERS), 'GET'),
  getQuickCapture: (id) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}`, 'GET'),
  listQuickCaptureEvidence: (id) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/evidencias`, 'GET'),
  uploadQuickCaptureInvoice: (id, factura) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/evidencias/factura`, 'POST', { factura }),
  deleteQuickCaptureEvidence: (id, evidenceId) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/evidencias/${encodeURIComponent(String(evidenceId))}`, 'DELETE'),
  discardQuickCapture: (id) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}`, 'DELETE'),
  sendQuickCapture: (id) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/enviar`, 'PUT', {}),
  rejectQuickCapture: (id, motivo_rechazo) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/rechazar`, 'PUT', { motivo_rechazo }),
  getQuickCaptureProviders: () => apiFetch('/solicitudes_compra/capturas-rapidas/proveedores', 'GET'),
  formalizeQuickCapture: (id, payload) => apiFetch(`/solicitudes_compra/capturas-rapidas/${encodeURIComponent(String(id))}/formalizar`, 'POST', payload)
};
