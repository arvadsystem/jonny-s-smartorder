import { apiFetch } from '../../../../services/api';

// Servicio HTTP del modulo menu admin (publicacion por sucursal).
const BASE_ENDPOINT = '/api/admin/menu-publicacion';
const CARRUSEL_CONTACT_STORAGE_KEY = 'pm_carrusel_contact_phones_v1';
const DEFAULT_CARRUSEL_CONTACT_PHONES = Object.freeze({
  primary: '',
  secondary: '',
  whatsapp: ''
});

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

const normalizeCarruselContactPhones = (value) => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CARRUSEL_CONTACT_PHONES };
  return {
    primary: String(value.primary || value.telefono_principal || value.phone_primary || '').trim(),
    secondary: String(value.secondary || value.telefono_secundario || value.phone_secondary || '').trim(),
    whatsapp: String(value.whatsapp || value.telefono_whatsapp || '').trim()
  };
};

const hasAnyCarruselContactPhone = (value = {}) =>
  Boolean(
    String(value?.primary || '').trim() ||
      String(value?.secondary || '').trim() ||
      String(value?.whatsapp || '').trim()
  );

const readCarruselContactPhonesCache = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_CARRUSEL_CONTACT_PHONES };
  try {
    const raw = window.localStorage.getItem(CARRUSEL_CONTACT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CARRUSEL_CONTACT_PHONES };
    return normalizeCarruselContactPhones(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CARRUSEL_CONTACT_PHONES };
  }
};

const saveCarruselContactPhonesCache = (value) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeCarruselContactPhones(value);
  try {
    if (hasAnyCarruselContactPhone(normalized)) {
      window.localStorage.setItem(CARRUSEL_CONTACT_STORAGE_KEY, JSON.stringify(normalized));
    } else {
      window.localStorage.removeItem(CARRUSEL_CONTACT_STORAGE_KEY);
    }
  } catch {
    // Silencioso: no interrumpimos guardado principal si localStorage falla.
  }
};

const normalizeCarruselConfig = (value) => {
  if (!value || typeof value !== 'object') {
    return { byBranch: {}, customByBranch: {}, contactPhones: { ...DEFAULT_CARRUSEL_CONTACT_PHONES } };
  }
  return {
    byBranch: value.byBranch && typeof value.byBranch === 'object' ? value.byBranch : {},
    customByBranch:
      value.customByBranch && typeof value.customByBranch === 'object' ? value.customByBranch : {},
    contactPhones: normalizeCarruselContactPhones(value.contactPhones || value)
  };
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

  async updateMenuProgramable({ idMenu, nombreMenu, descripcion }) {
    return apiFetch(`${BASE_ENDPOINT}/menus/${idMenu}`, 'PUT', {
      nombre_menu: nombreMenu,
      descripcion: descripcion || null
    });
  },

  async deleteMenuProgramable(idMenu) {
    return apiFetch(`${BASE_ENDPOINT}/menus/${idMenu}`, 'DELETE');
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
    const normalized = normalizeCarruselConfig(response?.data);
    const cachedPhones = readCarruselContactPhonesCache();
    const contactPhones = hasAnyCarruselContactPhone(normalized.contactPhones)
      ? normalized.contactPhones
      : cachedPhones;
    if (hasAnyCarruselContactPhone(contactPhones)) {
      saveCarruselContactPhonesCache(contactPhones);
    }
    return { ...normalized, contactPhones };
  },

  async saveCarruselConfig(config = {}) {
    const requestedPhones = normalizeCarruselContactPhones(config?.contactPhones || config);
    const response = await apiFetch(`${BASE_ENDPOINT}/carrusel-config`, 'PUT', config);
    const normalized = normalizeCarruselConfig(response?.data);
    const contactPhones = hasAnyCarruselContactPhone(normalized.contactPhones)
      ? normalized.contactPhones
      : requestedPhones;
    saveCarruselContactPhonesCache(contactPhones);
    return { ...normalized, contactPhones };
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
