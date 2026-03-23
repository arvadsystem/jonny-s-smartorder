import { apiFetch } from '../../../../services/api';

// Servicio HTTP del modulo menu admin (publicacion por sucursal).
const BASE_ENDPOINT = '/api/admin/menu-publicacion';

const withQueryParams = (endpoint, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

const toRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

// Servicio del panel admin de publicacion de menu por sucursal.
const menuPublicacionAdminService = {
  async getSucursales() {
    const response = await apiFetch(`${BASE_ENDPOINT}/sucursales`, 'GET', null, { noCache: true });
    return toRows(response);
  },

  async getCatalogoPublicacion(idSucursal) {
    const endpoint = withQueryParams(`${BASE_ENDPOINT}/catalogo`, { id_sucursal: idSucursal });
    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    return response?.data || {
      menu: null,
      capabilities: {},
      warnings: [],
      items: []
    };
  },

  async saveCatalogoPublicacion({ idSucursal, items }) {
    const endpoint = withQueryParams(`${BASE_ENDPOINT}/catalogo`, { id_sucursal: idSucursal });
    return apiFetch(endpoint, 'PUT', { items });
  },

  // Reusa el endpoint publico real para preview del cliente.
  async getPreviewPublico(idSucursal) {
    const endpoint = withQueryParams('/public-menu/catalogo', { id_sucursal: idSucursal });
    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    return response?.data || {
      menu: null,
      stats: { total: 0, disponibles: 0, agotados: 0 },
      items: []
    };
  }
};

export default menuPublicacionAdminService;
