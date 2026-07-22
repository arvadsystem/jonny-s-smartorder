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
const parseTimeoutMs = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const VENTAS_CREATE_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_VENTAS_CREATE_TIMEOUT_MS, 90000);
const VENTAS_CREATE_RECOVERY_TIMEOUT_MS = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_TIMEOUT_MS,
  20000
);
const VENTAS_CREATE_RECOVERY_RETRIES = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES,
  3
);
const VENTAS_CREATE_RECOVERY_DELAY_MS = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS,
  1500
);
const CAJA_BOOTSTRAP_CACHE_TTL_MS = 5000;
const cajaBootstrapInFlight = new Map();
const cajaBootstrapCache = new Map();

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const withIdempotencyKey = (config = {}, providedKey = null) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    'Idempotency-Key': String(providedKey || createIdempotencyKey()).trim()
  }
});

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isVentaCreateTimeoutError = (error) =>
  Number(error?.status || 0) === 408 || String(error?.code || error?.data?.code || '').trim().toUpperCase() === 'REQUEST_TIMEOUT';

const isVentaCreateInProgressError = (error) =>
  Number(error?.status || 0) === 409 && String(error?.code || error?.data?.code || '').trim().toUpperCase() === 'REQUEST_ALREADY_IN_PROGRESS';

const createVentaRequest = (payload, { idempotencyKey, timeoutMs }) =>
  apiFetch(
    '/ventas',
    'POST',
    payload,
    withIdempotencyKey({ timeoutMs }, idempotencyKey)
  );

const createVentaWithRecovery = async (payload, options = {}) => {
  const idempotencyKey = String(options?.idempotencyKey || createIdempotencyKey()).trim();
  const initialTimeoutMs = parseTimeoutMs(options?.timeoutMs, VENTAS_CREATE_TIMEOUT_MS);

  try {
    return await createVentaRequest(payload, { idempotencyKey, timeoutMs: initialTimeoutMs });
  } catch (error) {
    if (!isVentaCreateTimeoutError(error) && !isVentaCreateInProgressError(error)) {
      throw error;
    }

    let lastError = error;
    for (let attempt = 1; attempt <= VENTAS_CREATE_RECOVERY_RETRIES; attempt += 1) {
      await delay(VENTAS_CREATE_RECOVERY_DELAY_MS * attempt);
      try {
        return await createVentaRequest(payload, {
          idempotencyKey,
          timeoutMs: VENTAS_CREATE_RECOVERY_TIMEOUT_MS
        });
      } catch (recoveryError) {
        lastError = recoveryError;
        if (isVentaCreateTimeoutError(recoveryError) || isVentaCreateInProgressError(recoveryError)) {
          continue;
        }
        throw recoveryError;
      }
    }

    if (isVentaCreateInProgressError(lastError) || isVentaCreateTimeoutError(lastError)) {
      const fallbackError = new Error(
        'La venta sigue procesandose en el servidor. Espera unos segundos, revisa el historial de ventas y evita reenviar el cobro inmediatamente.'
      );
      fallbackError.status = Number(lastError?.status || 0) || 409;
      fallbackError.code = 'VENTA_EN_PROCESO';
      fallbackError.data = lastError?.data || null;
      throw fallbackError;
    }

    throw lastError;
  }
};

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

const clonePayload = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return value == null ? value : JSON.parse(JSON.stringify(value));
};

const buildCajaBootstrapRequestKey = (params = {}, config = {}) => JSON.stringify({
  user: String(config.coalesceUserKey || config.userKey || 'anon'),
  sucursal: params.id_sucursal ?? null,
  departamento: params.id_tipo_departamento ?? null
});

const getCajaBootstrapCoalesced = async (params = {}, config = {}) => {
  const key = buildCajaBootstrapRequestKey(params, config);
  const cached = cajaBootstrapCache.get(key);
  if (!config.force && cached && Date.now() - cached.at < CAJA_BOOTSTRAP_CACHE_TTL_MS) {
    return clonePayload(cached.value);
  }
  if (config.force) cajaBootstrapCache.delete(key);

  const inFlight = cajaBootstrapInFlight.get(key);
  if (inFlight) return clonePayload(await inFlight);

  const sharedConfig = { ...config };
  delete sharedConfig.signal;
  delete sharedConfig.coalesceUserKey;
  delete sharedConfig.userKey;
  delete sharedConfig.force;

  const promise = apiFetch(`/ventas/caja/bootstrap${buildQuery(params)}`, 'GET', null, sharedConfig);
  cajaBootstrapInFlight.set(key, promise);
  try {
    const value = await promise;
    cajaBootstrapCache.set(key, { at: Date.now(), value: clonePayload(value) });
    return clonePayload(value);
  } finally {
    if (cajaBootstrapInFlight.get(key) === promise) {
      cajaBootstrapInFlight.delete(key);
    }
  }
};

const ventasService = {
  list: (params = {}, config = {}) => apiFetch(`/ventas${buildVentasListQuery(params)}`, 'GET', null, config),
  buscarVenta: (params = {}) => apiFetch(`/ventas/buscar${buildQuery(params)}`, 'GET'),
  getById: (id) => apiFetch(`/ventas/${id}`, 'GET'),
  getTicketById: (id) => apiFetch(`/ventas/${id}/ticket`, 'GET'),
  getTicketPdf: (id) => fetchPdfBlob(`/ventas/${id}/ticket.pdf`),
  getComandaById: (id) => apiFetch(`/ventas/${id}/comanda`, 'GET'),
  getPedidoComanda: (id) => apiFetch(`/ventas/pedidos/${id}/comanda`, 'GET'),
  getPrintRuntimeConfig: (params = {}) => apiFetch(`/ventas/impresoras-config${buildQuery(params)}`, 'GET'),
  detectPrinterDevice: (payload) => apiFetch('/ventas/impresoras/dispositivo-deteccion', 'POST', payload),
  getQzCertificate: (idSucursal) => apiFetch(
    `/ventas/qz/certificate?id_sucursal=${encodeURIComponent(idSucursal)}`,
    'GET'
  ),
  signQzRequest: (request, idSucursal) => apiFetch('/ventas/qz/sign', 'POST', {
    request,
    id_sucursal: idSucursal
  }),
  registerPrintEvent: (id, payload) => apiFetch(`/ventas/${id}/impresiones`, 'POST', payload),
  enqueuePrintJob: (id, payload, idempotencyKey) => apiFetch(
    `/ventas/${id}/print-jobs`,
    'POST',
    payload,
    withIdempotencyKey({}, idempotencyKey)
  ),
  enqueuePedidoPrintJob: (idPedido, payload, idempotencyKey) => apiFetch(
    `/ventas/pedidos/${idPedido}/print-jobs`,
    'POST',
    payload,
    withIdempotencyKey({}, idempotencyKey)
  ),
  getPrintJob: (id) => apiFetch(`/ventas/print-jobs/${id}`, 'GET'),
  createReversion: (id, payload) => apiFetch(`/ventas/${id}/reversiones`, 'POST', payload, withIdempotencyKey()),
  listReversiones: (id) => apiFetch(`/ventas/${id}/reversiones`, 'GET'),
  create: (payload, options = {}) => createVentaWithRecovery(payload, options),
  createPedidoPendiente: (payload) => apiFetch('/ventas/pedidos-pendientes', 'POST', payload, withIdempotencyKey()),
  listPedidosPendientesPago: (params = {}, options = {}) =>
    apiFetch(`/ventas/pedidos-pendientes${buildQuery(params)}`, 'GET', null, options),
  registrarPagoPedido: (idPedido, payload) =>
    apiFetch(`/ventas/pedidos/${idPedido}/registrar-pago`, 'POST', payload, withIdempotencyKey()),
  guardarTelefonoCliente: (idCliente, payload) =>
    apiFetch(`/ventas/clientes/${idCliente}/telefono`, 'PATCH', payload),
  getCajaBootstrap: (params = {}, config = {}) =>
    getCajaBootstrapCoalesced(params, config),
  getClientesCatalog: (params = {}, config = {}) =>
    apiFetch(`/ventas/catalogos/clientes${buildQuery(params)}`, 'GET', null, config),
  getRecetasCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/recetas${buildQuery(params)}`, 'GET', null, config),
  getExtrasPermitidos: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/extras-permitidos${buildQuery(params)}`, 'GET', null, config),
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

