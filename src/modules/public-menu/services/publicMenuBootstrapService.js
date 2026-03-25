import { apiFetch } from '../../../services/api';
import { getBranchUiMeta } from '../config/publicBranchesUi';

// Construye querystring segura evitando repetir concatenacion manual.
const withQueryParams = (endpoint, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

// Normaliza estructura de sucursal para componentes de UI.
const normalizeBranch = (raw) => ({
  id: Number(raw?.id_sucursal ?? raw?.id),
  name: raw?.nombre_sucursal || raw?.name || 'Sucursal',
  address: raw?.direccion || raw?.address || 'Direccion no disponible',
  schedule: raw?.horario || raw?.schedule || 'Horario no disponible',
  etaMinutes: raw?.tiempo_entrega || raw?.etaMinutes || '20-30 min',
  imageUrl: raw?.url_imagen || raw?.imageUrl || '',
  isOpen: raw?.isOpen ?? raw?.estado ?? true
});

const normalizeBranchWithUi = (raw) => {
  const base = normalizeBranch(raw);
  const ui = getBranchUiMeta({
    id: base.id,
    name: base.name,
    address: base.address,
    imageUrl: base.imageUrl,
    slug: raw?.slug
  });

  return {
    ...base,
    slug: ui.slug,
    imageUrl: ui.foto || base.imageUrl || '',
    displayName: ui.nombre || base.name
  };
};

// Normaliza metadata del menu vigente para uso interno del flujo.
const normalizeMenu = (raw) => ({
  idMenuVigente: Number(raw?.id_menu_vigente ?? 0) || null,
  idMenu: Number(raw?.id_menu ?? 0) || null,
  idSucursal: Number(raw?.id_sucursal ?? 0) || null,
  nombreMenu: raw?.nombre_menu || 'Menu',
  descripcionMenu: raw?.descripcion_menu || '',
  fechaInicio: raw?.fecha_inicio || null,
  nombreSucursal: raw?.nombre_sucursal || ''
});

// Normaliza item del catalogo publico con su trazabilidad por id_detalle_menu.
const normalizeCatalogItem = (raw) => ({
  id_detalle_menu: Number(raw?.id_detalle_menu),
  tipo_item: raw?.tipo_item || 'PRODUCTO',
  id_item_base: Number(raw?.id_item_base ?? 0) || null,
  id_producto: raw?.id_producto ? Number(raw.id_producto) : null,
  id_receta: raw?.id_receta ? Number(raw.id_receta) : null,
  id_combo: raw?.id_combo ? Number(raw.id_combo) : null,
  nombre: raw?.nombre || 'Item sin nombre',
  descripcion: raw?.descripcion || '',
  categoria: {
    id_tipo_departamento: raw?.categoria?.id_tipo_departamento ?? null,
    nombre: raw?.categoria?.nombre || 'Sin categoria'
  },
  imagen_url: raw?.imagen_url || '',
  precio: {
    base: raw?.precio?.base ?? null,
    public: raw?.precio?.public ?? null,
    final: raw?.precio?.final ?? null
  },
  disponibilidad: {
    available: Boolean(raw?.disponibilidad?.available),
    reasonCode: raw?.disponibilidad?.reasonCode || null,
    message: raw?.disponibilidad?.message || ''
  },
  visible: Boolean(raw?.visible ?? true),
  orden: Number(raw?.orden || 0)
});

// Servicio API real del modulo public-menu (sin mocks).
export const publicMenuBootstrapService = {
  // Lista sucursales publicas.
  async getBranches() {
    const response = await apiFetch('/public-menu/sucursales', 'GET', null, { noCache: true });
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows
      .map(normalizeBranchWithUi)
      .filter((branch) => Number.isInteger(branch.id) && branch.id > 0);
  },

  // Obtiene menu vigente de la sucursal seleccionada.
  async getBranchActiveMenu(idSucursal) {
    const response = await apiFetch(
      `/public-menu/sucursales/${idSucursal}/menu-vigente`,
      'GET',
      null,
      { noCache: true }
    );

    return response?.data ? normalizeMenu(response.data) : null;
  },

  // Obtiene catalogo real publicado para sucursal/tipo de pedido.
  async getCatalog({ idSucursal, orderType }) {
    const endpoint = withQueryParams('/public-menu/catalogo', {
      id_sucursal: idSucursal,
      tipo_pedido: orderType
    });

    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    const payload = response?.data || {};
    const items = Array.isArray(payload?.items) ? payload.items.map(normalizeCatalogItem) : [];

    return {
      menu: payload?.menu ? normalizeMenu(payload.menu) : null,
      stats: payload?.stats || {
        total: items.length,
        disponibles: items.filter((item) => item.disponibilidad.available).length,
        agotados: items.filter((item) => !item.disponibilidad.available).length
      },
      items
    };
  },

  // Obtiene detalle real de un item puntual para HU-133.
  async getCatalogItemDetail({ idSucursal, idDetalleMenu }) {
    const endpoint = withQueryParams(`/public-menu/items/${idDetalleMenu}`, {
      id_sucursal: idSucursal
    });

    const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
    const payload = response?.data || {};

    return {
      menu: payload?.menu ? normalizeMenu(payload.menu) : null,
      item: payload?.item ? normalizeCatalogItem(payload.item) : null
    };
  },

  // Registra pedido publico para que aparezca en Ventas > Pedidos.
  async createOrder(payload) {
    const response = await apiFetch('/public-menu/pedidos', 'POST', payload);
    return response?.data || null;
  }
};
