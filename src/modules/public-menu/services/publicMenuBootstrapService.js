import { apiFetch } from '../../../services/api';
import { getBranchUiMeta } from '../config/publicBranchesUi';
import { API_URL } from '../../../utils/constants';

const CATALOG_CACHE_TTL_MS = 20_000;
const catalogCache = new Map();
const PUBLIC_ORDER_TYPES = new Set(['dine-in', 'pickup', 'delivery']);
const SUPABASE_PUBLIC_BUCKET = 'jonnys-assets';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const LEGACY_GOOGLE_IMAGE_RE = /(?:drive\.google\.com|drive\.usercontent\.google\.com|googleusercontent\.com)/i;

const toPositiveIntOrNull = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const assertValidBranchId = (idSucursal) => {
  if (!toPositiveIntOrNull(idSucursal)) {
    throw new Error('La sucursal seleccionada no es valida. Vuelve a seleccionar una sucursal.');
  }
};

const assertValidOrderType = (orderType) => {
  const normalized = String(orderType || '').trim().toLowerCase();
  if (!normalized || !PUBLIC_ORDER_TYPES.has(normalized)) {
    throw new Error('El tipo de pedido no es valido. Selecciona nuevamente como deseas ordenar.');
  }
  return normalized;
};

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

const buildCatalogCacheKey = ({ idSucursal, orderType }) =>
  `${Number(idSucursal) || 0}::${String(orderType || 'na').trim().toLowerCase()}`;

const readValidCatalogCache = (key) => {
  const entry = catalogCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt > Date.now() && entry.data) return entry.data;
  return null;
};

const resolvePublicImageUrl = (rawUrl) => {
  const normalized = String(rawUrl || '').trim();
  if (!normalized) return '';
  if (LEGACY_GOOGLE_IMAGE_RE.test(normalized)) return '';

  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }

  if (normalized.startsWith(`${SUPABASE_PUBLIC_BUCKET}/`) && SUPABASE_URL) {
    return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${normalized}`;
  }

  const base = String(API_URL || '').replace(/\/+$/, '');
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${base}${path}`;
};

const normalizeTimeValue = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const formatTimeLabel = (value) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return '';
  const [hourText, minuteText] = normalized.split(':');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return normalized;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteText} ${suffix}`;
};

const buildScheduleLabel = ({ opensAt, closesAt, fallback }) => {
  const openLabel = formatTimeLabel(opensAt);
  const closeLabel = formatTimeLabel(closesAt);
  if (openLabel && closeLabel) return `${openLabel} - ${closeLabel}`;
  return fallback || 'Horario no configurado';
};

const toBranchBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  return fallback;
};

// Normaliza estructura de sucursal para componentes de UI.
const normalizeBranch = (raw) => {
  const opensAt = normalizeTimeValue(raw?.opensAt ?? raw?.hora_inicio);
  const closesAt = normalizeTimeValue(raw?.closesAt ?? raw?.hora_final);
  const isActive = toBranchBoolean(raw?.isActive ?? raw?.estado, true);

  const hasSchedule = Boolean(opensAt && closesAt);

  const hasExplicitOpenState =
    raw?.isOpen !== undefined ||
    raw?.is_open !== undefined ||
    raw?.abierto_por_horario !== undefined ||
    raw?.acceptsOrders !== undefined ||
    raw?.accepts_orders !== undefined;

  const explicitOpenValue =
    raw?.isOpen ??
    raw?.is_open ??
    raw?.abierto_por_horario ??
    raw?.acceptsOrders ??
    raw?.accepts_orders;

  const isOpen = isActive && (
    hasExplicitOpenState ? toBranchBoolean(explicitOpenValue, true) : true
  );

  const schedule = buildScheduleLabel({
    opensAt,
    closesAt,
    fallback: raw?.horario || raw?.schedule || ''
  });

  const acceptsOrders = isActive && toBranchBoolean(
    raw?.acceptsOrders ?? raw?.accepts_orders,
    isOpen
  );

  return {
    id: Number(raw?.id_sucursal ?? raw?.id),
    name: raw?.nombre_sucursal || raw?.name || 'Sucursal',
    address: raw?.direccion || raw?.address || 'Direccion no disponible',
    whatsapp:
      String(
        raw?.whatsapp ??
        raw?.telefono_whatsapp ??
        raw?.telefono ??
        raw?.phone ??
        ''
      ).trim(),
    transferAccount:
      String(
        raw?.cuenta_transferencia ??
        raw?.cuenta_bancaria ??
        raw?.numero_cuenta ??
        ''
      ).trim(),
    schedule,
    etaMinutes: raw?.tiempo_entrega || raw?.etaMinutes || '20-30 min',
    imageUrl: resolvePublicImageUrl(raw?.url_imagen || raw?.imageUrl || ''),
    isActive,
    isOpen,
    acceptsOrders,
    opensAt,
    closesAt,
    statusLabel:
      raw?.statusLabel ||
      raw?.status_label ||
      (isOpen ? (hasSchedule ? 'Abierto ahora' : 'Disponible') : 'Cerrado'),
    closedReason:
      raw?.closedReason ||
      raw?.closed_reason ||
      (isOpen ? '' : `Disponible de ${schedule}`)
  };
};

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
    // Regla de negocio: el nombre de sucursal visible al cliente debe venir de BD.
    // Solo usamos `ui` para fallback de slug/foto cuando faltan en la data real.
    slug: String(raw?.slug || ui.slug || '').trim(),
    // Priorizamos imagen de BD/API; el asset local queda como respaldo visual.
    imageUrl: base.imageUrl || ui.foto || '',
    // Preferimos telefono real de API y dejamos config UI como fallback por sucursal.
    whatsapp: base.whatsapp || String(ui?.whatsapp || '').trim(),
    // Preferimos cuenta real de API y dejamos config UI como fallback por sucursal.
    transferAccount: base.transferAccount || String(ui?.cuenta_transferencia || '').trim(),
    displayName: base.name
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
    nombre: raw?.categoria?.nombre || 'Sin categoria',
    nombre_producto: raw?.categoria?.nombre_producto || ''
  },
  imagen_url: resolvePublicImageUrl(raw?.imagen_url || ''),
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
  extras_opciones: Array.isArray(raw?.extras_opciones)
    ? raw.extras_opciones.map((extra) => ({
      id_extra: String(extra?.id_extra || '').trim(),
      codigo: String(extra?.codigo || '').trim(),
      nombre: String(extra?.nombre || 'Extra').trim(),
      precio_adicional: Number(extra?.precio_adicional || 0)
    }))
    : [],
  salsas_componentes: Array.isArray(raw?.salsas_componentes)
    ? raw.salsas_componentes.map((component) => ({
      id_receta: Number(component?.id_receta || 0) || null,
      nombre_receta: String(component?.nombre_receta || ''),
      multiplicador: Math.max(1, Number(component?.multiplicador || 1)),
      unidades_base: Math.max(1, Number(component?.unidades_base || 1)),
      salsas_permitidas: Array.isArray(component?.salsas_permitidas)
        ? component.salsas_permitidas.map((sauce) => ({
          id_salsa: Number(sauce?.id_salsa || 0) || null,
          nombre: String(sauce?.nombre || 'Salsa'),
          nivel_picante: Number(sauce?.nivel_picante || 0),
          orden: Number(sauce?.orden || 0),
          disponible: Boolean(sauce?.disponible ?? true)
        }))
        : [],
      reglas: Array.isArray(component?.reglas)
        ? component.reglas.map((rule) => ({
          id_regla: Number(rule?.id_regla || 0) || null,
          min_unidades: Number(rule?.min_unidades || 0),
          max_unidades:
            rule?.max_unidades === null || rule?.max_unidades === undefined
              ? null
              : Number(rule.max_unidades),
          salsas_requeridas: Number(rule?.salsas_requeridas || 0)
        }))
        : []
    }))
    : [],
  salsas_permitidas: Array.isArray(raw?.salsas_permitidas)
    ? raw.salsas_permitidas.map((sauce) => ({
      id_salsa: Number(sauce?.id_salsa || 0) || null,
      nombre: String(sauce?.nombre || 'Salsa'),
      nivel_picante: Number(sauce?.nivel_picante || 0),
      orden: Number(sauce?.orden || 0),
      disponible: Boolean(sauce?.disponible ?? true)
    }))
    : [],
  salsas_requiere_seleccion: Boolean(raw?.salsas_requiere_seleccion),
  salsas_requeridas_base: Number(raw?.salsas_requeridas_base || 0),
  visible: Boolean(raw?.visible ?? true),
  orden: Number(raw?.orden || 0)
});

// Servicio API real del modulo public-menu (sin mocks).
export const publicMenuBootstrapService = {
  // Lista sucursales publicas.
  async getBranches() {
    const response = await apiFetch('/api/public-menu/sucursales', 'GET', null, { noCache: true });
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows
      .map(normalizeBranchWithUi)
      .filter((branch) => Number.isInteger(branch.id) && branch.id > 0);
  },

  // Obtiene menu vigente de la sucursal seleccionada.
  async getBranchActiveMenu(idSucursal) {
    assertValidBranchId(idSucursal);

    const response = await apiFetch(
      `/api/public-menu/sucursales/${idSucursal}/menu-vigente`,
      'GET',
      null,
      { noCache: true }
    );

    return response?.data ? normalizeMenu(response.data) : null;
  },

  // Obtiene catalogo real publicado para sucursal/tipo de pedido.
  async getCatalog({ idSucursal, orderType }) {
    assertValidBranchId(idSucursal);
    const normalizedOrderType = assertValidOrderType(orderType);

    const cacheKey = buildCatalogCacheKey({ idSucursal, orderType: normalizedOrderType });
    const cached = readValidCatalogCache(cacheKey);
    if (cached) return cached;

    const inFlight = catalogCache.get(cacheKey)?.inFlight;
    if (inFlight) return inFlight;

    const endpoint = withQueryParams('/api/public-menu/catalogo', {
      id_sucursal: idSucursal,
      tipo_pedido: normalizedOrderType
    });

    const requestPromise = (async () => {
      const response = await apiFetch(endpoint, 'GET', null, { noCache: true });
      const payload = response?.data || {};
      const items = Array.isArray(payload?.items) ? payload.items.map(normalizeCatalogItem) : [];

      const normalizedPayload = {
        menu: payload?.menu ? normalizeMenu(payload.menu) : null,
        stats: payload?.stats || {
          total: items.length,
          disponibles: items.filter((item) => item.disponibilidad.available).length,
          agotados: items.filter((item) => !item.disponibilidad.available).length
        },
        items
      };

      catalogCache.set(cacheKey, {
        data: normalizedPayload,
        expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
        inFlight: null
      });

      return normalizedPayload;
    })();

    catalogCache.set(cacheKey, {
      data: null,
      expiresAt: 0,
      inFlight: requestPromise
    });

    try {
      return await requestPromise;
    } finally {
      const current = catalogCache.get(cacheKey);
      if (current?.inFlight) {
        catalogCache.set(cacheKey, {
          data: current.data,
          expiresAt: current.expiresAt,
          inFlight: null
        });
      }
    }
  },

  // Obtiene detalle real de un item puntual para HU-133.
  async getCatalogItemDetail({ idSucursal, idDetalleMenu }) {
    assertValidBranchId(idSucursal);
    if (!toPositiveIntOrNull(idDetalleMenu)) {
      throw new Error('El item solicitado no es valido. Recarga el menu e intenta nuevamente.');
    }

    const endpoint = withQueryParams(`/api/public-menu/items/${idDetalleMenu}`, {
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
    const response = await apiFetch('/api/public-menu/pedidos', 'POST', payload);
    return response?.data || null;
  }
};