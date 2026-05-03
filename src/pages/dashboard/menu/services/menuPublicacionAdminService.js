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

  async getMenusProgramables() {
    const response = await apiFetch(`${BASE_ENDPOINT}/menus`, 'GET', null, { noCache: true });
    return toRows(response);
  },

  async createMenuProgramable({ nombreMenu, descripcion }) {
    return apiFetch(`${BASE_ENDPOINT}/menus`, 'POST', {
      nombre_menu: nombreMenu,
      descripcion: descripcion || null
    });
  },

  // Activa un menu de inmediato para la sucursal seleccionada.
  async activarMenuSucursal({ idSucursal, idMenu }) {
    return apiFetch(`${BASE_ENDPOINT}/programacion`, 'POST', {
      id_sucursal: idSucursal,
      id_menu: idMenu,
      fecha_inicio: null
    });
  },

  // Compatibilidad temporal con llamadas anteriores.
  async programarMenuSucursal({ idSucursal, idMenu, fechaInicio }) {
    return apiFetch(`${BASE_ENDPOINT}/programacion`, 'POST', {
      id_sucursal: idSucursal,
      id_menu: idMenu,
      fecha_inicio: fechaInicio || null
    });
  },

  // Permite cargar catalogo por sucursal y, opcionalmente, por menu destino seleccionado.
  async getCatalogoPublicacion(idSucursal, idMenu = null) {
    const endpoint = withQueryParams(`${BASE_ENDPOINT}/catalogo`, {
      id_sucursal: idSucursal,
      id_menu: idMenu
    });
    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    return response?.data || {
      menu: null,
      capabilities: {},
      warnings: [],
      items: []
    };
  },

  async getCarruselConfig() {
    const response = await apiFetch(`${BASE_ENDPOINT}/carrusel-config`, 'GET', null, { noCache: true });
    const payload = response?.data;
    if (!payload || typeof payload !== 'object') {
      return { byBranch: {}, customByBranch: {} };
    }
    return {
      byBranch: payload.byBranch && typeof payload.byBranch === 'object' ? payload.byBranch : {},
      customByBranch:
        payload.customByBranch && typeof payload.customByBranch === 'object' ? payload.customByBranch : {}
    };
  },

  async saveCarruselConfig(config = {}) {
    const response = await apiFetch(`${BASE_ENDPOINT}/carrusel-config`, 'PUT', config);
    const payload = response?.data;
    if (!payload || typeof payload !== 'object') {
      return { byBranch: {}, customByBranch: {} };
    }
    return {
      byBranch: payload.byBranch && typeof payload.byBranch === 'object' ? payload.byBranch : {},
      customByBranch:
        payload.customByBranch && typeof payload.customByBranch === 'object' ? payload.customByBranch : {}
    };
  },

  async saveCatalogoPublicacion({ idSucursal, idMenu = null, items }) {
    const endpoint = withQueryParams(`${BASE_ENDPOINT}/catalogo`, {
      id_sucursal: idSucursal,
      id_menu: idMenu
    });
    // Guardar publicacion puede tardar mas cuando se actualizan muchos items.
    return apiFetch(endpoint, 'PUT', { items }, { timeoutMs: 60000 });
  },

  // Preview administrativo coherente con el menu seleccionado (no depende del menu vigente publico).
  async getPreviewPublico(idSucursal, idMenu = null) {
    const endpoint = withQueryParams(`${BASE_ENDPOINT}/preview`, {
      id_sucursal: idSucursal,
      id_menu: idMenu
    });
    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    return response?.data || {
      menu: null,
      stats: { total: 0, disponibles: 0, agotados: 0 },
      items: []
    };
  }
};

export default menuPublicacionAdminService;
