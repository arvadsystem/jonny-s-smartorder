import { apiFetch } from './api';
import { createVentaNative } from './ventasNativeService';

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

const ventasService = {
  list: (params = {}) => apiFetch(`/ventas${buildQuery(params)}`, 'GET'),
  buscarVenta: (params = {}) => apiFetch(`/ventas/buscar${buildQuery(params)}`, 'GET'),
  getById: (id) => apiFetch(`/ventas/${id}`, 'GET'),
  createReversion: (id, payload) => apiFetch(`/ventas/${id}/reversiones`, 'POST', payload),
  listReversiones: (id) => apiFetch(`/ventas/${id}/reversiones`, 'GET'),
  create: (payload) => createVentaNative(payload),
  getClientesCatalog: () => apiFetch('/ventas/catalogos/clientes', 'GET'),
  getCombosCatalog: () => apiFetch('/ventas/catalogos/combos', 'GET'),
  getRecetasCatalog: () => apiFetch('/ventas/catalogos/recetas', 'GET'),
  getDescuentosCatalog: () => apiFetch('/ventas/catalogos/descuentos', 'GET'),
  getTiposDescuentoCatalog: () => apiFetch('/ventas/catalogos/tipos-descuento', 'GET'),
  getProductosCatalog: () => apiFetch('/ventas/catalogos/productos', 'GET'),
  // FIX: usar endpoint propio de ventas para categorias; /categorias_productos exige
  // INVENTARIO_CATEGORIAS_VER que el cajero no tiene, causando 403 y caja sin productos.
  getCategoriasCatalog: () => apiFetch('/ventas/catalogos/categorias', 'GET'),
  getTipoDepartamentos: () => apiFetch('/ventas/catalogos/tipo-departamento', 'GET'),
  listDescuentosCatalogosAdmin: (params = {}) =>
    apiFetch(`/ventas/descuentos-catalogos${buildQuery(params)}`, 'GET'),
  getDescuentoCatalogoById: (id) => apiFetch(`/ventas/descuentos-catalogos/${id}`, 'GET'),
  createDescuentoCatalogo: (payload) => apiFetch('/ventas/descuentos-catalogos', 'POST', payload),
  updateDescuentoCatalogo: (id, payload) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}`, 'PUT', payload),
  toggleDescuentoCatalogoEstado: (id, estado) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}/estado`, 'PATCH', { estado }),

  // Pedidos menú público
  getPedidosMenu: () => apiFetch('/ventas/pedidos-menu', 'GET'),
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
