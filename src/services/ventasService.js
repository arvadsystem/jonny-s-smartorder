import { apiFetch } from './api';
import { API_URL } from '../utils/constants';

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

const buildVentasListQuery = (params = {}) => buildQuery({
  ...params,
  includeSummary: params.includeSummary === false ? 'false' : params.includeSummary,
  includePaginationTotals: params.includePaginationTotals === false
    ? 'false'
    : params.includePaginationTotals
});
const VENTAS_CREATE_TIMEOUT_MS = 30000;

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const withIdempotencyKey = (config = {}) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    'Idempotency-Key': createIdempotencyKey()
  }
});

const readBlobError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `No se pudo descargar el PDF (HTTP ${response.status}).`;
  try {
    const payload = JSON.parse(text);
    return payload?.message || payload?.mensaje || `No se pudo descargar el PDF (HTTP ${response.status}).`;
  } catch {
    return text;
  }
};

const fetchPdfBlob = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/pdf'
    }
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  if (!response.ok) {
    throw new Error(await readBlobError(response));
  }

  return response.blob();
};

const ventasService = {
  list: (params = {}) => apiFetch(`/ventas${buildVentasListQuery(params)}`, 'GET'),
  buscarVenta: (params = {}) => apiFetch(`/ventas/buscar${buildQuery(params)}`, 'GET'),
  getById: (id) => apiFetch(`/ventas/${id}`, 'GET'),
  getTicketById: (id) => apiFetch(`/ventas/${id}/ticket`, 'GET'),
  getTicketPdf: (id) => fetchPdfBlob(`/ventas/${id}/ticket.pdf`),
  getComandaById: (id) => apiFetch(`/ventas/${id}/comanda`, 'GET'),
  registerPrintEvent: (id, payload) => apiFetch(`/ventas/${id}/impresiones`, 'POST', payload),
  createReversion: (id, payload) => apiFetch(`/ventas/${id}/reversiones`, 'POST', payload, withIdempotencyKey()),
  listReversiones: (id) => apiFetch(`/ventas/${id}/reversiones`, 'GET'),
  create: (payload) => apiFetch('/ventas', 'POST', payload, withIdempotencyKey({ timeoutMs: VENTAS_CREATE_TIMEOUT_MS })),
  createPedidoPendiente: (payload) => apiFetch('/ventas/pedidos-pendientes', 'POST', payload, withIdempotencyKey()),
  listPedidosPendientesPago: (params = {}) =>
    apiFetch(`/ventas/pedidos-pendientes${buildQuery(params)}`, 'GET'),
  registrarPagoPedido: (idPedido, payload) =>
    apiFetch(`/ventas/pedidos/${idPedido}/registrar-pago`, 'POST', payload, withIdempotencyKey()),
  guardarTelefonoCliente: (idCliente, payload) =>
    apiFetch(`/ventas/clientes/${idCliente}/telefono`, 'PATCH', payload),
  getCajaBootstrap: (params = {}, config = {}) =>
    apiFetch(`/ventas/caja/bootstrap${buildQuery(params)}`, 'GET', null, config),
  getClientesCatalog: (params = {}, config = {}) =>
    apiFetch(`/ventas/catalogos/clientes${buildQuery(params)}`, 'GET', null, config),
  getCombosCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/combos${buildQuery(params)}`, 'GET', null, config),
  getRecetasCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/recetas${buildQuery(params)}`, 'GET', null, config),
  getExtrasPermitidos: (params = {}) => apiFetch(`/ventas/catalogos/extras-permitidos${buildQuery(params)}`, 'GET'),
  getDescuentosCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/descuentos${buildQuery(params)}`, 'GET', null, config),
  getTiposDescuentoCatalog: (config = {}) => apiFetch('/ventas/catalogos/tipos-descuento', 'GET', null, config),
  getProductosCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/productos${buildQuery(params)}`, 'GET', null, config),
  // FIX: usar endpoint propio de ventas para categorias; /categorias_productos exige
  // INVENTARIO_CATEGORIAS_VER que el cajero no tiene, causando 403 y caja sin productos.
  getCategoriasCatalog: (config = {}) => apiFetch('/ventas/catalogos/categorias', 'GET', null, config),
  getTipoDepartamentos: (config = {}) => apiFetch('/ventas/catalogos/tipo-departamento', 'GET', null, config),
  listDescuentosCatalogosAdmin: (params = {}) =>
    apiFetch(`/ventas/descuentos-catalogos${buildQuery(params)}`, 'GET'),
  getDescuentoCatalogoById: (id) => apiFetch(`/ventas/descuentos-catalogos/${id}`, 'GET'),
  createDescuentoCatalogo: (payload) => apiFetch('/ventas/descuentos-catalogos', 'POST', payload),
  updateDescuentoCatalogo: (id, payload) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}`, 'PUT', payload),
  toggleDescuentoCatalogoEstado: (id, estado) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}/estado`, 'PATCH', { estado }),
  getDashboardResumen: (params = {}) => apiFetch(`/ventas/dashboard-resumen${buildQuery(params)}`, 'GET'),
  getDashboardFlujoPedidos: (params = {}) =>
    apiFetch(`/ventas/dashboard-flujo-pedidos${buildQuery(params)}`, 'GET'),
  // Pedidos menÃƒÂº pÃƒÂºblico
  getPedidosMenu: (params = {}) => apiFetch(`/ventas/pedidos-menu${buildQuery(params)}`, 'GET'),
  confirmarPagoPedido: (id) =>
    apiFetch(`/ventas/pedidos-menu/${id}/confirmar-pago`, 'POST', {}),
  updatePedidoEstado: (id, estadoDestinoOrId) => {
    const numericState = Number.parseInt(String(estadoDestinoOrId ?? ''), 10);
    if (Number.isInteger(numericState) && numericState > 0) {
      return apiFetch(`/ventas/pedidos-menu/${id}/estado`, 'PUT', { id_estado_pedido: numericState });
    }
    return apiFetch(`/ventas/pedidos-menu/${id}/estado`, 'PUT', { estado_destino: estadoDestinoOrId });
  }
};

export default ventasService;

