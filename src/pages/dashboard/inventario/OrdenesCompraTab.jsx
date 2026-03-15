import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { PERMISSIONS } from '../../../utils/permissions';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  resolveInventarioImageUrl
} from '../../../utils/inventarioImagenes';

const ORDER_LIMIT = 20;
const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'EN_COMPRA', 'ABASTECIDA', 'CANCELADA'];
const POLLING_MS = 2500;
const CATALOG_CARDS_PER_PAGE = 8;
// AM: modos de descuento administrativos para compra real (monto fijo o porcentaje).
const DISCOUNT_TYPE_MONTO = 'MONTO';
const DISCOUNT_TYPE_PORCENTAJE = 'PORCENTAJE';
// AM: estados operativos de solicitudes de item no registrado dentro de una OC.
const ITEM_REQUEST_STATE_PENDIENTE = 'PENDIENTE';
const ITEM_REQUEST_STATE_EN_REVISION = 'EN_REVISION';
const ITEM_REQUEST_STATE_ATENDIDA = 'ATENDIDA';
const ITEM_REQUEST_STATE_RECHAZADA = 'RECHAZADA';

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '');

const parsePositiveInt = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  const text = String(rawValue).trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
};

const parseNonNegativeNumber = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  const text = String(rawValue).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
};

const parseOptionalPositiveInt = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  return parsePositiveInt(rawValue);
};

const round2 = (rawValue) => Math.round(Number(rawValue || 0) * 100) / 100;

const resolveDiscountType = (rawValue) => {
  const text = String(rawValue || DISCOUNT_TYPE_MONTO)
    .trim()
    .toUpperCase();
  if (text === DISCOUNT_TYPE_PORCENTAJE) return DISCOUNT_TYPE_PORCENTAJE;
  return DISCOUNT_TYPE_MONTO;
};

const normalizeAlmacenesSelection = (rawValue, max = 2) => {
  const source = Array.isArray(rawValue) ? rawValue : hasValue(rawValue) ? [rawValue] : [];
  return Array.from(
    new Set(
      source
        .map((value) => parsePositiveInt(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ).slice(0, Math.max(1, max));
};

const sanitizeInt = (rawValue) => String(rawValue ?? '').replace(/[^\d]/g, '');
const sanitizeDecimal = (rawValue) => String(rawValue ?? '').replace(/[^\d.]/g, '');
const normalizeText = (rawValue, max = 1000) =>
  String(rawValue ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const boolish = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value ?? '').trim().toLowerCase() === 'true';

const getStockState = (item) => {
  const qty = Number.parseInt(String(item?.cantidad ?? '0'), 10) || 0;
  const min = Number.parseInt(String(item?.stock_minimo ?? '0'), 10) || 0;
  if (qty <= 0) return 'SIN STOCK';
  if (qty <= min) return 'STOCK BAJO';
  return 'OK';
};

const resolveEstado = (row) => {
  const estado = String(row?.estado_flujo ?? '')
    .trim()
    .toUpperCase();
  if (ESTADOS.includes(estado)) return estado;
  return row?.estado ? 'ABASTECIDA' : 'PENDIENTE';
};

const badgeClass = (estado) => {
  if (estado === 'PENDIENTE') return 'bg-warning text-dark';
  if (estado === 'EN_ESPERA') return 'bg-secondary';
  if (estado === 'ENVIADO') return 'bg-dark';
  if (estado === 'APROBADA') return 'bg-primary';
  if (estado === 'RECHAZADA') return 'bg-danger';
  if (estado === 'EN_COMPRA') return 'bg-info text-dark';
  if (estado === 'ABASTECIDA') return 'bg-success';
  return 'bg-secondary';
};

const estadoToneClass = (estado) => `is-${String(estado || '').toLowerCase().replace('_', '-')}`;

const estadoIconClass = (estado) => {
  if (estado === 'PENDIENTE') return 'bi bi-hourglass-split';
  if (estado === 'EN_ESPERA') return 'bi bi-hourglass';
  if (estado === 'ENVIADO') return 'bi bi-send-check';
  if (estado === 'APROBADA') return 'bi bi-patch-check';
  if (estado === 'RECHAZADA') return 'bi bi-x-octagon';
  if (estado === 'EN_COMPRA') return 'bi bi-receipt';
  if (estado === 'ABASTECIDA') return 'bi bi-box-seam';
  return 'bi bi-slash-circle';
};

const formatEstadoLabel = (estado) => {
  if (estado === 'EN_ESPERA') return 'EN ESPERA';
  if (estado === 'ENVIADO') return 'ENVIADO';
  return String(estado || '').replace('_', ' ');
};

const getCategoriaLabel = (row, fallback = '') =>
  normalizeText(
    row?.nombre_categoria ||
      row?.nombre_categoria_producto ||
      row?.nombre_categoria_insumo ||
      row?.nombre,
    120
  ) || fallback;

const resolveItemRequestOnlyState = (row) => {
  const pendientes = Number(row?.total_solicitudes_item_pendientes || 0);
  const enRevision = Number(row?.total_solicitudes_item_en_revision || 0);
  const atendidas = Number(row?.total_solicitudes_item_atendidas || 0);
  const rechazadas = Number(row?.total_solicitudes_item_rechazadas || 0);

  if (enRevision > 0) return 'EN_REVISION';
  if (pendientes > 0) return 'PENDIENTE_REVISION';
  if (atendidas > 0 && rechazadas > 0) return 'PARCIAL';
  if (atendidas > 0) return 'ATENDIDA';
  if (rechazadas > 0) return 'RECHAZADA';
  return 'PENDIENTE_REVISION';
};

const itemRequestOnlyBadgeClass = (estadoSolicitud) => {
  if (estadoSolicitud === 'PENDIENTE_REVISION') return 'bg-warning text-dark';
  if (estadoSolicitud === 'EN_REVISION') return 'bg-info text-dark';
  if (estadoSolicitud === 'ATENDIDA') return 'bg-success';
  if (estadoSolicitud === 'RECHAZADA') return 'bg-danger';
  if (estadoSolicitud === 'PARCIAL') return 'bg-secondary';
  return 'bg-secondary';
};

const itemRequestOnlyLabel = (estadoSolicitud) => {
  if (estadoSolicitud === 'PENDIENTE_REVISION') return 'PENDIENTE REVISION';
  if (estadoSolicitud === 'EN_REVISION') return 'EN REVISION';
  if (estadoSolicitud === 'ATENDIDA') return 'ATENDIDA';
  if (estadoSolicitud === 'RECHAZADA') return 'RECHAZADA';
  if (estadoSolicitud === 'PARCIAL') return 'PARCIAL';
  return 'PENDIENTE REVISION';
};

const parseItemRequestState = (value) => {
  const estado = String(value || '')
    .trim()
    .toUpperCase();
  if (
    [
      ITEM_REQUEST_STATE_PENDIENTE,
      ITEM_REQUEST_STATE_EN_REVISION,
      ITEM_REQUEST_STATE_ATENDIDA,
      ITEM_REQUEST_STATE_RECHAZADA
    ].includes(estado)
  ) {
    return estado;
  }
  return ITEM_REQUEST_STATE_PENDIENTE;
};

const itemRequestBadgeClass = (estado) => {
  if (estado === ITEM_REQUEST_STATE_PENDIENTE) return 'bg-warning text-dark';
  if (estado === ITEM_REQUEST_STATE_EN_REVISION) return 'bg-info text-dark';
  if (estado === ITEM_REQUEST_STATE_ATENDIDA) return 'bg-success';
  if (estado === ITEM_REQUEST_STATE_RECHAZADA) return 'bg-danger';
  return 'bg-secondary';
};

const stockBadgeClass = (stockState) => {
  if (stockState === 'SIN STOCK') return 'is-out';
  if (stockState === 'STOCK BAJO') return 'is-low';
  return 'is-ok';
};

const resolveItemIcon = (itemTipo) => (itemTipo === 'producto' ? 'bi bi-basket2-fill' : 'bi bi-box-seam-fill');

const formatDate = (rawValue) => {
  if (!rawValue) return '-';
  const text = String(rawValue);
  const date = text.includes('T') ? text.split('T')[0] : text.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  return text;
};

const formatTime = (rawValue) => {
  if (!rawValue) return '-';
  const text = String(rawValue).trim();
  const withSpace = text.replace('T', ' ');
  const parts = withSpace.split(' ');
  if (parts.length < 2) return '-';
  const timeRaw = String(parts[1] || '');
  const hhmmss = timeRaw.split('.')[0] || '';
  const [hh = '', mm = '', ss = ''] = hhmmss.split(':');
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) return '-';
  return `${hh}:${mm}:${/^\d{2}$/.test(ss) ? ss : '00'}`;
};

const resolveSucursalLabel = (row) => {
  const nombre = normalizeText(row?.nombre_sucursal, 120);
  if (nombre) return nombre;
  const idSucursal = parsePositiveInt(row?.id_sucursal);
  return idSucursal ? `Sucursal #${idSucursal}` : '-';
};

// AM: recepcion se considera registrada aunque la factura sea opcional.
const hasReceptionRegistered = (row) =>
  Boolean(
    parsePositiveInt(row?.id_usuario_recepcion) ||
      hasValue(row?.fecha_recepcion_reportada) ||
      hasValue(normalizeText(row?.observacion_recepcion, 1000)) ||
      parsePositiveInt(row?.id_archivo_factura_recepcion)
  );

const formatMoney = (rawValue) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return 'L. 0.00';
  return `L. ${value.toFixed(2)}`;
};

const resolveItemAlmacenes = (row) => {
  const fromArray = normalizeAlmacenesSelection(row?.id_almacenes, 50);
  if (fromArray.length > 0) return fromArray;

  const fallback = parsePositiveInt(row?.id_almacen);
  return fallback ? [fallback] : [];
};

const toCatalog = (productos, insumos) => {
  const prod = (Array.isArray(productos) ? productos : [])
    .filter((row) => boolish(row?.estado))
    .map((row) => {
      const idAlmacenes = resolveItemAlmacenes(row);
      return {
        key: `producto:${row.id_producto}`,
        item_tipo: 'producto',
        id_item: Number(row.id_producto),
        id_almacen: idAlmacenes[0] || null,
        id_almacenes: idAlmacenes,
        nombre: row.nombre_producto || `Producto #${row.id_producto}`,
        descripcion: row.descripcion_producto || '',
        cantidad: Number.parseInt(String(row.cantidad ?? '0'), 10) || 0,
        stock_minimo: Number.parseInt(String(row.stock_minimo ?? '0'), 10) || 0
      };
    });

  const ins = (Array.isArray(insumos) ? insumos : [])
    .filter((row) => boolish(row?.estado))
    .map((row) => {
      const idAlmacenes = resolveItemAlmacenes(row);
      return {
        key: `insumo:${row.id_insumo}`,
        item_tipo: 'insumo',
        id_item: Number(row.id_insumo),
        id_almacen: idAlmacenes[0] || null,
        id_almacenes: idAlmacenes,
        nombre: row.nombre_insumo || `Insumo #${row.id_insumo}`,
        descripcion: row.descripcion || '',
        cantidad: Number.parseInt(String(row.cantidad ?? '0'), 10) || 0,
        stock_minimo: Number.parseInt(String(row.stock_minimo ?? '0'), 10) || 0
      };
    });

  return [...prod, ...ins].filter((row) => row.id_item > 0);
};

const toAlmacenesCatalog = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => boolish(row?.sucursal_estado ?? row?.estado ?? true))
    .map((row) => ({
      id_almacen: Number(row.id_almacen),
      nombre: row.nombre || `Almacen #${row.id_almacen}`,
      id_sucursal: Number(row.id_sucursal),
      nombre_sucursal: row.nombre_sucursal || (row.id_sucursal ? `Sucursal #${row.id_sucursal}` : 'Sin sucursal')
    }))
    .filter((row) => row.id_almacen > 0);

const formatAlmacenDisplay = (almacen) => {
  if (!almacen) return '-';
  return `${almacen.nombre} (${almacen.nombre_sucursal})`;
};

const emptyConvertPanel = () => ({
  open: false,
  loading: false,
  submit_action: '',
  error: '',
  orden: null,
  id_proveedor: '',
  fecha_compra: '',
  observacion_admin: '',
  descuento_tipo: DISCOUNT_TYPE_MONTO,
  descuento_valor: '0',
  isv_pct: '0',
  detalles: [],
  factura_recepcion_url: '',
  transferencia_url_actual: '',
  transferencia_file: null,
  transferencia_preview_url: '',
  transferencia_error: ''
});

const emptyReviewModal = () => ({
  open: false,
  mode: 'aprobar',
  orden: null,
  comentario: '',
  loading: false,
  error: ''
});

const emptySupplyModal = () => ({
  open: false,
  orden: null,
  observacion: '',
  loading: false,
  error: ''
});

const emptyRecepcionModal = () => ({
  open: false,
  orden: null,
  observacion: '',
  usuario_sistema: '',
  sucursal_sistema: '',
  fecha_sistema: '',
  hora_sistema: '',
  loading: false,
  error: '',
  factura_file: null,
  factura_preview_url: '',
  factura_error: ''
});

const emptyItemRequestModal = () => ({
  open: false,
  tipo_item: 'producto',
  nombre_sugerido: '',
  descripcion: '',
  cantidad_sugerida: '1',
  error: ''
});

const emptyEditDetallesModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  rows: [],
  add_rows: [],
  // AM: controla filtro rapido por tipo y texto en el bloque "Agregar nuevo item".
  selected_item_tipo: 'producto',
  search_item: ''
});

const emptyItemRequestDecisionModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  solicitud: null,
  accion: 'aprobar',
  comentario: ''
});

const emptyQuickCreateItemModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  solicitud: null,
  tipo_item: 'producto',
  nombre: '',
  descripcion: '',
  cantidad: '1',
  precio: '0',
  stock_minimo: '0',
  id_categoria_producto: '',
  id_categoria_insumo: '',
  id_unidad_medida: '',
  id_almacen: ''
});

const OrdenesCompraTab = ({ openToast }) => {
  const { can, canAny, loading: permisosLoading } = usePermisos();
  const { user } = useAuth();

  // AM: permisos del submodulo OC para visibilidad y transiciones de workflow.
  const canCrear = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR);
  const canVer = canAny([
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canVerTodas = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS);
  const canGestionar = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR);
  const canConvertir = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CONVERTIR);
  const canAbastecer = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_ABASTECER);
  // AM: recepcion operativa solo con permiso dedicado; evita habilitarla por permiso de crear.
  const canRecepcionar = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR);
  // AM: solicitud de item nuevo solo para perfiles operativos sin alta directa de catalogo.
  const canCrearProductos = can(PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR);
  const canCrearInsumos = can(PERMISSIONS.INVENTARIO_INSUMOS_CREAR);
  const canCrearCatalogoDirecto = canAny([
    PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR,
    PERMISSIONS.INVENTARIO_INSUMOS_CREAR
  ]);
  const canSolicitarItemNuevo = canCrear && !canCrearCatalogoDirecto;
  // AM: separa actor operativo (cocina/cajero) de actor administrativo para no mezclar etapas.
  const isAdminFlowActor = canConvertir || canAbastecer || canGestionar || canVerTodas;
  const isSucursalOperativeActor = canRecepcionar && !isAdminFlowActor;
  const toast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') openToast(title, message, variant);
    },
    [openToast]
  );

  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  // AM: catalogos auxiliares para alta rapida de solicitudes de item no registrado.
  const [categoriasProductos, setCategoriasProductos] = useState([]);
  const [categoriasInsumos, setCategoriasInsumos] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  // AM: contexto backend para forzar sucursal automatica en creacion operativa.
  const [workflowCreateContext, setWorkflowCreateContext] = useState({
    id_sucursal_usuario: null,
    restringido_a_sucursal_usuario: false
  });
  const [draftAlmacenesBase, setDraftAlmacenesBase] = useState([]);
  const [catalogSucursalFilter, setCatalogSucursalFilter] = useState('');
  const [flowSucursalFilter, setFlowSucursalFilter] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(true);
  const [catalogPage, setCatalogPage] = useState(0);
  const [draft, setDraft] = useState([]);
  const [draftItemRequests, setDraftItemRequests] = useState([]);
  const [observacion, setObservacion] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [scope, setScope] = useState('mine');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [ordenes, setOrdenes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [rowBusy, setRowBusy] = useState({});

  const [detalleActual, setDetalleActual] = useState({ loading: false, error: '', data: null });
  const [convertPanel, setConvertPanel] = useState(emptyConvertPanel);
  const [reviewModal, setReviewModal] = useState(emptyReviewModal);
  const [supplyModal, setSupplyModal] = useState(emptySupplyModal);
  const [recepcionModal, setRecepcionModal] = useState(emptyRecepcionModal);
  const [itemRequestModal, setItemRequestModal] = useState(emptyItemRequestModal);
  const [editDetallesModal, setEditDetallesModal] = useState(emptyEditDetallesModal);
  const [itemRequestDecisionModal, setItemRequestDecisionModal] = useState(emptyItemRequestDecisionModal);
  const [quickCreateItemModal, setQuickCreateItemModal] = useState(emptyQuickCreateItemModal);
  // AM: perfiles operativos crean OC fijando sucursal desde backend/contexto, sin selector manual.
  const isOperationalCreateRestricted =
    isSucursalOperativeActor && Boolean(workflowCreateContext?.restringido_a_sucursal_usuario);

  useEffect(() => {
    // AM: inicializa el scope por defecto segun permisos (super admin = all).
    if (permisosLoading) return;
    if (!scopeInitialized) {
      setScope(canVerTodas ? 'all' : 'mine');
      setScopeInitialized(true);
      return;
    }
    if (!canVerTodas && scope === 'all') setScope('mine');
  }, [canVerTodas, permisosLoading, scope, scopeInitialized]);

  useEffect(() => {
    // AM: fija sucursal de catalogo para perfiles operativos restringidos por backend.
    if (!isOperationalCreateRestricted) return;
    const idSucursalUsuario = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    if (!idSucursalUsuario) return;
    setCatalogSucursalFilter(String(idSucursalUsuario));
  }, [isOperationalCreateRestricted, workflowCreateContext?.id_sucursal_usuario]);

  const catalog = useMemo(() => toCatalog(productos, insumos), [insumos, productos]);
  const almacenesCatalog = useMemo(() => toAlmacenesCatalog(almacenes), [almacenes]);
  const sucursalesCatalog = useMemo(() => {
    const map = new Map();
    for (const almacen of almacenesCatalog) {
      const idSucursal = parsePositiveInt(almacen?.id_sucursal);
      if (!idSucursal) continue;
      if (!map.has(idSucursal)) {
        map.set(idSucursal, {
          id_sucursal: idSucursal,
          nombre_sucursal: almacen.nombre_sucursal || `Sucursal #${idSucursal}`
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.id_sucursal - b.id_sucursal);
  }, [almacenesCatalog]);
  const almacenesCatalogFiltradosPorSucursal = useMemo(() => {
    const idSucursal = isOperationalCreateRestricted
      ? parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario)
      : parseOptionalPositiveInt(catalogSucursalFilter);
    if (!idSucursal) return almacenesCatalog;
    return almacenesCatalog.filter((row) => Number(row.id_sucursal) === Number(idSucursal));
  }, [almacenesCatalog, catalogSucursalFilter, isOperationalCreateRestricted, workflowCreateContext?.id_sucursal_usuario]);
  const almacenesMap = useMemo(
    () => new Map(almacenesCatalog.map((row) => [Number(row.id_almacen), row])),
    [almacenesCatalog]
  );
  const selectedBaseAlmacenes = useMemo(
    () =>
      normalizeAlmacenesSelection(draftAlmacenesBase, 1).filter((idAlmacen) =>
        almacenesMap.has(idAlmacen)
      ),
    [almacenesMap, draftAlmacenesBase]
  );

  useEffect(() => {
    if (almacenesCatalog.length === 0) {
      setDraftAlmacenesBase([]);
      return;
    }

    const visibleAlmacenes =
      almacenesCatalogFiltradosPorSucursal.length > 0
        ? almacenesCatalogFiltradosPorSucursal
        : almacenesCatalog;

    setDraftAlmacenesBase((prev) => {
      const valid = normalizeAlmacenesSelection(prev, 1).filter((idAlmacen) =>
        visibleAlmacenes.some((row) => Number(row.id_almacen) === Number(idAlmacen))
      );
      if (valid.length > 0) return valid;
      return [Number(visibleAlmacenes[0].id_almacen)];
    });
  }, [almacenesCatalog, almacenesCatalogFiltradosPorSucursal]);

  const filteredCatalog = useMemo(() => {
    const query = normalizeText(catalogSearch, 120).toLowerCase();
    // AM: el catalogo se gobierna por la sucursal/almacen destino seleccionado en la solicitud.
    const warehouseFilterSet = new Set(selectedBaseAlmacenes);
    const shouldFilterByWarehouse = warehouseFilterSet.size > 0;
    return catalog
      .map((row) => ({ ...row, stock_state: getStockState(row) }))
      .filter((row) => {
        if (!shouldFilterByWarehouse) return true;
        const rowAlmacenes = normalizeAlmacenesSelection(row?.id_almacenes, 50);
        if (rowAlmacenes.length === 0) {
          const fallbackAlmacen = parsePositiveInt(row?.id_almacen);
          if (!fallbackAlmacen) return true;
          return warehouseFilterSet.has(fallbackAlmacen);
        }
        return rowAlmacenes.some((idAlmacen) => warehouseFilterSet.has(idAlmacen));
      })
      .filter((row) => (soloAlertas ? row.stock_state !== 'OK' : true))
      .filter((row) => (query ? `${row.nombre} ${row.descripcion} ${row.item_tipo}`.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        const rank = { 'SIN STOCK': 0, 'STOCK BAJO': 1, OK: 2 };
        const rankA = rank[a.stock_state] ?? 99;
        const rankB = rank[b.stock_state] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.nombre.localeCompare(b.nombre, 'es');
      })
      .slice(0, 120);
  }, [catalog, catalogSearch, selectedBaseAlmacenes, soloAlertas]);

  const catalogPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < filteredCatalog.length; i += CATALOG_CARDS_PER_PAGE) {
      pages.push(filteredCatalog.slice(i, i + CATALOG_CARDS_PER_PAGE));
    }
    return pages;
  }, [filteredCatalog]);

  const catalogDotItems = useMemo(() => {
    const totalPages = catalogPages.length;
    if (totalPages <= 0) return [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => ({ type: 'page', index }));
    }

    const pageSet = new Set([0, totalPages - 1, catalogPage, catalogPage - 1, catalogPage + 1]);
    if (catalogPage <= 2) {
      pageSet.add(1);
      pageSet.add(2);
    }
    if (catalogPage >= totalPages - 3) {
      pageSet.add(totalPages - 2);
      pageSet.add(totalPages - 3);
    }

    const sortedPages = Array.from(pageSet)
      .filter((index) => index >= 0 && index < totalPages)
      .sort((a, b) => a - b);

    const dots = [];
    for (let i = 0; i < sortedPages.length; i += 1) {
      const index = sortedPages[i];
      dots.push({ type: 'page', index });

      const next = sortedPages[i + 1];
      if (next !== undefined && next - index > 1) {
        dots.push({ type: 'ellipsis', key: `ellipsis-${index}-${next}` });
      }
    }
    return dots;
  }, [catalogPage, catalogPages.length]);

  const catalogTotals = useMemo(() => {
    const totals = {
      productos: 0,
      insumos: 0
    };
    for (const item of filteredCatalog) {
      if (item.item_tipo === 'producto') totals.productos += 1;
      if (item.item_tipo === 'insumo') totals.insumos += 1;
    }
    return totals;
  }, [filteredCatalog]);

  // AM: lista de catalogo elegible para editar lineas; excluye repetidos y filtra por sucursal de la orden.
  const editDetalleCatalogOptions = useMemo(() => {
    const existingRows = Array.isArray(editDetallesModal?.rows) ? editDetallesModal.rows : [];
    const newRows = Array.isArray(editDetallesModal?.add_rows) ? editDetallesModal.add_rows : [];
    const idSucursalOrden = parseOptionalPositiveInt(editDetallesModal?.orden?.id_sucursal);
    const takenKeys = new Set(
      [...existingRows, ...newRows]
        .map((row) => {
          const itemTipo = String(row?.item_tipo || '')
            .trim()
            .toLowerCase();
          const idItem = parsePositiveInt(row?.id_item);
          if (!['producto', 'insumo'].includes(itemTipo) || !idItem) return null;
          return `${itemTipo}:${idItem}`;
        })
        .filter(Boolean)
    );

    return catalog
      .map((row) => {
        const idAlmacenesBase = normalizeAlmacenesSelection(
          row?.id_almacenes_disponibles ?? row?.id_almacenes,
          50
        ).filter((idAlmacen) => almacenesMap.has(idAlmacen));
        const idAlmacenesSucursal = idAlmacenesBase.filter((idAlmacen) => {
          if (!idSucursalOrden) return true;
          const almacen = almacenesMap.get(idAlmacen);
          const idSucursalAlmacen = parseOptionalPositiveInt(almacen?.id_sucursal);
          return !idSucursalAlmacen || Number(idSucursalAlmacen) === Number(idSucursalOrden);
        });
        return {
          ...row,
          id_almacenes_sucursal: idAlmacenesSucursal
        };
      })
      .filter((row) => {
        const itemTipo = String(row?.item_tipo || '')
          .trim()
          .toLowerCase();
        const idItem = parsePositiveInt(row?.id_item);
        if (!['producto', 'insumo'].includes(itemTipo) || !idItem) return false;
        if (!Array.isArray(row?.id_almacenes_sucursal) || row.id_almacenes_sucursal.length <= 0) return false;
        return !takenKeys.has(`${itemTipo}:${idItem}`);
      })
      .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'))
      .slice(0, 300);
  }, [almacenesMap, catalog, editDetallesModal?.add_rows, editDetallesModal?.orden?.id_sucursal, editDetallesModal?.rows]);

  // AM: filtro UX (tipo + buscador) para seleccion rapida de producto/insumo en modal admin.
  const editDetalleCatalogFiltered = useMemo(() => {
    const tipo = String(editDetallesModal?.selected_item_tipo || 'producto')
      .trim()
      .toLowerCase();
    const search = normalizeText(editDetallesModal?.search_item, 120).toLowerCase();

    return editDetalleCatalogOptions
      .filter((row) => String(row?.item_tipo || '').toLowerCase() === tipo)
      .filter((row) =>
        search
          ? `${String(row?.nombre || '')} ${String(row?.descripcion || '')}`.toLowerCase().includes(search)
          : true
      )
      .slice(0, 150);
  }, [editDetalleCatalogOptions, editDetallesModal?.search_item, editDetallesModal?.selected_item_tipo]);

  const quickCreateAlmacenesOptions = useMemo(() => {
    const idSucursalOrden = parseOptionalPositiveInt(quickCreateItemModal?.orden?.id_sucursal);
    if (!idSucursalOrden) return almacenesCatalog;
    const scoped = almacenesCatalog.filter(
      (row) => Number(parseOptionalPositiveInt(row?.id_sucursal) || 0) === Number(idSucursalOrden)
    );
    return scoped.length > 0 ? scoped : almacenesCatalog;
  }, [almacenesCatalog, quickCreateItemModal?.orden?.id_sucursal]);

  useEffect(() => {
    if (!quickCreateItemModal?.open) return;
    if (parsePositiveInt(quickCreateItemModal?.id_almacen)) return;

    const idSucursalUsuarioActual = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    const preferidosUsuario = quickCreateAlmacenesOptions.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalUsuarioActual || !idSucursalAlmacen) return false;
      return Number(idSucursalAlmacen) === Number(idSucursalUsuarioActual);
    });
    const idAlmacenPredeterminado = parsePositiveInt(
      preferidosUsuario?.[0]?.id_almacen || quickCreateAlmacenesOptions?.[0]?.id_almacen
    );
    if (!idAlmacenPredeterminado) return;

    setQuickCreateItemModal((prev) => {
      if (!prev?.open) return prev;
      if (parsePositiveInt(prev?.id_almacen)) return prev;
      // AM: asegura autoseleccion de almacen al abrir modal aunque catalogos carguen despues.
      return { ...prev, id_almacen: String(idAlmacenPredeterminado) };
    });
  }, [quickCreateAlmacenesOptions, quickCreateItemModal?.id_almacen, quickCreateItemModal?.open, workflowCreateContext?.id_sucursal_usuario]);

  useEffect(() => {
    const pagesCount = catalogPages.length;
    if (pagesCount === 0) {
      if (catalogPage !== 0) setCatalogPage(0);
      return;
    }
    if (catalogPage > pagesCount - 1) {
      setCatalogPage(0);
    }
  }, [catalogPage, catalogPages.length]);

  useEffect(() => {
    setCatalogPage(0);
  }, [catalogSearch, soloAlertas]);

  const draftValidation = useMemo(() => {
    const errors = {};
    for (const row of draft) {
      const cantidad = parsePositiveInt(row?.cantidad);
      const almacenesSeleccionados = normalizeAlmacenesSelection(row?.id_almacenes, 1);
      const almacenesDisponiblesItem = normalizeAlmacenesSelection(
        row?.id_almacenes_disponibles ?? row?.id_almacenes,
        50
      );
      if (!cantidad) {
        errors[row.key] = 'Cantidad invalida. Debe ser entero mayor a 0.';
      } else if (almacenesSeleccionados.length !== 1) {
        errors[row.key] = 'Selecciona exactamente 1 almacen destino.';
      } else if (almacenesSeleccionados.some((id) => !almacenesMap.has(id))) {
        errors[row.key] = 'Uno de los almacenes seleccionados ya no existe o esta inactivo.';
      } else if (
        almacenesDisponiblesItem.length > 0 &&
        almacenesSeleccionados.some((id) => !almacenesDisponiblesItem.includes(id))
      ) {
        errors[row.key] = 'El item no esta asignado al almacen seleccionado.';
      }
    }
    return errors;
  }, [draft, almacenesMap]);

  const draftTotals = useMemo(() => {
    const totals = { productos: 0, insumos: 0, unidades: 0 };
    for (const row of draft) {
      const cantidad = parsePositiveInt(row?.cantidad) || 0;
      totals.unidades += cantidad;
      if (row.item_tipo === 'producto') totals.productos += 1;
      if (row.item_tipo === 'insumo') totals.insumos += 1;
    }
    return totals;
  }, [draft]);

  const hasDraftErrors = Object.keys(draftValidation).length > 0;
  const hasDraftContent = draft.length > 0 || draftItemRequests.length > 0;

  // AM: conserva historial operativo visible para sucursal; los cards recepcionados quedan solo consulta.
  const ordenesVisibles = useMemo(() => {
    return ordenes;
  }, [ordenes]);

  const resolveEstadoVisual = useCallback(
    (row) => {
      const estado = resolveEstado(row);
      // AM: admin ve APROBADA como "EN ESPERA" hasta que sucursal registre recepcion.
      if (estado === 'APROBADA' && isAdminFlowActor && !hasReceptionRegistered(row)) return 'EN_ESPERA';
      // AM: para cocina/cajero, una OC recepcionada pasa a visual historica "ENVIADO" sin habilitar acciones operativas.
      if (estado === 'EN_COMPRA' && isSucursalOperativeActor && hasReceptionRegistered(row)) return 'ENVIADO';
      return estado;
    },
    [isAdminFlowActor, isSucursalOperativeActor]
  );

  const workflowStats = useMemo(() => {
    const stats = {
      total: ordenesVisibles.length,
      pendientes: 0,
      aprobadas: 0,
      enCompra: 0,
      abastecidas: 0
    };
    for (const row of ordenesVisibles) {
      const estado = resolveEstadoVisual(row);
      if (estado === 'PENDIENTE') stats.pendientes += 1;
      if (estado === 'APROBADA' || estado === 'EN_ESPERA') stats.aprobadas += 1;
      if (estado === 'EN_COMPRA' || estado === 'ENVIADO') stats.enCompra += 1;
      if (estado === 'ABASTECIDA') stats.abastecidas += 1;
    }
    return stats;
  }, [ordenesVisibles, resolveEstadoVisual]);

  // AM: layout operativo: arriba solicitud + flujo (si ambos permisos); abajo detalle de solicitud.
  const showDualTopPanels = canCrear && canVer;

  const loadCatalogs = useCallback(async (options = {}) => {
    if (!(canCrear || canConvertir || canGestionar)) return;
    if (!options?.silent) setLoadingCatalog(true);
    try {
      // AM: carga catalogos para crear solicitud y convertir compra.
      const [p, i, prov, alm, contextoCreacion, catsProd, catsIns, units] = await Promise.all([
        canCrear || canGestionar ? inventarioService.getProductos() : Promise.resolve([]),
        canCrear || canGestionar ? inventarioService.getInsumos() : Promise.resolve([]),
        canConvertir ? inventarioService.getProveedores() : Promise.resolve([]),
        canCrear || canGestionar ? inventarioService.getAlmacenes() : Promise.resolve([]),
        canCrear ? inventarioService.getOrdenCompraWorkflowContextoCreacion() : Promise.resolve(null),
        canGestionar ? inventarioService.getCategorias() : Promise.resolve([]),
        canGestionar ? inventarioService.getCategoriasInsumos() : Promise.resolve([]),
        canGestionar ? inventarioService.getUnidadesMedida() : Promise.resolve([])
      ]);

      const contextData = contextoCreacion?.data || {};
      const almacenesPermitidosContexto = Array.isArray(contextData?.almacenes_permitidos)
        ? contextData.almacenes_permitidos
        : [];
      const almacenesFinales =
        canCrear && almacenesPermitidosContexto.length > 0 ? almacenesPermitidosContexto : Array.isArray(alm) ? alm : [];

      setProductos(Array.isArray(p) ? p : []);
      setInsumos(Array.isArray(i) ? i : []);
      setProveedores(Array.isArray(prov) ? prov : []);
      setAlmacenes(almacenesFinales);
      setWorkflowCreateContext({
        id_sucursal_usuario: parseOptionalPositiveInt(contextData?.id_sucursal_usuario),
        restringido_a_sucursal_usuario: Boolean(contextData?.restringido_a_sucursal_usuario)
      });
      setCategoriasProductos(Array.isArray(catsProd) ? catsProd : []);
      setCategoriasInsumos(Array.isArray(catsIns) ? catsIns : []);
      setUnidadesMedida(Array.isArray(units) ? units : []);
    } catch (error) {
      if (!options?.silent) {
        toast('ERROR', error?.message || 'No se pudo cargar catalogo de ordenes de compra.', 'danger');
      }
    } finally {
      if (!options?.silent) setLoadingCatalog(false);
    }
  }, [canConvertir, canCrear, canGestionar, toast]);

  useEffect(() => {
    if (permisosLoading) return;
    void loadCatalogs();
  }, [loadCatalogs, permisosLoading]);

  useEffect(() => {
    if (permisosLoading || !(canCrear || canConvertir || canGestionar)) return undefined;

    // AM: refresco automatico de catalogo para reflejar cambios de stock sin recarga manual.
    const intervalId = window.setInterval(() => {
      if (document?.visibilityState === 'hidden') return;
      void loadCatalogs({ silent: true });
    }, POLLING_MS);

    return () => window.clearInterval(intervalId);
  }, [canConvertir, canCrear, canGestionar, loadCatalogs, permisosLoading]);

  const loadOrdenes = useCallback(async (options = {}) => {
    if (!canVer) return;
    if (!options?.silent) setLoadingOrdenes(true);
    try {
      const response = await inventarioService.getOrdenesCompraWorkflow({
        scope,
        estado: estadoFiltro || undefined,
        q: search || undefined,
        page,
        limit: ORDER_LIMIT,
        id_sucursal: flowSucursalFilter || undefined
      });
      setOrdenes(Array.isArray(response?.data) ? response.data : []);
      setPagination({
        page: parsePositiveInt(response?.pagination?.page) || page,
        total: Number(response?.pagination?.total || 0),
        totalPages: parsePositiveInt(response?.pagination?.totalPages) || 1
      });
    } catch (error) {
      if (!options?.silent) {
        toast('ERROR', error?.message || 'No se pudo cargar listado de ordenes.', 'danger');
      }
    } finally {
      if (!options?.silent) setLoadingOrdenes(false);
    }
  }, [canVer, estadoFiltro, flowSucursalFilter, page, scope, search, toast]);

  useEffect(() => {
    if (permisosLoading) return;
    void loadOrdenes();
  }, [loadOrdenes, permisosLoading]);

  useEffect(() => {
    if (permisosLoading || !canVer) return undefined;
    // AM: polling configurable para reflejar cambios del flujo OC sin recarga manual.
    const intervalId = window.setInterval(() => {
      if (document?.visibilityState === 'hidden') return;
      void loadOrdenes({ silent: true });
    }, POLLING_MS);
    return () => window.clearInterval(intervalId);
  }, [canVer, loadOrdenes, permisosLoading]);

  const addToDraft = (item) => {
    setDraft((prev) => {
      const rows = Array.isArray(prev) ? prev : [];
      const current = rows.find((row) => row.key === item.key);
      if (!current) {
        const itemAlmacenes = normalizeAlmacenesSelection(
          item?.id_almacenes_disponibles ?? item?.id_almacenes,
          50
        );
        const validFromBase = selectedBaseAlmacenes.filter((idAlmacen) => itemAlmacenes.includes(idAlmacen));
        const fallbackAlmacen = itemAlmacenes.length > 0 ? [itemAlmacenes[0]] : [];

        return [
          ...rows,
          {
            ...item,
            cantidad: '1',
            id_almacenes_disponibles: itemAlmacenes,
            id_almacenes: validFromBase.length > 0 ? [validFromBase[0]] : fallbackAlmacen
          }
        ];
      }
      return rows.map((row) =>
        row.key === item.key
          ? { ...row, cantidad: String((parsePositiveInt(row.cantidad) || 0) + 1) }
          : row
      );
    });
  };

  // AM: mantiene control dual de cantidad (stepper +/- y entrada manual) en cards de detalle de solicitud.
  const setDraftCantidad = (key, value) => {
    const safeValue = sanitizeInt(value);
    setDraft((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              cantidad: safeValue
            }
          : item
      )
    );
  };

  // AM: evita cantidades <= 0 al usar botones de incremento/decremento.
  const stepDraftCantidad = (key, delta) => {
    setDraft((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const current = parsePositiveInt(item.cantidad) || 1;
        const next = Math.max(1, current + delta);
        return {
          ...item,
          cantidad: String(next)
        };
      })
    );
  };

  // AM: permite elegir exactamente 1 almacen destino por linea de solicitud.
  const toggleDraftAlmacen = (key, idAlmacen) => {
    const safeAlmacenId = parsePositiveInt(idAlmacen);
    if (!safeAlmacenId || !almacenesMap.has(safeAlmacenId)) return;

    setDraft((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const itemAlmacenes = normalizeAlmacenesSelection(item?.id_almacenes, 50);
        if (itemAlmacenes.length > 0 && !itemAlmacenes.includes(safeAlmacenId)) return item;
        return {
          ...item,
          id_almacenes: [safeAlmacenId]
        };
      })
    );
  };

  const toggleDraftAlmacenBase = (idAlmacen) => {
    const safeAlmacenId = parsePositiveInt(idAlmacen);
    if (!safeAlmacenId || !almacenesMap.has(safeAlmacenId)) return;
    setDraftAlmacenesBase([safeAlmacenId]);
  };

  const addItemRequestToDraft = () => {
    // AM: defensa extra en frontend para impedir solicitudes_item en perfiles con alta directa.
    if (!canSolicitarItemNuevo) return;
    const tipoItem = String(itemRequestModal.tipo_item || '').toLowerCase();
    const nombreSugerido = normalizeText(itemRequestModal.nombre_sugerido, 160);
    const descripcion = normalizeText(itemRequestModal.descripcion, 500);
    const cantidadSugerida = parsePositiveInt(itemRequestModal.cantidad_sugerida);

    if (!['producto', 'insumo'].includes(tipoItem)) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Selecciona tipo de item valido.' }));
      return;
    }
    if (!nombreSugerido) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Nombre sugerido es obligatorio.' }));
      return;
    }
    if (!cantidadSugerida) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Cantidad sugerida debe ser un entero mayor a 0.' }));
      return;
    }

    setDraftItemRequests((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      {
        key: `solicitud:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        tipo_item: tipoItem,
        nombre_sugerido: nombreSugerido,
        descripcion,
        cantidad_sugerida: String(cantidadSugerida)
      }
    ]);
    setItemRequestModal(emptyItemRequestModal());
  };

  const createSolicitud = async () => {
    if (!canCrear) return;
    if (!hasDraftContent) {
      toast('VALIDACION', 'Agrega items existentes o solicitudes de items nuevos para crear la solicitud.', 'warning');
      return;
    }
    if (hasDraftErrors) {
      toast('VALIDACION', 'Corrige las cantidades invalidas antes de crear la solicitud.', 'warning');
      return;
    }

    const detalles = [];
    for (const row of draft) {
      const idItem = parsePositiveInt(row.id_item);
      const cantidad = parsePositiveInt(row.cantidad);
      const idAlmacenes = normalizeAlmacenesSelection(row.id_almacenes, 1).filter((idAlmacen) =>
        almacenesMap.has(idAlmacen)
      );
      if (!idItem || !cantidad || !['producto', 'insumo'].includes(row.item_tipo)) {
        toast('VALIDACION', `Detalle invalido en ${row.nombre}.`, 'warning');
        return;
      }
      if (idAlmacenes.length !== 1) {
        toast('VALIDACION', `Selecciona 1 almacen destino en ${row.nombre}.`, 'warning');
        return;
      }
      detalles.push({
        item_tipo: row.item_tipo,
        id_item: idItem,
        cantidad,
        id_almacen_destino: idAlmacenes[0]
      });
    }

    setCreating(true);
    try {
      // AM: crea solicitud de orden en estado pendiente.
      await inventarioService.crearOrdenCompraWorkflow({
        observacion: normalizeText(observacion, 1000),
        detalles,
        // AM: perfiles administrativos no envian solicitudes_item; solo roles operativos sin alta directa.
        solicitudes_item: canSolicitarItemNuevo
          ? draftItemRequests.map((row) => ({
            tipo_item: row.tipo_item,
            nombre_sugerido: normalizeText(row.nombre_sugerido, 160),
            descripcion: normalizeText(row.descripcion, 500),
            cantidad_sugerida: parsePositiveInt(row.cantidad_sugerida) || 1
          }))
          : []
      });
      toast('SOLICITUD CREADA', 'Orden registrada correctamente.', 'success');
      setDraft([]);
      setDraftItemRequests([]);
      setObservacion('');
      setPage(1);
      await loadOrdenes();
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo crear la solicitud.', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const uploadInventarioImage = async (file) => {
    const fileError = getInventarioImageFileError(file);
    if (fileError) {
      throw new Error(fileError);
    }

    // AM: reutiliza infraestructura existente de /archivos para evidencias de OC.
    const payload = await buildInventarioImageUploadPayload(file);
    const response = await inventarioService.crearArchivoImagen(payload);
    const idArchivo = parsePositiveInt(response?.id_archivo);
    if (!idArchivo) {
      throw new Error('No se pudo obtener id_archivo para la evidencia.');
    }

    return {
      id_archivo: idArchivo,
      url_publica: resolveInventarioImageUrl(response?.url_publica || '')
    };
  };

  const setBusy = (idOrden, value) => setRowBusy((prev) => ({ ...prev, [idOrden]: value }));

  // AM: modal de revision para sustituir prompts y reforzar validacion de comentarios.
  const openReviewModal = (orden, mode) => {
    setReviewModal({
      open: true,
      mode,
      orden,
      comentario: '',
      loading: false,
      error: ''
    });
  };

  const submitReviewModal = async () => {
    const idOrden = parsePositiveInt(reviewModal?.orden?.id_orden_compra);
    const comentario = normalizeText(reviewModal.comentario, 1000);
    if (!idOrden) return;
    if (reviewModal.mode === 'rechazar' && !comentario) {
      setReviewModal((prev) => ({ ...prev, error: 'El motivo de rechazo es obligatorio.' }));
      return;
    }

    setReviewModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      if (reviewModal.mode === 'rechazar') {
        await inventarioService.rechazarOrdenCompraWorkflow(idOrden, { comentario });
      } else {
        await inventarioService.aprobarOrdenCompraWorkflow(idOrden, { comentario });
      }
      toast(
        'ORDEN ACTUALIZADA',
        `Orden #${idOrden} ${reviewModal.mode === 'rechazar' ? 'rechazada' : 'aprobada'}.`,
        reviewModal.mode === 'rechazar' ? 'warning' : 'success'
      );
      setReviewModal(emptyReviewModal());
      await loadOrdenes();
    } catch (error) {
      setReviewModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const openEditDetallesModal = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setBusy(idOrden, true);
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      const orderData = response?.data || {};
      const estado = resolveEstado(orderData?.orden || orden);
      if (estado !== 'PENDIENTE') {
        toast('VALIDACION', 'Solo puedes editar lineas en estado PENDIENTE.', 'warning');
        return;
      }

      const detalles = Array.isArray(orderData?.detalles) ? orderData.detalles : [];
      setEditDetallesModal({
        open: true,
        loading: false,
        error: '',
        orden: orderData?.orden || orden,
        rows: detalles.map((row) => ({
          id_detalle_orden: Number(row.id_detalle_orden),
          item_nombre: `${row.item_nombre || row.item_tipo || `Detalle #${row.id_detalle_orden}`}${
            row.almacen_destino_nombre ? ` - ${row.almacen_destino_nombre}` : ''
          }`,
          item_tipo: row.item_tipo || '-',
          id_item: parsePositiveInt(row?.id_producto || row?.id_insumo),
          cantidad: String(row.cantidad_orden || 0),
          eliminar: false
        })),
        add_rows: [],
        selected_item_tipo: 'producto',
        search_item: ''
      });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo abrir edicion de detalles.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  const submitEditDetallesModal = async () => {
    const idOrden = parsePositiveInt(editDetallesModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    const actualizar = [];
    const eliminar = [];
    const agregar = [];

    for (const row of editDetallesModal.rows) {
      const idDetalle = parsePositiveInt(row.id_detalle_orden);
      if (!idDetalle) continue;
      if (row.eliminar) {
        eliminar.push(idDetalle);
        continue;
      }
      const cantidad = parsePositiveInt(row.cantidad);
      if (!cantidad) {
        setEditDetallesModal((prev) => ({
          ...prev,
          error: `Cantidad invalida en ${row.item_nombre}.`
        }));
        return;
      }
      actualizar.push({ id_detalle_orden: idDetalle, cantidad });
    }

    for (const row of Array.isArray(editDetallesModal.add_rows) ? editDetallesModal.add_rows : []) {
      const itemTipo = String(row?.item_tipo || '')
        .trim()
        .toLowerCase();
      const idItem = parsePositiveInt(row?.id_item);
      const cantidad = parsePositiveInt(row?.cantidad);
      const idAlmacenDestino = parsePositiveInt(row?.id_almacen_destino);
      if (!['producto', 'insumo'].includes(itemTipo) || !idItem || !cantidad || !idAlmacenDestino) {
        setEditDetallesModal((prev) => ({
          ...prev,
          error: `Hay una linea nueva invalida en ${row?.item_nombre || 'item agregado'}.`
        }));
        return;
      }

      agregar.push({
        item_tipo: itemTipo,
        id_item: idItem,
        cantidad,
        id_almacen_destino: idAlmacenDestino
      });
    }

    if (actualizar.length === 0 && eliminar.length === 0 && agregar.length === 0) {
      setEditDetallesModal((prev) => ({ ...prev, error: 'No hay cambios para guardar.' }));
      return;
    }

    setEditDetallesModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      await inventarioService.actualizarDetalleOrdenCompraWorkflow(idOrden, { actualizar, eliminar, agregar });
      toast('DETALLE ACTUALIZADO', `Orden #${idOrden} actualizada correctamente.`, 'success');
      setEditDetallesModal(emptyEditDetallesModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setEditDetallesModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar detalle de la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: permite al administrador agregar nuevas lineas al editar una OC pendiente.
  const addCatalogItemToEditModal = (item) => {
    const idItem = parsePositiveInt(item?.id_item);
    const itemTipo = String(item?.item_tipo || '')
      .trim()
      .toLowerCase();
    if (!idItem || !['producto', 'insumo'].includes(itemTipo)) return;

    const idSucursalOrden = parseOptionalPositiveInt(editDetallesModal?.orden?.id_sucursal);
    const almacenesItem = normalizeAlmacenesSelection(
      item?.id_almacenes_sucursal ?? item?.id_almacenes_disponibles ?? item?.id_almacenes,
      50
    ).filter((idAlmacen) => almacenesMap.has(idAlmacen));
    const idAlmacenesDisponibles = almacenesItem.filter((idAlmacen) => {
      if (!idSucursalOrden) return true;
      const almacen = almacenesMap.get(idAlmacen);
      const idSucursalAlmacen = parseOptionalPositiveInt(almacen?.id_sucursal);
      return !idSucursalAlmacen || Number(idSucursalAlmacen) === Number(idSucursalOrden);
    });
    const idAlmacenDestino = idAlmacenesDisponibles[0] || null;
    if (!idAlmacenDestino) {
      toast('VALIDACION', `El item ${item?.nombre || idItem} no tiene almacen destino activo.`, 'warning');
      return;
    }

    setEditDetallesModal((prev) => {
      const addRows = Array.isArray(prev.add_rows) ? prev.add_rows : [];
      const duplicate = addRows.find(
        (row) => Number(row.id_item) === Number(idItem) && String(row.item_tipo) === String(itemTipo)
      );
      if (duplicate) {
        return {
          ...prev,
          error: '',
          add_rows: addRows.map((row) =>
            row.key === duplicate.key
              ? { ...row, cantidad: String((parsePositiveInt(row.cantidad) || 0) + 1) }
              : row
          )
        };
      }

      return {
        ...prev,
        error: '',
        add_rows: [
          ...addRows,
          {
            key: `new:${itemTipo}:${idItem}:${Date.now()}`,
            item_tipo: itemTipo,
            id_item: idItem,
            item_nombre: item?.nombre || `${itemTipo} #${idItem}`,
            cantidad: '1',
            id_almacen_destino: idAlmacenDestino,
            id_almacenes_disponibles: idAlmacenesDisponibles
          }
        ]
      };
    });
  };

  // AM: modal dedicado para aprobar/rechazar solicitudes de item no registrado.
  const openItemRequestDecision = (orden, solicitud, accion) => {
    setItemRequestDecisionModal({
      open: true,
      loading: false,
      error: '',
      orden,
      solicitud,
      accion,
      comentario: ''
    });
  };

  // AM: persiste decision administrativa de solicitud de item (aprobar/rechazar).
  const submitItemRequestDecision = async () => {
    const idOrden = parsePositiveInt(itemRequestDecisionModal?.orden?.id_orden_compra);
    const idSolicitud = parsePositiveInt(itemRequestDecisionModal?.solicitud?.id_solicitud_item);
    const accion = String(itemRequestDecisionModal?.accion || '').trim().toLowerCase();
    const comentario = normalizeText(itemRequestDecisionModal?.comentario, 1000);
    if (!idOrden || !idSolicitud || !['aprobar', 'rechazar'].includes(accion)) return;
    if (accion === 'rechazar' && !comentario) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'El comentario es obligatorio para rechazar la solicitud.'
      }));
      return;
    }

    setBusy(idOrden, true);
    setItemRequestDecisionModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await inventarioService.revisarSolicitudItemOrdenCompraWorkflow(idOrden, idSolicitud, {
        accion,
        comentario_revision: comentario || undefined
      });
      toast(
        'SOLICITUD ACTUALIZADA',
        `Solicitud #${idSolicitud} ${accion === 'aprobar' ? 'aprobada' : 'rechazada'}.`,
        accion === 'aprobar' ? 'success' : 'warning'
      );
      setItemRequestDecisionModal(emptyItemRequestDecisionModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar la solicitud de item.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: prepara alta rapida de catalogo a partir de una solicitud aprobada.
  const openQuickCreateItemModalFromRequest = (orden, solicitud) => {
    const idSolicitud = parsePositiveInt(solicitud?.id_solicitud_item);
    if (!idSolicitud) return;
    const tipoItem = String(solicitud?.tipo_item || '')
      .trim()
      .toLowerCase();
    if (!['producto', 'insumo'].includes(tipoItem)) return;

    const idSucursalOrden = parseOptionalPositiveInt(orden?.id_sucursal);
    const almacenesCompatibles = almacenesCatalog.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalOrden || !idSucursalAlmacen) return true;
      return Number(idSucursalAlmacen) === Number(idSucursalOrden);
    });
    const idSucursalUsuarioActual = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    const preferidosUsuario = almacenesCompatibles.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalUsuarioActual || !idSucursalAlmacen) return false;
      return Number(idSucursalAlmacen) === Number(idSucursalUsuarioActual);
    });
    const idAlmacenPredeterminado = parsePositiveInt(
      preferidosUsuario?.[0]?.id_almacen || almacenesCompatibles?.[0]?.id_almacen
    );

    setQuickCreateItemModal({
      open: true,
      loading: false,
      error: '',
      orden,
      solicitud,
      tipo_item: tipoItem,
      nombre: normalizeText(solicitud?.nombre_sugerido, 160) || '',
      descripcion: normalizeText(solicitud?.descripcion, 500) || '',
      cantidad: String(parsePositiveInt(solicitud?.cantidad_sugerida) || 1),
      precio: '0',
      stock_minimo: '0',
      id_categoria_producto: '',
      id_categoria_insumo: '',
      id_unidad_medida: '',
      // AM: almacén predeterminado por sucursal del usuario (si aplica) y fallback a sucursal de la orden.
      id_almacen: String(idAlmacenPredeterminado || '')
    });
  };

  // AM: crea producto/insumo real y marca la solicitud como atendida en la OC.
  const submitQuickCreateItemModal = async () => {
    const idOrden = parsePositiveInt(quickCreateItemModal?.orden?.id_orden_compra);
    const idSolicitud = parsePositiveInt(quickCreateItemModal?.solicitud?.id_solicitud_item);
    const tipoItem = String(quickCreateItemModal?.tipo_item || '')
      .trim()
      .toLowerCase();
    if (!idOrden || !idSolicitud || !['producto', 'insumo'].includes(tipoItem)) return;
    if (tipoItem === 'producto' && !canCrearProductos) {
      setQuickCreateItemModal((prev) => ({ ...prev, error: 'No tienes permiso para crear productos.' }));
      return;
    }
    if (tipoItem === 'insumo' && !canCrearInsumos) {
      setQuickCreateItemModal((prev) => ({ ...prev, error: 'No tienes permiso para crear insumos.' }));
      return;
    }

    const nombre = normalizeText(quickCreateItemModal?.nombre, 160);
    const descripcion = normalizeText(quickCreateItemModal?.descripcion, 500) || '';
    const cantidad = parsePositiveInt(quickCreateItemModal?.cantidad);
    const precio = parseNonNegativeNumber(quickCreateItemModal?.precio);
    const stockMinimo = parseNonNegativeNumber(quickCreateItemModal?.stock_minimo);
    const idAlmacen = parsePositiveInt(quickCreateItemModal?.id_almacen);
    if (!nombre || !cantidad || precio === null || stockMinimo === null || !idAlmacen) {
      setQuickCreateItemModal((prev) => ({
        ...prev,
        error: 'Completa nombre, cantidad, precio, stock minimo y almacen validos.'
      }));
      return;
    }

    setBusy(idOrden, true);
    setQuickCreateItemModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      let idItemCreado = null;
      if (tipoItem === 'producto') {
        const idCategoriaProducto = parsePositiveInt(quickCreateItemModal?.id_categoria_producto);
        if (!idCategoriaProducto) {
          setQuickCreateItemModal((prev) => ({
            ...prev,
            loading: false,
            error: 'Selecciona categoria de producto.'
          }));
          return;
        }
        const payloadProducto = {
          nombre_producto: nombre,
          precio,
          cantidad,
          stock_minimo: Math.trunc(stockMinimo),
          descripcion_producto: descripcion,
          id_categoria_producto: idCategoriaProducto,
          id_almacen: idAlmacen
        };
        const responseProducto = await inventarioService.crearProducto(payloadProducto);
        idItemCreado = parsePositiveInt(responseProducto?.id_producto || responseProducto?.data?.id_producto);
      } else {
        const idCategoriaInsumo = parsePositiveInt(quickCreateItemModal?.id_categoria_insumo);
        if (!idCategoriaInsumo) {
          setQuickCreateItemModal((prev) => ({
            ...prev,
            loading: false,
            error: 'Selecciona categoria de insumo.'
          }));
          return;
        }
        const idUnidadMedida = parseOptionalPositiveInt(quickCreateItemModal?.id_unidad_medida);
        const payloadInsumo = {
          nombre_insumo: nombre,
          precio,
          cantidad,
          stock_minimo: Math.trunc(stockMinimo),
          descripcion,
          id_categoria_insumo: idCategoriaInsumo,
          id_unidad_medida: idUnidadMedida || undefined,
          id_almacen: idAlmacen
        };
        const responseInsumo = await inventarioService.crearInsumo(payloadInsumo);
        idItemCreado = parsePositiveInt(responseInsumo?.id_insumo || responseInsumo?.data?.id_insumo);
      }

      if (!idItemCreado) {
        throw new Error('No se pudo obtener el ID del item creado.');
      }

      // AM: marca la solicitud como atendida solo cuando el alta de catalogo fue exitosa.
      await inventarioService.atenderSolicitudItemOrdenCompraWorkflow(idOrden, idSolicitud, {
        id_item_creado: idItemCreado
      });

      toast('ITEM REGISTRADO', `${tipoItem} creado y solicitud atendida correctamente.`, 'success');
      setQuickCreateItemModal(emptyQuickCreateItemModal());
      await Promise.all([loadCatalogs({ silent: true }), loadOrdenes()]);
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setQuickCreateItemModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo crear el item solicitado.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const verDetalle = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setDetalleActual({ loading: true, error: '', data: null });
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      setDetalleActual({ loading: false, error: '', data: response?.data || null });
    } catch (error) {
      setDetalleActual({
        loading: false,
        error: error?.message || 'No se pudo cargar detalle.',
        data: null
      });
    }
  };

  const openConvert = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setBusy(idOrden, true);
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      const orderData = response?.data?.orden || orden || {};
      const compraActual = response?.data?.compra_actual || {};
      const detalles = Array.isArray(response?.data?.detalles) ? response.data.detalles : [];
      if (detalles.length === 0) {
        toast('VALIDACION', 'La orden no tiene detalle para convertir.', 'warning');
        return;
      }
      if (!hasReceptionRegistered(orderData)) {
        toast('VALIDACION', 'La recepcion de sucursal aun no esta registrada para esta orden.', 'warning');
        return;
      }
      const descuentoTipoActual = resolveDiscountType(compraActual?.descuento_tipo);
      const descuentoValorActual = parseNonNegativeNumber(compraActual?.descuento_valor);
      const totalDetalleActual = parseNonNegativeNumber(compraActual?.total_detalle);
      const isvActual = parseNonNegativeNumber(compraActual?.isv);
      const isvPctActual =
        totalDetalleActual && totalDetalleActual > 0 && isvActual !== null
          ? round2((isvActual * 100) / totalDetalleActual)
          : 0;
      // AM: inicializa costos administrativos por item desde compra previa si existe; fallback a precio de referencia.
      const detallesAdmin = detalles.map((row) => {
        const idDetalleOrden = parsePositiveInt(row?.id_detalle_orden);
        const cantidadOrden = parsePositiveInt(row?.cantidad_orden) || 0;
        const subTotalCompra = parseNonNegativeNumber(row?.sub_total_compra);
        const precioReferencia = parseNonNegativeNumber(row?.precio_referencia) ?? 0;
        const precioUnitario =
          cantidadOrden > 0 && subTotalCompra !== null ? round2(subTotalCompra / cantidadOrden) : round2(precioReferencia);
        const descuentoLinea = round2(parseNonNegativeNumber(row?.descuento_compra) ?? 0);
        return {
          id_detalle_orden: idDetalleOrden,
          item_nombre: row?.item_nombre || row?.item_tipo || `Detalle #${idDetalleOrden || '-'}`,
          cantidad_orden: cantidadOrden,
          precio_unitario: String(precioUnitario),
          descuento: String(descuentoLinea)
        };
      });
      // AM: modal administrativo minimo para guardar datos y luego abastecer.
      setConvertPanel({
        open: true,
        loading: false,
        submit_action: '',
        error: '',
        orden: { ...orden, ...orderData },
        id_proveedor: sanitizeInt(compraActual?.id_proveedor || ''),
        fecha_compra: hasValue(compraActual?.fecha)
          ? String(compraActual.fecha).replace('T', ' ').split(' ')[0]
          : '',
        observacion_admin:
          normalizeText(compraActual?.observacion_pago, 1000) ||
          normalizeText(compraActual?.referencia_transferencia, 1000) ||
          '',
        descuento_tipo: descuentoTipoActual,
        descuento_valor: String(round2(descuentoValorActual ?? 0)),
        isv_pct: String(round2(isvPctActual)),
        detalles: detallesAdmin,
        factura_recepcion_url: resolveInventarioImageUrl(orderData?.factura_recepcion_url_publica),
        transferencia_url_actual: resolveInventarioImageUrl(compraActual?.transferencia_url_publica),
        transferencia_file: null,
        transferencia_preview_url: '',
        transferencia_error: ''
      });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo abrir conversion.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: actualiza costos/descuentos por linea sin salir del modal administrativo.
  const updateConvertDetailField = useCallback((idDetalleOrden, field, rawValue) => {
    const idDetalle = parsePositiveInt(idDetalleOrden);
    if (!idDetalle) return;
    setConvertPanel((prev) => ({
      ...prev,
      error: '',
      detalles: Array.isArray(prev.detalles)
        ? prev.detalles.map((row) =>
            parsePositiveInt(row?.id_detalle_orden) === idDetalle ? { ...row, [field]: sanitizeDecimal(rawValue) } : row
          )
        : prev.detalles
    }));
  }, []);

  // AM: calcula resumen financiero en cliente para validacion inmediata antes del POST /convertir.
  const convertPreview = useMemo(() => {
    const details = Array.isArray(convertPanel?.detalles) ? convertPanel.detalles : [];
    if (details.length === 0) {
      return {
        has_error: false,
        error: '',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    let subTotal = 0;
    let descuentoLineas = 0;
    for (const row of details) {
      const cantidad = parsePositiveInt(row?.cantidad_orden) || 0;
      const precioUnitario = parseNonNegativeNumber(row?.precio_unitario);
      const descuentoLinea = parseNonNegativeNumber(row?.descuento);
      if (precioUnitario === null || descuentoLinea === null) {
        return {
          has_error: true,
          error: 'Hay costos o descuentos de linea invalidos.',
          sub_total: 0,
          descuento_lineas: 0,
          descuento_global: 0,
          descuento_total: 0,
          total_detalle: 0,
          isv: 0,
          total: 0
        };
      }
      const itemSubTotal = round2(cantidad * precioUnitario);
      if (descuentoLinea > itemSubTotal) {
        return {
          has_error: true,
          error: `El descuento de linea no puede superar su subtotal (${row?.item_nombre || 'item'}).`,
          sub_total: 0,
          descuento_lineas: 0,
          descuento_global: 0,
          descuento_total: 0,
          total_detalle: 0,
          isv: 0,
          total: 0
        };
      }
      subTotal = round2(subTotal + itemSubTotal);
      descuentoLineas = round2(descuentoLineas + round2(descuentoLinea));
    }

    const descuentoTipo = resolveDiscountType(convertPanel?.descuento_tipo);
    const descuentoValor = parseNonNegativeNumber(convertPanel?.descuento_valor);
    if (descuentoValor === null) {
      return {
        has_error: true,
        error: 'Descuento global invalido.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }
    if (descuentoTipo === DISCOUNT_TYPE_PORCENTAJE && descuentoValor > 100) {
      return {
        has_error: true,
        error: 'Descuento global en porcentaje no puede exceder 100.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const baseLineas = round2(subTotal - descuentoLineas);
    const descuentoGlobal =
      descuentoTipo === DISCOUNT_TYPE_PORCENTAJE ? round2(baseLineas * (descuentoValor / 100)) : round2(descuentoValor);
    if (descuentoGlobal > baseLineas) {
      return {
        has_error: true,
        error: 'El descuento global supera el total de lineas disponible.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const isvPct = parseNonNegativeNumber(convertPanel?.isv_pct);
    if (isvPct === null || isvPct > 100) {
      return {
        has_error: true,
        error: 'ISV % invalido. Debe estar entre 0 y 100.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const descuentoTotal = round2(descuentoLineas + descuentoGlobal);
    const totalDetalle = Math.max(0, round2(subTotal - descuentoTotal));
    const isv = round2(totalDetalle * (isvPct / 100));
    const total = round2(totalDetalle + isv);

    return {
      has_error: false,
      error: '',
      sub_total: subTotal,
      descuento_lineas: descuentoLineas,
      descuento_global: descuentoGlobal,
      descuento_total: descuentoTotal,
      total_detalle: totalDetalle,
      isv,
      total
    };
  }, [convertPanel?.descuento_tipo, convertPanel?.descuento_valor, convertPanel?.detalles, convertPanel?.isv_pct]);

  // AM: soporta guardado administrativo parcial y accion final de guardar + abastecer.
  const doConvert = async (accion = 'guardar') => {
    if (!['guardar', 'guardar_y_abastecer'].includes(String(accion))) return;
    if (accion === 'guardar' && !canConvertir) return;
    if (accion === 'guardar_y_abastecer' && (!canConvertir || !canAbastecer)) return;
    const idOrden = parsePositiveInt(convertPanel?.orden?.id_orden_compra);
    const idProveedor = parsePositiveInt(convertPanel.id_proveedor);
    const transferenciaPersistida = hasValue(convertPanel?.transferencia_url_actual);
    const descuentoTipo = resolveDiscountType(convertPanel?.descuento_tipo);
    const descuentoValor = parseNonNegativeNumber(convertPanel?.descuento_valor);
    const isvPct = parseNonNegativeNumber(convertPanel?.isv_pct);
    // AM: envia detalle financiero por linea para persistir costo unitario y descuento real por item.
    const detallesPayload = (Array.isArray(convertPanel?.detalles) ? convertPanel.detalles : []).map((row) => ({
      id_detalle_orden: parsePositiveInt(row?.id_detalle_orden),
      precio_unitario: parseNonNegativeNumber(row?.precio_unitario),
      descuento: parseNonNegativeNumber(row?.descuento) ?? 0
    }));
    if (!idOrden || !idProveedor) {
      setConvertPanel((prev) => ({ ...prev, error: 'Proveedor y orden son obligatorios.', submit_action: '' }));
      return;
    }
    if (detallesPayload.length === 0 || detallesPayload.some((row) => !row.id_detalle_orden || row.precio_unitario === null)) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Debes completar costos validos por item antes de guardar.',
        submit_action: ''
      }));
      return;
    }
    if (descuentoValor === null || (descuentoTipo === DISCOUNT_TYPE_PORCENTAJE && descuentoValor > 100)) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Descuento global invalido.',
        submit_action: ''
      }));
      return;
    }
    if (isvPct === null || isvPct > 100) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'ISV % invalido. Debe estar entre 0 y 100.',
        submit_action: ''
      }));
      return;
    }
    if (convertPreview.has_error) {
      setConvertPanel((prev) => ({
        ...prev,
        error: convertPreview.error || 'Corrige los montos administrativos antes de guardar.',
        submit_action: ''
      }));
      return;
    }
    if (convertPanel.loading || rowBusy[idOrden]) {
      // AM: evita doble envio por doble click o polling concurrente.
      return;
    }
    if (accion === 'guardar_y_abastecer' && !convertPanel.transferencia_file && !transferenciaPersistida) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Para guardar y abastecer debes registrar imagen de deposito/transferencia.',
        submit_action: '',
        transferencia_error: 'Adjunta una imagen o usa una ya registrada.'
      }));
      return;
    }

    setConvertPanel((prev) => ({
      ...prev,
      loading: true,
      submit_action: accion,
      error: '',
      transferencia_error: ''
    }));
    setBusy(idOrden, true);
    try {
      let idArchivoTransferencia = null;
      if (convertPanel.transferencia_file) {
        const transferUpload = await uploadInventarioImage(convertPanel.transferencia_file);
        idArchivoTransferencia = transferUpload.id_archivo;
      }

      const observacionAdmin = normalizeText(convertPanel.observacion_admin, 1000);
      const payload = {
        accion,
        id_proveedor: idProveedor,
        fecha_compra: convertPanel.fecha_compra || undefined,
        descuento_tipo: descuentoTipo,
        descuento_valor: round2(descuentoValor ?? 0),
        isv_pct: round2(isvPct ?? 0),
        detalles: detallesPayload
      };
      if (observacionAdmin) {
        payload.observacion_admin = observacionAdmin;
        payload.referencia_transferencia = observacionAdmin;
      }
      if (idArchivoTransferencia) {
        payload.id_archivo_transferencia = idArchivoTransferencia;
      }

      await inventarioService.convertirOrdenCompraWorkflow(idOrden, payload);

      if (accion === 'guardar_y_abastecer') {
        await inventarioService.abastecerOrdenCompraWorkflow(idOrden, {
          observacion: normalizeText(convertPanel.observacion_admin, 200) || undefined
        });
      }

      toast(
        accion === 'guardar_y_abastecer' ? 'GUARDADO Y ABASTECIDO' : 'GUARDADO',
        accion === 'guardar_y_abastecer'
          ? `Orden #${idOrden} guardada y abastecida correctamente.`
          : `Datos administrativos guardados para orden #${idOrden}.`,
        'success'
      );
      closeConvertPanel();
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setConvertPanel((prev) => ({
        ...prev,
        loading: false,
        submit_action: '',
        error: error?.message || 'No se pudo convertir orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const closeConvertPanel = () => {
    const preview = String(convertPanel?.transferencia_preview_url || '');
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setConvertPanel(emptyConvertPanel());
  };

  const closeRecepcionModal = () => {
    const preview = String(recepcionModal?.factura_preview_url || '');
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setRecepcionModal(emptyRecepcionModal());
  };

  // AM: modal de abastecimiento para sustituir prompt y evitar entradas ambiguas.
  const openSupplyModal = (orden) => {
    setSupplyModal({
      open: true,
      orden,
      observacion: '',
      loading: false,
      error: ''
    });
  };

  const doAbastecer = async () => {
    const idOrden = parsePositiveInt(supplyModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    setSupplyModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      await inventarioService.abastecerOrdenCompraWorkflow(idOrden, {
        observacion: normalizeText(supplyModal.observacion, 200)
      });
      toast('ABASTECIDA', `Orden #${idOrden} abastecida correctamente.`, 'success');
      setSupplyModal(emptySupplyModal());
      await loadOrdenes();
    } catch (error) {
      setSupplyModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo abastecer la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const openRecepcionModal = (orden) => {
    const now = new Date();
    setRecepcionModal({
      open: true,
      orden,
      observacion: '',
      // AM: datos automaticos no editables para trazabilidad de la recepcion en sucursal.
      usuario_sistema: normalizeText(user?.nombre_usuario, 120) || `Usuario #${user?.id_usuario || '-'}`,
      sucursal_sistema: resolveSucursalLabel(orden),
      fecha_sistema: now.toLocaleDateString('es-HN'),
      hora_sistema: now.toLocaleTimeString('es-HN', { hour12: false }),
      loading: false,
      error: '',
      factura_file: null,
      factura_preview_url: '',
      factura_error: ''
    });
  };

  const doReportarRecepcion = async () => {
    const idOrden = parsePositiveInt(recepcionModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    if (recepcionModal.loading || rowBusy[idOrden]) {
      // AM: evita doble envio por doble click o polling concurrente.
      return;
    }

    setRecepcionModal((prev) => ({ ...prev, loading: true, error: '', factura_error: '' }));
    setBusy(idOrden, true);
    try {
      let idArchivoFactura = null;
      if (recepcionModal.factura_file) {
        const facturaUpload = await uploadInventarioImage(recepcionModal.factura_file);
        idArchivoFactura = facturaUpload.id_archivo;
      }

      const payload = {
        observacion_recepcion: normalizeText(recepcionModal.observacion, 1000)
      };
      if (idArchivoFactura) payload.id_archivo_factura_recepcion = idArchivoFactura;

      await inventarioService.reportarRecepcionOrdenCompraWorkflow(idOrden, payload);
      toast('RECEPCION REPORTADA', `Recepcion registrada para orden #${idOrden}.`, 'success');
      closeRecepcionModal();
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setRecepcionModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo reportar recepcion.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const renderActions = (row, compact = false) => {
    const estado = resolveEstado(row);
    const recepcionRegistrada = hasReceptionRegistered(row);
    const isItemRequestOnlyCard =
      Number(row?.total_items || 0) <= 0 && Number(row?.total_solicitudes_item || 0) > 0;
    const hasOpenItemRequests =
      Number(row?.total_solicitudes_item_pendientes || 0) > 0 ||
      Number(row?.total_solicitudes_item_en_revision || 0) > 0;
    const busy = Boolean(rowBusy[row.id_orden_compra]);
    const actionClass = compact ? 'inv-oc-action-btn is-compact' : 'inv-oc-action-btn';

    return (
      <div className="inv-oc-actions">
        <button className={`${actionClass} is-neutral`} onClick={() => verDetalle(row)} disabled={busy}>
          <i className="bi bi-eye" aria-hidden="true" />
          <span>Ver</span>
        </button>
        {estado === 'PENDIENTE' && canGestionar && (
          <>
            {!isItemRequestOnlyCard && (
              <button
                className={`${actionClass} is-neutral`}
                onClick={() => openEditDetallesModal(row)}
                disabled={busy}
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span>Editar lineas</span>
              </button>
            )}
            <button
              className={`${actionClass} is-primary`}
              onClick={() => openReviewModal(row, 'aprobar')}
              disabled={busy || (isItemRequestOnlyCard && hasOpenItemRequests)}
              title={
                isItemRequestOnlyCard && hasOpenItemRequests
                  ? 'Primero atiende o rechaza las solicitudes de item nuevo en el detalle.'
                  : ''
              }
            >
              <i className="bi bi-check2-circle" aria-hidden="true" />
              <span>Aprobar</span>
            </button>
            <button
              className={`${actionClass} is-danger`}
              onClick={() => openReviewModal(row, 'rechazar')}
              disabled={busy}
            >
              <i className="bi bi-x-circle" aria-hidden="true" />
              <span>Rechazar</span>
            </button>
          </>
        )}
        {estado === 'APROBADA' && isSucursalOperativeActor && (
          <button className={`${actionClass} is-primary`} onClick={() => openRecepcionModal(row)} disabled={busy}>
            <i className="bi bi-receipt-cutoff" aria-hidden="true" />
            <span>Convertir</span>
          </button>
        )}
        {estado === 'EN_COMPRA' && isSucursalOperativeActor && !recepcionRegistrada && (
          <button className={`${actionClass} is-neutral`} onClick={() => openRecepcionModal(row)} disabled={busy}>
            <i className="bi bi-receipt" aria-hidden="true" />
            <span>Actualizar recepcion</span>
          </button>
        )}
        {/* AM: al completar recepcion en sucursal, admin continua en modal de gestion/abastecimiento. */}
        {estado === 'EN_COMPRA' && isAdminFlowActor && canConvertir && recepcionRegistrada && (
          <button className={`${actionClass} is-success`} onClick={() => openConvert(row)} disabled={busy}>
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            <span>Convertir</span>
          </button>
        )}
      </div>
    );
  };

  if (permisosLoading) return null;

  if (!canCrear && !canVer) {
    return <div className="alert alert-warning mb-0">No tienes permisos para Ordenes de compra.</div>;
  }

  return (
    <div className="inv-oc-module d-flex flex-column gap-3">
      <section className="inv-oc-hero">
        <div className="inv-oc-hero__copy">
          <p className="inv-oc-hero__eyebrow mb-1">Inventario inteligente</p>
          <h3 className="inv-oc-hero__title mb-2">Ordenes de compra</h3>
          <p className="inv-oc-hero__subtitle mb-0">
            Solicita, revisa y abastece en un flujo claro para cocina, caja y administracion.
          </p>
        </div>
        <div className="inv-oc-hero__stats">
          <article className="inv-oc-stat-card is-pending">
            <span>Pendientes</span>
            <strong>{workflowStats.pendientes}</strong>
          </article>
          <article className="inv-oc-stat-card is-approved">
            <span>Aprobadas</span>
            <strong>{workflowStats.aprobadas}</strong>
          </article>
          <article className="inv-oc-stat-card is-buying">
            <span>En compra</span>
            <strong>{workflowStats.enCompra}</strong>
          </article>
          <article className="inv-oc-stat-card is-stocked">
            <span>Abastecidas</span>
            <strong>{workflowStats.abastecidas}</strong>
          </article>
        </div>
      </section>

      {/* AM: layout principal: Nueva solicitud + Flujo en la franja superior para operacion rapida. */}
      {(canCrear || canVer) && (
        <div className={`inv-oc-top-panels ${showDualTopPanels ? 'is-dual' : ''}`}>
          {canCrear && (
            <section className="card shadow-sm inv-oc-card">
              <div className="card-header inv-oc-card__header inv-oc-card__header--single-row">
                <div className="inv-oc-card__header-title">
                  <h4 className="mb-0 inv-oc-title-stacked">
                    <span>Nueva solicitud</span>
                    <span>de compra</span>
                  </h4>
                </div>
                <div className="inv-oc-card__header-tools">
                  <div className="inv-oc-input-wrap inv-oc-input-wrap--compact">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      className="form-control form-control-sm inv-oc-input"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar producto o insumo..."
                    />
                  </div>
                  {!isOperationalCreateRestricted ? (
                    <select
                      className="form-select form-select-sm"
                      value={catalogSucursalFilter}
                      onChange={(e) => {
                        setCatalogSucursalFilter(e.target.value);
                        setCatalogPage(0);
                      }}
                      title="Filtrar por sucursal destino"
                    >
                      <option value="">Todas las sucursales</option>
                      {sucursalesCatalog.map((row) => (
                        <option key={`catalog-sucursal-${row.id_sucursal}`} value={row.id_sucursal}>
                          {row.nombre_sucursal}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge text-bg-light">
                      {resolveSucursalLabel({
                        id_sucursal: workflowCreateContext?.id_sucursal_usuario,
                        nombre_sucursal:
                          sucursalesCatalog.find(
                            (row) =>
                              Number(row.id_sucursal) === Number(workflowCreateContext?.id_sucursal_usuario)
                          )?.nombre_sucursal || null
                      })}
                    </span>
                  )}
                  <label htmlFor="oc-filtro-alerta" className="inv-oc-toggle inv-oc-toggle--compact mb-0">
                    <input
                      id="oc-filtro-alerta"
                      className="form-check-input"
                      type="checkbox"
                      checked={soloAlertas}
                      onChange={(e) => setSoloAlertas(e.target.checked)}
                    />
                    <span>Solo alertas</span>
                  </label>
                </div>
              </div>
              <div className="card-body d-flex flex-column">
                {almacenesCatalogFiltradosPorSucursal.length > 0 && (
                  <div className="inv-oc-warehouse-base mb-2">
                    <div className="inv-oc-warehouse-base__head">
                      <span className="inv-oc-warehouse-base__title">Almacen destino de la orden</span>
                      <small className="text-muted">{selectedBaseAlmacenes.length}/1 seleccionado</small>
                    </div>
                    <div className="inv-oc-warehouse-chips">
                      {almacenesCatalogFiltradosPorSucursal.map((almacen) => {
                        const idAlmacen = Number(almacen.id_almacen);
                        const selected = selectedBaseAlmacenes.includes(idAlmacen);
                        return (
                          <button
                            key={`base-almacen-${idAlmacen}`}
                            type="button"
                            className={`inv-oc-warehouse-chip ${selected ? 'is-active' : ''}`}
                            onClick={() => toggleDraftAlmacenBase(idAlmacen)}
                            title={formatAlmacenDisplay(almacen)}
                          >
                            <i className="bi bi-building" aria-hidden="true" />
                            <span>{almacen.nombre_sucursal || almacen.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {almacenesCatalog.length === 0 && (
                  <div className="alert alert-warning py-2 mb-2">
                    No hay almacenes activos para enviar la solicitud. Configura al menos un almacen.
                  </div>
                )}
                {catalogPages.length === 0 ? (
                  <div className="inv-oc-empty-state flex-grow-1">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <span>Sin items para el filtro actual.</span>
                  </div>
                ) : (
                  <>
                    <div key={`catalog-grid-${catalogPage}`} className="inv-oc-catalog-grid inv-oc-catalog-grid--animated mb-2">
                      {(catalogPages[catalogPage] || []).map((item) => (
                        <article className="inv-oc-catalog-card" key={item.key}>
                          <div className="inv-oc-catalog-card__head">
                            <div className="inv-oc-catalog-card__title-wrap">
                              <i className={resolveItemIcon(item.item_tipo)} aria-hidden="true" />
                              <h5>{item.nombre}</h5>
                            </div>
                            <span className={`inv-oc-stock-badge ${stockBadgeClass(item.stock_state)}`}>
                              {item.stock_state}
                            </span>
                          </div>
                          <div className="inv-oc-catalog-card__meta">
                            <span className="text-capitalize">{item.item_tipo}</span>
                            <span>
                              Almacenes:{' '}
                              {(() => {
                                const ids = normalizeAlmacenesSelection(item?.id_almacenes, 50);
                                if (ids.length === 0) return '-';
                                const labels = ids
                                  .map((idAlmacen) => {
                                    const almacen = almacenesMap.get(idAlmacen);
                                    return almacen?.nombre_sucursal || almacen?.nombre || null;
                                  })
                                  .filter(Boolean);
                                if (labels.length === 0) return '-';
                                const joined = labels.slice(0, 2).join(', ');
                                return labels.length > 2 ? `${joined}...` : joined;
                              })()}
                            </span>
                            <span>Stock: {item.cantidad}</span>
                            <span>Min: {item.stock_minimo}</span>
                          </div>
                          <button className="inv-oc-catalog-card__action" onClick={() => addToDraft(item)}>
                            <i className="bi bi-plus-circle" aria-hidden="true" />
                            <span>Agregar</span>
                          </button>
                        </article>
                      ))}
                    </div>

                    <div className="inv-oc-carousel-footer">
                      <div className="inv-oc-carousel-dots" role="tablist" aria-label="Paginas del carrusel">
                        {catalogDotItems.map((dot) => {
                          if (dot.type === 'ellipsis') {
                            return (
                              <span key={dot.key} className="inv-oc-carousel-ellipsis" aria-hidden="true">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={`catalog-dot-${dot.index}`}
                              type="button"
                              role="tab"
                              aria-selected={catalogPage === dot.index}
                              className={`inv-oc-carousel-dot ${catalogPage === dot.index ? 'is-active' : ''}`}
                              onClick={() => setCatalogPage(dot.index)}
                              title={`Ir a pagina ${dot.index + 1}`}
                            />
                          );
                        })}
                      </div>
                      <div className="inv-oc-carousel-controls">
                        <button
                          type="button"
                          className="inv-oc-carousel-nav"
                          onClick={() =>
                            setCatalogPage((prev) => (prev <= 0 ? Math.max(0, catalogPages.length - 1) : prev - 1))
                          }
                          disabled={catalogPages.length <= 1}
                          aria-label="Pagina anterior"
                        >
                          <i className="bi bi-chevron-left" aria-hidden="true" />
                        </button>
                        <span className="inv-oc-carousel-counter">Pagina {catalogPage + 1}/{catalogPages.length}</span>
                        <button
                          type="button"
                          className="inv-oc-carousel-nav"
                          onClick={() =>
                            setCatalogPage((prev) => (prev >= catalogPages.length - 1 ? 0 : prev + 1))
                          }
                          disabled={catalogPages.length <= 1}
                          aria-label="Pagina siguiente"
                        >
                          <i className="bi bi-chevron-right" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="inv-oc-catalog-totals mt-2">
                  <span className="badge rounded-pill text-bg-light">Productos: {catalogTotals.productos}</span>
                  <span className="badge rounded-pill text-bg-light">Insumos: {catalogTotals.insumos}</span>
                  <span className="badge rounded-pill text-bg-light">Total: {filteredCatalog.length}</span>
                </div>
              </div>
            </section>
          )}

          {canVer && (
            <section className="card shadow-sm inv-oc-card inv-oc-flow-shell">
              <div className="card-header inv-oc-card__header">
                <div>
                  <h4 className="mb-1">Flujo de ordenes de compra</h4>
                  <p className="mb-0 text-muted small">
                    Visualiza solicitudes, aplica filtros y ejecuta acciones segun estado y permiso.
                  </p>
                </div>
              </div>
              <div className="card-body d-flex flex-column gap-3">
                <div className="row g-2">
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Vista</label>
                    <select
                      className="form-select"
                      value={scope}
                      onChange={(e) => {
                        setPage(1);
                        setScope(e.target.value);
                      }}
                    >
                      <option value="mine">Mis solicitudes</option>
                      {canVerTodas && <option value="all">Todas</option>}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Sucursal</label>
                    <select
                      className="form-select"
                      value={flowSucursalFilter}
                      onChange={(e) => {
                        setPage(1);
                        setFlowSucursalFilter(e.target.value);
                      }}
                    >
                      <option value="">Todas</option>
                      {sucursalesCatalog.map((row) => (
                        <option key={`flow-sucursal-${row.id_sucursal}`} value={row.id_sucursal}>
                          {row.nombre_sucursal}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Estado</label>
                    <select
                      className="form-select"
                      value={estadoFiltro}
                      onChange={(e) => {
                        setPage(1);
                        setEstadoFiltro(e.target.value);
                      }}
                    >
                      <option value="">Todos</option>
                      {ESTADOS.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Buscar</label>
                    <div className="inv-oc-input-wrap">
                      <i className="bi bi-search" aria-hidden="true" />
                      <input
                        className="form-control inv-oc-input"
                        value={search}
                        onChange={(e) => {
                          setPage(1);
                          setSearch(e.target.value);
                        }}
                        placeholder="ID, usuario o texto..."
                      />
                    </div>
                  </div>
                </div>

                {loadingOrdenes ? (
                  <div className="text-muted small">Cargando...</div>
                ) : ordenesVisibles.length === 0 ? (
                  <div className="inv-oc-empty-state">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <span>Sin ordenes para este filtro.</span>
                  </div>
                ) : (
                  <div className="inv-oc-flow-grid">
                    {ordenesVisibles.map((row) => {
                      const estadoVisual = resolveEstadoVisual(row);
                      const isItemRequestOnlyCard =
                        Number(row?.total_items || 0) <= 0 && Number(row?.total_solicitudes_item || 0) > 0;
                      const itemRequestOnlyState = resolveItemRequestOnlyState(row);
                      const toneClass = isItemRequestOnlyCard
                        ? `is-item-request ${estadoToneClass(itemRequestOnlyState)}`
                        : estadoToneClass(estadoVisual);
                      const usuario = row.solicitante_nombre_usuario || `Usuario #${row.id_usuario}`;
                      const rol = row.solicitante_roles || 'Rol no disponible';
                      return (
                        <article key={row.id_orden_compra} className={`inv-oc-flow-card ${toneClass}`}>
                          <div className="inv-oc-flow-card__head">
                            <div className="inv-oc-flow-card__identity">
                              <span className="inv-oc-flow-card__order">
                                <i
                                  className={isItemRequestOnlyCard ? 'bi bi-lightbulb' : 'bi bi-journal-check'}
                                  aria-hidden="true"
                                />
                                {isItemRequestOnlyCard
                                  ? `Solicitud item nuevo #${row.id_orden_compra}`
                                  : `Orden #${row.id_orden_compra}`}
                              </span>
                              <strong>{usuario}</strong>
                              <small>{rol}</small>
                            </div>
                            {isItemRequestOnlyCard ? (
                              <span className={`badge ${itemRequestOnlyBadgeClass(itemRequestOnlyState)}`}>
                                <i className="bi bi-tags me-1" aria-hidden="true" />
                                {itemRequestOnlyLabel(itemRequestOnlyState)}
                              </span>
                            ) : (
                              <span className={`badge ${badgeClass(estadoVisual)}`}>
                                <i className={`${estadoIconClass(estadoVisual)} me-1`} aria-hidden="true" />
                                {formatEstadoLabel(estadoVisual)}
                              </span>
                            )}
                          </div>
                          <div className="inv-oc-flow-card__date">
                            <i className="bi bi-clock-history" aria-hidden="true" />
                            <span>
                              {formatDate(row.fecha_creacion || row.fecha)} {formatTime(row.fecha_creacion)}
                            </span>
                          </div>
                          <div className="inv-oc-flow-card__meta">
                            {!isItemRequestOnlyCard && (
                              <>
                                <span>
                                  <i className="bi bi-box2 me-1" aria-hidden="true" />
                                  Items: {row.total_items || 0}
                                </span>
                                <span>
                                  <i className="bi bi-123 me-1" aria-hidden="true" />
                                  Cantidad: {row.total_cantidad || 0}
                                </span>
                              </>
                            )}
                            <span>
                              <i className="bi bi-shop me-1" aria-hidden="true" />
                              {resolveSucursalLabel(row)}
                            </span>
                            {!isItemRequestOnlyCard && (
                              <span>
                                <i className="bi bi-receipt-cutoff me-1" aria-hidden="true" />
                                Recepcion:{' '}
                                {hasReceptionRegistered(row)
                                  ? parsePositiveInt(row?.id_archivo_factura_recepcion)
                                    ? 'Registrada + factura'
                                    : 'Registrada'
                                  : 'Pendiente'}
                              </span>
                            )}
                          </div>
                          {hasValue(row?.observacion_solicitud) && (
                            <p className="inv-oc-flow-card__note">
                              <i className="bi bi-chat-left-text me-1" aria-hidden="true" />
                              {row.observacion_solicitud}
                            </p>
                          )}
                          {isItemRequestOnlyCard && (
                            <p className="inv-oc-flow-card__note">
                              <i className="bi bi-info-circle me-1" aria-hidden="true" />
                              Flujo de alta rapida de catalogo: revisa las solicitudes y luego continua la OC.
                            </p>
                          )}
                          {renderActions(row, true)}
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="small text-muted">
                    Pagina {pagination.page} de {pagination.totalPages} - Total {pagination.total} orden(es)
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button
                      className="btn btn-outline-secondary"
                      disabled={page <= 1 || loadingOrdenes}
                      onClick={() => setPage((n) => Math.max(1, n - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      disabled={page >= pagination.totalPages || loadingOrdenes}
                      onClick={() => setPage((n) => Math.min(pagination.totalPages || 1, n + 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* AM: detalle de solicitud se mantiene abajo como panel unico para evitar saturacion visual. */}
      {canCrear && (
        <div className="inv-oc-middle-panels">
          <section className="card shadow-sm inv-oc-card inv-oc-draft-card">
              <div className="card-header inv-oc-card__header">
                <div>
                  <h4 className="mb-1">Detalle de solicitud</h4>
                  <p className="mb-0 text-muted small">Lineas que se enviaran para aprobacion.</p>
                </div>
                {canSolicitarItemNuevo && (
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setItemRequestModal({ ...emptyItemRequestModal(), open: true })}
                  >
                    <i className="bi bi-plus-square me-1" aria-hidden="true" />
                    Solicitar item nuevo
                  </button>
                )}
              </div>
              <div className="card-body d-flex flex-column gap-3">
                {draft.length === 0 ? (
                  <div className="inv-oc-empty-state">
                    <i className="bi bi-list-check" aria-hidden="true" />
                    <span>Aun no hay items agregados.</span>
                  </div>
                ) : (
                  <div className="inv-oc-draft-grid">
                    {draft.map((row) => {
                      const selectedForRow = normalizeAlmacenesSelection(row.id_almacenes, 1).filter((idAlmacen) =>
                        almacenesMap.has(idAlmacen)
                      );
                      const allowedWarehousesForRow = normalizeAlmacenesSelection(
                        row?.id_almacenes_disponibles ?? row?.id_almacenes,
                        50
                      )
                        .map((idAlmacen) => almacenesMap.get(idAlmacen))
                        .filter(Boolean);
                      return (
                        <article key={row.key} className="inv-oc-draft-item-card">
                        <div className="inv-oc-draft-item-card__head">
                          <div className="inv-oc-draft-item-card__title">
                            <span className="inv-oc-draft-item-card__icon">
                              <i className={resolveItemIcon(row.item_tipo)} aria-hidden="true" />
                            </span>
                            <div className="d-flex flex-column">
                              <strong>{row.nombre}</strong>
                              <small className="text-capitalize">{row.item_tipo}</small>
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-danger inv-oc-draft-remove"
                            onClick={() => setDraft((prev) => prev.filter((item) => item.key !== row.key))}
                          >
                            <i className="bi bi-trash3 me-1" aria-hidden="true" />
                            Quitar
                          </button>
                        </div>
                        <div className="inv-oc-draft-item-card__body">
                          <label className="form-label mb-1">Cantidad</label>
                          {/* AM: stepper mixto para subir/bajar rapido y permitir escritura manual del numero. */}
                          <div className={`inv-oc-qty-control ${draftValidation[row.key] ? 'is-invalid' : ''}`}>
                            <button
                              type="button"
                              className="inv-oc-qty-btn"
                              onClick={() => stepDraftCantidad(row.key, -1)}
                              aria-label={`Disminuir cantidad de ${row.nombre}`}
                            >
                              <i className="bi bi-dash-lg" aria-hidden="true" />
                            </button>
                            <input
                              className="form-control form-control-sm inv-oc-qty-input"
                              value={row.cantidad}
                              onChange={(e) => setDraftCantidad(row.key, e.target.value)}
                            />
                            <button
                              type="button"
                              className="inv-oc-qty-btn"
                              onClick={() => stepDraftCantidad(row.key, 1)}
                              aria-label={`Aumentar cantidad de ${row.nombre}`}
                            >
                              <i className="bi bi-plus-lg" aria-hidden="true" />
                            </button>
                          </div>
                          {draftValidation[row.key] && (
                            <div className="invalid-feedback d-block">{draftValidation[row.key]}</div>
                          )}

                          <label className="form-label mb-1 mt-2">Almacen destino (1)</label>
                          <div className={`inv-oc-warehouse-chips ${draftValidation[row.key] ? 'is-invalid' : ''}`}>
                            {allowedWarehousesForRow.map((almacen) => {
                              const idAlmacen = Number(almacen.id_almacen);
                              const selected = selectedForRow.includes(idAlmacen);
                              return (
                                <button
                                  key={`${row.key}:almacen:${idAlmacen}`}
                                  type="button"
                                  className={`inv-oc-warehouse-chip ${selected ? 'is-active' : ''}`}
                                  onClick={() => toggleDraftAlmacen(row.key, idAlmacen)}
                                  title={formatAlmacenDisplay(almacen)}
                                >
                                  <i className="bi bi-shop" aria-hidden="true" />
                                  <span>{almacen.nombre_sucursal || almacen.nombre}</span>
                                </button>
                              );
                            })}
                          </div>
                          <small className="text-muted d-block mt-1">
                            Cantidad solicitada para la sucursal seleccionada.
                          </small>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}

                {canSolicitarItemNuevo && (
                  <div className="inv-oc-draft-shell">
                    <div className="inv-oc-draft-shell__title">
                      <i className="bi bi-lightbulb" aria-hidden="true" />
                      <span>Solicitudes de item no registrado</span>
                    </div>
                    {draftItemRequests.length === 0 ? (
                      <div className="text-muted small px-2 py-2">Sin solicitudes de item nuevo.</div>
                    ) : (
                      <div className="d-flex flex-column gap-2 p-2">
                        {draftItemRequests.map((row) => (
                          <article
                            key={row.key}
                            className="border rounded-3 p-2 d-flex justify-content-between gap-2 align-items-start"
                          >
                            <div className="d-flex flex-column">
                              <strong className="text-capitalize">{row.nombre_sugerido}</strong>
                              <small className="text-muted text-capitalize">{row.tipo_item}</small>
                              <small className="text-muted">
                                Cantidad sugerida: {row.cantidad_sugerida} {row.descripcion ? `- ${row.descripcion}` : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                setDraftItemRequests((prev) => prev.filter((item) => item.key !== row.key))
                              }
                            >
                              Quitar
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="form-label">Observacion</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Ejemplo: Compra planificada para la siguiente semana..."
                  />
                  <div className="form-text">{normalizeText(observacion, 1000).length}/1000 caracteres</div>
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <small className="text-muted">
                    Productos: {draftTotals.productos} - Insumos: {draftTotals.insumos} - Unidades: {draftTotals.unidades}
                    {hasDraftErrors ? ' - corrige campos marcados' : ''}
                  </small>
                  <button
                    className="btn btn-primary inv-oc-primary-btn"
                    onClick={createSolicitud}
                    disabled={creating || hasDraftErrors || !hasDraftContent}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-check me-1" aria-hidden="true" />
                        Crear solicitud
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
        </div>
      )}
      {detalleActual.loading || detalleActual.error || detalleActual.data ? (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-journal-text" aria-hidden="true" />
                  Detalle de orden
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setDetalleActual({ loading: false, error: '', data: null })}
                />
              </div>
              <div className="modal-body">
                {detalleActual.loading ? (
                  <div className="text-muted">Cargando detalle...</div>
                ) : detalleActual.error ? (
                  <div className="alert alert-danger mb-0">{detalleActual.error}</div>
                ) : (
                  <>
                    {/* AM: detalle profesional en modal compacto, sin cuadros legacy ni tablas planas como vista principal. */}
                    {(() => {
                      const orden = detalleActual.data?.orden || {};
                      const solicitudesItem = Array.isArray(detalleActual.data?.solicitudes_item)
                        ? detalleActual.data.solicitudes_item
                        : [];
                      const estadoOrden = resolveEstadoVisual(orden);
                      const estadoOrdenReal = resolveEstado(orden);
                      // AM: resumen de estados movido al detalle para evitar ruido en el card.
                      const solicitudesResumen = solicitudesItem.reduce(
                        (acc, row) => {
                          const estado = parseItemRequestState(row?.estado);
                          acc.total += 1;
                          if (estado === ITEM_REQUEST_STATE_PENDIENTE) acc.pendientes += 1;
                          else if (estado === ITEM_REQUEST_STATE_EN_REVISION) acc.enRevision += 1;
                          else if (estado === ITEM_REQUEST_STATE_ATENDIDA) acc.atendidas += 1;
                          return acc;
                        },
                        { total: 0, pendientes: 0, enRevision: 0, atendidas: 0 },
                      );
                      return (
                        <div className="inv-oc-detail-modal">
                          <section className="inv-oc-detail-hero-card">
                            <div className="inv-oc-detail-hero-card__copy">
                              <span className="inv-oc-detail-kicker">Orden #{orden.id_orden_compra || '-'}</span>
                              <h6>{orden.solicitante_nombre_usuario || '-'}</h6>
                              <p>
                                <span>
                                  <i className="bi bi-person-badge me-1" aria-hidden="true" />
                                  {orden.solicitante_roles || 'Rol no disponible'}
                                </span>
                                <span>
                                  <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                                  {formatDate(orden.fecha_creacion || orden.fecha)}
                                </span>
                                <span>
                                  <i className="bi bi-clock me-1" aria-hidden="true" />
                                  {formatTime(orden.fecha_creacion)}
                                </span>
                                <span>
                                  <i className="bi bi-shop me-1" aria-hidden="true" />
                                  {resolveSucursalLabel(orden)}
                                </span>
                              </p>
                            </div>
                            <span className={`badge ${badgeClass(estadoOrden)} inv-oc-detail-state-badge`}>
                              <i className={`${estadoIconClass(estadoOrden)} me-1`} aria-hidden="true" />
                              {estadoOrden}
                            </span>
                          </section>

                          {hasValue(orden?.observacion_solicitud) && (
                            <section className="inv-oc-detail-note-card">
                              <span>Observacion de solicitud</span>
                              <p>{orden.observacion_solicitud}</p>
                            </section>
                          )}

                          <section className="inv-oc-detail-section">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                              <h6 className="mb-0">Solicitudes de item no registrado</h6>
                              {solicitudesResumen.total > 0 && (
                                <div className="d-flex flex-wrap gap-1">
                                  <span className="badge text-bg-secondary">Solicitudes: {solicitudesResumen.total}</span>
                                  <span className="badge text-bg-warning">Pendientes: {solicitudesResumen.pendientes}</span>
                                  <span className="badge text-bg-info">En revision: {solicitudesResumen.enRevision}</span>
                                  <span className="badge text-bg-success">Atendidas: {solicitudesResumen.atendidas}</span>
                                </div>
                              )}
                            </div>
                            {solicitudesItem.length === 0 ? (
                              <div className="inv-oc-empty-state">
                                <i className="bi bi-lightbulb" aria-hidden="true" />
                                <span>Sin solicitudes de item no registrado.</span>
                              </div>
                            ) : (
                              <div className="d-flex flex-column gap-2">
                                {solicitudesItem.map((row) => {
                                  const estadoSolicitud = parseItemRequestState(row?.estado);
                                  const idSolicitud = parsePositiveInt(row?.id_solicitud_item);
                                  const canReviewRequest =
                                    canGestionar &&
                                    estadoOrdenReal === 'PENDIENTE' &&
                                    (estadoSolicitud === ITEM_REQUEST_STATE_PENDIENTE ||
                                      estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION);
                                  const canOpenQuickCreate =
                                    canGestionar &&
                                    estadoOrdenReal === 'PENDIENTE' &&
                                    estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION &&
                                    ((String(row?.tipo_item || '').toLowerCase() === 'producto' && canCrearProductos) ||
                                      (String(row?.tipo_item || '').toLowerCase() === 'insumo' && canCrearInsumos));

                                  return (
                                    <article
                                      key={`solicitud-item-${idSolicitud || `${row?.tipo_item || 'item'}-${row?.nombre_sugerido || 'nuevo'}`}`}
                                      className="border rounded-3 p-2 d-flex flex-column gap-2"
                                    >
                                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                        <div className="d-flex flex-column">
                                          <strong>{normalizeText(row?.nombre_sugerido, 160) || '-'}</strong>
                                          <small className="text-muted text-capitalize">
                                            {row?.tipo_item || '-'} - Cantidad sugerida: {parsePositiveInt(row?.cantidad_sugerida) || 1}
                                          </small>
                                        </div>
                                        <span className={`badge ${itemRequestBadgeClass(estadoSolicitud)}`}>{estadoSolicitud}</span>
                                      </div>
                                      {hasValue(row?.descripcion) && (
                                        <small className="text-muted">{normalizeText(row?.descripcion, 500)}</small>
                                      )}
                                      {hasValue(row?.comentario_revision) && (
                                        <small className="text-muted">
                                          Revision: {normalizeText(row?.comentario_revision, 500)}
                                        </small>
                                      )}
                                      {canReviewRequest && (
                                        <div className="d-flex flex-wrap gap-2">
                                          {estadoSolicitud === ITEM_REQUEST_STATE_PENDIENTE && (
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-primary"
                                              onClick={() => openItemRequestDecision(orden, row, 'aprobar')}
                                              disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                            >
                                              Aprobar solicitud
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => openItemRequestDecision(orden, row, 'rechazar')}
                                            disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                          >
                                            Rechazar solicitud
                                          </button>
                                        </div>
                                      )}
                                      {canOpenQuickCreate && (
                                        <div className="d-flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-success"
                                            onClick={() => openQuickCreateItemModalFromRequest(orden, row)}
                                            disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                          >
                                            Agregar a catalogo
                                          </button>
                                        </div>
                                      )}
                                      {!canOpenQuickCreate && estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION && canGestionar && (
                                        <small className="text-muted">
                                          Sin permiso para crear este tipo de item en catalogo.
                                        </small>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setDetalleActual({ loading: false, error: '', data: null })}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {reviewModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i
                    className={`bi ${
                      reviewModal.mode === 'rechazar' ? 'bi-x-octagon' : 'bi-patch-check'
                    }`}
                    aria-hidden="true"
                  />
                  {reviewModal.mode === 'rechazar' ? 'Rechazar orden' : 'Aprobar orden'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setReviewModal(emptyReviewModal())}
                  disabled={reviewModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{reviewModal.orden?.id_orden_compra}</strong>
                </p>
                <label className="form-label">
                  {reviewModal.mode === 'rechazar'
                    ? 'Motivo de rechazo (obligatorio)'
                    : 'Comentario de aprobacion (opcional)'}
                </label>
                <textarea
                  className={`form-control ${reviewModal.error ? 'is-invalid' : ''}`}
                  rows="3"
                  value={reviewModal.comentario}
                  onChange={(e) =>
                    setReviewModal((prev) => ({
                      ...prev,
                      comentario: e.target.value,
                      error: ''
                    }))
                  }
                  placeholder={
                    reviewModal.mode === 'rechazar'
                      ? 'Escribe el motivo del rechazo...'
                      : 'Comentario interno para la aprobacion...'
                  }
                />
                {reviewModal.error && <div className="invalid-feedback d-block">{reviewModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setReviewModal(emptyReviewModal())}
                  disabled={reviewModal.loading}
                >
                  Cancelar
                </button>
                <button
                  className={`btn ${reviewModal.mode === 'rechazar' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={submitReviewModal}
                  disabled={reviewModal.loading}
                >
                  {reviewModal.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Guardando...
                    </>
                  ) : (
                    reviewModal.mode === 'rechazar' ? 'Confirmar rechazo' : 'Confirmar aprobacion'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemRequestModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-plus-square" aria-hidden="true" />
                  Solicitar item no registrado
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setItemRequestModal(emptyItemRequestModal())}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Tipo</label>
                    <select
                      className="form-select"
                      value={itemRequestModal.tipo_item}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, tipo_item: e.target.value, error: '' }))
                      }
                    >
                      <option value="producto">Producto</option>
                      <option value="insumo">Insumo</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Nombre sugerido</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.nombre_sugerido}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, nombre_sugerido: e.target.value, error: '' }))
                      }
                      placeholder="Ejemplo: Papel aluminio industrial"
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Cantidad sugerida</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.cantidad_sugerida}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({
                          ...prev,
                          cantidad_sugerida: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Descripcion</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.descripcion}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, descripcion: e.target.value, error: '' }))
                      }
                      placeholder="Uso o detalle breve del item solicitado"
                    />
                  </div>
                </div>
                {itemRequestModal.error && <div className="alert alert-danger mt-2 mb-0">{itemRequestModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setItemRequestModal(emptyItemRequestModal())}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={addItemRequestToDraft}>
                  Agregar a solicitud
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemRequestDecisionModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i
                    className={`bi ${
                      itemRequestDecisionModal.accion === 'rechazar' ? 'bi-x-octagon' : 'bi-patch-check'
                    }`}
                    aria-hidden="true"
                  />
                  {itemRequestDecisionModal.accion === 'rechazar'
                    ? 'Rechazar solicitud de item'
                    : 'Aprobar solicitud de item'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setItemRequestDecisionModal(emptyItemRequestDecisionModal())}
                  disabled={itemRequestDecisionModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{itemRequestDecisionModal.orden?.id_orden_compra || '-'}</strong> - Solicitud{' '}
                  <strong>#{itemRequestDecisionModal.solicitud?.id_solicitud_item || '-'}</strong>
                </p>
                <label className="form-label">
                  {itemRequestDecisionModal.accion === 'rechazar'
                    ? 'Comentario (obligatorio)'
                    : 'Comentario (opcional)'}
                </label>
                <textarea
                  className={`form-control ${itemRequestDecisionModal.error ? 'is-invalid' : ''}`}
                  rows="3"
                  value={itemRequestDecisionModal.comentario}
                  onChange={(e) =>
                    setItemRequestDecisionModal((prev) => ({
                      ...prev,
                      comentario: e.target.value,
                      error: ''
                    }))
                  }
                  placeholder={
                    itemRequestDecisionModal.accion === 'rechazar'
                      ? 'Motivo del rechazo de la solicitud...'
                      : 'Comentario interno de la revision...'
                  }
                />
                {itemRequestDecisionModal.error && (
                  <div className="invalid-feedback d-block">{itemRequestDecisionModal.error}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setItemRequestDecisionModal(emptyItemRequestDecisionModal())}
                  disabled={itemRequestDecisionModal.loading}
                >
                  Cancelar
                </button>
                <button
                  className={`btn ${itemRequestDecisionModal.accion === 'rechazar' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={submitItemRequestDecision}
                  disabled={itemRequestDecisionModal.loading}
                >
                  {itemRequestDecisionModal.loading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickCreateItemModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-box-seam" aria-hidden="true" />
                  Alta rapida de {quickCreateItemModal.tipo_item}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setQuickCreateItemModal(emptyQuickCreateItemModal())}
                  disabled={quickCreateItemModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{quickCreateItemModal.orden?.id_orden_compra || '-'}</strong> - Solicitud{' '}
                  <strong>#{quickCreateItemModal.solicitud?.id_solicitud_item || '-'}</strong>
                </p>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Nombre</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.nombre}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({ ...prev, nombre: e.target.value, error: '' }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Cantidad inicial</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.cantidad}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          cantidad: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Stock minimo</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.stock_minimo}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          stock_minimo: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Precio</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.precio}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          precio: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Almacen</label>
                    <select
                      className="form-select"
                      value={quickCreateItemModal.id_almacen}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          id_almacen: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value="">Selecciona almacen</option>
                      {quickCreateAlmacenesOptions.map((row) => (
                        <option key={`quick-add-almacen-${row.id_almacen}`} value={row.id_almacen}>
                          {row.nombre} ({row.nombre_sucursal || `Sucursal #${row.id_sucursal}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  {quickCreateItemModal.tipo_item === 'producto' ? (
                    <div className="col-12">
                      <label className="form-label mb-1">Categoria de producto</label>
                      <select
                        className="form-select"
                        value={quickCreateItemModal.id_categoria_producto}
                        onChange={(e) =>
                          setQuickCreateItemModal((prev) => ({
                            ...prev,
                            id_categoria_producto: sanitizeInt(e.target.value),
                            error: ''
                          }))
                        }
                      >
                        <option value="">Selecciona categoria</option>
                          {categoriasProductos
                            .filter((row) => boolish(row?.estado ?? true))
                            .map((row) => (
                            <option key={`quick-add-cat-prod-${row.id_categoria_producto}`} value={row.id_categoria_producto}>
                              {getCategoriaLabel(row, `Categoria #${row.id_categoria_producto}`)}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="col-12 col-md-8">
                        <label className="form-label mb-1">Categoria de insumo</label>
                        <select
                          className="form-select"
                          value={quickCreateItemModal.id_categoria_insumo}
                          onChange={(e) =>
                            setQuickCreateItemModal((prev) => ({
                              ...prev,
                              id_categoria_insumo: sanitizeInt(e.target.value),
                              error: ''
                            }))
                          }
                        >
                          <option value="">Selecciona categoria</option>
                          {categoriasInsumos
                            .filter((row) => boolish(row?.estado ?? true))
                            .map((row) => (
                              <option key={`quick-add-cat-ins-${row.id_categoria_insumo}`} value={row.id_categoria_insumo}>
                                {getCategoriaLabel(row, `Categoria #${row.id_categoria_insumo}`)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label mb-1">Unidad (opcional)</label>
                        <select
                          className="form-select"
                          value={quickCreateItemModal.id_unidad_medida}
                          onChange={(e) =>
                            setQuickCreateItemModal((prev) => ({
                              ...prev,
                              id_unidad_medida: sanitizeInt(e.target.value),
                              error: ''
                            }))
                          }
                        >
                          <option value="">Sin unidad</option>
                          {unidadesMedida.map((row) => (
                            <option key={`quick-add-um-${row.id_unidad_medida}`} value={row.id_unidad_medida}>
                              {row.nombre_unidad_medida || row.nombre || `Unidad #${row.id_unidad_medida}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="col-12">
                    <label className="form-label mb-1">Descripcion</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={quickCreateItemModal.descripcion}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({ ...prev, descripcion: e.target.value, error: '' }))
                      }
                    />
                  </div>
                </div>
                {quickCreateItemModal.error && <div className="alert alert-danger mt-2 mb-0">{quickCreateItemModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setQuickCreateItemModal(emptyQuickCreateItemModal())}
                  disabled={quickCreateItemModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={submitQuickCreateItemModal} disabled={quickCreateItemModal.loading}>
                  {quickCreateItemModal.loading ? 'Guardando...' : 'Guardar y marcar atendida'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editDetallesModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                  Editar lineas de orden #{editDetallesModal.orden?.id_orden_compra}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setEditDetallesModal(emptyEditDetallesModal())}
                  disabled={editDetallesModal.loading}
                />
              </div>
              <div className="modal-body">
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Tipo</th>
                        <th style={{ width: 140 }}>Cantidad</th>
                        <th style={{ width: 120 }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editDetallesModal.rows.map((row) => (
                        <tr key={row.id_detalle_orden}>
                          <td>{row.item_nombre}</td>
                          <td className="text-capitalize">{row.item_tipo}</td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={row.cantidad}
                              disabled={row.eliminar}
                              onChange={(e) =>
                                setEditDetallesModal((prev) => ({
                                  ...prev,
                                  error: '',
                                  rows: prev.rows.map((item) =>
                                    item.id_detalle_orden === row.id_detalle_orden
                                      ? { ...item, cantidad: sanitizeInt(e.target.value) }
                                      : item
                                  )
                                }))
                              }
                            />
                          </td>
                          <td>
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={Boolean(row.eliminar)}
                                onChange={(e) =>
                                  setEditDetallesModal((prev) => ({
                                    ...prev,
                                    error: '',
                                    rows: prev.rows.map((item) =>
                                      item.id_detalle_orden === row.id_detalle_orden
                                        ? { ...item, eliminar: e.target.checked }
                                        : item
                                    )
                                  }))
                                }
                              />
                              <label className="form-check-label small">Eliminar</label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border rounded-3 p-2 mt-2">
                  <h6 className="mb-2">Agregar nuevo item</h6>
                  {/* AM: selector guiado por tipo + buscador; evita combobox largo y acelera seleccion en operacion real. */}
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label mb-1">Tipo de item</label>
                      <div className="btn-group btn-group-sm w-100" role="group" aria-label="Tipo de item">
                        <button
                          type="button"
                          className={`btn ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'producto'
                              ? 'btn-primary'
                              : 'btn-outline-primary'
                          }`}
                          onClick={() =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              selected_item_tipo: 'producto',
                              error: ''
                            }))
                          }
                        >
                          Productos
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'insumo'
                              ? 'btn-primary'
                              : 'btn-outline-primary'
                          }`}
                          onClick={() =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              selected_item_tipo: 'insumo',
                              error: ''
                            }))
                          }
                        >
                          Insumos
                        </button>
                      </div>
                    </div>
                    <div className="col-12 col-md-8">
                      <label className="form-label mb-1">Buscar item</label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">
                          <i className="bi bi-search" aria-hidden="true" />
                        </span>
                        <input
                          className="form-control"
                          value={editDetallesModal.search_item || ''}
                          onChange={(e) =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              search_item: e.target.value,
                              error: ''
                            }))
                          }
                          placeholder={`Buscar ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'insumo'
                              ? 'insumos'
                              : 'productos'
                          }...`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive mt-2" style={{ maxHeight: 220 }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th>Almacenes de la sucursal</th>
                          <th style={{ width: 120 }}>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editDetalleCatalogFiltered.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-muted text-center py-3">
                              Sin resultados para este filtro.
                            </td>
                          </tr>
                        ) : (
                          editDetalleCatalogFiltered.map((row) => (
                            <tr key={`edit-item-row-${row.key}`}>
                              <td>
                                <strong>{row.nombre}</strong>{' '}
                                <small className="text-muted text-capitalize">({row.item_tipo})</small>
                              </td>
                              <td>
                                {normalizeAlmacenesSelection(row.id_almacenes_sucursal, 50)
                                  .map((idAlmacen) => {
                                    const almacen = almacenesMap.get(idAlmacen);
                                    return almacen?.nombre || null;
                                  })
                                  .filter(Boolean)
                                  .join(', ') || '-'}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => addCatalogItemToEditModal(row)}
                                >
                                  Agregar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {Array.isArray(editDetallesModal.add_rows) && editDetallesModal.add_rows.length > 0 && (
                    <div className="table-responsive mt-2">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Nuevo item</th>
                            <th style={{ width: 130 }}>Cantidad</th>
                            <th style={{ width: 220 }}>Almacen destino</th>
                            <th style={{ width: 110 }}>Quitar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editDetallesModal.add_rows.map((row) => (
                            <tr key={row.key}>
                              <td>
                                {row.item_nombre} <small className="text-muted text-capitalize">({row.item_tipo})</small>
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={row.cantidad}
                                  onChange={(e) =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      error: '',
                                      add_rows: prev.add_rows.map((item) =>
                                        item.key === row.key
                                          ? { ...item, cantidad: sanitizeInt(e.target.value) }
                                          : item
                                      )
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={row.id_almacen_destino || ''}
                                  onChange={(e) =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      error: '',
                                      add_rows: prev.add_rows.map((item) =>
                                        item.key === row.key
                                          ? { ...item, id_almacen_destino: parsePositiveInt(e.target.value) || '' }
                                          : item
                                      )
                                    }))
                                  }
                                >
                                  {normalizeAlmacenesSelection(row.id_almacenes_disponibles, 50).map((idAlmacen) => {
                                    const almacen = almacenesMap.get(idAlmacen);
                                    return (
                                      <option key={`${row.key}:almacen:${idAlmacen}`} value={idAlmacen}>
                                        {almacen?.nombre || `Almacen #${idAlmacen}`} (
                                        {almacen?.nombre_sucursal || `Sucursal #${almacen?.id_sucursal || '-'}`})
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      add_rows: prev.add_rows.filter((item) => item.key !== row.key),
                                      error: ''
                                    }))
                                  }
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {editDetallesModal.error && <div className="alert alert-danger mt-2 mb-0">{editDetallesModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setEditDetallesModal(emptyEditDetallesModal())}
                  disabled={editDetallesModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={submitEditDetallesModal} disabled={editDetallesModal.loading}>
                  {editDetallesModal.loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recepcionModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-receipt" aria-hidden="true" />
                  Registrar recepcion de orden #{recepcionModal.orden?.id_orden_compra}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeRecepcionModal}
                  disabled={recepcionModal.loading}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Usuario (auto)</label>
                    <input className="form-control" value={recepcionModal.usuario_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Sucursal (auto)</label>
                    <input className="form-control" value={recepcionModal.sucursal_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Fecha (auto)</label>
                    <input className="form-control" value={recepcionModal.fecha_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Hora (auto)</label>
                    <input className="form-control" value={recepcionModal.hora_sistema} readOnly disabled />
                  </div>
                </div>

                <label className="form-label mb-1">Factura de recepcion (opcional)</label>
                <input
                  className={`form-control ${recepcionModal.factura_error ? 'is-invalid' : ''}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    const validationError = getInventarioImageFileError(file);
                    if (validationError) {
                      setRecepcionModal((prev) => ({
                        ...prev,
                        factura_file: null,
                        factura_preview_url: '',
                        factura_error: validationError
                      }));
                      return;
                    }
                    setRecepcionModal((prev) => ({
                      ...prev,
                      factura_file: file,
                      factura_preview_url: URL.createObjectURL(file),
                      factura_error: ''
                    }));
                  }}
                />
                {recepcionModal.factura_error && (
                  <div className="invalid-feedback d-block">{recepcionModal.factura_error}</div>
                )}
                <label className="form-label mb-1 mt-2">Observacion (opcional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={recepcionModal.observacion}
                  onChange={(e) => setRecepcionModal((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Comentario de recepcion en sucursal..."
                />
                {recepcionModal.error && <div className="alert alert-danger mt-2 mb-0">{recepcionModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeRecepcionModal}
                  disabled={recepcionModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={doReportarRecepcion} disabled={recepcionModal.loading}>
                  {recepcionModal.loading ? 'Enviando...' : 'Guardar recepcion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {supplyModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-in-down" aria-hidden="true" />
                  Abastecer orden
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setSupplyModal(emptySupplyModal())}
                  disabled={supplyModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{supplyModal.orden?.id_orden_compra}</strong> lista para ingreso a inventario.
                </p>
                <label className="form-label">Observacion (opcional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={supplyModal.observacion}
                  onChange={(e) => setSupplyModal((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Observacion operativa del abastecimiento..."
                />
                {supplyModal.error && <div className="alert alert-danger mt-2 mb-0">{supplyModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setSupplyModal(emptySupplyModal())}
                  disabled={supplyModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={doAbastecer} disabled={supplyModal.loading}>
                  {supplyModal.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Abasteciendo...
                    </>
                  ) : (
                    'Confirmar abastecimiento'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {convertPanel.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-repeat" aria-hidden="true" />
                  Continuar orden #{convertPanel.orden?.id_orden_compra || '-'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeConvertPanel}
                  disabled={convertPanel.loading}
                />
              </div>
              <div className="modal-body">
                {convertPanel.error && <div className="alert alert-danger">{convertPanel.error}</div>}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-7">
                    <label className="form-label mb-1">Proveedor</label>
                    <select
                      className={`form-select ${parsePositiveInt(convertPanel.id_proveedor) ? '' : 'is-invalid'}`}
                      value={convertPanel.id_proveedor}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          id_proveedor: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value="">Seleccione proveedor</option>
                      {proveedores.map((row) => (
                        <option key={row.id_proveedor} value={row.id_proveedor}>
                          {row.nombre_proveedor || `Proveedor #${row.id_proveedor}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-5">
                    <label className="form-label mb-1">Fecha de compra</label>
                    <input
                      className="form-control"
                      type="date"
                      value={convertPanel.fecha_compra}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({ ...prev, fecha_compra: e.target.value, error: '' }))
                      }
                    />
                  </div>
                </div>

                {/* AM: captura administrativa de costos reales por item para trazabilidad de compra. */}
                <div className="mb-3">
                  <label className="form-label mb-1">Costos y descuentos por item</label>
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th className="text-center">Cantidad</th>
                          <th>Costo unitario (L.)</th>
                          <th>Descuento linea (L.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(convertPanel.detalles) ? convertPanel.detalles : []).map((row) => (
                          <tr key={`convert-detail-${row.id_detalle_orden}`}>
                            <td>{row.item_nombre || `Detalle #${row.id_detalle_orden || '-'}`}</td>
                            <td className="text-center">{row.cantidad_orden || 0}</td>
                            <td style={{ minWidth: 150 }}>
                              <input
                                className="form-control form-control-sm"
                                value={row.precio_unitario}
                                onChange={(e) =>
                                  updateConvertDetailField(row.id_detalle_orden, 'precio_unitario', e.target.value)
                                }
                                placeholder="0.00"
                              />
                            </td>
                            <td style={{ minWidth: 150 }}>
                              <input
                                className="form-control form-control-sm"
                                value={row.descuento}
                                onChange={(e) => updateConvertDetailField(row.id_detalle_orden, 'descuento', e.target.value)}
                                placeholder="0.00"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AM: parametros globales de la compra (descuento global + ISV) sin tocar inventario aun. */}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Tipo descuento global</label>
                    <select
                      className="form-select"
                      value={resolveDiscountType(convertPanel.descuento_tipo)}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          descuento_tipo: resolveDiscountType(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value={DISCOUNT_TYPE_MONTO}>MONTO</option>
                      <option value={DISCOUNT_TYPE_PORCENTAJE}>PORCENTAJE</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">
                      Descuento global {resolveDiscountType(convertPanel.descuento_tipo) === DISCOUNT_TYPE_PORCENTAJE ? '(%)' : '(L.)'}
                    </label>
                    <input
                      className="form-control"
                      value={convertPanel.descuento_valor}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          descuento_valor: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">ISV (%)</label>
                    <input
                      className="form-control"
                      value={convertPanel.isv_pct}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          isv_pct: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Subtotal</small>
                      <strong>{formatMoney(convertPreview.sub_total)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Descuento total</small>
                      <strong>{formatMoney(convertPreview.descuento_total)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">ISV</small>
                      <strong>{formatMoney(convertPreview.isv)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Total</small>
                      <strong>{formatMoney(convertPreview.total)}</strong>
                    </div>
                  </div>
                </div>
                {convertPreview.has_error && <div className="alert alert-warning py-2">{convertPreview.error}</div>}

                <div className="mb-3">
                  <label className="form-label mb-1">Observaciones administrativas</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={convertPanel.observacion_admin}
                    onChange={(e) =>
                      setConvertPanel((prev) => ({
                        ...prev,
                        observacion_admin: e.target.value,
                        error: ''
                      }))
                    }
                    placeholder="Ejemplo: compra parcial pendiente de confirmar transferencia..."
                  />
                </div>

                {/* AM: modal admin con evidencias reutilizando upload actual sin WebSocket ni subestados nuevos. */}
                <div className="inv-oc-detail-evidence-grid">
                  <article className="inv-oc-evidence-card">
                    <span>Factura subida por sucursal</span>
                    {convertPanel.factura_recepcion_url ? (
                      <>
                        <a href={convertPanel.factura_recepcion_url} target="_blank" rel="noreferrer">
                          Ver imagen
                        </a>
                        <img src={convertPanel.factura_recepcion_url} alt="Factura de recepcion en sucursal" />
                      </>
                    ) : (
                      <small className="text-muted">No hay factura adjunta en esta recepcion.</small>
                    )}
                  </article>
                  <article className="inv-oc-evidence-card">
                    <span>Deposito / transferencia (opcional para Guardar)</span>
                    <input
                      className={`form-control ${convertPanel.transferencia_error ? 'is-invalid' : ''}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        // AM: libera preview anterior para evitar fugas al cambiar de archivo.
                        const previousPreview = String(convertPanel.transferencia_preview_url || '');
                        if (previousPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(previousPreview);
                        }
                        const validationError = getInventarioImageFileError(file);
                        if (validationError) {
                          setConvertPanel((prev) => ({
                            ...prev,
                            transferencia_file: null,
                            transferencia_preview_url: '',
                            transferencia_error: validationError
                          }));
                          return;
                        }
                        setConvertPanel((prev) => ({
                          ...prev,
                          transferencia_file: file,
                          transferencia_preview_url: file ? URL.createObjectURL(file) : '',
                          transferencia_error: '',
                          error: ''
                        }));
                      }}
                    />
                    {convertPanel.transferencia_error && (
                      <div className="invalid-feedback d-block">{convertPanel.transferencia_error}</div>
                    )}
                    {(convertPanel.transferencia_preview_url || convertPanel.transferencia_url_actual) && (
                      <>
                        <a
                          href={resolveInventarioImageUrl(
                            convertPanel.transferencia_preview_url || convertPanel.transferencia_url_actual
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver imagen actual
                        </a>
                        <img
                          src={resolveInventarioImageUrl(
                            convertPanel.transferencia_preview_url || convertPanel.transferencia_url_actual
                          )}
                          alt="Comprobante de deposito o transferencia"
                        />
                      </>
                    )}
                  </article>
                </div>
                <p className="form-text mt-2 mb-0">
                  Guardar: persiste proveedor/evidencia sin mover inventario. Guardar y abastecer: persiste y ejecuta
                  abastecimiento append-only.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeConvertPanel}
                  disabled={convertPanel.loading}
                >
                  Cancelar
                </button>
                {canConvertir && (
                  <button
                    className="btn btn-primary"
                    onClick={() => doConvert('guardar')}
                    disabled={convertPanel.loading}
                  >
                    {convertPanel.loading && convertPanel.submit_action === 'guardar' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                )}
                {canConvertir && canAbastecer && (
                  <button
                    className="btn btn-success"
                    onClick={() => doConvert('guardar_y_abastecer')}
                    disabled={convertPanel.loading}
                  >
                    {convertPanel.loading && convertPanel.submit_action === 'guardar_y_abastecer' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Guardando y abasteciendo...
                      </>
                    ) : (
                      'Guardar y abastecer'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenesCompraTab;





