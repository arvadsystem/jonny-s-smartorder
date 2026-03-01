import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import { toUpperSafe } from '../../../utils/toUpperSafe';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  resolveInventarioImageUrl,
  revokeInventarioObjectUrl
} from '../../../utils/inventarioImagenes';

const DEFAULT_FILTERS = Object.freeze({ estados: [], almacen: 'todos', categoria: 'todos', sortBy: 'recientes' });
const STATUS_CHIPS = [
  { key: 'existencia', label: 'En existencia' },
  { key: 'bajo', label: 'Stock bajo' },
  { key: 'sin_stock', label: 'Sin stock' },
  { key: 'inactivo', label: 'Inactivo' }
];
const SORTS = [
  ['recientes', 'Mas recientes'],
  ['nombre_asc', 'Nombre A-Z'],
  ['nombre_desc', 'Nombre Z-A'],
  ['precio_desc', 'Precio mayor'],
  ['precio_asc', 'Precio menor'],
  ['stock_desc', 'Stock mayor'],
  ['stock_asc', 'Stock menor'],
  ['cad_asc', 'Caducidad proxima']
];
const INSUMOS_LIST_PAGE_SIZE = 10;
const DETAIL_SECTION_DEFAULT = 'summary';
const INSUMO_DB_INT32_MAX = 2147483647;

const getInsumosCarouselConfig = (viewportWidth) => {
  if (viewportWidth >= 1280) return { perPage: 6, columns: 3 };
  if (viewportWidth >= 768) return { perPage: 4, columns: 2 };
  return { perPage: 2, columns: 1 };
};

const chunkInsumosCarouselPages = (items, pageSize) => {
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
// IMPACT: solo estandariza el modal de confirmacion; no altera CRUD, filtros ni cards de Insumos.
const INACTIVATE_CONFIRM_COPY = Object.freeze({
  title: 'Confirmar inactivación',
  subtitle: 'Este registro quedará marcado como inactivo',
  question: '¿Deseas inactivar este registro?',
  fallbackName: 'Registro seleccionado',
  iconClass: 'bi bi-slash-circle'
});

// NEW: campos de texto elegibles para mayúsculas automáticas en formularios de Insumos.
// WHY: aplicar la regla con whitelist local y evitar afectar números, fechas o selects.
// IMPACT: `setField` usa esta whitelist en create/edit sin alterar validaciones ni payloads.
const UPPERCASE_INSUMO_FIELDS = new Set(['nombre_insumo', 'descripcion']);

const buildDrawerImageState = (previewUrl = '') => ({
  file: null,
  previewUrl: String(previewUrl || ''),
  loading: false,
  error: ''
});

const emptyForm = () => ({
  nombre_insumo: '',
  precio: '',
  cantidad: '',
  stock_minimo: '0',
  fecha_ingreso_insumo: '',
  id_almacen: '',
  // NEW: categoria de insumo editable en alta/edicion, alineada con la FK real `insumos.id_categoria_insumo`.
  // WHY: permitir asignar categorias de insumos desde el frontend sin inventar campos nuevos.
  // IMPACT: payloads de create/edit incluiran `id_categoria_insumo` solo cuando se seleccione.
  id_categoria_insumo: '',
  // NEW: la BD real ya incluye `insumos.id_unidad_medida`.
  // WHY: permitir seleccionar la unidad operativa del insumo desde el formulario.
  // IMPACT: el payload frontend se alinea con la FK real sin tocar otros submodulos.
  id_unidad_medida: '',
  fecha_caducidad: '',
  descripcion: ''
});

const cloneFilters = (f) => ({ ...DEFAULT_FILTERS, ...(f || {}), estados: Array.isArray(f?.estados) ? [...f.estados] : [] });
const toDateInputValue = (v) => (!v ? '' : String(v).includes('T') ? String(v).split('T')[0] : String(v));
const parseIntSafe = (v, fb = 0) => { const n = Number.parseInt(String(v ?? ''), 10); return Number.isNaN(n) ? fb : n; };
const parseFloatSafe = (v, fb = 0) => { const n = Number.parseFloat(String(v ?? '')); return Number.isNaN(n) ? fb : n; };
const fmtMoney = (v) => `L. ${parseFloatSafe(v, 0).toFixed(2)}`;
const normalize = (v) => String(v ?? '').trim().toLowerCase();
const sanitizeSpaces = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));

const dateLabel = (v) => {
  const d = toDateInputValue(v);
  if (!d) return 'Sin caducidad';
  if (!isDate(d)) return d;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const boolish = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = normalize(v);
  if (!s) return null;
  if (['1', 'true', 'activo', 'active', 'si', 'yes'].includes(s)) return true;
  if (['0', 'false', 'inactivo', 'inactive', 'no'].includes(s)) return false;
  return null;
};

// NEW: helper visual para mini-grafica tipo Productos en stat cards de Inventario.
// WHY: reutilizar el mismo estilo de sparkline en dashboards de Insumos sin dependencias nuevas.
// IMPACT: solo afecta la presentacion del dashboard; no modifica datos ni filtros.
const buildInventorySparkPoints = (series, width = 120, height = 44, padding = 4) => {
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
};

const getStatusUi = (activo, cantidad, stockMin) => {
  if (!activo) {
    return { key: 'inactivo', badge: 'INACTIVO', badgeClass: 'is-inactive', cardClass: 'is-inactive', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-subtle' };
  }
  if (cantidad <= 0) {
    return { key: 'sin_stock', badge: 'SIN STOCK', badgeClass: 'is-out', cardClass: 'is-out', primary: 'Reabastecer', primaryBtn: 'inv-prod-btn-primary' };
  }
  if (cantidad <= stockMin) {
    return { key: 'bajo', badge: 'STOCK BAJO', badgeClass: 'is-low', cardClass: 'is-low', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-outline' };
  }
  return { key: 'existencia', badge: 'EN EXISTENCIA', badgeClass: 'is-ok', cardClass: 'is-ok', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-outline' };
};

const getStockPriorityRank = (snap) => {
  if (!snap || snap.cantidad <= 0) return 0;
  if (snap.ui?.key === 'bajo') return 1;
  return 2;
};

const InsumosTab = ({ openToast, categorias = [], categoriasInsumos = [] }) => {
  const safeToast = useCallback((title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  }, [openToast]);

  const [insumos, setInsumos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [loadingUnidadesMedida, setLoadingUnidadesMedida] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));
  const [draftFilters, setDraftFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));
  // NEW: toggle admin para incluir insumos inactivos en el GET del tab de Inventario.
  // WHY: backend devuelve activos por defecto tras cambiar DELETE => inactivar.
  // IMPACT: solo afecta la fuente del listado; filtros locales siguen iguales.
  const [showInactiveInsumos, setShowInactiveInsumos] = useState(false);
  // NEW: estado dedicado para el modal de detalle del listado.
  // WHY: permitir "Ver" sin reutilizar el drawer de edicion ni alterar el flujo existente del formulario.
  // IMPACT: solo agrega una capa de lectura; CRUD y drawer actual siguen intactos.
  const [detailInsumoId, setDetailInsumoId] = useState(null);
  // NEW: seccion activa del modal de detalle segmentado.
  // WHY: ordenar la informacion por bloques sin saturar el modal con todo visible a la vez.
  // IMPACT: solo afecta presentacion/lectura del detalle; no modifica datos ni handlers.
  const [detailSection, setDetailSection] = useState(DETAIL_SECTION_DEFAULT);
  // NEW: paginacion frontend del listado de Insumos.
  // WHY: mantener la tabla limpia con 10 filas por pagina sin tocar el backend.
  // IMPACT: se aplica despues de filtros/orden actual; cards y endpoints no cambian.
  const [listPage, setListPage] = useState(1);
  const [carouselPageIndex, setCarouselPageIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));

  const [drawer, setDrawer] = useState(null); // null | filters | form
  const [drawerMode, setDrawerMode] = useState('create'); // create | edit
  const [selectedId, setSelectedId] = useState(null);
  const [drawerMsg, setDrawerMsg] = useState('');
  const [focusCantidad, setFocusCantidad] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [createErrors, setCreateErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingEstado, setTogglingEstado] = useState(false);
  const [togglingEstadoId, setTogglingEstadoId] = useState(null);
  const [localEstadoMap, setLocalEstadoMap] = useState({});
  const [drawerImage, setDrawerImage] = useState(() => buildDrawerImageState());
  const [imageErrorMap, setImageErrorMap] = useState({});

  const [confirmModal, setConfirmModal] = useState({ show: false, idToDelete: null, nombre: '' });
  const [deleting, setDeleting] = useState(false);

  const cantidadInputRef = useRef(null);
  const nombreInputRef = useRef(null);
  const drawerImageInputRef = useRef(null);
  // NEW: secuencia local de IDs temporales int32-safe para create sin respuesta con `id_insumo`.
  // WHY: evitar recargar la grilla completa solo para reflejar el nuevo insumo mientras llega una sync silenciosa.
  // IMPACT: los IDs temporales viven solo en frontend y se reemplazan al sincronizar.
  const tempInsumoIdSeqRef = useRef(-1);

  const categoriasMap = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(categorias) ? categorias : []) m.set(String(c?.id_categoria_producto), c);
    return m;
  }, [categorias]);

  // NEW: mapa local de categorías de insumos para labels y selects del formulario.
  // WHY: `insumos.id_categoria_insumo` referencia un catálogo distinto al de categorías de productos.
  // IMPACT: solo mejora labels/selects en Insumos; no altera otras pantallas.
  const categoriasInsumosMap = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(categoriasInsumos) ? categoriasInsumos : []) m.set(String(c?.id_categoria_insumo), c);
    return m;
  }, [categoriasInsumos]);

  // NEW: categorias activas para selects/filtros que dependen del catalogo compartido.
  // WHY: ocultar categorias inactivas en otros submodulos sin afectar labels historicos.
  // IMPACT: `categoriasMap` conserva todas para mostrar etiquetas; los selects usan solo activas.
  const categoriasActivas = useMemo(() => {
    const isActive = (categoria) => {
      const parsed = boolish(categoria?.estado);
      if (parsed === null) return categoria?.estado === undefined || categoria?.estado === null || categoria?.estado === '';
      return parsed;
    };
    return (Array.isArray(categorias) ? categorias : []).filter(isActive);
  }, [categorias]);

  const categoriasInsumosActivas = useMemo(() => {
    const isActive = (categoria) => {
      const parsed = boolish(categoria?.estado);
      if (parsed === null) return categoria?.estado === undefined || categoria?.estado === null || categoria?.estado === '';
      return parsed;
    };
    return (Array.isArray(categoriasInsumos) ? categoriasInsumos : []).filter(isActive);
  }, [categoriasInsumos]);

  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) m.set(String(a?.id_almacen), a);
    return m;
  }, [almacenes]);

  const unidadesMedidaMap = useMemo(() => {
    const m = new Map();
    for (const unidad of Array.isArray(unidadesMedida) ? unidadesMedida : []) {
      m.set(String(unidad?.id_unidad_medida), unidad);
    }
    return m;
  }, [unidadesMedida]);

  const getAlmacenLabel = useCallback((id) => {
    const a = almacenesMap.get(String(id));
    return a ? `${a.nombre} (Sucursal ${a.id_sucursal})` : `Almacen ID #${String(id || '-')}`;
  }, [almacenesMap]);

  const getUnidadMedidaLabel = useCallback((id) => {
    const unidad = unidadesMedidaMap.get(String(id));
    if (!unidad) return String(id || '').trim() ? `Unidad #${id}` : 'Sin unidad';
    const nombre = String(unidad?.nombre || '').trim();
    const simbolo = String(unidad?.simbolo || '').trim();
    if (nombre && simbolo) return `${nombre} (${simbolo})`;
    return nombre || simbolo || 'Sin unidad';
  }, [unidadesMedidaMap]);

  const estadoField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'estado'))) return 'estado';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'activo'))) return 'activo';
    return null;
  }, [insumos]);

  const categoriaField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria_insumo'))) return 'id_categoria_insumo';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria'))) return 'id_categoria';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria_producto'))) return 'id_categoria_producto';
    return null;
  }, [insumos]);

  const categoriaLabelField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'nombre_categoria'))) return 'nombre_categoria';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'categoria'))) return 'categoria';
    return null;
  }, [insumos]);

  const resolveActivo = useCallback((insumo) => {
    if (!insumo) return true;
    if (typeof localEstadoMap[insumo?.id_insumo] === 'boolean') return localEstadoMap[insumo.id_insumo];
    if (!estadoField) return true;
    const parsed = boolish(insumo?.[estadoField]);
    return parsed === null ? Boolean(insumo?.[estadoField]) : parsed;
  }, [estadoField, localEstadoMap]);

  const getCategoriaValue = useCallback((insumo) => (!categoriaField || !insumo ? '' : String(insumo?.[categoriaField] ?? '')), [categoriaField]);

  const getCategoriaLabel = useCallback((insumo) => {
    if (!insumo) return '';
    if (categoriaLabelField) {
      const raw = String(insumo?.[categoriaLabelField] ?? '').trim();
      if (raw) return raw;
    }
    if (!categoriaField) return '';
    const id = insumo?.[categoriaField];
    if (categoriaField === 'id_categoria_producto') {
      const c = categoriasMap.get(String(id));
      if (c?.nombre_categoria) return String(c.nombre_categoria);
    }
    if (categoriaField === 'id_categoria_insumo') {
      const c = categoriasInsumosMap.get(String(id));
      if (c?.nombre_categoria) return String(c.nombre_categoria);
    }
    return id !== undefined && id !== null && String(id).trim() !== '' ? `Categoria #${id}` : '';
  }, [categoriaField, categoriaLabelField, categoriasInsumosMap, categoriasMap]);

  const snapshot = useCallback((insumo) => {
    const cantidad = Math.max(0, parseIntSafe(insumo?.cantidad, 0));
    const stockMin = Math.max(0, parseIntSafe(insumo?.stock_minimo, 0));
    const activo = resolveActivo(insumo);
    return { cantidad, stockMin, activo, ui: getStatusUi(activo, cantidad, stockMin) };
  }, [resolveActivo]);

  const getInsumoImageSrc = useCallback((insumo) => {
    if (!insumo) return '';
    const insumoId = insumo?.id_insumo;
    if (imageErrorMap[insumoId]) return '';
    return resolveInventarioImageUrl(
      insumo?.imagen_principal_url || insumo?.imagen_url || insumo?.imagen || insumo?.url_publica || ''
    );
  }, [imageErrorMap]);

  const clearInsumoImageError = useCallback((insumoId) => {
    if (!insumoId) return;
    setImageErrorMap((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, insumoId)) return prev;
      const next = { ...prev };
      delete next[insumoId];
      return next;
    });
  }, []);

  const markInsumoImageAsError = useCallback((insumoId) => {
    if (!insumoId) return;
    setImageErrorMap((prev) => (prev[insumoId] ? prev : { ...prev, [insumoId]: true }));
  }, []);

  // NEW: helpers locales para mutar la grilla/listado sin recargar visiblemente todo el dataset.
  // WHY: alinear el comportamiento de Insumos con Productos/Categorias, donde los cambios se reflejan en caliente.
  // IMPACT: CRUD mantiene la misma API; solo cambia la sincronizacion de `insumos` en frontend.
  const parseInsumoPersistedId = useCallback((rawId) => {
    const parsed = Number.parseInt(String(rawId ?? ''), 10);
    if (!Number.isSafeInteger(parsed)) return null;
    if (parsed <= 0) return null;
    if (parsed > INSUMO_DB_INT32_MAX) return null;
    return parsed;
  }, []);

  const nextTempInsumoId = useCallback(() => {
    const nextId = tempInsumoIdSeqRef.current;
    tempInsumoIdSeqRef.current -= 1;
    return nextId;
  }, []);

  const patchInsumoLocalById = useCallback((id, patch) => {
    if (!id || !patch || typeof patch !== 'object') return;
    setInsumos((prev) => prev.map((item) => (
      Number(item?.id_insumo) === Number(id)
        ? { ...item, ...patch }
        : item
    )));
  }, []);

  const upsertInsumoLocal = useCallback((insumo) => {
    if (!insumo || typeof insumo !== 'object') return;
    const insumoId = Number(insumo?.id_insumo);
    setInsumos((prev) => {
      const index = prev.findIndex((item) => Number(item?.id_insumo) === insumoId);
      if (index === -1) return [insumo, ...prev];
      const next = [...prev];
      next[index] = { ...prev[index], ...insumo };
      return next;
    });
  }, []);

  const syncInsumosSilently = useCallback(async () => {
    try {
      const data = await inventarioService.getInsumos({ incluirInactivos: true });
      if (!Array.isArray(data)) return false;
      setInsumos(data);
      return true;
    } catch (syncError) {
      if (import.meta.env.DEV) {
        console.error('INSUMOS syncInsumosSilently error:', syncError);
      }
      return false;
    }
  }, []);

  const buildLocalInsumoFromCreate = useCallback((cleaned, createResponse, uploadedImage = null) => {
    const directResponse = createResponse && typeof createResponse === 'object' && !Array.isArray(createResponse)
      ? createResponse
      : null;
    const nestedInsumo = directResponse?.insumo && typeof directResponse.insumo === 'object'
      ? directResponse.insumo
      : null;
    const nestedDataInsumo = directResponse?.data?.insumo && typeof directResponse.data.insumo === 'object'
      ? directResponse.data.insumo
      : null;
    const nestedData = directResponse?.data && typeof directResponse.data === 'object' && !Array.isArray(directResponse.data)
      ? directResponse.data
      : null;

    const apiInsumo =
      [nestedInsumo, nestedDataInsumo, nestedData, directResponse]
        .find((candidate) => candidate && (candidate.id_insumo || candidate.nombre_insumo)) || null;

    const persistedId = parseInsumoPersistedId(
      apiInsumo?.id_insumo ?? directResponse?.id_insumo ?? directResponse?.insertId ?? directResponse?.id
    );
    const safeId = persistedId ?? nextTempInsumoId();

    return {
      nombre_insumo: cleaned.nombre_insumo,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad,
      stock_minimo: cleaned.stock_minimo,
      fecha_ingreso_insumo: cleaned.fecha_ingreso_insumo || '',
      id_almacen: cleaned.id_almacen,
      id_categoria_insumo: cleaned.id_categoria_insumo,
      id_unidad_medida: cleaned.id_unidad_medida,
      fecha_caducidad: cleaned.fecha_caducidad || '',
      descripcion: cleaned.descripcion || '',
      estado: true,
      ...(uploadedImage || {}),
      ...(apiInsumo || {}),
      id_insumo: persistedId ?? safeId,
      __local_temp_id: persistedId === null
    };
  }, [nextTempInsumoId, parseInsumoPersistedId]);

  // NEW: validacion centralizada para create/edit con reglas consistentes.
  // WHY: evitar diferencias entre alta y edicion y bloquear submit invalido.
  // IMPACT: no cambia endpoints; solo mejora UX y consistencia del frontend.
  const validarInsumo = useCallback((data) => {
    const errors = {};
    const nombre = sanitizeSpaces(data?.nombre_insumo);
    const descripcion = sanitizeSpaces(data?.descripcion);
    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    const stockRaw = String(data?.stock_minimo ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();
    const categoriaInsumoRaw = String(data?.id_categoria_insumo ?? '').trim();
    const unidadMedidaRaw = String(data?.id_unidad_medida ?? '').trim();
    const ingreso = String(data?.fecha_ingreso_insumo ?? '').trim();
    const cad = String(data?.fecha_caducidad ?? '').trim();
    const precio = Number.parseFloat(precioRaw);
    const cantidad = Number.parseInt(cantidadRaw, 10);
    const stock_minimo = Number.parseInt(stockRaw, 10);
    const id_almacen = Number.parseInt(almacenRaw, 10);
    const id_categoria_insumo = Number.parseInt(categoriaInsumoRaw, 10);
    const id_unidad_medida = Number.parseInt(unidadMedidaRaw, 10);

    if (nombre.length < 2) errors.nombre_insumo = 'MINIMO 2 CARACTERES';
    else if (nombre.length > 80) errors.nombre_insumo = 'MAXIMO 80 CARACTERES';
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NUMERO >= 0';
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';
    if (!stockRaw) errors.stock_minimo = 'EL STOCK MINIMO ES OBLIGATORIO';
    else if (!/^\d+$/.test(stockRaw)) errors.stock_minimo = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(stock_minimo) || stock_minimo < 0) errors.stock_minimo = 'DEBE SER UN ENTERO >= 0';
    if (!almacenRaw) errors.id_almacen = 'EL ALMACEN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'DEBE SER UN NUMERO > 0';
    // NEW: categoria de insumo opcional con validacion defensiva cuando se envia.
    // WHY: permitir asignar FK real sin romper registros legacy que aun no tengan categoria.
    // IMPACT: solo bloquea valores no numericos/invalidos en frontend.
    if (categoriaInsumoRaw && (Number.isNaN(id_categoria_insumo) || id_categoria_insumo <= 0)) {
      errors.id_categoria_insumo = 'SELECCIONA UNA CATEGORIA VALIDA';
    }
    // NEW: unidad de medida opcional alineada con la FK real de BD.
    // WHY: permitir insumos sin unidad legacy, pero validar correctamente cuando el usuario selecciona una.
    // IMPACT: el formulario envia `id_unidad_medida` solo con IDs validos.
    if (unidadMedidaRaw && (Number.isNaN(id_unidad_medida) || id_unidad_medida <= 0)) {
      errors.id_unidad_medida = 'SELECCIONA UNA UNIDAD VALIDA';
    }
    if (descripcion.length > 150) errors.descripcion = 'MAXIMO 150 CARACTERES';
    if (ingreso && !isDate(ingreso)) errors.fecha_ingreso_insumo = 'FORMATO INVALIDO (YYYY-MM-DD)';
    if (cad && !isDate(cad)) errors.fecha_caducidad = 'FORMATO INVALIDO (YYYY-MM-DD)';
    if (!errors.fecha_ingreso_insumo && ingreso) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (ingreso > today) errors.fecha_ingreso_insumo = 'NO PUEDE SER FECHA FUTURA';
    }
    if (!errors.fecha_ingreso_insumo && !errors.fecha_caducidad && ingreso && cad && cad < ingreso) {
      errors.fecha_caducidad = 'DEBE SER >= FECHA DE INGRESO';
    }
    // NEW: no se fuerza stock_minimo <= cantidad.
    // WHY: un stock minimo mayor a la existencia actual representa un faltante valido.
    // IMPACT: se permiten escenarios reales de reposicion sin romper compatibilidad.
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        nombre_insumo: nombre,
        precio,
        cantidad,
        stock_minimo,
        id_almacen,
        id_categoria_insumo: categoriaInsumoRaw && !Number.isNaN(id_categoria_insumo) && id_categoria_insumo > 0 ? id_categoria_insumo : null,
        id_unidad_medida: unidadMedidaRaw && !Number.isNaN(id_unidad_medida) && id_unidad_medida > 0 ? id_unidad_medida : null,
        fecha_ingreso_insumo: ingreso,
        fecha_caducidad: cad,
        descripcion
      }
    };
  }, []);

  const buildPayload = useCallback((c) => {
    const payload = { nombre_insumo: c.nombre_insumo, precio: c.precio, cantidad: c.cantidad, stock_minimo: c.stock_minimo, id_almacen: c.id_almacen };
    // NEW: enviar `id_categoria_insumo` solo si el usuario selecciono una categoria valida.
    // WHY: mantener compatibilidad con payloads legacy evitando mandar strings vacios/null innecesarios.
    // IMPACT: el backend recibe la FK real cuando se usa el nuevo select; resto del payload no cambia.
    if (c.id_categoria_insumo) payload.id_categoria_insumo = c.id_categoria_insumo;
    if (c.id_unidad_medida) payload.id_unidad_medida = c.id_unidad_medida;
    if (c.descripcion) payload.descripcion = c.descripcion;
    if (c.fecha_ingreso_insumo) payload.fecha_ingreso_insumo = c.fecha_ingreso_insumo;
    if (c.fecha_caducidad) payload.fecha_caducidad = c.fecha_caducidad;
    return payload;
  }, []);

  const apiError = useCallback((e, fallback, setFieldErrors) => {
    const data = e?.data;
    const msg = String((data && typeof data === 'object' && (data.message || data.mensaje)) || e?.message || fallback || 'ERROR');
    if (typeof setFieldErrors === 'function' && data?.errors && typeof data.errors === 'object') {
      const mapped = {};
      for (const [k, v] of Object.entries(data.errors)) mapped[k] = String(Array.isArray(v) ? v[0] : v || '').toUpperCase();
      setFieldErrors((prev) => ({ ...prev, ...mapped }));
    }
    const s = Number(e?.status || 0);
    safeToast(s === 401 ? 'SESION EXPIRADA' : s === 403 ? 'SIN PERMISOS' : s === 400 ? 'VALIDACION' : 'ERROR', msg, s >= 500 ? 'danger' : (s === 400 || s === 401 || s === 403 ? 'warning' : 'danger'));
    return msg;
  }, [safeToast]);

  // NEW: unifica el toast de éxito para inactivación de insumos entre el modal (desktop) y el botón de estado del drawer (responsive).
  // WHY: responsive usa `toggleEstado` (PUT) y desktop usa `deleteConfirmed` (DELETE), lo que generaba feedback distinto.
  // IMPACT: solo normaliza el mensaje/toast mostrado; no cambia endpoints ni la lógica de inactivación.
  const showInsumoInactivatedToast = useCallback(() => {
    safeToast('INACTIVADO', 'EL INSUMO SE INACTIVO CORRECTAMENTE.', 'success');
  }, [safeToast]);

  // NEW: centraliza el manejo de toast de error para cambios de estado de insumos.
  // WHY: asegurar el mismo fallback de error en desktop/responsive al inactivar (y mantener consistencia al activar).
  // IMPACT: reutiliza `apiError`; no duplica lógica de red ni modifica el flujo de CRUD.
  const showInsumoEstadoErrorToast = useCallback((e, nextActive) => (
    apiError(e, nextActive ? 'ERROR ACTIVANDO INSUMO' : 'ERROR INACTIVANDO INSUMO')
  ), [apiError]);

  const cargarInsumos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // NEW: cargar siempre dataset global (activos + inactivos) para KPIs y "Total" global del header.
      // WHY: el toggle "Ver inactivos" debe modificar solo el listado visible, no los conteos del dashboard.
      // IMPACT: usa el mismo endpoint con `incluir_inactivos=1`; filtros locales y CRUD no cambian.
      const data = await inventarioService.getInsumos({ incluirInactivos: true });
      setInsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiError(e, 'ERROR CARGANDO INSUMOS'));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  const cargarAlmacenes = useCallback(async () => {
    setLoadingAlmacenes(true);
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiError(e, 'ERROR CARGANDO ALMACENES'));
    } finally {
      setLoadingAlmacenes(false);
    }
  }, [apiError]);

  const cargarUnidadesMedida = useCallback(async () => {
    setLoadingUnidadesMedida(true);
    try {
      const data = await inventarioService.getUnidadesMedida();
      setUnidadesMedida(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiError(e, 'ERROR CARGANDO UNIDADES DE MEDIDA'));
    } finally {
      setLoadingUnidadesMedida(false);
    }
  }, [apiError]);

  useEffect(() => {
    cargarInsumos();
    cargarAlmacenes();
    cargarUnidadesMedida();
  }, [cargarAlmacenes, cargarInsumos, cargarUnidadesMedida]);

  useEffect(() => (
    () => {
      revokeInventarioObjectUrl(drawerImage.previewUrl);
    }
  ), [drawerImage.previewUrl]);

  const selectedInsumo = useMemo(() => insumos.find((i) => Number(i?.id_insumo) === Number(selectedId)) || null, [insumos, selectedId]);
  const detailInsumo = useMemo(() => insumos.find((i) => Number(i?.id_insumo) === Number(detailInsumoId)) || null, [detailInsumoId, insumos]);

  const resetDrawerImage = useCallback((previewUrl = '') => {
    // NEW: helper unico para limpiar preview + input file del drawer/create de Insumos.
    // WHY: al quitar imagen o cerrar el panel no debe quedar ningun `File` ni valor previo retenido por el navegador.
    // IMPACT: solo sincroniza estado local de la imagen; create/edit y upload siguen igual.
    if (drawerImageInputRef.current) drawerImageInputRef.current.value = '';
    setDrawerImage(buildDrawerImageState(previewUrl));
  }, []);

  const resetCreate = useCallback(() => {
    setForm(emptyForm());
    setCreateErrors({});
    resetDrawerImage();
  }, [resetDrawerImage]);

  const startEdit = useCallback((i) => {
    if (!i) return;
    setEditId(i.id_insumo);
    setEditErrors({});
    setEditForm({
      nombre_insumo: String(i?.nombre_insumo ?? ''),
      precio: String(i?.precio ?? ''),
      cantidad: String(i?.cantidad ?? ''),
      stock_minimo: String(i?.stock_minimo ?? '0'),
      fecha_ingreso_insumo: toDateInputValue(i?.fecha_ingreso_insumo),
      id_almacen: String(i?.id_almacen ?? ''),
      id_categoria_insumo: String(i?.id_categoria_insumo ?? ''),
      id_unidad_medida: String(i?.id_unidad_medida ?? ''),
      fecha_caducidad: toDateInputValue(i?.fecha_caducidad),
      descripcion: String(i?.descripcion ?? '')
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  }, []);

  const openFilters = useCallback(() => {
    // NEW: drawer de filtros con estado draft para aplicar/limpiar sin re-filtrar en cada clic.
    // WHY: replica el patrón UX lateral de Productos.
    // IMPACT: filtrado sigue siendo local; no toca integración backend.
    setDraftFilters(cloneFilters(appliedFilters));
    setDrawerMsg('');
    setDrawer('filters');
  }, [appliedFilters]);

  const openCreate = useCallback(() => {
    resetCreate();
    cancelEdit();
    setDrawerMode('create');
    setDrawer('form');
    setSelectedId(null);
    setDrawerMsg('');
    setFocusCantidad(false);
  }, [cancelEdit, resetCreate]);

  const openEdit = useCallback((i, opts = {}) => {
    if (!i) return;
    startEdit(i);
    clearInsumoImageError(i?.id_insumo);
    resetDrawerImage(resolveInventarioImageUrl(
      i?.imagen_principal_url || i?.imagen_url || i?.imagen || i?.url_publica || ''
    ));
    setSelectedId(i.id_insumo);
    setDrawerMode('edit');
    setDrawer('form');
    setDrawerMsg('');
    setFocusCantidad(Boolean(opts.focusCantidad));
  }, [clearInsumoImageError, resetDrawerImage, startEdit]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setDrawerMsg('');
    setFocusCantidad(false);
    resetDrawerImage();
  }, [resetDrawerImage]);

  const openDetailModal = useCallback((insumo) => {
    if (!insumo) return;
    setDetailSection(DETAIL_SECTION_DEFAULT);
    setDetailInsumoId(insumo.id_insumo);
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailSection(DETAIL_SECTION_DEFAULT);
    setDetailInsumoId(null);
  }, []);

  useEffect(() => {
    if (drawer !== 'form' || typeof window === 'undefined') return;
    const node = focusCantidad ? cantidadInputRef.current : nombreInputRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.focus();
      if (focusCantidad && typeof node.select === 'function') node.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [drawer, drawerMode, focusCantidad]);

  useEffect(() => {
    if ((drawer == null && detailInsumoId == null) || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailInsumoId, drawer]);

  const setField = useCallback((field, value) => {
    setDrawerMsg('');
    // NEW: normalización segura de mayúsculas centralizada para create/edit de Insumos.
    // WHY: evitar duplicar lógica en cada `onChange` y mantener exclusiones por campo.
    // IMPACT: solo transforma `nombre_insumo` y `descripcion`; demás campos permanecen igual.
    const nextValue = UPPERCASE_INSUMO_FIELDS.has(String(field)) ? toUpperSafe(value, field) : value;
    if (drawerMode === 'create') {
      setForm((s) => ({ ...s, [field]: nextValue }));
      setCreateErrors((s) => (s[field] ? { ...s, [field]: '' } : s));
      return;
    }
    setEditForm((s) => ({ ...(s || emptyForm()), [field]: nextValue }));
    setEditErrors((s) => (s[field] ? { ...s, [field]: '' } : s));
  }, [drawerMode]);

  const uploadInsumoImageFile = useCallback(async (file) => {
    const payload = await buildInventarioImageUploadPayload(file);
    return inventarioService.crearArchivoImagen(payload);
  }, []);

  const openDrawerImagePicker = useCallback(() => {
    if (drawerImage.loading) return;
    drawerImageInputRef.current?.click();
  }, [drawerImage.loading]);

  const onDrawerImageChange = useCallback(async (event) => {
    const input = event.target;
    const file = input?.files?.[0];

    if (!file) {
      if (input) input.value = '';
      return;
    }

    const fileError = getInventarioImageFileError(file);
    if (fileError) {
      setDrawerImage((prev) => ({ ...prev, loading: false, error: fileError }));
      if (input) input.value = '';
      return;
    }

    if (drawerMode === 'create') {
      const previewUrl = URL.createObjectURL(file);
      setDrawerImage({ file, previewUrl, loading: false, error: '' });
      if (input) input.value = '';
      return;
    }

    if (!selectedInsumo) {
      if (input) input.value = '';
      return;
    }

    setDrawerImage((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const archivoResp = await uploadInsumoImageFile(file);
      const archivoId = Number.parseInt(String(archivoResp?.id_archivo ?? ''), 10);
      if (!Number.isInteger(archivoId) || archivoId <= 0) {
        throw new Error('No se pudo obtener el archivo de imagen creado.');
      }

      await inventarioService.actualizarInsumoCampo(
        selectedInsumo.id_insumo,
        'id_archivo_imagen_principal',
        archivoId
      );

      clearInsumoImageError(selectedInsumo.id_insumo);
      const imageUrl = resolveInventarioImageUrl(archivoResp?.url_publica || '');
      setInsumos((prev) => prev.map((item) => (
        Number(item?.id_insumo) === Number(selectedInsumo.id_insumo)
          ? { ...item, id_archivo_imagen_principal: archivoId, imagen_principal_url: imageUrl }
          : item
      )));
      resetDrawerImage(imageUrl);
      setDrawerMsg('IMAGEN ACTUALIZADA.');
      safeToast('ACTUALIZADO', 'LA IMAGEN DEL INSUMO SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR ACTUALIZANDO IMAGEN DEL INSUMO');
      setError(msg);
      setDrawerMsg(msg);
      setDrawerImage((prev) => ({ ...prev, loading: false, error: msg }));
    } finally {
      if (input) input.value = '';
    }
  }, [
    apiError,
    clearInsumoImageError,
    drawerMode,
    resetDrawerImage,
    safeToast,
    selectedInsumo,
    uploadInsumoImageFile
  ]);

  const clearDrawerImage = useCallback(async () => {
    if (drawerMode === 'create') {
      resetDrawerImage();
      return;
    }

    if (!selectedInsumo || drawerImage.loading) return;
    if (!selectedInsumo?.id_archivo_imagen_principal && !getInsumoImageSrc(selectedInsumo)) return;

    setDrawerImage((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await inventarioService.actualizarInsumoCampo(
        selectedInsumo.id_insumo,
        'id_archivo_imagen_principal',
        null
      );
      clearInsumoImageError(selectedInsumo.id_insumo);
      setInsumos((prev) => prev.map((item) => (
        Number(item?.id_insumo) === Number(selectedInsumo.id_insumo)
          ? { ...item, id_archivo_imagen_principal: null, imagen_principal_url: null }
          : item
      )));
      resetDrawerImage();
      setDrawerMsg('IMAGEN ELIMINADA.');
      safeToast('ACTUALIZADO', 'LA IMAGEN DEL INSUMO SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR ELIMINANDO IMAGEN DEL INSUMO');
      setError(msg);
      setDrawerMsg(msg);
      setDrawerImage((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }, [
    apiError,
    clearInsumoImageError,
    drawerImage.loading,
    drawerMode,
    getInsumoImageSrc,
    resetDrawerImage,
    safeToast,
    selectedInsumo
  ]);

  const saveCreate = useCallback(async () => {
    const v = validarInsumo(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;
    setCreating(true);
    setError('');
    try {
      const payload = buildPayload(v.cleaned);
      let uploadedImage = null;
      if (drawerImage.file) {
        const archivoResp = await uploadInsumoImageFile(drawerImage.file);
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
      const createResp = await inventarioService.crearInsumo(payload);
      const createdLocalInsumo = buildLocalInsumoFromCreate(v.cleaned, createResp, uploadedImage);
      upsertInsumoLocal(createdLocalInsumo);
      if (createdLocalInsumo?.__local_temp_id === true) {
        // NEW: sincronizacion silenciosa posterior al alta cuando el backend no devuelve `id_insumo`.
        // WHY: reemplazar el ID temporal local sin mostrar loader ni vaciar cards/listado.
        // IMPACT: el usuario ve el nuevo insumo al instante y el dataset se reconcilia en segundo plano.
        void syncInsumosSilently();
      }
      resetCreate();
      closeDrawer();
      safeToast('CREADO', 'EL INSUMO SE CREO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR CREANDO INSUMO', setCreateErrors);
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setCreating(false);
    }
  }, [apiError, buildLocalInsumoFromCreate, buildPayload, closeDrawer, drawerImage.file, form, resetCreate, safeToast, syncInsumosSilently, uploadInsumoImageFile, upsertInsumoLocal, validarInsumo]);

  const saveEdit = useCallback(async () => {
    if (!editId || !editForm || savingEdit) return;
    const v = validarInsumo(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;
    setSavingEdit(true);
    setError('');
    try {
      const actual = insumos.find((x) => Number(x?.id_insumo) === Number(editId));
      if (!actual) throw new Error('INSUMO NO ENCONTRADO');
      const c = v.cleaned;
      const changes = [];
      if (c.nombre_insumo !== sanitizeSpaces(actual?.nombre_insumo)) changes.push(['nombre_insumo', c.nombre_insumo]);
      if (c.precio !== parseFloatSafe(actual?.precio, 0)) changes.push(['precio', c.precio]);
      if (c.cantidad !== parseIntSafe(actual?.cantidad, 0)) changes.push(['cantidad', c.cantidad]);
      if (c.stock_minimo !== parseIntSafe(actual?.stock_minimo, 0)) changes.push(['stock_minimo', c.stock_minimo]);
      if (c.id_almacen !== parseIntSafe(actual?.id_almacen, 0)) changes.push(['id_almacen', c.id_almacen]);
      if (c.id_categoria_insumo !== (parseIntSafe(actual?.id_categoria_insumo, 0) || null)) changes.push(['id_categoria_insumo', c.id_categoria_insumo]);
      if (c.id_unidad_medida !== (parseIntSafe(actual?.id_unidad_medida, 0) || null)) changes.push(['id_unidad_medida', c.id_unidad_medida]);
      if (c.descripcion !== sanitizeSpaces(actual?.descripcion)) changes.push(['descripcion', c.descripcion]);
      // NEW: se mantiene compatibilidad evitando enviar fechas vacías al update por campo.
      // WHY: algunos backends/SP del proyecto no aceptan null/vacío en fecha.
      // IMPACT: editar fechas funciona; limpiar fecha queda pendiente de soporte backend.
      if (c.fecha_ingreso_insumo && c.fecha_ingreso_insumo !== toDateInputValue(actual?.fecha_ingreso_insumo)) changes.push(['fecha_ingreso_insumo', c.fecha_ingreso_insumo]);
      if (c.fecha_caducidad && c.fecha_caducidad !== toDateInputValue(actual?.fecha_caducidad)) changes.push(['fecha_caducidad', c.fecha_caducidad]);
      if (!changes.length) {
        setDrawerMsg('NO HAY CAMBIOS PARA GUARDAR.');
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        return;
      }
      for (const [campo, valor] of changes) await inventarioService.actualizarInsumoCampo(editId, campo, valor);
      patchInsumoLocalById(editId, Object.fromEntries(changes));
      setDrawerMsg('CAMBIOS GUARDADOS.');
      safeToast('ACTUALIZADO', 'EL INSUMO SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR ACTUALIZANDO INSUMO', setEditErrors);
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setSavingEdit(false);
    }
  }, [apiError, editForm, editId, insumos, patchInsumoLocalById, safeToast, savingEdit, validarInsumo]);

  const setConfirm = useCallback((id, nombre) => setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' }), []);
  const closeConfirm = useCallback(() => { setConfirmModal({ show: false, idToDelete: null, nombre: '' }); setDeleting(false); }, []);

  const deleteConfirmed = useCallback(async () => {
    if (!confirmModal.idToDelete || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await inventarioService.eliminarInsumo(confirmModal.idToDelete);
      if (Number(selectedId) === Number(confirmModal.idToDelete)) { closeDrawer(); cancelEdit(); }
      if (estadoField) {
        patchInsumoLocalById(confirmModal.idToDelete, { [estadoField]: false });
      }
      closeConfirm();
      showInsumoInactivatedToast();
    } catch (e) {
      setError(showInsumoEstadoErrorToast(e, false));
      closeConfirm();
    } finally {
      setDeleting(false);
    }
  }, [cancelEdit, closeConfirm, closeDrawer, confirmModal.idToDelete, deleting, estadoField, patchInsumoLocalById, selectedId, showInsumoEstadoErrorToast, showInsumoInactivatedToast]);

  const toggleEstado = useCallback(async (insumo, nextActive) => {
    if (!estadoField || !insumo || togglingEstado) return;
    setTogglingEstado(true);
    setTogglingEstadoId(Number(insumo.id_insumo));
    setLocalEstadoMap((s) => ({ ...s, [insumo.id_insumo]: nextActive }));
    setDrawerMsg(nextActive ? 'ACTIVANDO INSUMO...' : 'INACTIVANDO INSUMO...');
    try {
      let done = false;
      let lastStateError = null;
      for (const candidate of (nextActive ? [1, '1', true] : [0, '0', false])) {
        try {
          await inventarioService.actualizarInsumoCampo(insumo.id_insumo, estadoField, candidate);
          done = true;
          break;
        } catch (err) {
          lastStateError = err;
        }
      }
      if (!done) throw (lastStateError || new Error('NO SE PUDO ACTUALIZAR EL ESTADO'));
      setInsumos((prev) => prev.map((it) => (Number(it?.id_insumo) === Number(insumo.id_insumo) ? { ...it, [estadoField]: nextActive } : it)));
      setLocalEstadoMap((s) => { const n = { ...s }; delete n[insumo.id_insumo]; return n; });
      const successMsg = nextActive ? 'INSUMO ACTIVADO.' : 'EL INSUMO SE INACTIVO CORRECTAMENTE.';
      setDrawerMsg(successMsg);
      if (nextActive) {
        safeToast('EXITO', 'INSUMO ACTIVADO.', 'success');
      } else {
        showInsumoInactivatedToast();
      }
    } catch (e) {
      setLocalEstadoMap((s) => { const n = { ...s }; delete n[insumo.id_insumo]; return n; });
      const msg = showInsumoEstadoErrorToast(e, nextActive);
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setTogglingEstado(false);
      setTogglingEstadoId(null);
    }
  }, [estadoField, safeToast, showInsumoEstadoErrorToast, showInsumoInactivatedToast, togglingEstado]);

  const clearFilters = useCallback(() => {
    setSearch('');
    const clean = cloneFilters(DEFAULT_FILTERS);
    setAppliedFilters(clean);
    setDraftFilters(clean);
  }, []);

  const applyFilters = useCallback(() => { setAppliedFilters(cloneFilters(draftFilters)); closeDrawer(); }, [draftFilters, closeDrawer]);

  const categoriaOptions = useMemo(() => {
    if (!categoriaField && !categoriaLabelField) return [];
    if (categoriaField === 'id_categoria_producto' && categorias.length) {
      return categoriasActivas
        .map((c) => ({ value: String(c?.id_categoria_producto), label: String(c?.nombre_categoria || c?.id_categoria_producto) }))
        .filter((x) => x.value);
    }
    // NEW: opciones del filtro/form basadas en `categorias_insumos` cuando el backend expone `id_categoria_insumo`.
    // WHY: separar correctamente el catálogo de categorías de insumos del catálogo de productos.
    // IMPACT: selects y filtros muestran labels correctos y solo categorías de insumos activas.
    if (categoriaField === 'id_categoria_insumo' && categoriasInsumosActivas.length) {
      return categoriasInsumosActivas
        .map((c) => ({ value: String(c?.id_categoria_insumo), label: String(c?.nombre_categoria || c?.id_categoria_insumo) }))
        .filter((x) => x.value);
    }
    const map = new Map();
    for (const i of insumos) {
      const val = getCategoriaValue(i);
      if (!val) continue;
      const label = getCategoriaLabel(i) || val;
      if (!map.has(val)) map.set(val, label);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [categoriaField, categoriaLabelField, categorias, categoriasActivas, categoriasInsumosActivas, getCategoriaLabel, getCategoriaValue, insumos]);

  const filtered = useMemo(() => {
    const s = normalize(search);
    const statusSet = new Set(appliedFilters.estados);
    const list = [...insumos].filter((i) => {
      const snap = snapshot(i);
      const st = snap.ui.key;
      // NEW: modo "Ver inactivos" fuerza listado exclusivo de inactivos; OFF deja solo activos.
      // WHY: cumplir el comportamiento solicitado sin cambiar endpoints ni la lógica de filtros existente.
      // IMPACT: filtro local adicional sobre `insumos`; chips y búsqueda siguen funcionando igual.
      const matchViewEstado = showInactiveInsumos ? !snap.activo : snap.activo;
      if (!matchViewEstado) return false;
      if (statusSet.size && !statusSet.has(st)) return false;
      if (appliedFilters.almacen !== 'todos' && String(i?.id_almacen ?? '') !== String(appliedFilters.almacen)) return false;
      if (appliedFilters.categoria !== 'todos' && String(getCategoriaValue(i) || '') !== String(appliedFilters.categoria)) return false;
      if (!s) return true;
      const text = `${i?.nombre_insumo ?? ''} ${i?.descripcion ?? ''} ${getAlmacenLabel(i?.id_almacen)} ${getCategoriaLabel(i)} ${getUnidadMedidaLabel(i?.id_unidad_medida)} ${i?.id_insumo ?? ''}`.toLowerCase();
      return text.includes(s);
    });
    list.sort((a, b) => {
      // NEW: prioridad operativa fija para faltantes antes de cualquier orden secundario.
      // WHY: `sin stock` y `stock bajo` deben aparecer primero tanto en cards como en listado.
      // IMPACT: respeta filtros/toggle de activos y usa el sort actual solo dentro de cada prioridad.
      const snapA = snapshot(a);
      const snapB = snapshot(b);
      const stockRankDiff = getStockPriorityRank(snapA) - getStockPriorityRank(snapB);
      if (stockRankDiff !== 0) return stockRankDiff;

      const k = appliedFilters.sortBy || 'recientes';
      let sortDiff = 0;
      if (k === 'nombre_asc') sortDiff = String(a?.nombre_insumo ?? '').localeCompare(String(b?.nombre_insumo ?? ''), 'es', { sensitivity: 'base' });
      else if (k === 'nombre_desc') sortDiff = String(b?.nombre_insumo ?? '').localeCompare(String(a?.nombre_insumo ?? ''), 'es', { sensitivity: 'base' });
      else if (k === 'precio_desc') sortDiff = parseFloatSafe(b?.precio, 0) - parseFloatSafe(a?.precio, 0);
      else if (k === 'precio_asc') sortDiff = parseFloatSafe(a?.precio, 0) - parseFloatSafe(b?.precio, 0);
      else if (k === 'stock_desc') sortDiff = parseIntSafe(b?.cantidad, 0) - parseIntSafe(a?.cantidad, 0);
      else if (k === 'stock_asc') sortDiff = parseIntSafe(a?.cantidad, 0) - parseIntSafe(b?.cantidad, 0);
      if (k === 'cad_asc') {
        const ca = toDateInputValue(a?.fecha_caducidad) || '9999-12-31';
        const cb = toDateInputValue(b?.fecha_caducidad) || '9999-12-31';
        if (ca !== cb) sortDiff = ca.localeCompare(cb);
      } else if (k === 'recientes') {
        sortDiff = Number(b?.id_insumo ?? 0) - Number(a?.id_insumo ?? 0);
      }
      if (sortDiff !== 0) return sortDiff;

      const byName = String(a?.nombre_insumo ?? '').localeCompare(String(b?.nombre_insumo ?? ''), 'es', { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return Number(a?.id_insumo ?? 0) - Number(b?.id_insumo ?? 0);
    });
    return list;
  }, [appliedFilters, getAlmacenLabel, getCategoriaLabel, getCategoriaValue, getUnidadMedidaLabel, insumos, search, showInactiveInsumos, snapshot]);

  const filtersSignature = useMemo(() => JSON.stringify({
    search: search.trim().toLowerCase(),
    appliedFilters,
    showInactiveInsumos
  }), [appliedFilters, search, showInactiveInsumos]);

  const carouselConfig = useMemo(
    () => getInsumosCarouselConfig(viewportWidth),
    [viewportWidth]
  );

  // NEW: paginas del carrusel de Insumos agrupadas por breakpoint para mantener 6/4/2 cards visibles por vista.
  // WHY: el usuario pidio un carrusel tipo Productos pero con paginacion fija y sin scroll horizontal libre.
  // IMPACT: solo cambia la presentacion de las cards; filtros, orden y handlers existentes siguen iguales.
  const carouselPages = useMemo(
    () => chunkInsumosCarouselPages(filtered, carouselConfig.perPage),
    [carouselConfig.perPage, filtered]
  );

  const carouselPageCount = Math.max(1, carouselPages.length || 0);
  const currentCarouselItems = carouselPages[carouselPageIndex] || [];

  // NEW: paginacion local del listado despues del filtro/orden actual para evitar recargas adicionales.
  // WHY: el usuario necesita navegar tablas largas sin perder el estado de filtros ni el orden por stock.
  // IMPACT: solo afecta la vista de listado; cards y datos cargados se mantienen intactos.
  const listTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / INSUMOS_LIST_PAGE_SIZE)),
    [filtered.length]
  );

  const paginatedList = useMemo(() => {
    const start = (listPage - 1) * INSUMOS_LIST_PAGE_SIZE;
    return filtered.slice(start, start + INSUMOS_LIST_PAGE_SIZE);
  }, [filtered, listPage]);

  const listPageWindow = useMemo(() => {
    if (!filtered.length) return '0-0';
    const start = (listPage - 1) * INSUMOS_LIST_PAGE_SIZE + 1;
    const end = Math.min(filtered.length, start + INSUMOS_LIST_PAGE_SIZE - 1);
    return `${start}-${end}`;
  }, [filtered.length, listPage]);

  const kpis = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lim = new Date(now); lim.setDate(lim.getDate() + 30);
    const limit = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, '0')}-${String(lim.getDate()).padStart(2, '0')}`;
    let existencia = 0, bajo = 0, sin_stock = 0, inactivo = 0, cad = 0;
    for (const i of insumos) {
      const st = snapshot(i).ui.key;
      if (st === 'existencia') existencia++;
      else if (st === 'bajo') bajo++;
      else if (st === 'sin_stock') sin_stock++;
      else if (st === 'inactivo') inactivo++;
      const fc = toDateInputValue(i?.fecha_caducidad);
      if (fc && fc >= today && fc <= limit) cad++;
    }
    return { total: insumos.length, existencia, bajo, sin_stock, inactivo, cad };
  }, [insumos, snapshot]);

  // NEW: series decorativas derivadas de KPIs para renderizar sparklines tipo Productos.
  // WHY: unificar visualmente los dashboards sin persistencia historica adicional.
  // IMPACT: no altera conteos; solo agrega linea SVG sutil en cada tarjeta.
  const insumosKpiSeries = useMemo(() => {
    const makeSeries = (value, neighbor = 0) => {
      const v = Math.max(0, Number(value ?? 0));
      const n = Math.max(0, Number(neighbor ?? 0));
      const delta = Math.max(1, Math.round(Math.max(v, n) * 0.1));
      return [
        Math.max(0, v - delta),
        Math.max(0, Math.round((v + n) / 2)),
        v,
        Math.max(0, v - Math.round(delta / 2)),
        v
      ];
    };
    return {
      total: makeSeries(kpis.total, kpis.existencia),
      existencia: makeSeries(kpis.existencia, kpis.total),
      bajo: makeSeries(kpis.bajo, kpis.existencia),
      sin_stock: makeSeries(kpis.sin_stock, kpis.bajo),
      inactivo: makeSeries(kpis.inactivo, kpis.total),
      cad: makeSeries(kpis.cad, kpis.sin_stock)
    };
  }, [kpis]);

  // NEW: renderer del KPI con sparkline reutilizando markup visual de Productos.
  // WHY: mantener consistencia y evitar duplicar SVG inline en cada tarjeta del dashboard.
  // IMPACT: componente local de presentacion; no toca logica del resto del modulo.
  const renderKpiCard = (key, label, value, className = '') => {
    const points = buildInventorySparkPoints(insumosKpiSeries[key] || []);
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

  const hasActiveFilters = useMemo(() => (
    search.trim() !== '' || appliedFilters.almacen !== 'todos' || appliedFilters.categoria !== 'todos' || appliedFilters.sortBy !== 'recientes' || appliedFilters.estados.length > 0
  ), [appliedFilters, search]);

  useEffect(() => {
    if (detailInsumoId !== null && !detailInsumo) {
      setDetailInsumoId(null);
    }
  }, [detailInsumo, detailInsumoId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // NEW: sincroniza la pagina del carrusel con el breakpoint activo sin recargar datos ni desmontar la vista.
    // WHY: el carrusel de Insumos debe responder a 1440/1024/768/375 manteniendo la pagina actual cuando sea posible.
    // IMPACT: solo afecta el layout visible del carrusel; no toca el fetch ni los payloads del modulo.
    const syncViewportWidth = () => setViewportWidth(window.innerWidth);
    syncViewportWidth();
    window.addEventListener('resize', syncViewportWidth);
    return () => window.removeEventListener('resize', syncViewportWidth);
  }, []);

  useEffect(() => {
    setListPage(1);
  }, [filtersSignature]);

  useEffect(() => {
    setListPage((prev) => Math.min(prev, listTotalPages));
  }, [listTotalPages]);

  useEffect(() => {
    setCarouselPageIndex((prev) => {
      const maxPageIndex = Math.max(0, carouselPageCount - 1);
      return Math.min(prev, maxPageIndex);
    });
  }, [carouselPageCount]);

  const formValues = drawerMode === 'create' ? form : (editForm || emptyForm());
  const formErrors = drawerMode === 'create' ? createErrors : editErrors;
  const previewItem = useMemo(() => (drawerMode === 'create' ? { ...formValues } : (selectedInsumo ? { ...selectedInsumo, ...formValues } : null)), [drawerMode, formValues, selectedInsumo]);
  const previewSnap = useMemo(() => (previewItem ? snapshot(previewItem) : null), [previewItem, snapshot]);
  // NEW: snapshot derivado para renderizar el modal de detalle con el mismo criterio de stock/estado que cards y listado.
  // WHY: evitar duplicar reglas visuales y mantener coherencia entre vistas.
  // IMPACT: solo lectura/UI; no toca persistencia ni filtros.
  const detailSnap = useMemo(() => (detailInsumo ? snapshot(detailInsumo) : null), [detailInsumo, snapshot]);
  const detailImageSrc = useMemo(() => getInsumoImageSrc(detailInsumo), [detailInsumo, getInsumoImageSrc]);
  const detailCostRows = useMemo(() => {
    if (!detailInsumo) return [];
    const rows = [];

    if (detailInsumo?.precio !== undefined && detailInsumo?.precio !== null && String(detailInsumo?.precio).trim() !== '') {
      rows.push({ label: 'Precio registrado', value: fmtMoney(detailInsumo?.precio) });
    }

    const extraCostCandidates = [
      ['costo', 'Costo'],
      ['costo_promedio', 'Costo promedio'],
      ['ultimo_costo', 'Ultimo costo'],
      ['precio_compra', 'Precio de compra'],
      ['ultima_compra', 'Ultima compra']
    ];

    for (const [field, label] of extraCostCandidates) {
      const raw = detailInsumo?.[field];
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      rows.push({ label, value: String(raw) });
    }

    return rows;
  }, [detailInsumo]);

  const detailSections = useMemo(() => {
    const sections = [
      { key: 'summary', label: 'Resumen' },
      { key: 'stock', label: 'Inventario' }
    ];
    if (detailCostRows.length > 0) sections.push({ key: 'costs', label: 'Compras' });
    sections.push({ key: 'related', label: 'Relacionados' });
    sections.push({ key: 'image', label: 'Imagen' });
    return sections;
  }, [detailCostRows.length]);

  // NEW: tarjetas resumen del modal siguiendo la jerarquia visual del detalle de venta.
  // WHY: concentrar los datos clave en la parte superior para que el modal se lea en bloques cortos y anchos.
  // IMPACT: solo presentacion del modal; no cambia datos, handlers ni contratos del modulo.
  const detailSummaryCards = useMemo(() => {
    if (!detailInsumo || !detailSnap) return [];

    return [
      {
        key: 'existencia',
        icon: 'bi-box-seam',
        label: 'Existencia',
        value: `${detailSnap.cantidad} ${getUnidadMedidaLabel(detailInsumo?.id_unidad_medida)}`
      },
      {
        key: 'stock',
        icon: 'bi-speedometer2',
        label: 'Stock minimo',
        value: String(detailSnap.stockMin)
      },
      {
        key: 'caducidad',
        icon: 'bi-calendar-event',
        label: 'Caducidad',
        value: toDateInputValue(detailInsumo?.fecha_caducidad) ? dateLabel(detailInsumo?.fecha_caducidad) : 'Sin caducidad'
      },
      {
        key: 'precio',
        icon: 'bi-cash-stack',
        label: 'Precio',
        value: fmtMoney(detailInsumo?.precio)
      },
      {
        key: 'categoria',
        icon: 'bi-tags',
        label: 'Categoria',
        value: getCategoriaLabel(detailInsumo) || 'Sin categoria'
      },
      {
        key: 'almacen',
        icon: 'bi-shop',
        label: 'Almacen',
        value: getAlmacenLabel(detailInsumo?.id_almacen)
      }
    ];
  }, [detailInsumo, detailSnap, fmtMoney, getAlmacenLabel, getCategoriaLabel, getUnidadMedidaLabel]);

  // NEW: bloques del detalle renderizados como cuadros con icono para unificar toda la lectura del modal.
  // WHY: el usuario pidio que todos los detalles sigan el mismo patron visual de tarjetas con iconografia.
  // IMPACT: solo cambia la presentacion del modal de detalle; no modifica datos ni el flujo del submodulo.
  const detailInfoSections = useMemo(() => {
    if (!detailInsumo || !detailSnap) return [];

    const sections = [
      {
        key: 'summary',
        title: 'Resumen',
        items: [
          { key: 'id', icon: 'bi-hash', label: 'ID', value: detailInsumo?.id_insumo ?? '-' },
          { key: 'nombre', icon: 'bi-card-text', label: 'Nombre', value: detailInsumo?.nombre_insumo || '-' },
          { key: 'descripcion', icon: 'bi-text-paragraph', label: 'Descripcion', value: sanitizeSpaces(detailInsumo?.descripcion) || 'Sin descripcion' },
          { key: 'estado', icon: 'bi-activity', label: 'Estado', value: detailSnap.ui.badge }
        ]
      },
      {
        key: 'stock',
        title: 'Inventario',
        items: [
          { key: 'existencias', icon: 'bi-box-seam', label: 'Existencias', value: detailSnap.cantidad },
          { key: 'stock_minimo', icon: 'bi-speedometer2', label: 'Stock minimo', value: detailSnap.stockMin },
          { key: 'fecha_ingreso', icon: 'bi-calendar-plus', label: 'Fecha ingreso', value: toDateInputValue(detailInsumo?.fecha_ingreso_insumo) || 'Sin fecha' },
          { key: 'fecha_caducidad', icon: 'bi-calendar-event', label: 'Fecha caducidad', value: toDateInputValue(detailInsumo?.fecha_caducidad) ? dateLabel(detailInsumo?.fecha_caducidad) : 'Sin caducidad' }
        ]
      },
      {
        key: 'related',
        title: 'Relacionados',
        items: [
          { key: 'categoria', icon: 'bi-tags', label: 'Categoria', value: getCategoriaLabel(detailInsumo) || 'Sin categoria' },
          { key: 'almacen', icon: 'bi-shop', label: 'Almacen', value: getAlmacenLabel(detailInsumo?.id_almacen) },
          { key: 'unidad', icon: 'bi-rulers', label: 'Unidad', value: getUnidadMedidaLabel(detailInsumo?.id_unidad_medida) }
        ]
      }
    ];

    if (detailCostRows.length > 0) {
      sections.splice(2, 0, {
        key: 'costs',
        title: 'Compras',
        items: detailCostRows.map((row, index) => ({
          key: `${row.label}-${index}`,
          icon: row.label.toLowerCase().includes('compra') ? 'bi-bag-check' : 'bi-cash-stack',
          label: row.label,
          value: row.value
        }))
      });
    }

    return sections;
  }, [detailCostRows, detailInsumo, detailSnap, getAlmacenLabel, getCategoriaLabel, getUnidadMedidaLabel]);
  const submitDrawer = async (e) => { e.preventDefault(); if (drawerMode === 'create') await saveCreate(); else await saveEdit(); };
  const blockNonIntegerKeys = (e) => { if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault(); };
  const intInput = (v) => String(v ?? '').replace(/[^\d]/g, '');
  const isAnyDrawerOpen = drawer === 'filters' || drawer === 'form';
  const fieldErr = (key) => (formErrors[key] ? <div className="invalid-feedback d-block">{formErrors[key]}</div> : null);

  const resolveInsumoStatusClass = (uiKey) => {
    if (uiKey === 'bajo') return 'is-low';
    if (uiKey === 'sin_stock') return 'is-empty';
    if (uiKey === 'inactivo') return 'is-inactive';
    return 'is-ok';
  };

  const renderCard = (i) => {
    const s = snapshot(i);
    const ui = s.ui;
    const inactive = ui.key === 'inactivo';
    const isSel = drawer === 'form' && Number(selectedId) === Number(i?.id_insumo);
    const categoriaText = getCategoriaLabel(i) || 'Sin categoria';
    const unidadText = getUnidadMedidaLabel(i?.id_unidad_medida);
    const imageSrc = getInsumoImageSrc(i);
    const cadLabel = toDateInputValue(i?.fecha_caducidad) ? dateLabel(i?.fecha_caducidad) : 'Sin caducidad';
    const estadoLabel = inactive ? 'Inactivo' : 'Activo';
    const showStockAlert = ui.key === 'bajo' || ui.key === 'sin_stock';
    const desc = sanitizeSpaces(i?.descripcion) || 'Sin descripcion';
    const stockRatioBase = s.stockMin > 0 ? s.cantidad / (s.stockMin * 2) : s.cantidad / 20;
    const stockRatio = Math.max(0, Math.min(1, Number.isNaN(stockRatioBase) ? 0 : stockRatioBase));

    return (
      <article
        key={i?.id_insumo}
        className={`inv-prod-catalog-card inv-ins-card-v3 ${isSel ? 'is-selected' : ''} ${inactive ? 'is-inactive' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openEdit(i)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit(i);
          }
        }}
      >
        <div className="inv-ins-card-v3__header">
          <div className="inv-ins-card-v3__media">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={i?.nombre_insumo || 'Insumo'}
                className="inv-ins-card-v3__image"
                loading="lazy"
                onError={() => markInsumoImageAsError(i?.id_insumo)}
              />
            ) : (
              <div className="inv-ins-card-v3__image inv-ins-card-v3__image--placeholder">
                <i className="bi bi-image" />
                <span>Sin imagen</span>
              </div>
            )}
          </div>

          <div className="inv-ins-card-v3__header-copy">
            <div className="inv-ins-card-v3__title-row">
              <div className="inv-prod-card-name inv-ins-card-v3__name">{i?.nombre_insumo || `Insumo #${i?.id_insumo ?? '-'}`}</div>
              <span className={`inv-ins-status-pill ${inactive ? 'is-inactive' : 'is-ok'}`}>{estadoLabel}</span>
            </div>

            <div className="inv-ins-card-v3__chips">
              <span className="inv-prod-card-category inv-ins-card-v3__category">{categoriaText}</span>
              {showStockAlert ? (
                <span className={`inv-prod-card-state ${resolveInsumoStatusClass(ui.key)} inv-ins-card-v3__stock-chip`}>{ui.badge}</span>
              ) : null}
            </div>

            <div className="inv-ins-card-v3__meta">{getAlmacenLabel(i?.id_almacen)}</div>
          </div>
        </div>

        <div className="inv-prod-card-body inv-ins-card-v3__body">
          {/* NEW: resumen compacto y accionable para homogeneizar la grilla de Insumos con Productos. */}
          {/* WHY: la card necesita priorizar datos operativos y dejar el detalle completo al modal. */}
          {/* IMPACT: ordena el contenido visible sin tocar handlers ni la persistencia existente. */}
          <div className="inv-ins-card-v3__stats">
            <div className="inv-ins-card-v3__stat">
              <span>Existencia</span>
              <strong>{s.cantidad} {unidadText}</strong>
            </div>
            <div className="inv-ins-card-v3__stat">
              <span>Stock minimo</span>
              <strong>{s.stockMin}</strong>
            </div>
            <div className="inv-ins-card-v3__stat">
              <span>Precio</span>
              <strong>{fmtMoney(i?.precio)}</strong>
            </div>
            <div className="inv-ins-card-v3__stat">
              <span>Caducidad</span>
              <strong>{cadLabel}</strong>
            </div>
          </div>

          <div className="inv-ins-card-v3__actions-primary">
            <button
              type="button"
              className="btn inv-prod-btn-subtle inv-ins-card-v3__action"
              onClick={(e) => {
                e.stopPropagation();
                openDetailModal(i);
              }}
            >
              <i className="bi bi-eye" />
              <span>Ver detalle</span>
            </button>
            <button
              type="button"
              className="btn inv-prod-btn-outline inv-ins-card-v3__action"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(i, { focusCantidad: true });
              }}
            >
              <i className="bi bi-pencil-square" />
              <span>Editar</span>
            </button>
            {estadoField ? (
              <button
                type="button"
                className={`btn inv-ins-card-v3__action ${inactive ? 'inv-prod-btn-success-lite' : 'inv-prod-btn-inactivate'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleEstado(i, inactive);
                }}
                disabled={togglingEstado}
                title={inactive ? 'Activar' : 'Inactivar'}
                aria-label={`${inactive ? 'Activar' : 'Inactivar'} ${i?.nombre_insumo || 'insumo'}`}
              >
                <i className={`bi ${inactive ? 'bi-check-circle' : 'bi-slash-circle'}`} />
                <span>{inactive ? 'Activar' : 'Inactivar'}</span>
              </button>
            ) : null}
          </div>

          <div className="inv-prod-card-name">{i?.nombre_insumo || `Insumo #${i?.id_insumo ?? '-'}`}</div>
          <div className="inv-prod-card-category">{categoriaText}</div>
          <div className="inv-ins-card-v3__meta">{getAlmacenLabel(i?.id_almacen)} · {unidadText}</div>

          <div className="inv-prod-card-metrics inv-ins-card-v3__metrics">
            <div>
              <div className="inv-prod-card-label">Precio</div>
              <div className="inv-prod-card-value">{fmtMoney(i?.precio)}</div>
            </div>
            <div>
              <div className="inv-prod-card-label">Existencias</div>
              <div className="inv-prod-card-value">{s.cantidad}</div>
            </div>
            <div>
              <div className="inv-prod-card-label">Stock minimo</div>
              <div className="inv-prod-card-value">{s.stockMin}</div>
            </div>
            <div>
              <div className="inv-prod-card-label">Caducidad</div>
              <div className="inv-prod-card-value">{toDateInputValue(i?.fecha_caducidad) ? dateLabel(i?.fecha_caducidad) : 'Sin cad.'}</div>
            </div>
          </div>

          <div className="inv-prod-stock-line inv-ins-card-v3__footer">
            <div className="inv-prod-stock-meta">
              <div className="inv-prod-stock-ring" style={{ '--stock-ratio': stockRatio }} />
              <div className="inv-prod-stock-copy">
                <span>{inactive ? 'Insumo inactivo' : `Unidad: ${unidadText}`}</span>
                <small title={desc}>{desc}</small>
              </div>
            </div>

            <div className="inv-ins-card-v3__actions">
              <button
                type="button"
                className="btn inv-prod-btn-subtle inv-ins-card-v3__action"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(i, { focusCantidad: true });
                }}
                disabled={inactive}
              >
                <i className="bi bi-sliders2-vertical" />
                <span>Ajustar</span>
              </button>
              {estadoField ? (
                <button
                  type="button"
                  className={`btn inv-prod-card-action inv-prod-card-action-compact ${inactive ? '' : 'inactivate'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleEstado(i, inactive);
                  }}
                  disabled={togglingEstado}
                  title={inactive ? 'Activar' : 'Inactivar'}
                  aria-label={`${inactive ? 'Activar' : 'Inactivar'} ${i?.nombre_insumo || 'insumo'}`}
                >
                  <i className={`bi ${inactive ? 'bi-check-circle' : 'bi-slash-circle'}`} />
                  <span className="inv-prod-card-action-label">{inactive ? 'Activar' : 'Inactivar'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderListRow = (i, index) => {
    const snapInfo = snapshot(i);
    const inactive = snapInfo.ui.key === 'inactivo';
    const imageSrc = getInsumoImageSrc(i);
    const categoriaText = getCategoriaLabel(i) || 'Sin categoria';
    const unidadText = getUnidadMedidaLabel(i?.id_unidad_medida);
    const rowNumber = (listPage - 1) * INSUMOS_LIST_PAGE_SIZE + index + 1;

    return (
      <tr key={i?.id_insumo}>
        <td className="text-muted">{rowNumber}</td>
        <td>
          <div className="inv-ins-table-main">
            <div className="inv-ins-table-thumb-wrap">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={i?.nombre_insumo || 'Insumo'}
                  className="inv-ins-table-thumb"
                  loading="lazy"
                  onError={() => markInsumoImageAsError(i?.id_insumo)}
                />
              ) : (
                <div className="inv-ins-table-thumb is-placeholder">
                  <i className="bi bi-image" />
                </div>
              )}
            </div>
            <div className="inv-ins-table-main__copy">
              <div className="fw-semibold">{i?.nombre_insumo || `Insumo #${i?.id_insumo ?? '-'}`}</div>
              <div className="text-muted small">{getAlmacenLabel(i?.id_almacen)}</div>
            </div>
          </div>
        </td>
        <td>{categoriaText}</td>
        <td>
          <div className="fw-semibold">{snapInfo.cantidad}</div>
          <div className="text-muted small">{unidadText}</div>
        </td>
        <td className="text-end">{snapInfo.stockMin}</td>
        <td className="text-end">{fmtMoney(i?.precio)}</td>
        <td>{toDateInputValue(i?.fecha_caducidad) ? dateLabel(i?.fecha_caducidad) : 'Sin caducidad'}</td>
        <td>
          <span className={`inv-ins-status-pill ${resolveInsumoStatusClass(snapInfo.ui.key)}`}>{snapInfo.ui.badge}</span>
        </td>
        <td>
          <div className="inv-ins-table-actions">
            <button type="button" className="btn inv-prod-btn-subtle inv-ins-table-action" onClick={() => openDetailModal(i)} title="Ver detalle" aria-label={`Ver detalle de ${i?.nombre_insumo || 'insumo'}`}>
              <i className="bi bi-eye" /> <span>Ver</span>
            </button>
            <button type="button" className="btn inv-prod-btn-outline inv-ins-table-action" onClick={() => openEdit(i)} title="Editar" aria-label={`Editar ${i?.nombre_insumo || 'insumo'}`}>
              <i className="bi bi-pencil-square" /> <span>Editar</span>
            </button>
            {estadoField ? (
              <button
                type="button"
                className={`btn inv-ins-table-action ${inactive ? 'inv-prod-btn-success-lite' : 'inv-prod-btn-inactivate'}`}
                onClick={() => void toggleEstado(i, inactive)}
                disabled={togglingEstado}
                title={inactive ? 'Activar' : 'Inactivar'}
                aria-label={`${inactive ? 'Activar' : 'Inactivar'} ${i?.nombre_insumo || 'insumo'}`}
              >
                <i className={`bi ${inactive ? 'bi-check-circle' : 'bi-trash'}`} />
                <span>{inactive ? 'Activar' : 'Inactivar'}</span>
              </button>
            ) : null}
          </div>
        </td>
      </tr>
    );
  };

  const renderCarouselCard = (insumo) => {
    const snapInfo = snapshot(insumo);
    const inactive = snapInfo.ui.key === 'inactivo';
    const categoriaText = getCategoriaLabel(insumo) || 'Sin categoria';
    const unidadText = getUnidadMedidaLabel(insumo?.id_unidad_medida);
    const caducidadLabel = toDateInputValue(insumo?.fecha_caducidad) ? dateLabel(insumo?.fecha_caducidad) : 'No registrada';
    const isSelected = drawer === 'form' && Number(selectedId) === Number(insumo?.id_insumo);
    const isCardTogglePending = Number(togglingEstadoId) === Number(insumo?.id_insumo);

    return (
      <article
        key={insumo?.id_insumo}
        className={`inv-prod-catalog-card inv-ins-card-v4 ${isSelected ? 'is-selected' : ''} ${inactive ? 'is-inactive' : ''} ${resolveInsumoStatusClass(snapInfo.ui.key)}`}
        role="button"
        tabIndex={0}
        onClick={() => openEdit(insumo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit(insumo);
          }
        }}
      >
        {/* NEW: card ultra-limpio con solo los datos operativos requeridos y edicion al click. */}
        {/* WHY: reducir densidad visual y usar el modal para el detalle completo sin perder rapidez operativa. */}
        {/* IMPACT: la edicion sigue en el drawer existente; solo cambia la composicion visible del card. */}
        <div className="inv-ins-card-v4__surface">
          <div className="inv-ins-card-v4__header">
            <div className="inv-ins-card-v4__name-wrap">
              <div className="inv-ins-card-v4__name">{insumo?.nombre_insumo || `Insumo #${insumo?.id_insumo ?? '-'}`}</div>
              <div className="inv-ins-card-v4__category">{categoriaText}</div>
            </div>
            {snapInfo.ui.key === 'bajo' || snapInfo.ui.key === 'sin_stock' ? (
              <span className={`inv-ins-card-v4__stock-pill ${resolveInsumoStatusClass(snapInfo.ui.key)}`}>{snapInfo.ui.badge}</span>
            ) : null}
          </div>

          <div className="inv-ins-card-v4__body">
            <div className="inv-ins-card-v4__metric-grid">
              <div className="inv-ins-card-v4__metric">
                <span>Existencia</span>
                <strong>{`${snapInfo.cantidad} ${unidadText}`}</strong>
              </div>
              <div className="inv-ins-card-v4__metric">
                <span>Caducidad</span>
                <strong>{caducidadLabel}</strong>
              </div>
            </div>

            <div className="inv-ins-card-v4__actions">
              <button
                type="button"
                className="btn inv-prod-btn-subtle inv-ins-card-v4__action"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetailModal(insumo);
                }}
              >
                <i className="bi bi-eye" />
                <span>Ver detalle</span>
              </button>
              {estadoField ? (
                <button
                  type="button"
                  className={`btn inv-ins-card-v4__action ${inactive ? 'inv-prod-btn-success-lite' : 'inv-prod-btn-inactivate'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleEstado(insumo, inactive);
                  }}
                  disabled={isCardTogglePending}
                  title={inactive ? 'Activar' : 'Inactivar'}
                  aria-label={`${inactive ? 'Activar' : 'Inactivar'} ${insumo?.nombre_insumo || 'insumo'}`}
                >
                  {isCardTogglePending ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className={`bi ${inactive ? 'bi-check-circle' : 'bi-slash-circle'}`} />}
                  <span>{isCardTogglePending ? 'Procesando...' : (inactive ? 'Activar' : 'Inactivar')}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  };


  return (
    <>
      {/* NEW: helper class para habilitar sticky del header dentro del card de Insumos. */}
      {/* WHY: permite override local de `overflow` sin afectar otros módulos ni la lógica del listado. */}
      {/* IMPACT: solo presentación/scroll del header; handlers y datos permanecen iguales. */}
      <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module inv-has-sticky-header">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-box2-heart inv-prod-title-icon" />
              <span className="inv-prod-title">Insumos</span>
            </div>
            <div className="inv-prod-subtitle">Gestion Visual de Insumos</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions">
            <label className="inv-ins-search" aria-label="Buscar insumos">
              <i className="bi bi-search" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
            </label>
            <button type="button" className={`inv-prod-toolbar-btn ${drawer === 'filters' ? 'is-on' : ''}`} onClick={openFilters}>
              <i className="bi bi-funnel" /> <span>Filtros</span>
            </button>
            <button type="button" className={`inv-prod-toolbar-btn ${drawer === 'form' && drawerMode === 'create' ? 'is-on' : ''}`} onClick={openCreate}>
              <i className="bi bi-plus-circle" /> <span>Nuevo</span>
            </button>
          </div>
        </div>

        <div className="inv-prod-kpis">
          {renderKpiCard('total', 'Total', kpis.total)}
          {renderKpiCard('existencia', 'En existencia', kpis.existencia, 'is-ok')}
          {renderKpiCard('bajo', 'Stock bajo', kpis.bajo, 'is-low')}
          {renderKpiCard('sin_stock', 'Sin stock', kpis.sin_stock, 'is-empty')}
          {renderKpiCard('inactivo', 'Inactivos', kpis.inactivo)}
          {renderKpiCard('cad', 'Por caducar (30d)', kpis.cad, kpis.cad > 0 ? 'is-low' : '')}
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

          <div className="inv-prod-results-meta inv-inventory-results-meta">
            <span>{loading ? 'Cargando insumos...' : `${filtered.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${insumos.length}`}</span>
            {/* NEW: toggle admin para incluir inactivos en la consulta del tab. */}
            {/* WHY: el backend lista solo activos por defecto con soft delete. */}
            {/* IMPACT: recarga el listado con el mismo endpoint (`?incluir_inactivos=1`). */}
            <label className="form-check form-switch mb-0 inv-catpro-inline-toggle">
              <input
                className="form-check-input"
                type="checkbox"
                checked={showInactiveInsumos}
                onChange={(e) => setShowInactiveInsumos(e.target.checked)}
              />
              <span className="form-check-label">Ver inactivos</span>
            </label>
            {hasActiveFilters ? (
              <span className="inv-prod-active-filter-pill">
                <span>Filtros activos</span>
                {/* NEW: atajo de limpieza total de filtros desde el resumen del listado. */}
                {/* WHY: reutilizar `clearFilters` y evitar pasos extra para resetear filtros aplicados. */}
                {/* IMPACT: no cambia cómo se filtra; solo agrega un acceso rápido. */}
                <button
                  type="button"
                  className="inv-prod-active-filter-pill__clear"
                  onClick={clearFilters}
                  aria-label="Limpiar filtros"
                  title="Limpiar filtros"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </span>
            ) : null}
            {!estadoField ? <span className="inv-ins-inline-note">{'// TODO: backend support required (inactivo)'}</span> : null}
          </div>

          <section className="inv-ins-section">
            <div className="inv-ins-section__head">
              <div>
                <div className="inv-prod-panel-eyebrow">Carrusel</div>
                <div className="inv-ins-section__title">Insumos</div>
                <div className="inv-ins-section__sub">Se muestran primero los insumos sin stock y luego los de stock bajo.</div>
              </div>
              <button type="button" className="btn inv-prod-btn-subtle inv-ins-clear" onClick={clearFilters}>
                <i className="bi bi-arrow-counterclockwise" /> <span>Limpiar</span>
              </button>
            </div>

            {loading ? (
              <div className="inv-ins-skeleton-track is-all">
                {Array.from({ length: carouselConfig.perPage }).map((_, i) => <div key={i} className="inv-ins-skeleton-card" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="inv-ins-empty">{hasActiveFilters ? 'No se encontraron insumos con los filtros aplicados.' : 'Crea tu primer insumo.'}</div>
            ) : (
              <div className="inv-ins-carousel-shell">
                <div className="inv-ins-carousel-meta">
                  <span>{`Pagina ${carouselPageIndex + 1} de ${carouselPageCount}`}</span>
                  <span>{`${filtered.length} insumos visibles`}</span>
                </div>
                <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
                  <button
                    type="button"
                    className={`btn inv-prod-carousel-float is-prev ${carouselPageIndex > 0 ? 'is-visible' : ''}`}
                    aria-label="Pagina anterior del carrusel de insumos"
                    onClick={() => setCarouselPageIndex((prev) => Math.max(0, prev - 1))}
                    disabled={carouselPageIndex <= 0}
                  >
                    <i className="bi bi-chevron-left" />
                  </button>

                  <div className={`inv-ins-carousel-page cols-${carouselConfig.columns}`} key={`insumos-page-${carouselPageIndex}`}>
                    {currentCarouselItems.map(renderCarouselCard)}
                  </div>

                  <button
                    type="button"
                    className={`btn inv-prod-carousel-float is-next ${carouselPageIndex < carouselPageCount - 1 ? 'is-visible' : ''}`}
                    aria-label="Pagina siguiente del carrusel de insumos"
                    onClick={() => setCarouselPageIndex((prev) => Math.min(carouselPageCount - 1, prev + 1))}
                    disabled={carouselPageIndex >= carouselPageCount - 1}
                  >
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {/* NEW: reutiliza el shell glass/backdrop de Categorias para unificar el drawer de Insumos sin tocar su contenido. */}
      {/* WHY: mantener el mismo contenedor visual (overlay + blur + animacion) entre submodulos de Inventario. */}
      {/* IMPACT: solo cambia la capa visual del drawer; formularios, filtros y handlers permanecen iguales. */}
      <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`} onClick={closeDrawer} aria-hidden={!isAnyDrawerOpen} />

      <aside className={`inv-prod-drawer inv-cat-v2__drawer inv-ins-drawer ${drawer === 'filters' ? 'show' : ''}`} id="inv-ins-filters-drawer" role="dialog" aria-modal="true" aria-hidden={drawer !== 'filters'}>
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark decorativo del shell de Categorias para igualar jerarquia visual del header del drawer. */}
          {/* WHY: replicar el acento visual del panel lateral sin afectar legibilidad ni foco. */}
          {/* IMPACT: elemento puramente decorativo; sin impacto funcional. */}
          <i className="bi bi-box-seam inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Filtros de insumos</div>
            <div className="inv-prod-drawer-sub">Estados, categorias, almacenes y orden</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeDrawer}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="inv-prod-drawer-body">
          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Estados</div>
            <div className="inv-ins-chip-grid">
              {STATUS_CHIPS.map((chip) => {
                const on = draftFilters.estados.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    className={`inv-ins-chip ${on ? 'is-active' : ''}`}
                    onClick={() => setDraftFilters((s) => ({ ...s, estados: on ? s.estados.filter((x) => x !== chip.key) : [...s.estados, chip.key] }))}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <div className="inv-ins-help">Si no seleccionas estados, se muestran todos.</div>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Filtros adicionales</div>
            <div className="inv-ins-drawer-fields">
              <div>
                <label className="form-label">Almacen</label>
                <select className="form-select" value={String(draftFilters.almacen)} onChange={(e) => setDraftFilters((s) => ({ ...s, almacen: e.target.value }))}>
                  <option value="todos">Todos los almacenes</option>
                  {almacenes.map((a) => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre} (Sucursal {a.id_sucursal})</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={String(draftFilters.categoria)}
                  onChange={(e) => setDraftFilters((s) => ({ ...s, categoria: e.target.value }))}
                  disabled={categoriaOptions.length === 0}
                >
                  <option value="todos">{categoriaOptions.length ? 'Todas las categorias' : 'No disponible'}</option>
                  {categoriaOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {!categoriaOptions.length ? <div className="inv-ins-help">{categoriaField || categoriaLabelField ? 'Sin datos suficientes para filtrar.' : 'No se detecto categoria en insumos.'}</div> : null}
              </div>

              <div>
                <label className="form-label">Orden</label>
                <select className="form-select" value={String(draftFilters.sortBy)} onChange={(e) => setDraftFilters((s) => ({ ...s, sortBy: e.target.value }))}>
                  {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="inv-prod-drawer-actions inv-ins-drawer-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={clearFilters}>Limpiar</button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={applyFilters}>Aplicar</button>
          </div>
        </div>
      </aside>

      <aside className={`inv-prod-drawer inv-cat-v2__drawer inv-ins-drawer ${drawer === 'form' ? 'show' : ''}`} id="inv-ins-form-drawer" role="dialog" aria-modal="true" aria-hidden={drawer !== 'form'}>
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark decorativo compartido con el patron de Categorias. */}
          {/* WHY: unificar el shell del drawer de alta/edicion con el resto del modulo Inventario. */}
          {/* IMPACT: solo presentacional; no altera validaciones ni submit. */}
          <i className="bi bi-box-seam inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === 'create' ? 'Nuevo insumo' : 'Editar insumo'}</div>
            <div className="inv-prod-drawer-sub">{drawerMode === 'create' ? 'Completa los campos y guarda.' : (selectedInsumo?.nombre_insumo || `Insumo #${selectedInsumo?.id_insumo ?? '-'}`)}</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeDrawer}><i className="bi bi-x-lg" /></button>
        </div>

        <form className="inv-prod-drawer-body" onSubmit={submitDrawer}>
          <div className="inv-ins-drawer-hero">
            <div className="inv-ins-drawer-hero__price">{fmtMoney(formValues?.precio || 0)}</div>
            {previewSnap ? <span className={`inv-ins-card__badge ${previewSnap.ui.badgeClass}`}>{previewSnap.ui.badge}</span> : null}
          </div>

          {/* NEW: se retira la UI de imagen del drawer de alta/edicion de Insumos. */}
          {/* WHY: el usuario pidio eliminar la imagen al crear o editar insumos sin afectar el resto del formulario. */}
          {/* IMPACT: la logica existente queda inertizada al no exponer controles visuales de carga/cambio de imagen. */}

          <div className="inv-ins-drawer-fields">
            <div>
              <label className="form-label">Nombre del insumo</label>
              <input ref={nombreInputRef} className={`form-control ${formErrors.nombre_insumo ? 'is-invalid' : ''}`} value={formValues.nombre_insumo ?? ''} onChange={(e) => setField('nombre_insumo', e.target.value)} placeholder="Ej: Queso mozzarella" />
              {fieldErr('nombre_insumo')}
            </div>

            <div className="inv-ins-drawer-grid">
              <div>
                <label className="form-label">Precio</label>
                <input className={`form-control ${formErrors.precio ? 'is-invalid' : ''}`} type="number" step="0.01" min="0" value={formValues.precio ?? ''} onChange={(e) => setField('precio', e.target.value)} />
                {fieldErr('precio')}
              </div>
              <div>
                <label className="form-label">Cantidad</label>
                <input ref={cantidadInputRef} className={`form-control ${formErrors.cantidad ? 'is-invalid' : ''}`} type="number" step="1" min="0" inputMode="numeric" value={formValues.cantidad ?? ''} onKeyDown={blockNonIntegerKeys} onChange={(e) => setField('cantidad', intInput(e.target.value))} />
                {fieldErr('cantidad')}
              </div>
              <div>
                <label className="form-label">Stock minimo</label>
                <input className={`form-control ${formErrors.stock_minimo ? 'is-invalid' : ''}`} type="number" step="1" min="0" inputMode="numeric" value={formValues.stock_minimo ?? ''} onKeyDown={blockNonIntegerKeys} onChange={(e) => setField('stock_minimo', intInput(e.target.value))} />
                {fieldErr('stock_minimo')}
              </div>
              <div>
                <label className="form-label">Almacen</label>
                <select className={`form-select ${formErrors.id_almacen ? 'is-invalid' : ''}`} value={String(formValues.id_almacen ?? '')} onChange={(e) => setField('id_almacen', e.target.value)} disabled={loadingAlmacenes}>
                  <option value="">{loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacen'}</option>
                  {almacenes.map((a) => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre} (Sucursal {a.id_sucursal})</option>)}
                </select>
                {fieldErr('id_almacen')}
              </div>
              <div>
                {/* NEW: selector de categoría de insumo usando el catálogo `categorias_insumos`. */}
                {/* WHY: permitir asignar la FK real `id_categoria_insumo` desde alta/edición de insumos. */}
                {/* IMPACT: solo agrega un campo al formulario; create/edit reutilizan el mismo submit y validaciones. */}
                <label className="form-label">Categoría de insumo</label>
                <select
                  className={`form-select ${formErrors.id_categoria_insumo ? 'is-invalid' : ''}`}
                  value={String(formValues.id_categoria_insumo ?? '')}
                  onChange={(e) => setField('id_categoria_insumo', e.target.value)}
                  disabled={categoriasInsumosActivas.length === 0}
                >
                  <option value="">{categoriasInsumosActivas.length ? 'Seleccione una categoría (opcional)' : 'Sin categorías de insumo activas'}</option>
                  {categoriasInsumosActivas.map((c) => (
                    <option key={c.id_categoria_insumo} value={c.id_categoria_insumo}>
                      {c.nombre_categoria}
                    </option>
                  ))}
                </select>
                {fieldErr('id_categoria_insumo')}
              </div>
              <div>
                <label className="form-label">Unidad de medida</label>
                <select
                  className={`form-select ${formErrors.id_unidad_medida ? 'is-invalid' : ''}`}
                  value={String(formValues.id_unidad_medida ?? '')}
                  onChange={(e) => setField('id_unidad_medida', e.target.value)}
                  disabled={loadingUnidadesMedida}
                >
                  <option value="">{loadingUnidadesMedida ? 'Cargando unidades...' : 'Seleccione una unidad (opcional)'}</option>
                  {unidadesMedida.map((unidad) => (
                    <option key={unidad.id_unidad_medida} value={unidad.id_unidad_medida}>
                      {getUnidadMedidaLabel(unidad.id_unidad_medida)}
                    </option>
                  ))}
                </select>
                {fieldErr('id_unidad_medida')}
              </div>
              <div>
                <label className="form-label">Fecha ingreso (opcional)</label>
                <input className={`form-control ${formErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`} type="date" value={formValues.fecha_ingreso_insumo ?? ''} onChange={(e) => setField('fecha_ingreso_insumo', e.target.value)} />
                {fieldErr('fecha_ingreso_insumo')}
              </div>
              <div>
                <label className="form-label">Fecha caducidad (opcional)</label>
                <input className={`form-control ${formErrors.fecha_caducidad ? 'is-invalid' : ''}`} type="date" value={formValues.fecha_caducidad ?? ''} onChange={(e) => setField('fecha_caducidad', e.target.value)} />
                {fieldErr('fecha_caducidad')}
              </div>
            </div>

            <div>
              <label className="form-label">Descripcion (opcional)</label>
              <textarea className={`form-control ${formErrors.descripcion ? 'is-invalid' : ''}`} rows="3" value={formValues.descripcion ?? ''} onChange={(e) => setField('descripcion', e.target.value)} />
              {fieldErr('descripcion')}
              <div className="inv-ins-help">Se sanitizan espacios extra al guardar.</div>
            </div>
          </div>

          {/* NEW: se elimina el bloque inferior de resumen/stepper/estado para dejar un drawer mas limpio. */}
          {/* WHY: el usuario pidio quitar los cuadros informativos, el ajuste rapido de existencias y el boton duplicado de inactivar. */}
          {/* IMPACT: la edicion sigue funcionando desde los campos del formulario y queda un unico CTA de inactivar en el footer. */}

          {drawerMsg ? <div className="inv-prod-drawer-feedback">{drawerMsg}</div> : null}

          <div className="inv-ins-drawer-footer">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={closeDrawer} disabled={creating || savingEdit || togglingEstado}>Cancelar</button>
            {drawerMode === 'edit' ? (
              <button type="button" className="btn inv-prod-btn-inactivate" onClick={() => setConfirm(selectedInsumo?.id_insumo, selectedInsumo?.nombre_insumo)} disabled={savingEdit || togglingEstado || !selectedInsumo}>Inactivar</button>
            ) : (
              <button type="button" className="btn inv-prod-btn-subtle" onClick={resetCreate} disabled={creating}>Limpiar</button>
            )}
            <button type="submit" className="btn inv-prod-btn-primary" disabled={creating || savingEdit || togglingEstado || (drawerMode === 'edit' && !editForm)}>
              {drawerMode === 'create' ? (creating ? 'Creando...' : 'Crear') : (savingEdit ? 'Guardando...' : 'Guardar cambios')}
            </button>
          </div>
        </form>
      </aside>
      {/* NEW: modal de detalle solo lectura para la accion "Ver" del listado. */}
      {/* WHY: mostrar informacion completa sin sobrecargar columnas ni reutilizar el drawer de edicion. */}
      {/* IMPACT: agrega una vista responsive de consulta; no modifica endpoints ni payloads. */}
      {detailInsumo && detailSnap ? (
        <div className="modal fade show inv-prod-modal-backdrop" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2550 }} role="dialog" aria-modal="true" onClick={closeDetailModal}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog inv-ins-detail-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow inv-prod-modal-content inv-ins-detail-modal">
              <div className="modal-header inv-ins-detail-modal__header">
                <div className="inv-ins-detail-modal__title-wrap">
                  <div className="inv-ins-detail-modal__icon">
                    <i className="bi bi-box2-heart" />
                  </div>
                  <div>
                    <div className="fw-semibold">Detalle de insumo</div>
                    <div className="small text-muted">{detailInsumo?.nombre_insumo || `Insumo #${detailInsumo?.id_insumo ?? '-'}`}</div>
                  </div>
                </div>
                <div className="inv-ins-detail-modal__header-actions">
                  <span className={`inv-ins-status-pill inv-ins-detail-modal__status ${resolveInsumoStatusClass(detailSnap.ui.key)}`}>{detailSnap.ui.badge}</span>
                  <button type="button" className="btn btn-sm inv-ins-detail-modal__close" onClick={closeDetailModal}><i className="bi bi-x-lg" /></button>
                </div>
              </div>

              <div className="modal-body inv-prod-modal-body inv-ins-detail-modal__body">
                <div className="inv-ins-detail-modal__hero">
                  {detailSummaryCards.map((card) => (
                    <div key={card.key} className="inv-ins-detail-modal__hero-card">
                      <div className="inv-ins-detail-modal__hero-head">
                        <i className={`bi ${card.icon}`} aria-hidden="true" />
                        <span>{card.label}</span>
                      </div>
                      <strong>{card.value}</strong>
                    </div>
                  ))}
                </div>

                {/* NEW: composicion fija en bloques para replicar un modal horizontal tipo detalle de venta sin tabs ni footer de acciones. */}
                {/* WHY: la referencia pide un detalle fino, mas ancho que alto y sin botones visibles dentro del contenido. */}
                {/* IMPACT: solo reordena la presentacion del modal de consulta; no modifica endpoints ni flujos del resto del modulo. */}
                <div className="inv-ins-detail-modal__content">
                  <div className="inv-ins-detail-modal__column">
                    {detailInfoSections
                      .filter((section) => section.key !== 'related')
                      .map((section) => (
                        <section key={section.key} className="inv-ins-detail-modal__section-card">
                          <div className="inv-ins-detail-modal__section-title">{section.title}</div>
                          <div className="inv-ins-detail-modal__section-grid">
                            {section.items.map((item) => (
                              <article key={item.key} className="inv-ins-detail-modal__info-card">
                                <div className="inv-ins-detail-modal__info-head">
                                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                                  <span>{item.label}</span>
                                </div>
                                <strong>{item.value}</strong>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                  </div>

                  <div className="inv-ins-detail-modal__column">
                    {detailInfoSections
                      .filter((section) => section.key === 'related')
                      .map((section) => (
                        <section key={section.key} className="inv-ins-detail-modal__section-card">
                          <div className="inv-ins-detail-modal__section-title">{section.title}</div>
                          <div className="inv-ins-detail-modal__section-grid">
                            {section.items.map((item) => (
                              <article key={item.key} className="inv-ins-detail-modal__info-card">
                                <div className="inv-ins-detail-modal__info-head">
                                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                                  <span>{item.label}</span>
                                </div>
                                <strong>{item.value}</strong>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {confirmModal.show && (
        <div className="modal fade show inv-prod-modal-backdrop inv-prod-modal-backdrop-danger" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2600 }} role="dialog" aria-modal="true" onClick={closeConfirm}>
          <div className="modal-dialog modal-dialog-centered inv-prod-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow inv-prod-modal-content inv-prod-delete-modal">
              <div className="modal-header d-flex align-items-center justify-content-between inv-prod-modal-header danger">
                <div className="d-flex align-items-start gap-2">
                  <i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" />
                  <div>
                    <div className="fw-semibold">{INACTIVATE_CONFIRM_COPY.title}</div>
                    <div className="small text-muted">{INACTIVATE_CONFIRM_COPY.subtitle}</div>
                  </div>
                </div>
                <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={closeConfirm}><i className="bi bi-x-lg" /></button>
              </div>
              <div className="modal-body inv-prod-modal-body">
                <div className="mb-2">{INACTIVATE_CONFIRM_COPY.question}</div>
                <div className="text-muted small inv-prod-delete-name"><i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" /> <span className="fw-semibold">{confirmModal.nombre || INACTIVATE_CONFIRM_COPY.fallbackName}</span></div>
              </div>
              <div className="modal-footer d-flex gap-2 inv-prod-modal-footer">
                <button className="btn btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={closeConfirm} disabled={deleting}>Cancelar</button>
                <button className="btn inv-prod-btn-inactivate" type="button" onClick={deleteConfirmed} disabled={deleting}><i className={INACTIVATE_CONFIRM_COPY.iconClass} aria-hidden="true" /><span>{deleting ? 'Inactivando...' : 'Inactivar'}</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InsumosTab;
