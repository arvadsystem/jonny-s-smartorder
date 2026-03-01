import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../services/inventarioService';
import { useAuth } from '../../../hooks/useAuth';
import { toUpperSafe } from '../../../utils/toUpperSafe';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  resolveInventarioImageUrl
} from '../../../utils/inventarioImagenes';

const getStockMeta = (cantidad, stockMinimo = 0) => {
  const qty = Number.parseInt(String(cantidad ?? '0'), 10);
  const minQty = Math.max(0, Number.parseInt(String(stockMinimo ?? '0'), 10) || 0);
  if (Number.isNaN(qty) || qty <= 0) return { qty: 0, label: 'Sin stock', className: 'is-empty' };
  if (minQty > 0 && qty <= minQty) return { qty, label: 'Stock bajo', className: 'is-low' };
  return { qty, label: 'Con stock', className: 'is-ok' };
};

const getStockPriorityRank = (cantidad, stockMinimo = 0) => {
  const stockMeta = getStockMeta(cantidad, stockMinimo);
  if (stockMeta.qty <= 0) return 0;
  if (stockMeta.className === 'is-low') return 1;
  return 2;
};

// NEW: configuracion responsive del carrusel principal de Productos.
// WHY: el usuario pidio el mismo patron paginado de Insumos pero con 4x2 en desktop.
// IMPACT: solo reorganiza la presentacion del carrusel; filtros, cards y handlers se mantienen.
const getProductosCarouselConfig = (viewportWidth) => {
  if (viewportWidth >= 1280) return { perPage: 8, columns: 4 };
  if (viewportWidth >= 768) return { perPage: 4, columns: 2 };
  return { perPage: 2, columns: 1 };
};

// NEW: helper local para agrupar productos visibles en paginas del carrusel.
// WHY: reemplazar el scroll horizontal libre por paginas fijas del mismo estilo de Insumos.
// IMPACT: mantiene el dataset actual intacto y solo lo divide para render.
const chunkProductosCarouselPages = (items, pageSize) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  const pages = [];

  for (let index = 0; index < safeItems.length; index += safePageSize) {
    pages.push(safeItems.slice(index, index + safePageSize));
  }

  return pages;
};

// NEW: copy e iconografia unificados para todas las confirmaciones de inactivacion en Inventario.
// WHY: el usuario pidio el mismo mensaje y el mismo icono en todos los modulos al confirmar la inactivacion.
// IMPACT: solo estandariza el modal de confirmacion; no cambia handlers, endpoints ni estados locales.
const INACTIVATE_CONFIRM_COPY = Object.freeze({
  title: 'Confirmar inactivación',
  subtitle: 'Este registro quedará marcado como inactivo',
  question: '¿Deseas inactivar este registro?',
  fallbackName: 'Registro seleccionado',
  iconClass: 'bi bi-slash-circle'
});

const buildCreateImageState = () => ({
  file: null,
  previewUrl: '',
  loading: false,
  error: ''
});

const buildDrawerImageActionState = () => ({
  loading: false,
  error: ''
});

// NEW: limite superior de INT32 usado por la BD/SPs para IDs de productos.
// WHY: prevenir que un timestamp en ms (Date.now()) se use como `id_producto` en mutaciones.
// IMPACT: validacion frontend local; no cambia endpoints ni payloads validos.
const PRODUCTO_DB_INT32_MAX = 2147483647;
// NEW: se oculta `tipo_departamento` en el modulo de Productos.
// WHY: el usuario indico que Departamentos ya no se necesitara en Productos.
// IMPACT: solo frontend de Productos; backend y otros modulos siguen intactos.
const SHOW_PRODUCTO_DEPARTAMENTOS = false;
const PRODUCTO_FILTER_SORT_LABELS = Object.freeze({
  recientes: 'Mas recientes',
  nombre_asc: 'Nombre A-Z',
  nombre_desc: 'Nombre Z-A',
  precio_desc: 'Precio mayor',
  precio_asc: 'Precio menor',
  stock_desc: 'Stock mayor',
  stock_asc: 'Stock menor'
});

const ProductosTab = ({ categorias = [], openToast }) => {
  // NUEVO: toma contexto de sesion existente para segmentar historial KPI por usuario/empresa/sucursal.
  const { user } = useAuth();
  // ==============================
  // TOAST (SI NO VIENE DEL PADRE)
  // ==============================
  // AJUSTE: memoizado para evitar recreacion y mantener estables los hooks dependientes.
  const safeToast = useCallback((title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  }, [openToast]);

  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [error, setError] = useState('');

  // ==============================
  // DEPENDENCIAS (DROPDOWNS FK)
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);

  const [tipoDepartamentos, setTipoDepartamentos] = useState([]);
  const [loadingTipoDepto, setLoadingTipoDepto] = useState(false);

  // ==============================
  // FILTROS
  // ==============================
  const [search, setSearch] = useState('');
  const [stockFiltro, setStockFiltro] = useState('todos'); // todos | con_stock | sin_stock
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // todos | activo | inactivo
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos'); // todos | id_categoria
  const [almacenFiltro, setAlmacenFiltro] = useState('todos'); // todos | id_almacen
  const [deptoFiltro, setDeptoFiltro] = useState('todos'); // todos | id_tipo_departamento
  const [sortBy, setSortBy] = useState('recientes');
  // NEW: toggle admin para incluir productos inactivos en el listado del tab.
  // WHY: backend devuelve activos por defecto despues del cambio a soft delete.
  // IMPACT: solo afecta la carga del listado de Productos; filtros locales se mantienen.
  const [showInactiveProductos, setShowInactiveProductos] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  // NUEVO: feature flag para mantener fallback del formulario legacy sin eliminar código funcional.
  const USE_PREMIUM_NEW_FORM = true;
  // NUEVO: historial local para micro-gráficos de KPI sin requerir backend adicional.
  // NUEVO: key legacy para compatibilidad con historico guardado antes del contexto dinamico.
  const KPI_HISTORY_LEGACY_KEY = 'inv_productos_kpi_history_v1';
  // NUEVO: historial local segmentado por contexto para evitar mezcla entre cuentas/sucursales.
  const KPI_HISTORY_KEY = useMemo(() => {
    const normalizePart = (value) => {
      if (value === null || value === undefined) return '';
      const s = String(value).trim().toLowerCase();
      if (!s) return '';
      return s.replace(/[^a-z0-9_-]/g, '');
    };

    // AJUSTE: se usan datos de sesion existentes; si no hay contexto suficiente, cae a global.
    const userEntries = user && typeof user === 'object' ? Object.entries(user) : [];
    const usuarioCtx = normalizePart(user?.nombre_usuario);
    const empresaCtx = normalizePart(
      userEntries.find(([key, value]) =>
        String(key).toLowerCase().includes('empresa') && value !== null && value !== undefined && String(value).trim() !== ''
      )?.[1]
    );
    const sucursalCtx = normalizePart(
      user?.id_sucursal ||
      userEntries.find(([key, value]) =>
        String(key).toLowerCase().includes('sucursal') && value !== null && value !== undefined && String(value).trim() !== ''
      )?.[1]
    );

    if (!usuarioCtx && !empresaCtx && !sucursalCtx) return 'inv_productos_kpi_history_global';
    return `inv_productos_kpi_history_${empresaCtx || 'na'}_${sucursalCtx || 'na'}_${usuarioCtx || 'na'}`;
  }, [user]);
  // AJUSTE: limita snapshots para controlar tamano de almacenamiento local.
  const KPI_HISTORY_LIMIT = 20;
  const currentPage = 1;
  const pageSize = 8;
  const renderLegacyLayouts = false;
  // NEW: flag runtime local para conservar el código legacy de shells sin renderizarlo por defecto.
  // WHY: evitar errores de lint por `false && (...)` mientras se mantiene un fallback visual para depuración.
  // IMPACT: desactivado por defecto; no afecta la lógica funcional de Productos.
  const enableLegacyProductosModalShellFallback =
    typeof window !== 'undefined' && window.__INV_PRODUCTS_LEGACY_MODAL_SHELL__ === true;

  // ==============================
  // MODAL CREAR (RESPONSIVE)
  // ==============================
  const [showCreateProductoSheet, setShowCreateProductoSheet] = useState(false);

  // ==============================
  // FORM CREAR
  // ==============================
  const [form, setForm] = useState({
    nombre_producto: '',
    precio: '',
    cantidad: '',
    // NUEVO: se agrega stock_minimo al formulario de alta para alinear payload con backend.
    stock_minimo: '0',
    descripcion_producto: '',
    fecha_ingreso_producto: '',
    fecha_caducidad: '',
    id_categoria_producto: '',
    id_almacen: '',
    id_tipo_departamento: '' // OPCIONAL
  });

  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [createImage, setCreateImage] = useState(buildCreateImageState);

  // ==============================
  // EDITAR
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // ==============================
  // MODAL CONFIRMAR ELIMINAR
  // ==============================
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });
  const [deleting, setDeleting] = useState(false);
  // NEW: error local del modal de confirmación de eliminar para mantenerlo abierto en fallos.
  // WHY: mostrar feedback en el propio modal sin cerrarlo cuando la API responde con error.
  // IMPACT: solo UX del confirm modal; no cambia la lógica de eliminación.
  const [confirmDeleteError, setConfirmDeleteError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState(null);
  const [localEstadoMap, setLocalEstadoMap] = useState({});
  // NEW: marcas temporales para animar salida de cards eliminadas localmente.
  // WHY: suavizar la desaparición del item sin refetch global de la lista.
  // IMPACT: solo controla una clase CSS de transición en cards de Productos.
  const [removingProductoIds, setRemovingProductoIds] = useState({});
  const [imageErrorMap, setImageErrorMap] = useState({});
  const [drawerMessage, setDrawerMessage] = useState('');
  const [togglingEstado, setTogglingEstado] = useState(false);
  const [drawerImageAction, setDrawerImageAction] = useState(buildDrawerImageActionState);
  // NUEVO: refs para desplazar viewport a paneles cuando el usuario abre Nuevo/Filtros.
  const filtersSectionRef = useRef(null);
  const createSectionRef = useRef(null);
  const filtersBodyRef = useRef(null);
  const createBodyRef = useRef(null);
  const drawerBodyRef = useRef(null);
  const [carouselPageIndex, setCarouselPageIndex] = useState(0);
  const [carouselViewportWidth, setCarouselViewportWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  const [kpiHistory, setKpiHistory] = useState([]);
  // NEW: target de portal local para modales de Productos.
  // WHY: sacar Filtros/Nuevo del card para evitar recortes por `overflow: hidden`.
  // IMPACT: solo define el nodo de render del shell visual; no cambia datos ni handlers.
  const productsModalPortalTarget = typeof document !== 'undefined' ? document.body : null;
  // NEW: registro de timeouts para remoción visual suave de cards sin fugas en unmount.
  // WHY: permitir transición de salida al eliminar sin refrescar toda la lista.
  // IMPACT: solo afecta la UX de remoción local; no toca backend ni filtros.
  const removeCardTimeoutsRef = useRef(new Map());
  const drawerImageInputRef = useRef(null);
  // NEW: referencia explicita del input de imagen en create.
  // WHY: al quitar imagen se debe vaciar tambien el valor del `<input type="file">` para evitar estados colgados.
  // IMPACT: solo sincroniza UI local del formulario de alta; el flujo de upload no cambia.
  const createImageInputRef = useRef(null);
  // NEW: secuencia de IDs temporales negativos (int32-safe) para altas locales sin `id_producto` en respuesta.
  // WHY: reemplazar el fallback `Date.now()` que produce valores fuera de rango para INT en backend/BD.
  // IMPACT: solo IDs temporales en frontend; se sincronizan con IDs reales tras recarga silenciosa.
  const tempProductoIdSeqRef = useRef(-1);

  useEffect(() => {
    // NEW: escucha el ancho del viewport para recalcular paginas 4x2/2x2/1x2 sin remount del modulo.
    // WHY: mantener el carrusel de Productos alineado con el patron responsive de Insumos.
    // IMPACT: solo actualiza la agrupacion visual del carrusel.
    const onResize = () => setCarouselViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openConfirmDelete = (id, nombre) => {
    setConfirmDeleteError('');
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  const closeConfirmDelete = () => {
    setConfirmDeleteError('');
    setConfirmModal({ show: false, idToDelete: null, nombre: '' });
    setDeleting(false);
  };

  // NEW: cierre unificado del modal de Nuevo producto (desktop y flujo mobile legacy).
  // WHY: reutilizar un solo shell centrado sin tocar `onCrear`, validaciones ni payloads.
  // IMPACT: solo centraliza el cierre visual del modal de alta en Productos.
  const closeCreateProductoModal = useCallback(() => {
    setCreatePanelOpen(false);
    setShowCreateProductoSheet(false);
  }, []);

  // ==============================
  // HELPERS
  // ==============================
  const toDateInputValue = (value) => {
    if (!value) return '';
    const s = String(value);
    if (s.includes('T')) return s.split('T')[0];
    return s;
  };

  // NUEVO: normaliza estado para compatibilidad backend (boolean/string/number).
  const productoActivo = useCallback((estado) => {
    return estado === true || estado === 'true' || estado === 1 || estado === '1';
  }, []);

  // ==============================
  // SOLO ENTEROS EN INPUT (BLOQUEAR DECIMALES)
  // ==============================
  const blockNonIntegerKeys = (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  };

  const sanitizeInteger = (value) => String(value ?? '').replace(/[^\d]/g, '');

  // NEW: normalizador local para campos de texto elegibles del formulario de Productos.
  // WHY: aplicar mayúsculas de forma segura solo en nombre/descripcion sin afectar números, fechas o selects.
  // IMPACT: se reutiliza en create/edit; handlers, validaciones y submit permanecen iguales.
  const normalizeProductoTextInput = useCallback((field, value) => {
    if (field !== 'nombre_producto' && field !== 'descripcion_producto') return value;
    return toUpperSafe(value, field);
  }, []);

  // NEW: valida IDs de productos persistidos contra el rango INT32 usado por la BD.
  // WHY: cortar mutaciones con IDs temporales/corruptos antes de llegar a `pa_update` / `pa_delete`.
  // IMPACT: solo prevencion en frontend; IDs validos siguen enviandose igual.
  const parseProductoPersistedId = useCallback((rawId) => {
    const parsed = Number.parseInt(String(rawId ?? ''), 10);
    if (!Number.isSafeInteger(parsed)) return null;
    if (parsed <= 0) return null;
    if (parsed > PRODUCTO_DB_INT32_MAX) return null;
    return parsed;
  }, []);

  // NEW: genera IDs temporales negativos y seguros para int32 cuando el POST no devuelve ID.
  // WHY: evitar usar `Date.now()` como ID local y luego enviarlo accidentalmente en edit/delete.
  // IMPACT: frontend-only; no cambia contratos API ni estructura de datos persistida.
  const nextTempProductoId = useCallback(() => {
    const currentRaw = Number(tempProductoIdSeqRef.current ?? -1);
    const current = Number.isInteger(currentRaw) && currentRaw < 0 ? currentRaw : -1;
    const next = current - 1;
    tempProductoIdSeqRef.current = next < -PRODUCTO_DB_INT32_MAX ? -1 : next;
    return current;
  }, []);

  const formatMoney = (value) => {
    const n = Number.parseFloat(String(value ?? '0'));
    if (Number.isNaN(n)) return 'L. 0.00';
    return `L. ${n.toFixed(2)}`;
  };

  // NUEVO: extrae errores de campo del backend cuando vienen en e.data.errors.
  const mapApiFieldErrors = useCallback((apiData) => {
    const errors = apiData?.errors;
    if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {};

    return Object.entries(errors).reduce((acc, [field, rawValue]) => {
      if (typeof rawValue === 'string' && rawValue.trim()) {
        acc[field] = rawValue.trim();
      } else if (Array.isArray(rawValue) && rawValue.length > 0) {
        acc[field] = String(rawValue[0]);
      } else if (rawValue !== null && rawValue !== undefined) {
        acc[field] = String(rawValue);
      }
      return acc;
    }, {});
  }, []);

  // NEW: sanitiza mensajes crudos de BD/SQL para no exponerlos en la UI de Productos.
  // WHY: ocultar errores internos como `out of range for type integer` y mostrar feedback util al usuario.
  // IMPACT: los detalles se pueden seguir ver en consola en desarrollo; la UI recibe mensaje seguro.
  const toSafeProductoUiErrorMessage = useCallback((status, rawMessage, fallbackMessage) => {
    const candidate = String(rawMessage || fallbackMessage || 'Error inesperado').trim();
    const lower = candidate.toLowerCase();
    const leaksDbDetail =
      lower.includes('out of range') ||
      lower.includes('for type integer') ||
      lower.includes('numeric value out of range') ||
      lower.includes('sqlstate') ||
      lower.includes('postgres');

    if (leaksDbDetail || status >= 500) {
      return 'No se pudo completar la acción. Verifica los datos e intenta de nuevo.';
    }

    return candidate;
  }, []);

  // NUEVO: centraliza lectura de mensaje y estado para toasts consistentes.
  const handleApiStatusError = useCallback((apiError, fallbackMessage, setFieldErrors) => {
    const status = Number(apiError?.status || 0);
    const backendData = apiError?.data;
    const backendMessage = backendData && typeof backendData === 'object'
      ? backendData.message || backendData.mensaje
      : '';
    // AJUSTE: fallback especifico para auth/permisos manteniendo el flujo actual sin redirecciones.
    const fallbackByStatus =
      status === 401
        ? 'Vuelve a iniciar sesi\u00F3n para continuar.'
        : status === 403
        ? 'No tienes autorizaci\u00F3n para realizar esta acci\u00F3n.'
        : fallbackMessage;
    const rawMessage = String(backendMessage || apiError?.message || fallbackByStatus || 'Error inesperado');
    const message = toSafeProductoUiErrorMessage(status, rawMessage, fallbackByStatus);

    // NEW: conserva el detalle interno de error solo en desarrollo cuando se oculta en UI.
    // WHY: facilitar diagnóstico sin exponer mensajes de BD al usuario final.
    // IMPACT: solo logs en consola DEV; producción permanece sin cambios visuales.
    if (import.meta.env.DEV && rawMessage !== message) {
      console.error('PRODUCTOS API ERROR (detalle interno oculto en UI):', {
        status,
        rawMessage,
        apiError
      });
    }

    if (typeof setFieldErrors === 'function') {
      const fieldErrors = mapApiFieldErrors(backendData);
      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
    }

    // VALIDACION: se respeta feedback por código HTTP acordado con backend.
    // AJUSTE: se agrega manejo explicito para 401/403 con toasts claros y consistentes.
    if (status === 401) safeToast('SESI\u00D3N EXPIRADA', message, 'warning');
    else if (status === 403) safeToast('SIN PERMISOS', message, 'warning');
    else if (status === 400) safeToast('VALIDACION', message, 'warning');
    else if (status === 404) safeToast('NO ENCONTRADO', message, 'warning');
    else if (status === 409) safeToast('CONFLICTO', message, 'warning');
    else if (status >= 500) safeToast('ERROR', message, 'danger');
    else safeToast('ERROR', message, 'danger');

    return message;
  }, [mapApiFieldErrors, safeToast, toSafeProductoUiErrorMessage]);

  // NUEVO: genera puntos SVG normalizados para sparkline de KPI.
  const buildSparklinePoints = useCallback((series, width = 120, height = 44, padding = 4) => {
    if (!Array.isArray(series) || series.length < 2) return '';

    const values = series.map((value) => Number(value ?? 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const safeWidth = Math.max(width - padding * 2, 1);
    const safeHeight = Math.max(height - padding * 2, 1);

    return values
      .map((value, index) => {
        const x = padding + (safeWidth * index) / (values.length - 1);
        const y = padding + safeHeight - ((value - min) / range) * safeHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, []);

  useEffect(() => {
    return () => {
      if (createImage.previewUrl && createImage.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createImage.previewUrl);
      }
    };
  }, [createImage.previewUrl]);

  useEffect(() => {
    setDrawerImageAction(buildDrawerImageActionState());
  }, [drawerOpen, selectedProductoId]);

  useEffect(() => {
    // NEW: limpia timeouts pendientes de remoción de cards al desmontar el tab.
    // WHY: evitar callbacks tardíos sobre estado desmontado al cerrar/cambiar de vista.
    // IMPACT: solo housekeeping de UX local; sin impacto en datos ni API.
    const timeouts = removeCardTimeoutsRef.current;
    return () => {
      if (!timeouts || typeof timeouts.forEach !== 'function') return;
      timeouts.forEach((timeoutId) => {
        if (typeof window !== 'undefined') window.clearTimeout(timeoutId);
      });
      timeouts.clear();
    };
  }, []);

  // ==============================
  // MAPS PARA LABELS (NO MOSTRAR IDS)
  // ==============================
  const categoriasMap = useMemo(() => {
    const m = new Map();
    for (const c of categorias) {
      m.set(String(c?.id_categoria_producto), c);
    }
    return m;
  }, [categorias]);

  // NEW: opciones de categorias activas para selects/listados de asignacion en Productos.
  // WHY: evitar mostrar categorias inactivas al crear/editar/filtrar por categoria en otros submodulos.
  // IMPACT: no cambia endpoints; el mapa de labels sigue usando todas las categorias para leer historicos.
  const categoriasActivas = useMemo(() => {
    const isActive = (categoria) => {
      const raw = categoria?.estado;
      if (raw === undefined || raw === null || raw === '') return true;
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    };
    return (Array.isArray(categorias) ? categorias : []).filter(isActive);
  }, [categorias]);

  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) {
      m.set(String(a?.id_almacen), a);
    }
    return m;
  }, [almacenes]);

  const tipoDeptoMap = useMemo(() => {
    const m = new Map();
    for (const d of tipoDepartamentos) {
      m.set(String(d?.id_tipo_departamento), d);
    }
    return m;
  }, [tipoDepartamentos]);

  const getCategoriaLabel = useCallback((id) => {
    const c = categoriasMap.get(String(id));
    if (!c) return String(id || '-');
    return `${c.nombre_categoria}`;
  }, [categoriasMap]);

  const getAlmacenLabel = useCallback((id) => {
    const a = almacenesMap.get(String(id));
    if (!a) return String(id || '-');
    return `${a.nombre} (Sucursal ${a.id_sucursal})`;
  }, [almacenesMap]);

  const getDeptoLabel = useCallback((id) => {
    if (!id && id !== 0) return '-';
    const d = tipoDeptoMap.get(String(id));
    if (!d) return String(id || '-');
    return `${d.nombre_departamento}${d.estado === false ? ' (Inactivo)' : ''}`;
  }, [tipoDeptoMap]);

  const selectedProducto = useMemo(() => {
    if (!selectedProductoId) return null;
    return productos.find((p) => Number(p?.id_producto) === Number(selectedProductoId)) || null;
  }, [productos, selectedProductoId]);

  // NEW: normalización local para detectar productos duplicados sin depender del backend.
  // WHY: prevenir registros repetidos en create/edit usando los campos reales disponibles en el formulario.
  // IMPACT: validación UX en frontend; backend y contratos permanecen intactos.
  const normalizeProductoDuplicateText = useCallback(
    (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
    []
  );

  const normalizeProductoDuplicateId = useCallback((value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return String(parsed);
    return raw.toLowerCase();
  }, []);

  const buildProductoDuplicateKey = useCallback((data) => {
    const nombre = normalizeProductoDuplicateText(data?.nombre_producto);
    const categoria = normalizeProductoDuplicateId(data?.id_categoria_producto);
    const almacen = normalizeProductoDuplicateId(data?.id_almacen);
    const depto = SHOW_PRODUCTO_DEPARTAMENTOS ? normalizeProductoDuplicateId(data?.id_tipo_departamento) : '';

    // NEW: no se usa SKU/codigo porque el formulario actual de Productos no expone ese campo.
    // WHY: aplicar criterio real del modelo disponible en UI (nombre + categoria + almacen).
    // IMPACT: evita falsos positivos por campos inexistentes; no inventa atributos nuevos.
    if (!nombre || !categoria || !almacen) return '';
    return `${nombre}__cat:${categoria}__alm:${almacen}__dep:${depto || '-'}`;
  }, [normalizeProductoDuplicateId, normalizeProductoDuplicateText]);

  const findDuplicateProducto = useCallback((data, { excludeId = null } = {}) => {
    const candidateKey = buildProductoDuplicateKey(data);
    if (!candidateKey) return null;

    return productos.find((item) => {
      const sameRecord = excludeId !== null && Number(item?.id_producto) === Number(excludeId);
      if (sameRecord) return false;
      return buildProductoDuplicateKey(item) === candidateKey;
    }) || null;
  }, [buildProductoDuplicateKey, productos]);

  // NEW: helpers locales para crear/editar/eliminar sin recargar visiblemente toda la grilla/carrusel.
  // WHY: mantener cards estables y reflejar cambios inmediatos tras éxito de la API.
  // IMPACT: solo sincronización de estado `productos`; no altera llamadas al backend.
  const patchProductoLocalById = useCallback((id, patch) => {
    if (!id || !patch || typeof patch !== 'object') return;
    setProductos((prev) =>
      prev.map((item) => (
        Number(item?.id_producto) === Number(id)
          ? { ...item, ...patch }
          : item
      ))
    );
  }, []);

  const upsertProductoLocal = useCallback((producto) => {
    if (!producto || typeof producto !== 'object') return;
    const productId = Number(producto?.id_producto);
    setProductos((prev) => {
      const idx = prev.findIndex((item) => Number(item?.id_producto) === productId);
      if (idx === -1) return [producto, ...prev];
      const next = [...prev];
      next[idx] = { ...prev[idx], ...producto };
      return next;
    });
  }, []);

  // NEW: sincronizacion silenciosa de productos sin vaciar lista ni activar loader global.
  // WHY: obtener IDs reales despues de crear cuando el backend responde solo con mensaje (sin `id_producto`).
  // IMPACT: refresca estado local de `productos` sin cambiar contratos API ni UX de loaders.
  const syncProductosSilently = useCallback(async () => {
    try {
      // NEW: sincronizacion silenciosa siempre contra dataset global (activos + inactivos).
      // WHY: mantener KPIs y "Total" estables aunque el toggle solo cambie el listado visible.
      // IMPACT: `syncProductosSilently` sigue usando el mismo endpoint; no cambia contratos.
      const data = await inventarioService.getProductos({ incluirInactivos: true });
      if (!Array.isArray(data)) return false;
      setProductos(data);
      return true;
    } catch (syncError) {
      // NEW: logging solo en DEV para diagnosticar fallos de sincronizacion sin ensuciar la UI.
      // WHY: el usuario ya recibe feedback del create; la sincronizacion posterior debe ser silenciosa.
      // IMPACT: no altera flujos; solo agrega diagnostico en desarrollo.
      if (import.meta.env.DEV) {
        console.error('PRODUCTOS syncProductosSilently error:', syncError);
      }
      return false;
    }
  }, []);

  const removeProductoLocalById = useCallback((id, { animate = false } = {}) => {
    if (!id) return;
    const numericId = Number(id);
    const commitRemove = () => {
      setProductos((prev) => prev.filter((item) => Number(item?.id_producto) !== numericId));
      setRemovingProductoIds((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, numericId)) return prev;
        const next = { ...prev };
        delete next[numericId];
        return next;
      });
    };

    if (!animate || typeof window === 'undefined') {
      commitRemove();
      return;
    }

    setRemovingProductoIds((prev) => ({ ...prev, [numericId]: true }));

    const previousTimeout = removeCardTimeoutsRef.current.get(numericId);
    if (previousTimeout) window.clearTimeout(previousTimeout);

    const timeoutId = window.setTimeout(() => {
      removeCardTimeoutsRef.current.delete(numericId);
      commitRemove();
    }, 180);

    removeCardTimeoutsRef.current.set(numericId, timeoutId);
  }, []);

  const buildLocalProductoFromCreateResponse = useCallback((cleaned, createResponse) => {
    const directResponse = createResponse && typeof createResponse === 'object' && !Array.isArray(createResponse)
      ? createResponse
      : null;
    const nestedProducto = directResponse?.producto && typeof directResponse.producto === 'object'
      ? directResponse.producto
      : null;
    const nestedDataProducto = directResponse?.data?.producto && typeof directResponse.data.producto === 'object'
      ? directResponse.data.producto
      : null;
    const nestedData = directResponse?.data && typeof directResponse.data === 'object' && !Array.isArray(directResponse.data)
      ? directResponse.data
      : null;

    const apiProducto =
      [nestedProducto, nestedDataProducto, nestedData, directResponse]
        .find((candidate) => candidate && (candidate.id_producto || candidate.nombre_producto)) || null;

    const rawId =
      apiProducto?.id_producto
      ?? directResponse?.id_producto
      ?? directResponse?.insertId
      ?? directResponse?.id;
    const persistedId = parseProductoPersistedId(rawId);
    const safeId = persistedId ?? nextTempProductoId();

    const localProductoBase = {
      id_producto: safeId,
      nombre_producto: cleaned.nombre_producto,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad,
      stock_minimo: cleaned.stock_minimo,
      descripcion_producto: cleaned.descripcion_producto || '',
      fecha_ingreso_producto: cleaned.fecha_ingreso_producto || '',
      fecha_caducidad: cleaned.fecha_caducidad || '',
      id_categoria_producto: cleaned.id_categoria_producto,
      id_almacen: cleaned.id_almacen,
      id_tipo_departamento: SHOW_PRODUCTO_DEPARTAMENTOS ? (cleaned.id_tipo_departamento ?? null) : null,
      estado: true,
      // NEW: flag local para identificar cards creadas sin ID persistido y forzar sincronizacion silenciosa.
      // WHY: evitar que un ID temporal llegue a edit/delete mientras el backend no retorna `id_producto`.
      // IMPACT: propiedad solo frontend; desaparece al sincronizar desde GET /productos.
      __local_temp_id: persistedId === null
    };

    return apiProducto
      ? {
          ...localProductoBase,
          ...apiProducto,
          id_producto: parseProductoPersistedId(apiProducto?.id_producto ?? safeId) ?? safeId,
          __local_temp_id: parseProductoPersistedId(apiProducto?.id_producto ?? safeId) === null
        }
      : localProductoBase;
  }, [nextTempProductoId, parseProductoPersistedId]);

  // AJUSTE: usa normalización estricta para mostrar estado activo/inactivo de forma consistente.
  const resolveEstadoActivo = useCallback((producto) => {
    if (!producto) return false;
    const localEstado = localEstadoMap[producto?.id_producto];
    if (localEstado !== null && localEstado !== undefined) return productoActivo(localEstado);
    return productoActivo(producto?.estado);
  }, [localEstadoMap, productoActivo]);

  const resolveEstadoProducto = useCallback((producto) => {
    if (!resolveEstadoActivo(producto)) return { label: 'Inactivo', className: 'is-inactive' };

    const stockMeta = getStockMeta(producto?.cantidad, producto?.stock_minimo);
    if (stockMeta.qty <= 0) return { label: 'Sin existencias', className: 'is-empty' };
    if (stockMeta.className === 'is-low') return { label: 'Stock bajo', className: 'is-low' };
    return { label: 'En existencia', className: 'is-ok' };
  }, [resolveEstadoActivo]);

  const clearCreateImage = useCallback(() => {
    // NEW: limpia tambien el valor del input file de alta.
    // WHY: permite volver a seleccionar el mismo archivo despues de "Quitar imagen" sin quedar pegado al valor previo.
    // IMPACT: solo UX/estado local del formulario de create.
    if (createImageInputRef.current) createImageInputRef.current.value = '';
    setCreateImage(buildCreateImageState());
  }, []);

  const setCreateImageError = useCallback((message) => {
    setCreateImage({
      ...buildCreateImageState(),
      error: message
    });
  }, []);

  const onCreateImageChange = useCallback((event) => {
    const input = event.target;
    const file = input?.files?.[0];

    if (!file) {
      clearCreateImage();
      return;
    }

    const fileError = getInventarioImageFileError(file);
    if (fileError) {
      setCreateImage((prev) => ({
        ...prev,
        loading: false,
        error: fileError
      }));
      input.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCreateImage({
      file,
      previewUrl,
      loading: true,
      error: ''
    });

    const probe = new Image();
    probe.onload = () => {
      setCreateImage((prev) => {
        if (prev.previewUrl !== previewUrl) return prev;
        return {
          ...prev,
          loading: false,
          error: ''
        };
      });
    };
    probe.onerror = () => {
      setCreateImageError('No se pudo cargar la imagen seleccionada.');
      input.value = '';
    };
    probe.src = previewUrl;
  }, [clearCreateImage, setCreateImageError]);

  const onCreatePreviewError = useCallback(() => {
    setCreateImageError('No se pudo mostrar la vista previa de la imagen.');
  }, [setCreateImageError]);

  const markImageAsError = useCallback((productoId) => {
    if (!productoId) return;
    setImageErrorMap((prev) => {
      if (prev[productoId]) return prev;
      return { ...prev, [productoId]: true };
    });
  }, []);

  const getProductoImageSrc = useCallback((producto) => {
    if (!producto) return '';
    const id = producto?.id_producto;
    if (imageErrorMap[id]) return '';
    return resolveInventarioImageUrl(
      producto?.imagen_principal_url || producto?.imagen_url || producto?.imagen || producto?.url_publica || ''
    );
  }, [imageErrorMap]);

  const uploadProductoImageFile = useCallback(async (file) => {
    const payload = await buildInventarioImageUploadPayload(file);
    return inventarioService.crearArchivoImagen(payload);
  }, []);

  // ==============================
  // VALIDACIÓN MÍNIMA (PRODUCTOS)
  // ==============================
  const validarProducto = (data) => {
    // === LIMPIEZA ===
    const nombre = String(data?.nombre_producto ?? '').trim();
    const descripcion = String(data?.descripcion_producto ?? '').trim();

    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    // NUEVO: se valida stock_minimo para enviar valor compatible con backend.
    const stockMinimoRaw = String(data?.stock_minimo ?? '').trim();

    const categoriaRaw = String(data?.id_categoria_producto ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();
    const deptoRaw = SHOW_PRODUCTO_DEPARTAMENTOS ? String(data?.id_tipo_departamento ?? '').trim() : '';

    const fechaIngreso = String(data?.fecha_ingreso_producto ?? '').trim();
    const fechaCaducidad = String(data?.fecha_caducidad ?? '').trim();

    const errors = {};

    // === NOMBRE OBLIGATORIO ===
    if (nombre.length < 2) errors.nombre_producto = 'MÍNIMO 2 CARACTERES';
    // AJUSTE: backend valida nombre_producto con maximo de 50 caracteres.
    if (nombre.length > 50) errors.nombre_producto = 'M\u00C1XIMO 50 CARACTERES';

    // === PRECIO OBLIGATORIO (DECIMAL) ===
    const precio = Number.parseFloat(precioRaw);
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NÚMERO >= 0';

    // === CANTIDAD OBLIGATORIA (ENTERO) ===
    const cantidad = Number.parseInt(cantidadRaw, 10);
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';

    // === FK CATEGORÍA OBLIGATORIA ===
    // VALIDACION: stock_minimo debe ser entero no negativo.
    const stock_minimo = Number.parseInt(stockMinimoRaw || '0', 10);
    if (stockMinimoRaw === '') errors.stock_minimo = 'EL STOCK M\u00CDNIMO ES OBLIGATORIO';
    else if (!/^\d+$/.test(stockMinimoRaw)) errors.stock_minimo = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(stock_minimo) || stock_minimo < 0) errors.stock_minimo = 'DEBE SER UN ENTERO >= 0';

    const id_categoria_producto = Number.parseInt(categoriaRaw, 10);
    if (!categoriaRaw) errors.id_categoria_producto = 'LA CATEGORÍA ES OBLIGATORIA';
    else if (Number.isNaN(id_categoria_producto) || id_categoria_producto <= 0)
      errors.id_categoria_producto = 'DEBE SER UN NÚMERO > 0';

    // === FK ALMACÉN OBLIGATORIA ===
    const id_almacen = Number.parseInt(almacenRaw, 10);
    if (!almacenRaw) errors.id_almacen = 'EL ALMACÉN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'DEBE SER UN NÚMERO > 0';

    // === FK TIPO_DEPARTAMENTO (OPCIONAL) ===
    let id_tipo_departamento = null;
    if (deptoRaw) {
      const parsed = Number.parseInt(deptoRaw, 10);
      if (Number.isNaN(parsed) || parsed <= 0) errors.id_tipo_departamento = 'DEBE SER UN NÚMERO > 0';
      else id_tipo_departamento = parsed;
    }

    // === DESCRIPCIÓN OPCIONAL ===

    // AJUSTE: se permite hasta 250 caracteres para descripcion_producto.
    if (descripcion.length > 250) errors.descripcion_producto = 'M\u00C1XIMO 250 CARACTERES';

    // === FECHAS OPCIONALES ===
    if (fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
      errors.fecha_ingreso_producto = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }
    if (fechaCaducidad && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad)) {
      errors.fecha_caducidad = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        nombre_producto: nombre,
        precio,
        cantidad,
        stock_minimo,
        descripcion_producto: descripcion,
        fecha_ingreso_producto: fechaIngreso,
        fecha_caducidad: fechaCaducidad,
        id_categoria_producto,
        id_almacen,
        id_tipo_departamento // PUEDE SER null (PERO NO LO ENVIAREMOS SI ES NULL)
      }
    };
  };

  // ==============================
  // CONSTRUIR PAYLOAD SIN NULLS
  // ==============================
  const buildProductoPayload = (cleaned) => {
    // COMENTARIO EN MAYÚSCULAS: OMITIMOS CAMPOS OPCIONALES VACÍOS PARA NO ENVIAR NULLS
    const payload = {
      nombre_producto: cleaned.nombre_producto,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad,
      // AJUSTE: se incluye stock_minimo como numero para alinear create con backend.
      stock_minimo: cleaned.stock_minimo,
      id_categoria_producto: cleaned.id_categoria_producto,
      id_almacen: cleaned.id_almacen
    };

    if (cleaned.descripcion_producto) payload.descripcion_producto = cleaned.descripcion_producto;
    if (cleaned.fecha_ingreso_producto) payload.fecha_ingreso_producto = cleaned.fecha_ingreso_producto;
    if (cleaned.fecha_caducidad) payload.fecha_caducidad = cleaned.fecha_caducidad;

    // COMENTARIO EN MAYÚSCULAS: SOLO ENVIAR id_tipo_departamento SI VIENE CON VALOR (NO NULL)
    if (SHOW_PRODUCTO_DEPARTAMENTOS && cleaned.id_tipo_departamento) payload.id_tipo_departamento = cleaned.id_tipo_departamento;

    return payload;
  };

  // ==============================
  // CARGAS (API)
  // ==============================
  const cargarProductos = async () => {
    setLoadingProductos(true);
    setError('');
    try {
      // COMENTARIO EN MAYÚSCULAS: PRODUCTOS SE CARGA DESDE EL BACKEND /productos
      // NEW: se pide siempre el dataset global (activos + inactivos) para KPIs y "Total" global.
      // WHY: el toggle "Ver inactivos" ahora debe afectar solo el listado visible (filtro local).
      // IMPACT: no cambia endpoint ni contrato; la vista usa el mismo `productos` con filtro por estado.
      const data = await inventarioService.getProductos({ incluirInactivos: true });
      setProductos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO PRODUCTOS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingProductos(false);
    }
  };

  const cargarAlmacenes = async () => {
    setLoadingAlmacenes(true);
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO ALMACENES';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const cargarTipoDepartamentos = async () => {
    setLoadingTipoDepto(true);
    try {
      // COMENTARIO EN MAYÚSCULAS: TIPO_DEPARTAMENTO VIENE DE /tipo_departamento
      const data = await inventarioService.getTipoDepartamentos();
      setTipoDepartamentos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO TIPO DEPARTAMENTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingTipoDepto(false);
    }
  };

  useEffect(() => {
    // COMENTARIO EN MAYÚSCULAS: CARGA INICIAL DEL TAB PRODUCTOS
    cargarAlmacenes();
    if (SHOW_PRODUCTO_DEPARTAMENTOS) cargarTipoDepartamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!SHOW_PRODUCTO_DEPARTAMENTOS) setDeptoFiltro('todos');
  }, []);

  useEffect(() => {
    // NEW: carga inicial del dataset global de productos (activos + inactivos) para KPIs y listado.
    // WHY: el toggle "Ver inactivos" ahora filtra localmente y no requiere refetch para cambiar la vista.
    // IMPACT: reduce recargas visibles en el toggle; CRUD y `cargarProductos()` manual siguen intactos.
    void cargarProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // RESET FORM CREAR
  // ==============================
  const resetForm = () => {
    setForm({
      nombre_producto: '',
      precio: '',
      cantidad: '',
      // AJUSTE: reset consistente del nuevo campo stock_minimo.
      stock_minimo: '0',
      descripcion_producto: '',
      fecha_ingreso_producto: '',
      fecha_caducidad: '',
      id_categoria_producto: '',
      id_almacen: '',
      id_tipo_departamento: ''
    });
    setCreateErrors({});
    clearCreateImage();
  };

  // ==============================
  // CREAR PRODUCTO
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    if (creating) return;
    setError('');

    const v = validarProducto(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    const duplicateProducto = findDuplicateProducto(v.cleaned);
    if (duplicateProducto) {
      // NEW: validación anti-duplicados en frontend usando los campos reales del formulario.
      // WHY: evitar submits innecesarios y dar feedback inmediato antes de llamar al backend.
      // IMPACT: bloquea el submit solo si coincide nombre+categoría+almacén(+depto opcional) con otro producto.
      setCreateErrors((prev) => ({
        ...prev,
        nombre_producto: 'YA EXISTE UN PRODUCTO CON ESTOS DATOS (NOMBRE + CATEGORÍA + ALMACÉN).'
      }));
      return;
    }

    setCreating(true);
    try {
      const payload = buildProductoPayload(v.cleaned);
      let uploadedImage = null;

      // NEW: si hay imagen seleccionada, se crea primero en `archivos` y luego se envia la FK al POST /productos.
      // WHY: mantener el flujo actual del formulario sin introducir multipart ni romper el contrato existente.
      // IMPACT: el create solo agrega `id_archivo_imagen_principal` cuando la imagen se subio correctamente.
      if (createImage.file) {
        const archivoResp = await uploadProductoImageFile(createImage.file);
        const archivoId = Number.parseInt(String(archivoResp?.id_archivo ?? ''), 10);
        if (!Number.isInteger(archivoId) || archivoId <= 0) {
          throw new Error('No se pudo obtener el archivo de imagen creado.');
        }
        payload.id_archivo_imagen_principal = archivoId;
        uploadedImage = {
          id_archivo_imagen_principal: archivoId,
          imagen_principal_url: resolveInventarioImageUrl(archivoResp?.url_publica || '')
        };
      }

      const createResp = await inventarioService.crearProducto(payload);
      const createdProductoLocal = {
        ...buildLocalProductoFromCreateResponse(v.cleaned, createResp),
        ...(uploadedImage || {})
      };
      upsertProductoLocal(createdProductoLocal);
      if (createdProductoLocal?.__local_temp_id === true) {
        // NEW: sincroniza la lista tras create cuando el backend no devolvio `id_producto`.
        // WHY: reemplazar el ID temporal local por el ID real antes de futuras acciones (edit/delete).
        // IMPACT: fetch silencioso de `/productos` sin loader global ni cambio de contrato del POST.
        void syncProductosSilently();
      }

      resetForm();
      closeCreateProductoModal();

      safeToast('CREADO', 'EL PRODUCTO SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      // AJUSTE: se maneja ApiError por status y errores de campo para feedback consistente.
      const msg = handleApiStatusError(e2, 'ERROR CREANDO PRODUCTO', setCreateErrors);
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  // ==============================
  // INICIAR / CANCELAR EDICIÓN
  // ==============================
  const iniciarEdicion = (p) => {
    setError('');
    setEditErrors({});
    setEditId(p.id_producto);

    setEditForm({
      nombre_producto: p.nombre_producto ?? '',
      precio: p.precio ?? '',
      cantidad: p.cantidad ?? '',
      // AJUSTE: el form de edicion conserva stock_minimo para validacion homogenea.
      stock_minimo: String(p.stock_minimo ?? '0'),
      descripcion_producto: p.descripcion_producto ?? '',
      fecha_ingreso_producto: toDateInputValue(p.fecha_ingreso_producto),
      fecha_caducidad: toDateInputValue(p.fecha_caducidad),
      id_categoria_producto: String(p.id_categoria_producto ?? ''),
      id_almacen: String(p.id_almacen ?? ''),
      id_tipo_departamento: SHOW_PRODUCTO_DEPARTAMENTOS && p.id_tipo_departamento ? String(p.id_tipo_departamento) : ''
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
    setSavingEdit(false);
  };

  const abrirDrawerProducto = (producto) => {
    iniciarEdicion(producto);
    setSelectedProductoId(producto?.id_producto ?? null);
    // NEW: el drawer de Productos abre directamente en modo edicion.
    // WHY: el usuario pidio ver todos los campos modificables sin una capa previa de detalle.
    // IMPACT: solo cambia el estado inicial del drawer; el guardado y validaciones permanecen.
    setDrawerEditMode(true);
    setDrawerMessage('');
    setDrawerOpen(true);
  };

  const cerrarDrawerProducto = () => {
    setDrawerOpen(false);
    setDrawerEditMode(false);
    setDrawerMessage('');
    setSelectedProductoId(null);
    cancelarEdicion();
  };

  const clearProductoImageError = useCallback((productoId) => {
    if (!productoId) return;
    setImageErrorMap((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, productoId)) return prev;
      const next = { ...prev };
      delete next[productoId];
      return next;
    });
  }, []);

  const openDrawerImagePicker = useCallback(() => {
    if (drawerImageAction.loading) return;
    drawerImageInputRef.current?.click();
  }, [drawerImageAction.loading]);

  const onDrawerImageChange = useCallback(async (event) => {
    const input = event.target;
    const file = input?.files?.[0];

    if (!file || !selectedProducto) {
      if (input) input.value = '';
      return;
    }

    const fileError = getInventarioImageFileError(file);
    if (fileError) {
      setDrawerImageAction({ loading: false, error: fileError });
      if (input) input.value = '';
      return;
    }

    const persistedProductId = parseProductoPersistedId(selectedProducto?.id_producto);
    if (!persistedProductId) {
      const safeMsg = 'No se pudo completar la accion. Verifica los datos e intenta de nuevo.';
      setDrawerImageAction({ loading: false, error: safeMsg });
      setDrawerMessage(safeMsg);
      void syncProductosSilently();
      if (input) input.value = '';
      return;
    }

    setDrawerImageAction({ loading: true, error: '' });
    try {
      const archivoResp = await uploadProductoImageFile(file);
      const archivoId = Number.parseInt(String(archivoResp?.id_archivo ?? ''), 10);
      if (!Number.isInteger(archivoId) || archivoId <= 0) {
        throw new Error('No se pudo obtener el archivo de imagen creado.');
      }

      await inventarioService.actualizarProductoCampo(
        persistedProductId,
        'id_archivo_imagen_principal',
        archivoId
      );

      clearProductoImageError(persistedProductId);
      patchProductoLocalById(persistedProductId, {
        id_archivo_imagen_principal: archivoId,
        imagen_principal_url: resolveInventarioImageUrl(archivoResp?.url_publica || '')
      });
      setDrawerImageAction({ loading: false, error: '' });
      setDrawerMessage('Imagen actualizada.');
      safeToast('ACTUALIZADO', 'LA IMAGEN DEL PRODUCTO SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (errorUpload) {
      const msg = handleApiStatusError(errorUpload, 'NO SE PUDO ACTUALIZAR LA IMAGEN DEL PRODUCTO.');
      setDrawerImageAction({ loading: false, error: msg });
      setDrawerMessage(msg);
    } finally {
      if (input) input.value = '';
    }
  }, [
    clearProductoImageError,
    handleApiStatusError,
    parseProductoPersistedId,
    patchProductoLocalById,
    safeToast,
    selectedProducto,
    syncProductosSilently,
    uploadProductoImageFile
  ]);

  const removeDrawerImage = useCallback(async () => {
    if (drawerImageAction.loading || !selectedProducto) return;

    const persistedProductId = parseProductoPersistedId(selectedProducto?.id_producto);
    if (!persistedProductId) {
      const safeMsg = 'No se pudo completar la accion. Verifica los datos e intenta de nuevo.';
      setDrawerImageAction({ loading: false, error: safeMsg });
      setDrawerMessage(safeMsg);
      void syncProductosSilently();
      return;
    }

    const currentImageSrc = getProductoImageSrc(selectedProducto);
    if (!currentImageSrc && !selectedProducto?.id_archivo_imagen_principal) return;

    setDrawerImageAction({ loading: true, error: '' });
    try {
      await inventarioService.actualizarProductoCampo(
        persistedProductId,
        'id_archivo_imagen_principal',
        null
      );

      clearProductoImageError(persistedProductId);
      patchProductoLocalById(persistedProductId, {
        id_archivo_imagen_principal: null,
        imagen_principal_url: null
      });
      // NEW: limpia el file input oculto del drawer al desvincular la imagen.
      // WHY: evita reenvios accidentales o que el navegador retenga el mismo archivo seleccionado.
      // IMPACT: solo sincroniza el estado visual del picker del drawer.
      if (drawerImageInputRef.current) drawerImageInputRef.current.value = '';
      setDrawerImageAction({ loading: false, error: '' });
      setDrawerMessage('Imagen eliminada.');
      safeToast('ACTUALIZADO', 'LA IMAGEN DEL PRODUCTO SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (errorUpload) {
      const msg = handleApiStatusError(errorUpload, 'NO SE PUDO ELIMINAR LA IMAGEN DEL PRODUCTO.');
      setDrawerImageAction({ loading: false, error: msg });
      setDrawerMessage(msg);
    }
  }, [
    clearProductoImageError,
    drawerImageAction.loading,
    getProductoImageSrc,
    handleApiStatusError,
    parseProductoPersistedId,
    patchProductoLocalById,
    safeToast,
    selectedProducto,
    syncProductosSilently
  ]);

  const duplicarProductoDesdeDrawer = () => {
    if (!selectedProducto) return;

    // AJUSTE: se toma snapshot antes de cerrar drawer para no perder la referencia seleccionada.
    const productoBase = { ...selectedProducto };
    // VALIDACION: se normalizan campos numericos para evitar valores invalidos al precargar.
    const precioRaw = Number.parseFloat(String(productoBase?.precio ?? '0'));
    const precioNormalizado = Number.isNaN(precioRaw) || precioRaw < 0 ? 0 : precioRaw;
    const stockMinimoRaw = Number.parseInt(String(productoBase?.stock_minimo ?? '0'), 10);
    const stockMinimoNormalizado = Number.isNaN(stockMinimoRaw) || stockMinimoRaw < 0 ? 0 : stockMinimoRaw;

    setForm({
      nombre_producto: productoBase?.nombre_producto ? `${productoBase.nombre_producto} (copia)` : '',
      precio: String(precioNormalizado),
      // VALIDACION: el duplicado inicia con cantidad 0 para evitar clonar existencias sin intencion.
      cantidad: '0',
      // AJUSTE: al duplicar se replica stock_minimo y si no existe se usa 0.
      stock_minimo: String(stockMinimoNormalizado),
      descripcion_producto: productoBase?.descripcion_producto ?? '',
      fecha_ingreso_producto: toDateInputValue(productoBase?.fecha_ingreso_producto),
      fecha_caducidad: toDateInputValue(productoBase?.fecha_caducidad),
      id_categoria_producto: String(productoBase?.id_categoria_producto ?? ''),
      id_almacen: String(productoBase?.id_almacen ?? ''),
      id_tipo_departamento: SHOW_PRODUCTO_DEPARTAMENTOS && productoBase?.id_tipo_departamento ? String(productoBase?.id_tipo_departamento) : ''
    });
    setCreateErrors({});
    clearCreateImage();
    // AJUSTE: al duplicar se cierra el drawer y filtros antes de redirigir al flujo de alta.
    setFiltersOpen(false);
    cerrarDrawerProducto();
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setCreatePanelOpen(false);
      setShowCreateProductoSheet(true);
      return;
    }
    setShowCreateProductoSheet(false);
    setCreatePanelOpen(true);
    // NUEVO: al abrir Nuevo desde duplicar se desplaza al formulario para completar datos.
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        createSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const toggleEstadoProductoDesdeDrawer = async () => {
    if (!selectedProducto || togglingEstado) return;

    const productId = selectedProducto?.id_producto;
    const persistedProductId = parseProductoPersistedId(productId);
    if (!persistedProductId) {
      // NEW: evita mutar backend con IDs temporales/fuera de rango y fuerza sincronizacion silenciosa.
      // WHY: cortar el error 500 (`out of range for type integer`) antes de llamar a `/productos`.
      // IMPACT: no cambia el flujo normal; solo protege casos de cards locales sin ID real.
      const safeMsg = 'No se pudo completar la acción. Verifica los datos e intenta de nuevo.';
      setError(safeMsg);
      setDrawerMessage(safeMsg);
      void syncProductosSilently();
      return;
    }
    const currentActive = resolveEstadoActivo(selectedProducto);
    const nextActive = !currentActive;

    setLocalEstadoMap((prev) => ({ ...prev, [productId]: nextActive }));
    setDrawerMessage(nextActive ? 'Activando producto...' : 'Desactivando producto...');
    setTogglingEstado(true);

    try {
      const estadoCandidates = [nextActive ? 1 : 0, nextActive ? '1' : '0', nextActive];
      let estadoUpdated = false;
      let lastError = null;

      for (const estadoValue of estadoCandidates) {
        try {
          await inventarioService.actualizarProductoCampo(persistedProductId, 'estado', estadoValue);
          estadoUpdated = true;
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (!estadoUpdated) {
        throw lastError || new Error('No se pudo actualizar el estado.');
      }

      setProductos((prev) =>
        prev.map((item) => (
          Number(item?.id_producto) === Number(productId)
            ? { ...item, estado: nextActive }
            : item
        ))
      );
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, productId)) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setDrawerMessage(nextActive ? 'Producto activado.' : 'Producto desactivado.');
      safeToast('EXITO', nextActive ? 'Producto activado.' : 'Producto desactivado.', 'success');
    } catch (e) {
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, productId)) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      const msg = e?.message || 'No se pudo actualizar el estado. Intenta de nuevo.';
      setDrawerMessage(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setTogglingEstado(false);
    }
  };

  // NEW: reactivacion directa desde card cuando el listado visible es de productos inactivos.
  // WHY: corregir la coherencia del CTA del card (ACTIVAR/INACTIVAR) sin obligar al usuario a abrir el drawer.
  // IMPACT: reutiliza `actualizarProductoCampo` y el estado local existente; no cambia contratos ni el DELETE actual.
  const activarProductoDesdeCard = useCallback(async (producto) => {
    if (!producto || togglingEstado || deleting) return;

    const productId = producto?.id_producto;
    const persistedProductId = parseProductoPersistedId(productId);
    if (!persistedProductId) {
      // NEW: evita mutar backend con IDs temporales/fuera de rango y fuerza sincronizacion silenciosa.
      // WHY: proteger el flujo de activacion con la misma validacion de ID usada en otras mutaciones.
      // IMPACT: no afecta productos persistidos; solo corta casos invalidos y recupera datos desde GET.
      const safeMsg = 'No se pudo completar la acción. Verifica los datos e intenta de nuevo.';
      setError(safeMsg);
      if (drawerOpen && Number(selectedProductoId) === Number(productId)) setDrawerMessage(safeMsg);
      void syncProductosSilently();
      return;
    }

    setTogglingEstado(true);
    setError('');
    if (drawerOpen && Number(selectedProductoId) === Number(persistedProductId)) {
      setDrawerMessage('Activando producto...');
    }

    try {
      let done = false;
      let lastError = null;
      for (const candidate of [1, '1', true]) {
        try {
          await inventarioService.actualizarProductoCampo(persistedProductId, 'estado', candidate);
          done = true;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!done) throw (lastError || new Error('No se pudo activar el producto.'));

      patchProductoLocalById(persistedProductId, { estado: true });
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, persistedProductId)) return prev;
        const next = { ...prev };
        delete next[persistedProductId];
        return next;
      });

      if (drawerOpen && Number(selectedProductoId) === Number(persistedProductId)) {
        setDrawerMessage('Producto activado.');
      }
      safeToast('EXITO', 'Producto activado.', 'success');
    } catch (e) {
      const msg = handleApiStatusError(e, 'No se pudo activar el producto. Intenta de nuevo.');
      setError(msg);
      if (drawerOpen && Number(selectedProductoId) === Number(persistedProductId)) {
        setDrawerMessage(msg);
      }
    } finally {
      setTogglingEstado(false);
    }
  }, [
    deleting,
    drawerOpen,
    handleApiStatusError,
    parseProductoPersistedId,
    patchProductoLocalById,
    safeToast,
    selectedProductoId,
    syncProductosSilently,
    togglingEstado
  ]);

  // ==============================
  // GUARDAR EDICIÓN (CAMPO POR CAMPO)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm || savingEdit) return;

    setError('');
    // AJUSTE: en edicion, stock_minimo vacio se normaliza a 0 para alinear con DEFAULT de BD.
    const editData = {
      ...editForm,
      stock_minimo: String(editForm?.stock_minimo ?? '').trim() === '' ? '0' : editForm.stock_minimo
    };
    const v = validarProducto(editData);
    setEditErrors(v.errors);
    if (!v.ok) return;

    // VALIDACION: bloquea guardado si stock_minimo no es entero valido >= 0.
    const stockMinimoEdit = Number.parseInt(String(v.cleaned?.stock_minimo ?? '0'), 10);
    if (Number.isNaN(stockMinimoEdit) || stockMinimoEdit < 0) {
      setEditErrors((prev) => ({
        ...prev,
        stock_minimo: 'DEBE SER UN ENTERO >= 0'
      }));
      return;
    }

    const duplicateProducto = findDuplicateProducto(v.cleaned, { excludeId: editId });
    if (duplicateProducto) {
      // NEW: bloqueo preventivo de duplicados también en edición.
      // WHY: evitar dejar dos productos equivalentes tras editar nombre/categoría/almacén.
      // IMPACT: no toca backend; muestra feedback y detiene el guardado localmente.
      const duplicateMsg = 'YA EXISTE UN PRODUCTO CON ESTOS DATOS (NOMBRE + CATEGORÍA + ALMACÉN).';
      setEditErrors((prev) => ({
        ...prev,
        nombre_producto: duplicateMsg
      }));
      setDrawerMessage(duplicateMsg);
      return;
    }

    const persistedEditId = parseProductoPersistedId(editId);
    if (!persistedEditId) {
      // NEW: bloquea guardado si el item tiene ID temporal/fuera de rango y sincroniza IDs reales.
      // WHY: evitar que `id_valor` llegue a `/productos` con un timestamp en ms y provoque 500 en BD.
      // IMPACT: solo previene mutaciones inválidas; mantiene intacta la edición de productos persistidos.
      const safeMsg = 'No se pudo completar la acción. Verifica los datos e intenta de nuevo.';
      setError(safeMsg);
      setDrawerMessage(safeMsg);
      void syncProductosSilently();
      return;
    }

    setSavingEdit(true);
    try {
      // COMENTARIO EN MAYÚSCULAS: SOLO ACTUALIZAMOS CAMPOS QUE CAMBIARON
      const actual = productos.find((x) => x.id_producto === editId);

      const cambios = [];

      const nombreActual = String(actual?.nombre_producto ?? '').trim();
      const precioActual = Number.parseFloat(String(actual?.precio ?? ''));
      const cantidadActual = Number.parseInt(String(actual?.cantidad ?? ''), 10);
      // AJUSTE: normaliza stock_minimo actual para comparar contra edicion con fallback 0.
      const stockMinimoActualRaw = Number.parseInt(String(actual?.stock_minimo ?? '0'), 10);
      const stockMinimoActual = Number.isNaN(stockMinimoActualRaw) ? 0 : stockMinimoActualRaw;

      const descActual = String(actual?.descripcion_producto ?? '').trim();

      const catActual = Number.parseInt(String(actual?.id_categoria_producto ?? ''), 10);
      const almActual = Number.parseInt(String(actual?.id_almacen ?? ''), 10);

      const ingresoActual = toDateInputValue(actual?.fecha_ingreso_producto);
      const caducidadActual = toDateInputValue(actual?.fecha_caducidad);

      const deptoActual = actual?.id_tipo_departamento ? Number.parseInt(String(actual.id_tipo_departamento), 10) : null;

      if (v.cleaned.nombre_producto !== nombreActual) cambios.push(['nombre_producto', v.cleaned.nombre_producto]);
      if (!Number.isNaN(v.cleaned.precio) && v.cleaned.precio !== precioActual) cambios.push(['precio', v.cleaned.precio]);
      if (!Number.isNaN(v.cleaned.cantidad) && v.cleaned.cantidad !== cantidadActual) cambios.push(['cantidad', v.cleaned.cantidad]);
      // AJUSTE: se incluye stock_minimo en persistencia por campo cuando cambia en edicion.
      if (stockMinimoEdit !== stockMinimoActual) cambios.push(['stock_minimo', stockMinimoEdit]);

      if (!Number.isNaN(v.cleaned.id_categoria_producto) && v.cleaned.id_categoria_producto !== catActual) {
        cambios.push(['id_categoria_producto', v.cleaned.id_categoria_producto]);
      }

      if (!Number.isNaN(v.cleaned.id_almacen) && v.cleaned.id_almacen !== almActual) {
        cambios.push(['id_almacen', v.cleaned.id_almacen]);
      }

      // DESCRIPCIÓN: PERMITIMOS VACÍO (NO ES NULL)
      if (v.cleaned.descripcion_producto !== descActual) cambios.push(['descripcion_producto', v.cleaned.descripcion_producto]);

      // FECHAS: SOLO ENVIAR SI VIENE CON VALOR (EVITAR ENVIAR VACÍO Y QUE EL SP FALLE)
      if (v.cleaned.fecha_ingreso_producto && v.cleaned.fecha_ingreso_producto !== ingresoActual) {
        cambios.push(['fecha_ingreso_producto', v.cleaned.fecha_ingreso_producto]);
      }
      if (v.cleaned.fecha_caducidad && v.cleaned.fecha_caducidad !== caducidadActual) {
        cambios.push(['fecha_caducidad', v.cleaned.fecha_caducidad]);
      }

      // TIPO_DEPARTAMENTO: SOLO ENVIAR SI EL USUARIO SELECCIONÓ UNO (NO NULL)
      if (SHOW_PRODUCTO_DEPARTAMENTOS && v.cleaned.id_tipo_departamento && v.cleaned.id_tipo_departamento !== deptoActual) {
        cambios.push(['id_tipo_departamento', v.cleaned.id_tipo_departamento]);
      }

      if (cambios.length === 0) {
        setDrawerMessage('Cambios guardados.');
        safeToast('INFO', 'Cambios guardados.', 'success');
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarProductoCampo(persistedEditId, campo, valor);
      }
      const patchLocal = Object.fromEntries(cambios);
      patchProductoLocalById(persistedEditId, patchLocal);
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, persistedEditId)) return prev;
        const next = { ...prev };
        delete next[persistedEditId];
        return next;
      });
      const shouldCloseDrawerAfterEdit = drawerOpen && Number(selectedProductoId) === Number(persistedEditId);
      if (shouldCloseDrawerAfterEdit) {
        cerrarDrawerProducto();
      } else {
        setDrawerMessage('Cambios guardados.');
        setDrawerEditMode(false);
      }
      safeToast('EXITO', 'Cambios guardados.', 'success');
    } catch (e) {
      // AJUSTE: se refleja status HTTP y errores por campo en la edición.
      const msg = handleApiStatusError(e, 'No se pudo guardar. Intenta de nuevo.', setEditErrors);
      setError(msg);
      setDrawerMessage(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // ==============================
  // ELIMINAR PRODUCTO (CONFIRMADO)
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || deleting) return;
    const persistedDeleteId = parseProductoPersistedId(id);
    if (!persistedDeleteId) {
      // NEW: evita DELETE con IDs temporales/fuera de rango y refresca lista para recuperar IDs reales.
      // WHY: impedir 500 por `valor_id` inválido en `pa_delete` y mostrar feedback profesional.
      // IMPACT: solo protege un caso inválido; delete normal de productos persistidos no cambia.
      const safeMsg = 'No se pudo completar la acción. Verifica los datos e intenta de nuevo.';
      setError(safeMsg);
      setConfirmDeleteError(safeMsg);
      void syncProductosSilently();
      return;
    }

    setDeleting(true);
    setError('');
    setConfirmDeleteError('');
    try {
      const resp = await inventarioService.eliminarProducto(persistedDeleteId);
      closeConfirmDelete();
      if (Number(selectedProductoId) === Number(persistedDeleteId) && drawerOpen) {
        if (showInactiveProductos) {
          setDrawerMessage(resp?.message || 'Producto inactivado.');
        } else {
          cerrarDrawerProducto();
        }
      }
      patchProductoLocalById(persistedDeleteId, { estado: false });
      // NEW: el producto inactivado se conserva en memoria para que aparezca al instante en "Ver inactivos".
      // WHY: evitar recarga/refetch y asegurar que el toggle de inactivos lo encuentre inmediatamente.
      // IMPACT: el card sigue saliendo de la vista activa por filtrado local, pero ya no se elimina del dataset global.
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, persistedDeleteId)) return prev;
        const next = { ...prev };
        delete next[persistedDeleteId];
        return next;
      });
      safeToast('INACTIVADO', resp?.message || 'PRODUCTO INACTIVADO.', 'success');
    } catch (e) {
      const msg = handleApiStatusError(e, 'ERROR INACTIVANDO PRODUCTO');
      setError(msg);
      setConfirmDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ==============================
  // FILTRAR + ORDENAR
  // ==============================
  const productosFiltrados = useMemo(() => {
    const s = search.trim().toLowerCase();

    const filtered = [...productos].filter((p) => {
      const deptoTexto = SHOW_PRODUCTO_DEPARTAMENTOS ? getDeptoLabel(p.id_tipo_departamento) : '';
      const texto = `${p.nombre_producto ?? ''} ${p.descripcion_producto ?? ''} ${getCategoriaLabel(p.id_categoria_producto)} ${getAlmacenLabel(p.id_almacen)} ${deptoTexto}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const cant = Number.parseInt(String(p.cantidad ?? '0'), 10);
      const conStock = !Number.isNaN(cant) && cant > 0;

      const matchStock =
        stockFiltro === 'todos' ? true : stockFiltro === 'con_stock' ? conStock : !conStock;

      const matchCategoria =
        categoriaFiltro === 'todos' ? true : String(p.id_categoria_producto) === String(categoriaFiltro);

      const matchAlmacen =
        almacenFiltro === 'todos' ? true : String(p.id_almacen) === String(almacenFiltro);

      const matchDepto =
        !SHOW_PRODUCTO_DEPARTAMENTOS || deptoFiltro === 'todos'
          ? true
          : String(p.id_tipo_departamento ?? '') === String(deptoFiltro);

      // AJUSTE: filtro por estado usando normalizacion de activo/inactivo.
      const activo = resolveEstadoActivo(p);
      // NEW: modo "Ver inactivos" fuerza listado exclusivo de inactivos; OFF deja solo activos.
      // WHY: evitar mezclar estados cuando el backend devuelve ambos con `incluir_inactivos=1`.
      // IMPACT: filtro local adicional en la grilla/carrusel; no altera handlers ni paginación visual.
      const matchViewEstado = showInactiveProductos ? !activo : activo;
      const matchEstado =
        estadoFiltro === 'todos' ? true : estadoFiltro === 'activo' ? activo : !activo;

      return matchTexto && matchStock && matchEstado && matchCategoria && matchAlmacen && matchDepto && matchViewEstado;
    });

    filtered.sort((a, b) => {
      // NEW: prioridad operativa fija para mostrar primero sin stock y luego stock bajo.
      // WHY: el usuario necesita ver faltantes al inicio sin importar si la vista es cards o listado.
      // IMPACT: respeta filtros activos y aplica el `sortBy` actual solo dentro de cada grupo de prioridad.
      const stockRankDiff =
        getStockPriorityRank(a?.cantidad, a?.stock_minimo) - getStockPriorityRank(b?.cantidad, b?.stock_minimo);
      if (stockRankDiff !== 0) return stockRankDiff;

      let sortDiff = 0;
      if (sortBy === 'nombre_asc') {
        sortDiff = String(a?.nombre_producto ?? '').localeCompare(String(b?.nombre_producto ?? ''), 'es', { sensitivity: 'base' });
      } else if (sortBy === 'nombre_desc') {
        sortDiff = String(b?.nombre_producto ?? '').localeCompare(String(a?.nombre_producto ?? ''), 'es', { sensitivity: 'base' });
      } else if (sortBy === 'precio_desc') {
        sortDiff = Number(b?.precio ?? 0) - Number(a?.precio ?? 0);
      } else if (sortBy === 'precio_asc') {
        sortDiff = Number(a?.precio ?? 0) - Number(b?.precio ?? 0);
      } else if (sortBy === 'stock_desc') {
        sortDiff = Number(b?.cantidad ?? 0) - Number(a?.cantidad ?? 0);
      } else if (sortBy === 'stock_asc') {
        sortDiff = Number(a?.cantidad ?? 0) - Number(b?.cantidad ?? 0);
      } else {
        sortDiff = Number(b?.id_producto ?? 0) - Number(a?.id_producto ?? 0);
      }
      if (sortDiff !== 0) return sortDiff;

      const byName = String(a?.nombre_producto ?? '').localeCompare(String(b?.nombre_producto ?? ''), 'es', { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return Number(a?.id_producto ?? 0) - Number(b?.id_producto ?? 0);
    });

    return filtered;
  }, [productos, search, stockFiltro, estadoFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, sortBy, showInactiveProductos, getCategoriaLabel, getAlmacenLabel, getDeptoLabel, resolveEstadoActivo]);

  const kpis = useMemo(() => {
    const total = Array.isArray(productos) ? productos.length : 0;
    const conStock = (productos || []).filter((p) => getStockMeta(p?.cantidad, p?.stock_minimo).qty > 0).length;
    const stockBajo = (productos || []).filter((p) => getStockMeta(p?.cantidad, p?.stock_minimo).className === 'is-low').length;
    const sinStock = total - conStock;
    // AJUSTE: se agregan KPIs de activas/inactivas con la misma regla de estado.
    const activas = (productos || []).filter((p) => resolveEstadoActivo(p)).length;
    const inactivas = total - activas;
    return { total, conStock, stockBajo, sinStock, activas, inactivas };
  }, [productos, resolveEstadoActivo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(KPI_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setKpiHistory(parsed.slice(-KPI_HISTORY_LIMIT));
          return;
        }
      }

      const legacyRaw = window.localStorage.getItem(KPI_HISTORY_LEGACY_KEY);
      if (!legacyRaw) return;
      const legacyParsed = JSON.parse(legacyRaw);
      if (!Array.isArray(legacyParsed)) return;
      const migrated = legacyParsed.slice(-KPI_HISTORY_LIMIT);
      setKpiHistory(migrated);
      // AJUSTE: migracion de key para no perder historico si aun existe en la key anterior.
      window.localStorage.setItem(KPI_HISTORY_KEY, JSON.stringify(migrated));
    } catch {
      setKpiHistory([]);
    }
  }, [KPI_HISTORY_KEY, KPI_HISTORY_LEGACY_KEY, KPI_HISTORY_LIMIT]);

  useEffect(() => {
    if (loadingProductos || typeof window === 'undefined') return;

    const snapshot = {
      ts: Date.now(),
      total: kpis.total,
      activas: kpis.activas,
      inactivas: kpis.inactivas,
      conStock: kpis.conStock,
      stockBajo: kpis.stockBajo,
      sinStock: kpis.sinStock
    };

    // NUEVO: persistencia de snapshots KPI para sparklines sin soporte histórico del backend.
    setKpiHistory((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const last = base[base.length - 1];
      const isSameAsLast = Boolean(last) && (
        Number(last.total ?? 0) === snapshot.total &&
        Number(last.activas ?? 0) === snapshot.activas &&
        Number(last.inactivas ?? 0) === snapshot.inactivas &&
        Number(last.conStock ?? 0) === snapshot.conStock &&
        Number(last.stockBajo ?? 0) === snapshot.stockBajo &&
        Number(last.sinStock ?? 0) === snapshot.sinStock
      );

      const next = isSameAsLast ? base : [...base, snapshot].slice(-KPI_HISTORY_LIMIT);
      try {
        window.localStorage.setItem(KPI_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // VALIDACION: si localStorage falla, el flujo de KPIs no se interrumpe.
      }
      return next;
    });
  }, [
    KPI_HISTORY_KEY,
    KPI_HISTORY_LIMIT,
    loadingProductos,
    kpis.total,
    kpis.activas,
    kpis.inactivas,
    kpis.conStock,
    kpis.stockBajo,
    kpis.sinStock
  ]);

  const kpiSeries = useMemo(() => {
    const values = Array.isArray(kpiHistory) ? kpiHistory : [];
    return {
      total: values.map((item) => Number(item?.total ?? 0)),
      activas: values.map((item) => Number(item?.activas ?? 0)),
      inactivas: values.map((item) => Number(item?.inactivas ?? 0)),
      conStock: values.map((item) => Number(item?.conStock ?? 0)),
      stockBajo: values.map((item) => Number(item?.stockBajo ?? 0)),
      sinStock: values.map((item) => Number(item?.sinStock ?? 0))
    };
  }, [kpiHistory]);

  const hasActiveFilters = useMemo(() => {
    return (
      search.trim() !== '' ||
      stockFiltro !== 'todos' ||
      estadoFiltro !== 'todos' ||
      categoriaFiltro !== 'todos' ||
      almacenFiltro !== 'todos' ||
      (SHOW_PRODUCTO_DEPARTAMENTOS && deptoFiltro !== 'todos') ||
      sortBy !== 'recientes'
    );
  }, [search, stockFiltro, estadoFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, sortBy]);

  // NEW: contador derivado de filtros activos para reforzar el header del modal de Filtros.
  // WHY: aprovechar el estado actual (filtros live) sin introducir lógica draft adicional.
  // IMPACT: solo UI informativa; no altera cómo se filtra o se ordena el catálogo.
  const activeFiltersCount = useMemo(() => {
    return [
      search.trim() !== '',
      stockFiltro !== 'todos',
      estadoFiltro !== 'todos',
      categoriaFiltro !== 'todos',
      almacenFiltro !== 'todos',
      SHOW_PRODUCTO_DEPARTAMENTOS && deptoFiltro !== 'todos',
      sortBy !== 'recientes'
    ].filter(Boolean).length;
  }, [search, stockFiltro, estadoFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, sortBy]);

  const productosPaginados = productosFiltrados;
  const carouselConfig = useMemo(
    () => getProductosCarouselConfig(carouselViewportWidth),
    [carouselViewportWidth]
  );
  const carouselPages = useMemo(
    () => chunkProductosCarouselPages(productosPaginados, carouselConfig.perPage),
    [carouselConfig.perPage, productosPaginados]
  );
  const carouselPageCount = Math.max(1, carouselPages.length || 0);
  const currentCarouselItems = carouselPages[carouselPageIndex] || [];

  useEffect(() => {
    // NEW: mantiene la pagina actual del carrusel dentro de rango tras filtros o cambios locales.
    // WHY: evitar saltos al inicio y conservar la posicion visual despues de crear/editar/inactivar.
    // IMPACT: el carrusel solo corrige indices invalidos; no dispara refetch ni cambia el orden.
    setCarouselPageIndex((prev) => Math.min(prev, Math.max(0, carouselPageCount - 1)));
  }, [carouselPageCount]);

  // NUEVO: helper de scroll para enfocar paneles abiertos sin cambiar rutas ni navegacion.
  const scrollToSection = useCallback((sectionRef) => {
    if (typeof window === 'undefined') return;
    const node = sectionRef?.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // AJUSTE: Filtros y Nuevo son mutuamente excluyentes para evitar paneles abiertos al mismo tiempo.
  const toggleFiltrosPanel = useCallback(() => {
    const nextOpen = !filtersOpen;
    if (!nextOpen) {
      setFiltersOpen(false);
      return;
    }
    setCreatePanelOpen(false);
    setShowCreateProductoSheet(false);
    setFiltersOpen(true);
    scrollToSection(filtersSectionRef);
  }, [filtersOpen, scrollToSection]);

  // AJUSTE: al abrir Nuevo en desktop se cierran filtros y se enfoca el formulario.
  const toggleNuevoDesktop = useCallback(() => {
    const nextOpen = !createPanelOpen;
    if (!nextOpen) {
      setCreatePanelOpen(false);
      return;
    }
    setFiltersOpen(false);
    setShowCreateProductoSheet(false);
    setCreatePanelOpen(true);
    scrollToSection(createSectionRef);
  }, [createPanelOpen, scrollToSection]);

  // AJUSTE: en mobile, Nuevo abre sheet y cierra filtros para mantener exclusividad.
  const _abrirNuevoMobile = useCallback(() => {
    setFiltersOpen(false);
    setCreatePanelOpen(false);
    setShowCreateProductoSheet(true);
  }, []);

  // NEW: cierre compartido del shell lateral de Filtros/Nuevo cuando se usa overlay.
  // WHY: mantener la UX de drawer lateral consistente con otros submodulos sin tocar la logica interna de formularios.
  // IMPACT: solo controla apertura/cierre visual de paneles de Productos (Filtros/Nuevo).
  const closePanelsDrawer = useCallback(() => {
    setFiltersOpen(false);
    setCreatePanelOpen(false);
  }, []);

  // NEW: flags derivados para unificar apertura de modales auxiliares de Productos.
  // WHY: compartir scroll-lock y shell portal entre `createPanelOpen` y `showCreateProductoSheet`.
  // IMPACT: estado derivado de UI; no modifica flujos de creación/filtros existentes.
  const createProductoModalOpen = createPanelOpen || showCreateProductoSheet;
  const productsAuxModalOpen = filtersOpen || createProductoModalOpen;

  // NEW: bloqueo de scroll del body mientras Filtros/Nuevo están abiertos en overlay.
  // WHY: evitar desplazamiento del fondo y mantener foco visual en el modal activo.
  // IMPACT: solo modifica temporalmente `body.style.overflow`; no toca lógica de CRUD.
  useEffect(() => {
    if (typeof document === 'undefined' || !productsAuxModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [productsAuxModalOpen]);

  // NEW: focus al primer campo inválido del formulario de Nuevo producto.
  // WHY: mejorar UX al mostrar errores existentes sin cambiar reglas de validación.
  // IMPACT: mueve foco solo dentro del modal de alta cuando hay `createErrors`.
  useEffect(() => {
    if (!createProductoModalOpen) return undefined;
    if (!createErrors || Object.keys(createErrors).length === 0) return undefined;
    if (typeof window === 'undefined') return undefined;

    const rafId = window.requestAnimationFrame(() => {
      const firstInvalid = createSectionRef.current?.querySelector?.('.is-invalid');
      if (!firstInvalid || typeof firstInvalid.focus !== 'function') return;
      firstInvalid.focus({ preventScroll: true });
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [createErrors, createProductoModalOpen]);

  useEffect(() => {
    if (!filtersOpen || typeof window === 'undefined') return undefined;
    const rafId = window.requestAnimationFrame(() => {
      if (filtersBodyRef.current) filtersBodyRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [filtersOpen]);

  useEffect(() => {
    if (!createProductoModalOpen || typeof window === 'undefined') return undefined;
    const rafId = window.requestAnimationFrame(() => {
      if (createBodyRef.current) createBodyRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [createProductoModalOpen]);

  useEffect(() => {
    if (!drawerOpen || typeof window === 'undefined') return undefined;
    const rafId = window.requestAnimationFrame(() => {
      if (drawerBodyRef.current) drawerBodyRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [drawerOpen]);

  const resetFiltros = () => {
    setSearch('');
    setStockFiltro('todos');
    // AJUSTE: limpia tambien el nuevo filtro por estado.
    setEstadoFiltro('todos');
    setCategoriaFiltro('todos');
    setAlmacenFiltro('todos');
    setDeptoFiltro('todos');
    setSortBy('recientes');
  };

  const drawerEstadoActivo = selectedProducto ? resolveEstadoActivo(selectedProducto) : true;
  const drawerImageSrc = getProductoImageSrc(selectedProducto);
  const productsAuxDrawerOpen = filtersOpen || createPanelOpen;

  const renderCreateImageField = (className = 'col-12') => (
    <div className={className}>
      <label className="form-label mb-1">Imagen (opcional)</label>
      <div className={`inv-prod-image-field ${createImage.loading ? 'is-loading' : ''}`}>
        <div className={`inv-prod-image-preview ${createImage.previewUrl ? 'has-image' : ''}`} aria-live="polite">
          {createImage.loading ? (
            <div className="inv-prod-image-loading" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando imagen...</span>
            </div>
          ) : createImage.previewUrl ? (
            <img src={createImage.previewUrl} alt="Vista previa del producto" onError={onCreatePreviewError} />
          ) : (
            <div className="inv-prod-image-placeholder">
              <i className="bi bi-image" />
              <span>Sin imagen seleccionada</span>
            </div>
          )}
        </div>

        <div className="inv-prod-image-actions">
          <label className="btn inv-prod-btn-subtle inv-prod-image-picker">
            <input ref={createImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onCreateImageChange} />
            <i className="bi bi-upload" />
            <span>{createImage.previewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
          </label>

          <button
            type="button"
            className="btn inv-prod-btn-outline"
            onClick={clearCreateImage}
            disabled={!createImage.previewUrl && !createImage.error && !createImage.loading}
          >
            Quitar
          </button>
        </div>

        {createImage.error ? (
          <div className="inv-prod-image-feedback is-error">{createImage.error}</div>
        ) : (
          <div className="inv-prod-image-feedback">JPG, PNG o WEBP hasta 6 MB.</div>
        )}
      </div>
    </div>
  );

  // AJUSTE: renderiza cada KPI con sparkline de fondo sin duplicar contenido principal.
  const renderKpiCard = (key, label, value, className = '') => {
    const series = kpiSeries[key] || [];
    const points = buildSparklinePoints(series);

    return (
      <div className={`inv-prod-kpi ${className}`.trim()}>
        {points ? (
          <svg className="inv-prod-kpi-spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} />
          </svg>
        ) : null}
        <div className="inv-prod-kpi-content">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      </div>
    );
  };

  // NEW: helper class para habilitar sticky del header del submódulo Productos.
  // WHY: el sticky requiere un override local de `overflow` en el card contenedor.
  // IMPACT: solo comportamiento visual del header al scrollear; no cambia CRUD ni filtros.
  return (
    <div className="card shadow-sm mb-3 inv-prod-card inv-has-sticky-header">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-bag-check inv-prod-title-icon" />
            <span className="inv-prod-title">Productos</span>
          </div>
          <div className="inv-prod-subtitle">Gestión del Catálogo de Productos</div>
        </div>

        <div className="inv-prod-header-actions">
          {/* NEW: buscador en header como patrón de Categorías/Insumos, reutilizando el mismo estado `search`. */}
          {/* WHY: sacar la búsqueda del modal de filtros y mantener acceso directo sin cambiar la lógica de filtrado. */}
          {/* IMPACT: solo reubica la UI del input; `productosFiltrados` sigue usando `search` igual. */}
          <label className="inv-ins-search inv-prod-header-search" aria-label="Buscar productos">
            <i className="bi bi-search" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
            />
          </label>

          <button
            type="button"
            className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
            // AJUSTE: usa handler dedicado para exclusión mutua con panel Nuevo.
            onClick={toggleFiltrosPanel}
            aria-expanded={filtersOpen}
            aria-controls="inv-prod-filters"
          >
            <i className="bi bi-funnel" />
            <span>Filtros</span>
          </button>

          <button
            type="button"
            className={`inv-prod-toolbar-btn d-none d-md-inline-flex ${createPanelOpen ? 'is-on' : ''}`}
            // AJUSTE: usa handler dedicado para cerrar filtros y hacer scroll al formulario.
            onClick={toggleNuevoDesktop}
            aria-expanded={createPanelOpen}
            aria-controls="inv-prod-create-panel"
          >
            <i className="bi bi-plus-circle" />
            <span>Nuevo</span>
          </button>

          <button
            type="button"
            className="inv-prod-toolbar-btn d-md-none"
            // NEW: en mobile se reutiliza el drawer lateral para mantener el mismo patron visual de Inventario.
            // WHY: estandarizar Nuevo de Productos con el shell derecho (glass/overlay/animacion) sin cambiar el formulario.
            // IMPACT: UI-only; el submit/validaciones del formulario permanecen intactos.
            onClick={toggleNuevoDesktop}
            aria-label="Abrir drawer de crear producto"
          >
            <i className="bi bi-plus-circle" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <div className="inv-prod-kpis">
        {renderKpiCard('total', 'Total', kpis.total)}
        {renderKpiCard('activas', 'Activas', kpis.activas, 'is-ok')}
        {renderKpiCard('inactivas', 'Inactivas', kpis.inactivas, 'is-empty')}
        {renderKpiCard('conStock', 'Con stock', kpis.conStock, 'is-ok')}
        {renderKpiCard('stockBajo', 'Stock bajo', kpis.stockBajo, 'is-low')}
        {renderKpiCard('sinStock', 'Sin stock', kpis.sinStock, 'is-empty')}
      </div>

      <div className="card-body inv-prod-body">
        {error && <div className="alert alert-danger inv-prod-alert">{error}</div>}

        {/* NEW: portal local de Productos para evitar recortes por `overflow/transform` del card contenedor. */}
        {/* WHY: renderizar Filtros y Nuevo sobre `document.body` con overlay completo y animación centrada bottom-up. */}
        {/* IMPACT: solo reemplaza el shell visual de Filtros/Nuevo; handlers, filtros y submit siguen iguales. */}
        {productsModalPortalTarget ? createPortal(
          <>
            <div className={`inv-prod-pmodal inv-prod-pmodal--filters ${filtersOpen ? 'show' : ''}`} aria-hidden={!filtersOpen}>
              <div className="inv-prod-pmodal__overlay" onClick={() => setFiltersOpen(false)} />

              <div className="inv-prod-pmodal__viewport" onClick={() => setFiltersOpen(false)}>
                <section
                  id="inv-prod-filters"
                  ref={filtersSectionRef}
                  className="inv-prod-pmodal__panel inv-prod-pmodal__panel--filters"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="inv-prod-filters-title"
                  aria-describedby="inv-prod-filters-sub"
                  onClick={(e) => e.stopPropagation()}
                >
                  <form
                    className="inv-prod-pmodal__form-shell"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFiltersOpen(false);
                    }}
                  >
                    <div ref={filtersBodyRef} className="inv-prod-pmodal__body inv-prod-pmodal__body--filters">
                      <div className="inv-ins-create-hero inv-ins-filter-hero">
                        <button
                          type="button"
                          className="inv-prod-drawer-close inv-ins-create-hero__close"
                          onClick={() => setFiltersOpen(false)}
                          aria-label="Cerrar filtros"
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                        <div className="inv-ins-create-hero__icon">
                          <i className="bi bi-funnel" aria-hidden="true" />
                        </div>
                        <div className="inv-ins-create-hero__copy">
                          <div id="inv-prod-filters-sub" className="inv-ins-create-hero__kicker">Vista De Filtros</div>
                          <div id="inv-prod-filters-title" className="inv-ins-create-hero__title">
                            Ajusta stock, categoria y orden del catalogo
                          </div>
                        </div>
                        <div className="inv-ins-create-hero__chips">
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-sliders2" aria-hidden="true" />
                            {activeFiltersCount > 0 ? `${activeFiltersCount} Activos` : 'Vista General'}
                          </span>
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-tags" aria-hidden="true" />
                            {categoriaFiltro !== 'todos' ? getCategoriaLabel(categoriaFiltro) : 'Todas Las Categorias'}
                          </span>
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-arrow-down-up" aria-hidden="true" />
                            {PRODUCTO_FILTER_SORT_LABELS[sortBy] || 'Mas recientes'}
                          </span>
                        </div>
                      </div>

                      <div className="inv-prod-pmodal__sections inv-prod-pmodal__sections--filters">
                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Estado y stock</div>
                            <div className="inv-prod-pmodal__section-sub">Filtra disponibilidad y estado del producto.</div>
                          </div>
                          <div className="row g-2 inv-prod-filters-grid">
                            <div className="col-12 col-sm-6">
                              <select className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                                <option value="todos">ESTADOS</option>
                                <option value="activo">Activos</option>
                                <option value="inactivo">Inactivos</option>
                              </select>
                            </div>

                            <div className="col-12 col-sm-6">
                              <select className="form-select" value={stockFiltro} onChange={(e) => setStockFiltro(e.target.value)}>
                                <option value="todos">STOCK</option>
                                <option value="con_stock">Con stock</option>
                                <option value="sin_stock">Sin stock</option>
                              </select>
                            </div>
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Clasificación</div>
                            <div className="inv-prod-pmodal__section-sub">Filtra por categoría, almacén y departamento.</div>
                          </div>
                          <div className="row g-2 inv-prod-filters-grid">
                            <div className="col-12 col-md-4">
                              <select className="form-select" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                                <option value="todos">CATEGORIAS</option>
                                {categoriasActivas.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-12 col-md-4">
                              <select className="form-select" value={almacenFiltro} onChange={(e) => setAlmacenFiltro(e.target.value)}>
                                <option value="todos">ALMACENES</option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                              <div className="col-12 col-md-4">
                                <select className="form-select" value={deptoFiltro} onChange={(e) => setDeptoFiltro(e.target.value)}>
                                  <option value="todos">DEPTOS</option>
                                  {tipoDepartamentos.map((d) => (
                                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Ordenamiento</div>
                            <div className="inv-prod-pmodal__section-sub">El filtrado es inmediato; usa Aplicar para cerrar el modal.</div>
                          </div>
                          <div className="row g-2 inv-prod-filters-grid">
                            <div className="col-12 col-md-6">
                              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="recientes">{'M\u00E1s recientes'}</option>
                                <option value="nombre_asc">Nombre A-Z</option>
                                <option value="nombre_desc">Nombre Z-A</option>
                                <option value="precio_desc">Precio mayor</option>
                                <option value="precio_asc">Precio menor</option>
                                <option value="stock_desc">Stock mayor</option>
                                <option value="stock_asc">Stock menor</option>
                              </select>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__footer">
                      <button
                        className="btn btn-outline-secondary inv-prod-btn-subtle"
                        type="button"
                        onClick={resetFiltros}
                      >
                        Limpiar filtros
                      </button>
                      <button className="btn inv-prod-btn-primary" type="submit">
                        Aplicar
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            </div>

            <div className={`inv-prod-pmodal inv-prod-pmodal--create ${createProductoModalOpen ? 'show' : ''}`} aria-hidden={!createProductoModalOpen}>
              <div className="inv-prod-pmodal__overlay" onClick={closeCreateProductoModal} />

              <div className="inv-prod-pmodal__viewport" onClick={closeCreateProductoModal}>
                <section
                  id="inv-prod-create-panel"
                  ref={createSectionRef}
                  className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="inv-prod-create-title"
                  aria-describedby="inv-prod-create-sub"
                  onClick={(e) => e.stopPropagation()}
                >
                  <form onSubmit={onCrear} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                    <div ref={createBodyRef} className="inv-prod-pmodal__body">
                      <div className="inv-ins-create-hero is-create">
                        <button
                          type="button"
                          className="inv-prod-drawer-close inv-ins-create-hero__close"
                          onClick={closeCreateProductoModal}
                          aria-label="Cerrar nuevo producto"
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                        <div className="inv-ins-create-hero__icon">
                          <i className="bi bi-stars" aria-hidden="true" />
                        </div>
                        <div className="inv-ins-create-hero__copy">
                          <div id="inv-prod-create-sub" className="inv-ins-create-hero__kicker">Nuevo Registro</div>
                          <div id="inv-prod-create-title" className="inv-ins-create-hero__title">Alta Rapida de Producto</div>
                        </div>
                        <div className="inv-ins-create-hero__chips">
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-cash-stack" aria-hidden="true" />
                            {formatMoney(form?.precio || 0)}
                          </span>
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-boxes" aria-hidden="true" />
                            {String(form?.cantidad || '').trim() || '0'} En Inventario
                          </span>
                          <span className="inv-ins-create-hero__chip">
                            <i className="bi bi-tags" aria-hidden="true" />
                            {form?.id_categoria_producto ? getCategoriaLabel(form.id_categoria_producto) : 'Sin Categoria'}
                          </span>
                        </div>
                      </div>

                      <div className="inv-prod-pmodal__sections">
                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Datos principales</div>
                            <div className="inv-prod-pmodal__section-sub">Nombre, categoría y descripción del producto.</div>
                          </div>
                          <div className="row g-2 inv-prod-create-form">
                            <div className="col-12 col-lg-8">
                              <label className="form-label mb-1">Nombre del producto</label>
                              <input
                                className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                                placeholder="Ej: Hamburguesa clásica"
                                value={form.nombre_producto}
                                onChange={(e) => setForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                                required
                              />
                              {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
                            </div>

                            <div className="col-12 col-md-6 col-lg-4">
                              <label className="form-label mb-1">Categoría</label>
                              <select
                                className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                                value={String(form.id_categoria_producto ?? '')}
                                onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                                required
                              >
                                <option value="">Seleccione categoría</option>
                                {categoriasActivas.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                              {createErrors.id_categoria_producto && (
                                <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
                              )}
                            </div>

                            <div className="col-12">
                              <label className="form-label mb-1">Descripción (opcional)</label>
                              <input
                                className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                                placeholder="Ej: Incluye papas y bebida"
                                value={form.descripcion_producto}
                                onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }))}
                              />
                              {createErrors.descripcion_producto && (
                                <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
                              )}
                            </div>
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Inventario</div>
                            <div className="inv-prod-pmodal__section-sub">Cantidad inicial, stock mínimo y ubicación.</div>
                          </div>
                          <div className="row g-2 inv-prod-create-form">
                            <div className="col-12 col-sm-6 col-lg-3">
                              <label className="form-label mb-1">Cantidad</label>
                              <input
                                className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                placeholder="Ej: 10"
                                value={form.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                                required
                              />
                              {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                            </div>

                            <div className="col-12 col-sm-6 col-lg-3">
                              <label className="form-label mb-1">{'Stock m\u00EDnimo'}</label>
                              <input
                                className={`form-control ${createErrors.stock_minimo ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={form.stock_minimo}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) => setForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))}
                              />
                              {createErrors.stock_minimo && <div className="invalid-feedback">{createErrors.stock_minimo}</div>}
                            </div>

                            <div className="col-12 col-md-6 col-lg-3">
                              <label className="form-label mb-1">Almacén</label>
                              <select
                                className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={String(form.id_almacen ?? '')}
                                onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                required
                                disabled={loadingAlmacenes}
                              >
                                <option value="">
                                  {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione almacén'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
                            </div>

                            {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                              <div className="col-12 col-lg-3">
                                <label className="form-label mb-1">Tipo departamento (opcional)</label>
                                <select
                                  className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                                  value={String(form.id_tipo_departamento ?? '')}
                                  onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                                  disabled={loadingTipoDepto}
                                >
                                  <option value="">
                                    {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                                  </option>
                                  {tipoDepartamentos.map((d) => (
                                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                    </option>
                                  ))}
                                </select>
                                {createErrors.id_tipo_departamento && (
                                  <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Precio</div>
                            <div className="inv-prod-pmodal__section-sub">Configura el precio de venta inicial.</div>
                          </div>
                          <div className="row g-2 inv-prod-create-form">
                            <div className="col-12 col-md-6 col-lg-4">
                              <label className="form-label mb-1">Precio</label>
                              <input
                                className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ej: 150.00"
                                value={form.precio}
                                onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                                required
                              />
                              {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
                            </div>
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Fechas</div>
                            <div className="inv-prod-pmodal__section-sub">Campos opcionales de ingreso y caducidad.</div>
                          </div>
                          <div className="row g-2 inv-prod-create-form">
                            <div className="col-12 col-md-6">
                              <label className="form-label mb-1">Fecha ingreso (opcional)</label>
                              <input
                                className={`form-control ${createErrors.fecha_ingreso_producto ? 'is-invalid' : ''}`}
                                type="date"
                                value={form.fecha_ingreso_producto}
                                onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }))}
                              />
                              {createErrors.fecha_ingreso_producto && (
                                <div className="invalid-feedback">{createErrors.fecha_ingreso_producto}</div>
                              )}
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label mb-1">Fecha caducidad (opcional)</label>
                              <input
                                className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                                type="date"
                                value={form.fecha_caducidad}
                                onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                              />
                              {createErrors.fecha_caducidad && <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>}
                            </div>
                          </div>
                        </section>

                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Imagen</div>
                            <div className="inv-prod-pmodal__section-sub">Carga opcional con preview y validación actual.</div>
                          </div>
                          <div className="row g-2 inv-prod-create-form">
                            {renderCreateImageField('col-12')}
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                      <button className="btn inv-prod-btn-subtle" type="button" onClick={resetForm} disabled={creating}>
                        Limpiar
                      </button>
                      <button className="btn inv-prod-btn-subtle" type="button" onClick={closeCreateProductoModal} disabled={creating}>
                        Cancelar
                      </button>
                      <button className="btn inv-prod-btn-primary" type="submit" disabled={creating}>
                        {creating ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            </div>
          </>,
          productsModalPortalTarget
        ) : null}

        {enableLegacyProductosModalShellFallback && (
        <>
        {/* NEW: overlay compartido para drawers de Filtros y Nuevo reutilizando el shell visual de Categorias. */}
        {/* WHY: unificar la experiencia de apertura/cierre lateral en Productos sin tocar el contenido interno. */}
        {/* IMPACT: solo afecta paneles de Filtros/Nuevo; no altera otros modales ni el drawer de detalle. */}
        <div
          // NEW: clase hook exclusiva para separar el overlay de Filtros/Nuevo del drawer de detalle en desktop.
          // WHY: permitir revertir solo el shell desktop de paneles auxiliares sin afectar responsive ni el drawer de detalle.
          // IMPACT: solo agrega selector CSS para estilos por breakpoint; sin cambios funcionales.
          className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop inv-prod-aux-backdrop ${productsAuxDrawerOpen ? 'show' : ''}`}
          onClick={closePanelsDrawer}
          aria-hidden={!productsAuxDrawerOpen}
        />

        {/* FORM CREAR (SOLO DESKTOP/TABLET) */}
        <div
          id="inv-prod-create-panel"
          ref={createSectionRef}
          // NEW: clase hook del panel Nuevo para aplicar look previo solo en desktop mediante media query.
          // WHY: recuperar el estilo ligero anterior en desktop sin tocar el drawer actual de mobile/tablet.
          // IMPACT: UI-only; mantiene handlers, validaciones y submit existentes.
          className={`inv-prod-create-wrap inv-prod-drawer inv-cat-v2__drawer inv-prod-aux-panel ${createPanelOpen ? 'open show' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!createPanelOpen}
        >
          <div className="inv-prod-drawer-head">
            {/* NEW: icono de producto en header del drawer Nuevo con el mismo tratamiento visual del patron. */}
            {/* WHY: reforzar consistencia del shell de Productos con el resto de submodulos sin redisenar el formulario. */}
            {/* IMPACT: decorativo; no modifica el flujo de alta. */}
            <i className="bi bi-bag-check inv-cat-v2__drawer-mark" aria-hidden="true" />
            <div>
              <div className="inv-prod-drawer-title">Nuevo producto</div>
              <div className="inv-prod-drawer-sub">Registro de producto</div>
            </div>
            <button type="button" className="inv-prod-drawer-close" onClick={() => setCreatePanelOpen(false)} aria-label="Cerrar nuevo producto">
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="inv-prod-drawer-body">
            <div className="inv-prod-section-head inv-prod-panel-head">
              <div className="inv-prod-panel-eyebrow">Alta rápida</div>
              <div className="inv-prod-section-title">Registro de producto</div>
              <div className="inv-prod-section-sub">Completa los datos esenciales sin salir del catálogo</div>
            </div>

          {USE_PREMIUM_NEW_FORM ? (
          <form onSubmit={onCrear} className="row g-3 mb-1 inv-prod-create-form inv-prod-create-form-premium">
            <div className="col-12 col-xl-8">
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label mb-1">Nombre del producto</label>
                  <input
                    className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                    placeholder="Ej: Hamburguesa clásica"
                    value={form.nombre_producto}
                    onChange={(e) => setForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                    required
                  />
                  {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Precio</label>
                  <input
                    className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 150.00"
                    value={form.precio}
                    onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                    required
                  />
                  {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Cantidad</label>
                  <input
                    className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    placeholder="Ej: 10"
                    value={form.cantidad}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                    required
                  />
                  {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Stock mínimo</label>
                  <input
                    className={`form-control ${createErrors.stock_minimo ? 'is-invalid' : ''}`}
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    value={form.stock_minimo}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => setForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))}
                  />
                  {createErrors.stock_minimo && <div className="invalid-feedback">{createErrors.stock_minimo}</div>}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Categoría</label>
                  <select
                    className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                    value={String(form.id_categoria_producto ?? '')}
                    onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                    required
                  >
                    <option value="">Seleccione categoría</option>
                    {categoriasActivas.map((c) => (
                      <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                        {c.nombre_categoria}
                      </option>
                    ))}
                  </select>
                  {createErrors.id_categoria_producto && (
                    <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
                  )}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Almacén</label>
                  <select
                    className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                    value={String(form.id_almacen ?? '')}
                    onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                    required
                    disabled={loadingAlmacenes}
                  >
                    <option value="">
                      {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione almacén'}
                    </option>
                    {almacenes.map((a) => (
                      <option key={a.id_almacen} value={a.id_almacen}>
                        {a.nombre} (Sucursal {a.id_sucursal})
                      </option>
                    ))}
                  </select>
                  {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
                </div>

                {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Tipo departamento (opcional)</label>
                    <select
                      className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                      value={String(form.id_tipo_departamento ?? '')}
                      onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                      disabled={loadingTipoDepto}
                    >
                      <option value="">
                        {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                      </option>
                      {tipoDepartamentos.map((d) => (
                        <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                          {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                        </option>
                      ))}
                    </select>
                    {createErrors.id_tipo_departamento && (
                      <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
                    )}
                  </div>
                ) : null}

                <div className="col-12">
                  <label className="form-label mb-1">Descripción (opcional)</label>
                  <input
                    className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                    placeholder="Ej: Incluye papas y bebida"
                    value={form.descripcion_producto}
                    onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }))}
                  />
                  {createErrors.descripcion_producto && (
                    <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label mb-1">Fecha ingreso (opcional)</label>
                  <input
                    className={`form-control ${createErrors.fecha_ingreso_producto ? 'is-invalid' : ''}`}
                    type="date"
                    value={form.fecha_ingreso_producto}
                    onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }))}
                  />
                  {createErrors.fecha_ingreso_producto && (
                    <div className="invalid-feedback">{createErrors.fecha_ingreso_producto}</div>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label mb-1">Fecha caducidad (opcional)</label>
                  <input
                    className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                    type="date"
                    value={form.fecha_caducidad}
                    onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                  />
                  {createErrors.fecha_caducidad && <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>}
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="inv-prod-create-premium-media">
                <div className="inv-prod-create-premium-media-title">Imagen del producto</div>
                {renderCreateImageField('col-12')}
              </div>
            </div>

            <div className="col-12 inv-prod-create-actions-col">
              <div className="inv-prod-create-actions">
                <button className="btn inv-prod-btn-primary" type="submit" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear'}
                </button>
                <button className="btn inv-prod-btn-subtle" type="button" onClick={resetForm} disabled={creating}>
                  Limpiar
                </button>
              </div>
            </div>
          </form>
          ) : (
          <form onSubmit={onCrear} className="row g-2 mb-1 inv-prod-create-form">
            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Nombre del producto</label>
              <input
                className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                placeholder="Ej: Hamburguesa clásica"
                value={form.nombre_producto}
                onChange={(e) => setForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                required
              />
              {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Precio</label>
              <input
                className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 150.00"
                value={form.precio}
                onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                required
              />
              {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Cantidad</label>
              <input
                className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                type="number"
                step="1"
                min="0"
                inputMode="numeric"
                placeholder="Ej: 10"
                value={form.cantidad}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                required
              />
              {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">{'Stock m\u00EDnimo'}</label>
              <input
                className={`form-control ${createErrors.stock_minimo ? 'is-invalid' : ''}`}
                type="number"
                step="1"
                min="0"
                inputMode="numeric"
                value={form.stock_minimo}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))}
              />
              {createErrors.stock_minimo && <div className="invalid-feedback">{createErrors.stock_minimo}</div>}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Categoría</label>
              <select
                className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                value={String(form.id_categoria_producto ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                required
              >
                <option value="">Seleccione categoría</option>
                {categoriasActivas.map((c) => (
                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                    {c.nombre_categoria}
                  </option>
                ))}
              </select>
              {createErrors.id_categoria_producto && (
                <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Almacén</label>
              <select
                className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                value={String(form.id_almacen ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                required
                disabled={loadingAlmacenes}
              >
                <option value="">
                  {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione almacén'}
                </option>
                {almacenes.map((a) => (
                  <option key={a.id_almacen} value={a.id_almacen}>
                    {a.nombre} (Sucursal {a.id_sucursal})
                  </option>
                ))}
              </select>
              {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
            </div>

            {SHOW_PRODUCTO_DEPARTAMENTOS ? (
              <div className="col-12 col-md-3">
                <label className="form-label mb-1">Tipo departamento (opcional)</label>
                <select
                  className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                  value={String(form.id_tipo_departamento ?? '')}
                  onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                  disabled={loadingTipoDepto}
                >
                  <option value="">
                    {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                  </option>
                  {tipoDepartamentos.map((d) => (
                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                    </option>
                  ))}
                </select>
                {createErrors.id_tipo_departamento && (
                  <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
                )}
              </div>
            ) : null}

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha ingreso (opcional)</label>
              <input
                className={`form-control ${createErrors.fecha_ingreso_producto ? 'is-invalid' : ''}`}
                type="date"
                value={form.fecha_ingreso_producto}
                onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }))}
              />
              {createErrors.fecha_ingreso_producto && (
                <div className="invalid-feedback">{createErrors.fecha_ingreso_producto}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha caducidad (opcional)</label>
              <input
                className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                type="date"
                value={form.fecha_caducidad}
                onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
              />
              {createErrors.fecha_caducidad && <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Descripción (opcional)</label>
              <input
                className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                placeholder="Ej: Incluye papas y bebida"
                value={form.descripcion_producto}
                onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }))}
              />
              {createErrors.descripcion_producto && (
                <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
              )}
            </div>

            {renderCreateImageField('col-12 col-md-6')}

            <div className="col-12 col-md-6 inv-prod-create-actions-col">
              <div className="inv-prod-create-actions">
                <button className="btn inv-prod-btn-primary" type="submit" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear'}
                </button>
                <button className="btn inv-prod-btn-subtle" type="button" onClick={resetForm} disabled={creating}>
                  Limpiar
                </button>
              </div>
            </div>
          </form>
          )}
          </div>
        </div>
        </>
        )}

        {/* FILTROS */}
        <div className="inv-prod-results-meta inv-inventory-results-meta">
          <span>{loadingProductos ? 'Cargando productos...' : `${productosFiltrados.length} resultados`}</span>
          <span>{loadingProductos ? '' : `Total: ${productos.length}`}</span>
          {/* NEW: toggle admin para incluir productos inactivos en el GET del tab. */}
          {/* WHY: backend lista solo activos por defecto despues del cambio a soft delete. */}
          {/* IMPACT: recarga usando el mismo endpoint; filtros locales se mantienen. */}
          <label className="form-check form-switch mb-0 inv-catpro-inline-toggle">
            <input
              className="form-check-input"
              type="checkbox"
              checked={showInactiveProductos}
              onChange={(e) => setShowInactiveProductos(e.target.checked)}
            />
            <span className="form-check-label">Ver inactivos</span>
          </label>
          {hasActiveFilters ? (
            <span className="inv-prod-active-filter-pill">
              <span>Filtros activos</span>
              {/* NEW: acceso rápido para resetear todos los filtros desde el resumen. */}
              {/* WHY: reutilizar `resetFiltros` existente sin abrir el panel/modal de filtros. */}
              {/* IMPACT: no cambia la lógica de filtrado; solo agrega un atajo de UX. */}
              <button
                type="button"
                className="inv-prod-active-filter-pill__clear"
                onClick={resetFiltros}
                aria-label="Limpiar filtros"
                title="Limpiar filtros"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>

        {enableLegacyProductosModalShellFallback && (
        <div
          id="inv-prod-filters"
          ref={filtersSectionRef}
          // NEW: clase hook del panel Filtros para revertir el shell solo en desktop.
          // WHY: conservar la experiencia responsive actual y recuperar el formato compacto previo en desktop.
          // IMPACT: visual por breakpoint; no altera filtros ni datos.
          className={`inv-prod-filters inv-prod-drawer inv-cat-v2__drawer inv-prod-aux-panel ${filtersOpen ? 'open show' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!filtersOpen}
        >
          <div className="inv-prod-drawer-head">
            {/* NEW: icono de producto en header del drawer de Filtros para homogeneidad con el shell de Inventario. */}
            {/* WHY: mantener el lenguaje visual unificado entre Filtros/Nuevo en Productos. */}
            {/* IMPACT: solo decorativo; no altera filtros ni consultas locales. */}
            <i className="bi bi-bag-check inv-cat-v2__drawer-mark" aria-hidden="true" />
            <div>
              <div className="inv-prod-drawer-title">Filtros de productos</div>
              <div className="inv-prod-drawer-sub">Stock, estado, categoria, almacen y orden</div>
            </div>
            <button type="button" className="inv-prod-drawer-close" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="inv-prod-drawer-body">
            <div className="inv-prod-panel-head inv-prod-filters-head">
              <div className="inv-prod-panel-eyebrow">Búsqueda avanzada</div>
              <div className="inv-prod-section-title">Filtros y Orden del Catálogo</div>
              <div className="inv-prod-section-sub">Refina resultados por stock, categoría, almacén y departamento</div>
            </div>

          <div className="row g-2 inv-prod-filters-grid">
            <div className="col-12 col-md-4">
              <input
                className="form-control"
                placeholder="Buscar productos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-2">
              <select className="form-select" value={stockFiltro} onChange={(e) => setStockFiltro(e.target.value)}>
                <option value="todos">STOCK</option>
                <option value="con_stock">Con stock</option>
                <option value="sin_stock">Sin stock</option>
              </select>
            </div>

            <div className="col-12 col-md-2">
              <select className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                <option value="todos">ESTADOS</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>

            <div className="col-12 col-md-2">
              <select className="form-select" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                <option value="todos">CATEGORIAS</option>
                {categoriasActivas.map((c) => (
                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                    {c.nombre_categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-2">
              <select className="form-select" value={almacenFiltro} onChange={(e) => setAlmacenFiltro(e.target.value)}>
                <option value="todos">ALMACENES</option>
                {almacenes.map((a) => (
                  <option key={a.id_almacen} value={a.id_almacen}>
                    {a.nombre} (Sucursal {a.id_sucursal})
                  </option>
                ))}
              </select>
            </div>

            {SHOW_PRODUCTO_DEPARTAMENTOS ? (
              <div className="col-12 col-md-2">
                <select className="form-select" value={deptoFiltro} onChange={(e) => setDeptoFiltro(e.target.value)}>
                  <option value="todos">DEPTOS</option>
                  {tipoDepartamentos.map((d) => (
                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="col-12 col-md-2">
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recientes">{'M\u00E1s recientes'}</option>
                <option value="nombre_asc">Nombre A-Z</option>
                <option value="nombre_desc">Nombre Z-A</option>
                <option value="precio_desc">Precio mayor</option>
                <option value="precio_asc">Precio menor</option>
                <option value="stock_desc">Stock mayor</option>
                <option value="stock_asc">Stock menor</option>
              </select>
            </div>

            <div className="col-12 col-md-2 d-grid">
              <button
                className="btn btn-outline-secondary inv-prod-btn-subtle"
                type="button"
                onClick={resetFiltros}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
          </div>
        </div>
        )}

        <div className="inv-prod-catalog-zone">
          {loadingProductos ? (
            <div className="inv-prod-skeleton-grid" role="status" aria-live="polite">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={`sk-${idx}`} className="inv-prod-skeleton-card" />
              ))}
            </div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty inv-prod-empty-rich">
              <i className={`bi ${hasActiveFilters ? 'bi-search' : 'bi-box-seam'}`} />
              <div className="inv-prod-empty-title">
                {hasActiveFilters
                  ? 'No encontramos productos con esos filtros.'
                  : 'Aún no hay productos. Haz clic en ‘Nuevo’ para crear el primero.'}
              </div>
            </div>
          ) : (
            <div className="inv-prod-catalog-shell">
              <div className="inv-prod-carousel-caption">Carrusel de productos</div>
              <div className="inv-prod-carousel-meta">
                <span>{`Pagina ${carouselPageIndex + 1} de ${carouselPageCount}`}</span>
                <span>{`${productosPaginados.length} productos visibles`}</span>
              </div>
              <div className="inv-prod-carousel-stage inv-prod-carousel-stage--paged">
                <button
                  type="button"
                  className={`btn inv-prod-carousel-float is-prev ${carouselPageIndex > 0 ? 'is-visible' : ''}`}
                  aria-label="Pagina anterior del carrusel de productos"
                  onClick={() => setCarouselPageIndex((prev) => Math.max(0, prev - 1))}
                  disabled={carouselPageIndex <= 0}
                >
                  <i className="bi bi-chevron-left" />
                </button>

                <div className={`inv-prod-carousel-page cols-${carouselConfig.columns}`} key={`productos-page-${carouselPageIndex}`}>
                {currentCarouselItems.map((p) => {
                  const cardIsActive = resolveEstadoActivo(p);
                  const estado = resolveEstadoProducto(p);
                  const stock = getStockMeta(p.cantidad, p?.stock_minimo);
                  const imgSrc = getProductoImageSrc(p);
                  const stockMin = Number.parseInt(String(p?.stock_minimo ?? 0), 10);
                  const ratioBase = stockMin > 0 ? stock.qty / (stockMin * 2) : stock.qty / 20;
                  const ratio = Math.max(0, Math.min(1, Number.isNaN(ratioBase) ? 0 : ratioBase));

                  return (
                    <article
                      key={p.id_producto}
                      className={`inv-prod-catalog-card ${estado.className} ${Number(selectedProductoId) === Number(p.id_producto) && drawerOpen ? 'is-selected' : ''} ${removingProductoIds[Number(p.id_producto)] ? 'is-removing' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirDrawerProducto(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          abrirDrawerProducto(p);
                        }
                      }}
                    >
                      <div className="inv-prod-thumb-wrap">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={p?.nombre_producto || 'Producto'}
                            className="inv-prod-thumb"
                            loading="lazy"
                            onError={() => markImageAsError(p?.id_producto)}
                          />
                        ) : (
                          <div className="inv-prod-thumb placeholder">
                            <i className="bi bi-image" />
                            <span>Sin imagen</span>
                          </div>
                        )}
                        <span className={`inv-prod-card-state ${estado.className}`}>{estado.label}</span>
                      </div>

                      <div className="inv-prod-card-body">
                        {/* NEW: icono decorativo centrado dentro del card de producto. */}
                        {/* WHY: replicar el lenguaje visual premium aplicado en Insumos sin alterar el contenido operativo del card. */}
                        {/* IMPACT: solo decoracion visual del card; no modifica acciones, datos ni eventos. */}
                        <div className="inv-prod-card-bg-icon" aria-hidden="true">
                          <i className="bi bi-box-seam" />
                        </div>

                        <div className="inv-prod-card-name">{p?.nombre_producto || 'Producto sin nombre'}</div>
                        <div className="inv-prod-card-category">{getCategoriaLabel(p?.id_categoria_producto)}</div>

                        <div className="inv-prod-card-metrics">
                          <div>
                            <div className="inv-prod-card-label">Precio</div>
                            <div className="inv-prod-card-value">{formatMoney(p?.precio)}</div>
                          </div>
                          <div>
                            <div className="inv-prod-card-label">Existencias</div>
                            <div className="inv-prod-card-value">{Number.parseInt(String(p?.cantidad ?? '0'), 10) || 0}</div>
                          </div>
                        </div>

                        <div className="inv-prod-stock-line">
                          <div className="inv-prod-stock-meta">
                            <div className="inv-prod-stock-ring" style={{ '--stock-ratio': ratio }} />
                            <div className="inv-prod-stock-copy">
                              <span>{stock.label}</span>
                            </div>
                          </div>

                          {/* NEW: CTA de estado dinamico para que el card sea coherente en activos vs. solo inactivos. */}
                          {/* WHY: cuando el producto esta inactivo el usuario debe poder activarlo desde el card sin abrir drawer. */}
                          {/* IMPACT: `Inactivar` conserva el flujo actual (DELETE + confirm); `Activar` reutiliza PUT por campo `estado`. */}
                          <button
                            type="button"
                            className={`btn inv-prod-card-action ${cardIsActive ? 'inactivate' : ''} inv-prod-card-action-compact`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cardIsActive) {
                                openConfirmDelete(p?.id_producto, p?.nombre_producto);
                                return;
                              }
                              void activarProductoDesdeCard(p);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label={`${cardIsActive ? 'Inactivar' : 'Activar'} ${p?.nombre_producto || 'producto'}`}
                            title={`${cardIsActive ? 'Inactivar' : 'Activar'} producto`}
                            disabled={togglingEstado || deleting}
                          >
                            <i className={`bi ${cardIsActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                            <span className="inv-prod-card-action-label">{cardIsActive ? 'Inactivar' : 'Activar'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                </div>

                <button
                  type="button"
                  className={`btn inv-prod-carousel-float is-next ${carouselPageIndex < carouselPageCount - 1 ? 'is-visible' : ''}`}
                  aria-label="Pagina siguiente del carrusel de productos"
                  onClick={() => setCarouselPageIndex((prev) => Math.min(carouselPageCount - 1, prev + 1))}
                  disabled={carouselPageIndex >= carouselPageCount - 1}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE CARDS (LEGACY) */}
        {renderLegacyLayouts ? (
        <div className="d-none inv-prod-mobile-zone">
          {loadingProductos ? (
            <div className="inv-prod-loading" role="status" aria-live="polite">Cargando...</div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2 inv-prod-mobile-list">
              {productosPaginados.map((p, index) => {
                const isEditing = editId === p.id_producto;
                const stockMeta = getStockMeta(p.cantidad, p?.stock_minimo);

                return (
                  <div key={p.id_producto} className={`card border inv-prod-mobile-card ${isEditing ? 'is-editing' : ''}`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {(currentPage - 1) * pageSize + index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : p.nombre_producto}</div>
                          <div className="text-muted small">
                            Categoría: <span className="fw-semibold">{getCategoriaLabel(p.id_categoria_producto)}</span> •
                            Stock: <span className="fw-semibold">{p.cantidad}</span>
                          </div>
                          <div className="text-muted small">
                            Almacén: <span className="fw-semibold">{getAlmacenLabel(p.id_almacen)}</span>
                          </div>
                        </div>

                        <span className={`inv-prod-stock-badge ${stockMeta.className}`}>{stockMeta.label}</span>
                      </div>

                      {/* CAMPOS */}
                      <div className="mb-2">
                        <div className="small text-muted">Nombre</div>
                        {isEditing ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.nombre_producto ? 'is-invalid' : ''}`}
                              value={editForm.nombre_producto}
                              onChange={(e) => setEditForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                            />
                            {editErrors.nombre_producto && <div className="invalid-feedback">{editErrors.nombre_producto}</div>}
                          </>
                        ) : (
                          <div>{p.nombre_producto}</div>
                        )}
                      </div>

                      <div className="row g-2">
                        <div className="col-6">
                          <div className="small text-muted">Precio</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.precio}
                                onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                              />
                              {editErrors.precio && <div className="invalid-feedback">{editErrors.precio}</div>}
                            </>
                          ) : (
                            <div>{p.precio}</div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Cantidad</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) => setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            <div>{p.cantidad}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Categoría</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                                value={String(editForm.id_categoria_producto ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                              >
                                <option value="">Seleccione</option>
                                {categoriasActivas.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_categoria_producto && (
                                <div className="invalid-feedback">{editErrors.id_categoria_producto}</div>
                              )}
                            </>
                          ) : (
                            <div>{getCategoriaLabel(p.id_categoria_producto)}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Almacén</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={String(editForm.id_almacen ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingAlmacenes}
                              >
                                <option value="">
                                  {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            <div>{getAlmacenLabel(p.id_almacen)}</div>
                          )}
                        </div>

                        {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                          <div className="col-12">
                            <div className="small text-muted">Departamento (opcional)</div>
                            {isEditing ? (
                              <>
                                <select
                                  className={`form-select form-select-sm ${editErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                                  value={String(editForm.id_tipo_departamento ?? '')}
                                  onChange={(e) => setEditForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                                  disabled={loadingTipoDepto}
                                >
                                  <option value="">
                                    {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                                  </option>
                                  {tipoDepartamentos.map((d) => (
                                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                    </option>
                                  ))}
                                </select>
                                {editErrors.id_tipo_departamento && (
                                  <div className="invalid-feedback">{editErrors.id_tipo_departamento}</div>
                                )}
                              </>
                            ) : (
                              <div>{getDeptoLabel(p.id_tipo_departamento)}</div>
                            )}
                          </div>
                        ) : null}

                        <div className="col-12">
                          <div className="small text-muted">Descripción (opcional)</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.descripcion_producto ? 'is-invalid' : ''}`}
                                value={editForm.descripcion_producto}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }))}
                              />
                              {editErrors.descripcion_producto && (
                                <div className="invalid-feedback">{editErrors.descripcion_producto}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-muted">{p.descripcion_producto || '-'}</div>
                          )}
                        </div>

                        <div className="col-12">
                          {isEditing ? (
                            <div className="d-flex gap-2 mt-2 inv-prod-actions">
                              <button className="btn btn-sm btn-primary inv-prod-btn-primary" type="button" onClick={guardarEdicion} disabled={savingEdit}>
                                {savingEdit ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button className="btn btn-sm btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={cancelarEdicion} disabled={savingEdit}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 mt-2 inv-prod-actions">
                              <button className="btn btn-sm btn-outline-primary inv-prod-btn-outline" type="button" onClick={() => iniciarEdicion(p)}>
                                <i className="bi bi-pencil-square" /> Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger inv-prod-btn-danger-lite"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                <i className="bi bi-trash3" /> Inactivar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        ) : null}

        {/* DESKTOP TABLE (LEGACY) */}
        {renderLegacyLayouts ? (
        <div className="d-none inv-prod-table-zone">
          {loadingProductos ? (
            <div className="inv-prod-loading" role="status" aria-live="polite">Cargando...</div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty">Sin datos</div>
          ) : (
            <div className="table-responsive inv-prod-table-wrap">
              <table className="table table-sm align-middle inv-prod-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>No.</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Almacén</th>
                    {SHOW_PRODUCTO_DEPARTAMENTOS ? <th>Departamento</th> : null}
                    <th className="text-end">Precio</th>
                    <th className="text-end">Cantidad</th>
                    <th style={{ width: 220 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPaginados.map((p, index) => {
                    const isEditing = editId === p.id_producto;
                    const stockMeta = getStockMeta(p.cantidad, p?.stock_minimo);

                    return (
                      <tr key={p.id_producto} className={isEditing ? 'is-editing' : ''}>
                        <td className="text-muted">{(currentPage - 1) * pageSize + index + 1}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.nombre_producto ? 'is-invalid' : ''}`}
                                value={editForm.nombre_producto}
                                onChange={(e) => setEditForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                              />
                              {editErrors.nombre_producto && <div className="invalid-feedback">{editErrors.nombre_producto}</div>}
                            </>
                          ) : (
                            <div className="fw-semibold">{p.nombre_producto}</div>
                          )}
                          {!isEditing && (
                            <div className="text-muted small">{p.descripcion_producto || '-'}</div>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                                value={String(editForm.id_categoria_producto ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                              >
                                <option value="">Seleccione</option>
                                {categoriasActivas.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_categoria_producto && (
                                <div className="invalid-feedback">{editErrors.id_categoria_producto}</div>
                              )}
                            </>
                          ) : (
                            <span>{getCategoriaLabel(p.id_categoria_producto)}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={String(editForm.id_almacen ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingAlmacenes}
                              >
                                <option value="">
                                  {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            <span>{getAlmacenLabel(p.id_almacen)}</span>
                          )}
                        </td>

                        {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                          <td>
                            {isEditing ? (
                              <>
                                <select
                                  className={`form-select form-select-sm ${editErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                                  value={String(editForm.id_tipo_departamento ?? '')}
                                  onChange={(e) => setEditForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                                  disabled={loadingTipoDepto}
                                >
                                  <option value="">
                                    {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                                  </option>
                                  {tipoDepartamentos.map((d) => (
                                    <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                      {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                    </option>
                                  ))}
                                </select>
                                {editErrors.id_tipo_departamento && (
                                  <div className="invalid-feedback">{editErrors.id_tipo_departamento}</div>
                                )}
                              </>
                            ) : (
                              <span>{getDeptoLabel(p.id_tipo_departamento)}</span>
                            )}
                          </td>
                        ) : null}

                        <td className="text-end">
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm text-end ${editErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.precio}
                                onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                              />
                              {editErrors.precio && <div className="invalid-feedback">{editErrors.precio}</div>}
                            </>
                          ) : (
                            <span className="fw-semibold">{p.precio}</span>
                          )}
                        </td>

                        <td className="text-end">
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm text-end ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) => setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            <span className={`fw-semibold inv-prod-stock-inline ${stockMeta.className}`}>{p.cantidad}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="d-flex gap-2 inv-prod-actions">
                              <button className="btn btn-sm btn-primary inv-prod-btn-primary" type="button" onClick={guardarEdicion} disabled={savingEdit}>
                                {savingEdit ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button className="btn btn-sm btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={cancelarEdicion} disabled={savingEdit}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 inv-prod-actions">
                              <button className="btn btn-sm btn-outline-primary inv-prod-btn-outline" type="button" onClick={() => iniciarEdicion(p)}>
                                <i className="bi bi-pencil-square" /> Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger inv-prod-btn-danger-lite"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                <i className="bi bi-trash3" /> Inactivar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : null}

        {/* NEW: shell glass del drawer de Categorias aplicado al drawer de detalle/edicion de Productos. */}
        {/* WHY: unificar overlay, blur y animacion lateral en todo Inventario sin tocar el contenido del formulario. */}
        {/* IMPACT: cambio solo visual del contenedor del drawer; la logica del detalle/edicion permanece igual. */}
        <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${drawerOpen ? 'show' : ''}`} onClick={cerrarDrawerProducto} />
        <aside className={`inv-prod-drawer inv-cat-v2__drawer inv-ins-drawer inv-ins-drawer--edit ${drawerOpen ? 'show' : ''}`} aria-hidden={!drawerOpen}>
          {selectedProducto ? (
            <>
              <div ref={drawerBodyRef} className="inv-prod-drawer-body inv-ins-drawer-body--edit">
                <div className="inv-ins-create-hero is-edit">
                  <button
                    type="button"
                    className="inv-prod-drawer-close inv-ins-create-hero__close"
                    onClick={cerrarDrawerProducto}
                    aria-label="Cerrar detalle"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                  <div className="inv-ins-create-hero__icon">
                    <i className="bi bi-stars" aria-hidden="true" />
                  </div>
                  <div className="inv-ins-create-hero__copy">
                    <div className="inv-ins-create-hero__kicker">Edicion Activa</div>
                    <div className="inv-ins-create-hero__title">{editForm?.nombre_producto || selectedProducto?.nombre_producto || 'Producto'}</div>
                  </div>
                  <div className="inv-ins-create-hero__chips">
                    <span className="inv-ins-create-hero__chip">
                      <i className="bi bi-cash-stack" aria-hidden="true" />
                      {formatMoney(editForm?.precio ?? selectedProducto?.precio ?? 0)}
                    </span>
                    <span className="inv-ins-create-hero__chip">
                      <i className="bi bi-box-seam" aria-hidden="true" />
                      {getStockMeta(
                        editForm?.cantidad ?? selectedProducto?.cantidad,
                        editForm?.stock_minimo ?? selectedProducto?.stock_minimo
                      ).label}
                    </span>
                    <span className="inv-ins-create-hero__chip">
                      <i className="bi bi-tags" aria-hidden="true" />
                      {getCategoriaLabel(editForm?.id_categoria_producto ?? selectedProducto?.id_categoria_producto)}
                    </span>
                  </div>
                </div>

                <div className="inv-ins-drawer-hero is-edit">
                  <div className="inv-ins-drawer-hero__price">{formatMoney(editForm?.precio ?? selectedProducto?.precio ?? 0)}</div>
                  <span className={`inv-prod-drawer-status-pill ${drawerEstadoActivo ? 'is-active' : 'is-inactive'}`}>
                    {drawerEstadoActivo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="inv-prod-drawer-hero">
                  <div className={`inv-prod-drawer-image ${drawerImageSrc ? '' : 'placeholder'}`}>
                    {drawerImageSrc ? (
                      <img
                        src={drawerImageSrc}
                        alt={selectedProducto?.nombre_producto || 'Producto'}
                        onError={() => markImageAsError(selectedProducto?.id_producto)}
                      />
                    ) : (
                      <div className="inv-prod-drawer-image-empty">
                        <i className="bi bi-image" />
                        <span>Sin imagen</span>
                      </div>
                    )}
                  </div>

                  <div className="inv-prod-drawer-meta">
                    <input
                      ref={drawerImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="d-none"
                      onChange={onDrawerImageChange}
                    />
                    <span className={`inv-prod-drawer-status-pill ${drawerEstadoActivo ? 'is-active' : 'is-inactive'}`}>
                      {drawerEstadoActivo ? 'Activo' : 'Inactivo'}
                    </span>
                    <div className="inv-prod-drawer-image-actions">
                      <button
                        type="button"
                        className="btn inv-prod-btn-subtle"
                        onClick={openDrawerImagePicker}
                        disabled={drawerImageAction.loading}
                      >
                        <i className="bi bi-upload" /> {drawerImageSrc ? 'Cambiar imagen' : 'Agregar imagen'}
                      </button>
                      <button
                        type="button"
                        className="btn inv-prod-btn-outline"
                        onClick={removeDrawerImage}
                        disabled={drawerImageAction.loading || (!drawerImageSrc && !selectedProducto?.id_archivo_imagen_principal)}
                      >
                        Quitar
                      </button>
                    </div>
                    {drawerImageAction.loading ? (
                      <div className="inv-prod-image-feedback">Procesando imagen...</div>
                    ) : drawerImageAction.error ? (
                      <div className="inv-prod-image-feedback is-error">{drawerImageAction.error}</div>
                    ) : (
                      <div className="inv-prod-image-feedback">JPG, PNG o WEBP hasta 6 MB.</div>
                    )}
                  </div>
                </div>

                <div className="inv-prod-drawer-section">
                  <div className="inv-prod-drawer-section-title">Datos editables del producto</div>
                  <div className="inv-prod-drawer-form inv-prod-drawer-form-grid">
                  <div className="inv-prod-drawer-field--span-2">
                    <label>Nombre</label>
                    <input
                      className={editErrors?.nombre_producto ? 'is-invalid' : ''}
                      type="text"
                      value={editForm?.nombre_producto ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }));
                      }}
                    />
                    {editErrors?.nombre_producto ? <div className="invalid-feedback d-block">{editErrors.nombre_producto}</div> : null}
                  </div>
                  <div>
                    <label>Precio (L.)</label>
                    <input
                      className={editErrors?.precio ? 'is-invalid' : ''}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm?.precio ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, precio: e.target.value }));
                      }}
                    />
                    {editErrors?.precio ? <div className="invalid-feedback d-block">{editErrors.precio}</div> : null}
                  </div>
                  <div>
                    <label>Existencias</label>
                    <input
                      className={editErrors?.cantidad ? 'is-invalid' : ''}
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      value={String(editForm?.cantidad ?? '')}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }));
                      }}
                    />
                    {editErrors?.cantidad ? <div className="invalid-feedback d-block">{editErrors.cantidad}</div> : null}
                  </div>
                  <div>
                    <label>{'Stock m\u00EDnimo'}</label>
                    <input
                      className={editErrors?.stock_minimo ? 'is-invalid' : ''}
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      value={String(editForm?.stock_minimo ?? '')}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }));
                      }}
                    />
                    {editErrors?.stock_minimo ? <div className="invalid-feedback d-block">{editErrors.stock_minimo}</div> : null}
                  </div>
                  <div>
                    <label>Categoría</label>
                    <select
                      className={`form-select ${editErrors?.id_categoria_producto ? 'is-invalid' : ''}`}
                      value={String(editForm?.id_categoria_producto ?? '')}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, id_categoria_producto: e.target.value }));
                      }}
                    >
                      <option value="">Seleccione</option>
                      {categoriasActivas.map((c) => (
                        <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                          {c.nombre_categoria}
                        </option>
                      ))}
                    </select>
                    {editErrors?.id_categoria_producto ? <div className="invalid-feedback d-block">{editErrors.id_categoria_producto}</div> : null}
                  </div>
                  <div>
                    <label>Almacén</label>
                    <select
                      className={`form-select ${editErrors?.id_almacen ? 'is-invalid' : ''}`}
                      value={String(editForm?.id_almacen ?? '')}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, id_almacen: e.target.value }));
                      }}
                      disabled={loadingAlmacenes}
                    >
                      <option value="">{loadingAlmacenes ? 'Cargando...' : 'Seleccione'}</option>
                      {almacenes.map((a) => (
                        <option key={a.id_almacen} value={a.id_almacen}>
                          {a.nombre} (Sucursal {a.id_sucursal})
                        </option>
                      ))}
                    </select>
                    {editErrors?.id_almacen ? <div className="invalid-feedback d-block">{editErrors.id_almacen}</div> : null}
                  </div>
                  {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                    <div>
                      <label>Departamento (opcional)</label>
                      <select
                        className={`form-select ${editErrors?.id_tipo_departamento ? 'is-invalid' : ''}`}
                        value={String(editForm?.id_tipo_departamento ?? '')}
                        onChange={(e) => {
                          setDrawerEditMode(true);
                          setEditForm((s) => ({ ...s, id_tipo_departamento: e.target.value }));
                        }}
                        disabled={loadingTipoDepto}
                      >
                        <option value="">{loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}</option>
                        {tipoDepartamentos.map((d) => (
                          <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                            {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                          </option>
                        ))}
                      </select>
                      {editErrors?.id_tipo_departamento ? <div className="invalid-feedback d-block">{editErrors.id_tipo_departamento}</div> : null}
                    </div>
                  ) : null}
                  <div>
                    <label>Fecha de ingreso</label>
                    <input
                      className={editErrors?.fecha_ingreso_producto ? 'is-invalid' : ''}
                      type="date"
                      value={editForm?.fecha_ingreso_producto ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }));
                      }}
                    />
                    {editErrors?.fecha_ingreso_producto ? <div className="invalid-feedback d-block">{editErrors.fecha_ingreso_producto}</div> : null}
                  </div>
                  <div>
                    <label>Fecha de caducidad</label>
                    <input
                      className={editErrors?.fecha_caducidad ? 'is-invalid' : ''}
                      type="date"
                      value={editForm?.fecha_caducidad ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, fecha_caducidad: e.target.value }));
                      }}
                    />
                    {editErrors?.fecha_caducidad ? <div className="invalid-feedback d-block">{editErrors.fecha_caducidad}</div> : null}
                  </div>
                  <div className="inv-prod-drawer-field--span-2">
                    <label>Descripción (opcional)</label>
                    <textarea
                      className={`form-control ${editErrors?.descripcion_producto ? 'is-invalid' : ''}`}
                      rows={4}
                      value={editForm?.descripcion_producto ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }));
                      }}
                    />
                    {editErrors?.descripcion_producto ? <div className="invalid-feedback d-block">{editErrors.descripcion_producto}</div> : null}
                  </div>
                </div>
                </div>

                <div className="inv-prod-drawer-actions inv-prod-drawer-actions--edit inv-ins-drawer-footer">
                  <button type="button" className="btn inv-prod-btn-subtle" onClick={duplicarProductoDesdeDrawer} disabled={togglingEstado}>Duplicar</button>
                  <button
                    type="button"
                    className={`btn ${drawerEstadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                    onClick={toggleEstadoProductoDesdeDrawer}
                    disabled={togglingEstado}
                  >
                    {togglingEstado ? 'Procesando...' : drawerEstadoActivo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" className="btn inv-prod-btn-primary" onClick={guardarEdicion} disabled={savingEdit || togglingEstado}>
                    {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                {drawerMessage ? <div className="inv-prod-drawer-feedback">{drawerMessage}</div> : null}
              </div>
            </>
          ) : null}
        </aside>

        {/* ==============================
            SHEET CREAR PRODUCTO (MÓVIL CENTRADO)
            ============================== */}
        {enableLegacyProductosModalShellFallback && showCreateProductoSheet && (
          <div
            className="modal fade show inv-prod-modal-backdrop"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCreateProductoSheet(false)}
          >
            <div className="modal-dialog modal-dialog-centered inv-prod-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content shadow inv-prod-modal-content">
                <div className="modal-header d-flex align-items-center justify-content-between inv-prod-modal-header">
                  <div>
                    <div className="fw-semibold">Agregar producto</div>
                    <div className="small text-muted">Completa los campos y guarda</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={() => setShowCreateProductoSheet(false)}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>

                <div className="modal-body inv-prod-modal-body">
                  <form onSubmit={onCrear} className="row g-2">
                    <div className="col-12">
                      <label className="form-label mb-1">Nombre</label>
                      <input
                        className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                        value={form.nombre_producto}
                        onChange={(e) => setForm((s) => ({ ...s, nombre_producto: normalizeProductoTextInput('nombre_producto', e.target.value) }))}
                        required
                      />
                      {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">Precio</label>
                      <input
                        className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.precio}
                        onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                        required
                      />
                      {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">Cantidad</label>
                      <input
                        className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        value={form.cantidad}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                        required
                      />
                      {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">{'Stock m\u00EDnimo'}</label>
                      <input
                        className={`form-control ${createErrors.stock_minimo ? 'is-invalid' : ''}`}
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        value={form.stock_minimo}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => setForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))}
                      />
                      {createErrors.stock_minimo && <div className="invalid-feedback">{createErrors.stock_minimo}</div>}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Categoría</label>
                      <select
                        className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                        value={String(form.id_categoria_producto ?? '')}
                        onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                        required
                      >
                        <option value="">Seleccione</option>
                        {categoriasActivas.map((c) => (
                          <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                            {c.nombre_categoria}
                          </option>
                        ))}
                      </select>
                      {createErrors.id_categoria_producto && (
                        <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Almacén</label>
                      <select
                        className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                        value={String(form.id_almacen ?? '')}
                        onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                        required
                        disabled={loadingAlmacenes}
                      >
                        <option value="">
                          {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
                        </option>
                        {almacenes.map((a) => (
                          <option key={a.id_almacen} value={a.id_almacen}>
                            {a.nombre} (Sucursal {a.id_sucursal})
                          </option>
                        ))}
                      </select>
                      {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
                    </div>

                    {SHOW_PRODUCTO_DEPARTAMENTOS ? (
                      <div className="col-12">
                        <label className="form-label mb-1">Tipo departamento (opcional)</label>
                        <select
                          className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                          value={String(form.id_tipo_departamento ?? '')}
                          onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                          disabled={loadingTipoDepto}
                        >
                          <option value="">
                            {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                          </option>
                          {tipoDepartamentos.map((d) => (
                            <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                              {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                            </option>
                          ))}
                        </select>
                        {createErrors.id_tipo_departamento && (
                          <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
                        )}
                      </div>
                    ) : null}

                    <div className="col-12">
                      <label className="form-label mb-1">Descripción (opcional)</label>
                      <input
                        className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                        value={form.descripcion_producto}
                        onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: normalizeProductoTextInput('descripcion_producto', e.target.value) }))}
                      />
                      {createErrors.descripcion_producto && (
                        <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label mb-1">Fecha ingreso (opcional)</label>
                      <input
                        className={`form-control ${createErrors.fecha_ingreso_producto ? 'is-invalid' : ''}`}
                        type="date"
                        value={form.fecha_ingreso_producto}
                        onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }))}
                      />
                      {createErrors.fecha_ingreso_producto && (
                        <div className="invalid-feedback">{createErrors.fecha_ingreso_producto}</div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label mb-1">Fecha caducidad (opcional)</label>
                      <input
                        className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                        type="date"
                        value={form.fecha_caducidad}
                        onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                      />
                      {createErrors.fecha_caducidad && <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>}
                    </div>

                    {renderCreateImageField('col-12')}

                    <div className="col-12 d-grid gap-2 mt-2">
                      <button className="btn btn-primary inv-prod-btn-primary" type="submit" disabled={creating}>
                        {creating ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button className="btn btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={() => setShowCreateProductoSheet(false)} disabled={creating}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==============================
            MODAL CONFIRMAR ELIMINAR
            ============================== */}
        {confirmModal.show && (
          <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
            <div className="inv-pro-confirm-panel inv-pro-confirm-panel--danger" onClick={(e) => e.stopPropagation()}>
              <div className="inv-pro-confirm-glow" aria-hidden="true" />

              <div className="inv-pro-confirm-head">
                <div className="inv-pro-confirm-head-main">
                  <div className="inv-pro-confirm-head-icon">
                    <i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" />
                  </div>
                  <div className="inv-pro-confirm-head-copy">
                    {/* NEW: etiqueta de contexto para que el modal deje claro el módulo afectado. */}
                    {/* WHY: reforzar orientación visual sin cambiar los textos de confirmación ya unificados. */}
                    {/* IMPACT: solo mejora jerarquía del encabezado del modal. */}
                    <div className="inv-pro-confirm-kicker">Productos</div>
                    <div className="inv-pro-confirm-title">{INACTIVATE_CONFIRM_COPY.title}</div>
                    <div className="inv-pro-confirm-sub">{INACTIVATE_CONFIRM_COPY.subtitle}</div>
                  </div>
                </div>
                <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar" disabled={deleting}>
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="inv-pro-confirm-body">
                {/* NEW: aviso breve con tono operativo para explicar el resultado de la acción. */}
                {/* WHY: el usuario pidió un modal más profesional; este bloque aporta claridad sin recargar el contenido. */}
                {/* IMPACT: solo agrega contexto visual al confirmar la inactivación. */}
                <div className="inv-pro-confirm-note">
                  <i className="bi bi-shield-exclamation" aria-hidden="true" />
                  <span>El producto pasará a la vista de inactivos y podrá activarse nuevamente después.</span>
                </div>

                <div className="inv-pro-confirm-question">{INACTIVATE_CONFIRM_COPY.question}</div>

                <div className="inv-pro-confirm-name">
                  <div className="inv-pro-confirm-name-label">Registro seleccionado</div>
                  <div className="inv-pro-confirm-name-value">
                    <i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" />
                    <span>{confirmModal.nombre || INACTIVATE_CONFIRM_COPY.fallbackName}</span>
                  </div>
                </div>

                {confirmDeleteError ? (
                  <div className="alert alert-danger inv-pro-confirm-error mb-0" role="alert">
                    {confirmDeleteError}
                  </div>
                ) : null}
              </div>

              <div className="inv-pro-confirm-footer">
                <button className="btn inv-pro-btn-cancel" type="button" onClick={closeConfirmDelete} disabled={deleting}>
                  Cancelar
                </button>
                <button className="btn inv-pro-btn-danger" type="button" onClick={eliminarConfirmado} disabled={deleting}>
                  <i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" />
                  <span>{deleting ? 'Inactivando...' : 'Inactivar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProductosTab;


