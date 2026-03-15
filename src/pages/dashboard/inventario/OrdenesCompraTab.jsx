import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import { usePermisos } from '../../../context/PermisosContext';
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
const DISCOUNT_MODE_MONTO = 'MONTO';
const DISCOUNT_MODE_PORCENTAJE = 'PORCENTAJE';

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
  if (estado === 'APROBADA') return 'bg-primary';
  if (estado === 'RECHAZADA') return 'bg-danger';
  if (estado === 'EN_COMPRA') return 'bg-info text-dark';
  if (estado === 'ABASTECIDA') return 'bg-success';
  return 'bg-secondary';
};

const estadoToneClass = (estado) => `is-${String(estado || '').toLowerCase().replace('_', '-')}`;

const estadoIconClass = (estado) => {
  if (estado === 'PENDIENTE') return 'bi bi-hourglass-split';
  if (estado === 'APROBADA') return 'bi bi-patch-check';
  if (estado === 'RECHAZADA') return 'bi bi-x-octagon';
  if (estado === 'EN_COMPRA') return 'bi bi-receipt';
  if (estado === 'ABASTECIDA') return 'bi bi-box-seam';
  return 'bi bi-slash-circle';
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
  const date = text.includes('T') ? text.split('T')[0] : text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  return text;
};

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
  error: '',
  orden: null,
  id_proveedor: '',
  fecha_compra: '',
  isv_porcentaje: '0',
  descuento_tipo: DISCOUNT_MODE_MONTO,
  descuento_valor: '0',
  referencia_transferencia: '',
  transferencia_file: null,
  transferencia_preview_url: '',
  transferencia_error: '',
  detalles: []
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
  rows: []
});

const OrdenesCompraTab = ({ openToast }) => {
  const { can, canAny, loading: permisosLoading } = usePermisos();

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
  const canRecepcionar = canAny([
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR
  ]);
  // AM: solicitud de item nuevo solo para perfiles operativos sin alta directa de catalogo.
  const canCrearCatalogoDirecto = canAny([
    PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR,
    PERMISSIONS.INVENTARIO_INSUMOS_CREAR
  ]);
  const canSolicitarItemNuevo = canCrear && !canCrearCatalogoDirecto;

  const toast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') openToast(title, message, variant);
    },
    [openToast]
  );

  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
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
    const idSucursal = parseOptionalPositiveInt(catalogSucursalFilter);
    if (!idSucursal) return almacenesCatalog;
    return almacenesCatalog.filter((row) => Number(row.id_sucursal) === Number(idSucursal));
  }, [almacenesCatalog, catalogSucursalFilter]);
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

  const workflowStats = useMemo(() => {
    const stats = {
      total: ordenes.length,
      pendientes: 0,
      aprobadas: 0,
      enCompra: 0,
      abastecidas: 0
    };
    for (const row of ordenes) {
      const estado = resolveEstado(row);
      if (estado === 'PENDIENTE') stats.pendientes += 1;
      if (estado === 'APROBADA') stats.aprobadas += 1;
      if (estado === 'EN_COMPRA') stats.enCompra += 1;
      if (estado === 'ABASTECIDA') stats.abastecidas += 1;
    }
    return stats;
  }, [ordenes]);

  // AM: layout operativo: arriba solicitud + flujo (si ambos permisos); abajo detalle de solicitud.
  const showDualTopPanels = canCrear && canVer;

  const convertSummary = useMemo(() => {
    const subtotalBruto = (convertPanel.detalles || []).reduce((acc, row) => {
      const cantidad = parsePositiveInt(row?.cantidad) || 0;
      const precio = parseNonNegativeNumber(row?.precio_unitario) || 0;
      return acc + cantidad * precio;
    }, 0);
    const descuentoValor = parseNonNegativeNumber(convertPanel.descuento_valor) || 0;
    const descuentoTipo = String(convertPanel.descuento_tipo || DISCOUNT_MODE_MONTO).toUpperCase();
    const descuentoAplicado =
      descuentoTipo === DISCOUNT_MODE_PORCENTAJE
        ? subtotalBruto * (Math.min(descuentoValor, 100) / 100)
        : descuentoValor;
    const subtotal = Math.max(0, subtotalBruto - descuentoAplicado);
    const isv = parseNonNegativeNumber(convertPanel.isv_porcentaje) || 0;
    const isvValue = subtotal * (isv / 100);
    return {
      subtotalBruto,
      descuentoAplicado,
      subtotal,
      isvValue,
      total: subtotal + isvValue
    };
  }, [
    convertPanel.descuento_tipo,
    convertPanel.descuento_valor,
    convertPanel.detalles,
    convertPanel.isv_porcentaje
  ]);

  const loadCatalogs = useCallback(async (options = {}) => {
    if (!(canCrear || canConvertir)) return;
    if (!options?.silent) setLoadingCatalog(true);
    try {
      // AM: carga catalogos para crear solicitud y convertir compra.
      const [p, i, prov, alm] = await Promise.all([
        canCrear ? inventarioService.getProductos() : Promise.resolve([]),
        canCrear ? inventarioService.getInsumos() : Promise.resolve([]),
        canConvertir ? inventarioService.getProveedores() : Promise.resolve([]),
        canCrear ? inventarioService.getAlmacenes() : Promise.resolve([])
      ]);
      setProductos(Array.isArray(p) ? p : []);
      setInsumos(Array.isArray(i) ? i : []);
      setProveedores(Array.isArray(prov) ? prov : []);
      setAlmacenes(Array.isArray(alm) ? alm : []);
    } catch (error) {
      if (!options?.silent) {
        toast('ERROR', error?.message || 'No se pudo cargar catalogo de ordenes de compra.', 'danger');
      }
    } finally {
      if (!options?.silent) setLoadingCatalog(false);
    }
  }, [canConvertir, canCrear, toast]);

  useEffect(() => {
    if (permisosLoading) return;
    void loadCatalogs();
  }, [loadCatalogs, permisosLoading]);

  useEffect(() => {
    if (permisosLoading || !(canCrear || canConvertir)) return undefined;

    // AM: refresco automatico de catalogo para reflejar cambios de stock sin recarga manual.
    const intervalId = window.setInterval(() => {
      if (document?.visibilityState === 'hidden') return;
      void loadCatalogs({ silent: true });
    }, POLLING_MS);

    return () => window.clearInterval(intervalId);
  }, [canConvertir, canCrear, loadCatalogs, permisosLoading]);

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
          cantidad: String(row.cantidad_orden || 0),
          eliminar: false
        }))
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

    if (actualizar.length === 0 && eliminar.length === 0) {
      setEditDetallesModal((prev) => ({ ...prev, error: 'No hay cambios para guardar.' }));
      return;
    }

    setEditDetallesModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      await inventarioService.actualizarDetalleOrdenCompraWorkflow(idOrden, { actualizar, eliminar });
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
      const detalles = Array.isArray(response?.data?.detalles) ? response.data.detalles : [];
      if (detalles.length === 0) {
        toast('VALIDACION', 'La orden no tiene detalle para convertir.', 'warning');
        return;
      }
      // AM: modal de conversion con validacion monetaria por linea.
      setConvertPanel({
        open: true,
        loading: false,
        error: '',
        orden,
        id_proveedor: '',
        fecha_compra: '',
        isv_porcentaje: '0',
        descuento_tipo: DISCOUNT_MODE_MONTO,
        descuento_valor: '0',
        referencia_transferencia: '',
        transferencia_file: null,
        transferencia_preview_url: '',
        transferencia_error: '',
        detalles: detalles.map((row) => ({
          id_detalle_orden: Number(row.id_detalle_orden),
          item_nombre: `${row.item_nombre || row.item_tipo || `Detalle #${row.id_detalle_orden}`}${
            row.almacen_destino_nombre ? ` - ${row.almacen_destino_nombre}` : ''
          }`,
          cantidad: Number(row.cantidad_orden || 0),
          precio_unitario: String(Number(row.precio_referencia || 0))
        }))
      });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo abrir conversion.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  const getConvertRowError = (row) => {
    const idDetalle = parsePositiveInt(row?.id_detalle_orden);
    const cantidad = parsePositiveInt(row?.cantidad);
    const precio = parseNonNegativeNumber(row?.precio_unitario);
    if (!idDetalle || !cantidad) return 'Detalle invalido.';
    if (precio === null) return 'Precio unitario invalido.';
    return '';
  };

  const doConvert = async () => {
    const idOrden = parsePositiveInt(convertPanel?.orden?.id_orden_compra);
    const idProveedor = parsePositiveInt(convertPanel.id_proveedor);
    const isv = parseNonNegativeNumber(convertPanel.isv_porcentaje);
    const descuentoValor = parseNonNegativeNumber(convertPanel.descuento_valor);
    const descuentoTipo = String(convertPanel.descuento_tipo || DISCOUNT_MODE_MONTO).toUpperCase();
    if (!idOrden || !idProveedor) {
      setConvertPanel((prev) => ({ ...prev, error: 'Proveedor y orden son obligatorios.' }));
      return;
    }
    if (isv === null || isv > 100) {
      setConvertPanel((prev) => ({ ...prev, error: 'ISV (%) debe estar entre 0 y 100.' }));
      return;
    }
    if (![DISCOUNT_MODE_MONTO, DISCOUNT_MODE_PORCENTAJE].includes(descuentoTipo)) {
      setConvertPanel((prev) => ({ ...prev, error: 'Tipo de descuento invalido.' }));
      return;
    }
    if (descuentoValor === null) {
      setConvertPanel((prev) => ({ ...prev, error: 'Descuento global invalido.' }));
      return;
    }
    if (descuentoTipo === DISCOUNT_MODE_PORCENTAJE && descuentoValor > 100) {
      setConvertPanel((prev) => ({ ...prev, error: 'Si el descuento es porcentaje, debe estar entre 0 y 100.' }));
      return;
    }
    if (!convertPanel.transferencia_file) {
      setConvertPanel((prev) => ({ ...prev, transferencia_error: 'Adjunta el comprobante de transferencia.' }));
      return;
    }

    const detalles = [];
    for (const row of convertPanel.detalles) {
      const rowError = getConvertRowError(row);
      if (rowError) {
        setConvertPanel((prev) => ({ ...prev, error: `${row.item_nombre}: ${rowError}` }));
        return;
      }
      detalles.push({
        id_detalle_orden: parsePositiveInt(row.id_detalle_orden),
        precio_unitario: parseNonNegativeNumber(row.precio_unitario),
        descuento: 0
      });
    }

    setConvertPanel((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      const transferUpload = await uploadInventarioImage(convertPanel.transferencia_file);
      await inventarioService.convertirOrdenCompraWorkflow(idOrden, {
        id_proveedor: idProveedor,
        fecha_compra: convertPanel.fecha_compra || undefined,
        isv_porcentaje: isv,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoValor,
        referencia_transferencia: normalizeText(convertPanel.referencia_transferencia, 250),
        id_archivo_transferencia: transferUpload.id_archivo,
        detalles
      });
      toast('COMPRA REGISTRADA', `Orden #${idOrden} convertida a compra.`, 'success');
      closeConvertPanel();
      await loadOrdenes();
    } catch (error) {
      setConvertPanel((prev) => ({
        ...prev,
        loading: false,
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

  const aprobarYAbrirConversion = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setBusy(idOrden, true);
    try {
      await inventarioService.aprobarOrdenCompraWorkflow(idOrden, {
        comentario: 'Aprobada y enviada a compra desde flujo rapido.'
      });
      toast('ORDEN APROBADA', `Orden #${idOrden} aprobada. Completa la conversion.`, 'success');
      await loadOrdenes({ silent: true });
      await openConvert({ ...orden, estado_flujo: 'APROBADA' });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo aprobar la orden para conversion rapida.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
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
    setRecepcionModal({
      open: true,
      orden,
      observacion: '',
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
    if (!recepcionModal.factura_file) {
      setRecepcionModal((prev) => ({ ...prev, factura_error: 'Adjunta la factura de recepcion.' }));
      return;
    }

    setRecepcionModal((prev) => ({ ...prev, loading: true, error: '', factura_error: '' }));
    setBusy(idOrden, true);
    try {
      const facturaUpload = await uploadInventarioImage(recepcionModal.factura_file);
      await inventarioService.reportarRecepcionOrdenCompraWorkflow(idOrden, {
        id_archivo_factura_recepcion: facturaUpload.id_archivo,
        observacion_recepcion: normalizeText(recepcionModal.observacion, 1000)
      });
      toast('RECEPCION REPORTADA', `Factura de recepcion enviada para orden #${idOrden}.`, 'success');
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
            <button
              className={`${actionClass} is-neutral`}
              onClick={() => openEditDetallesModal(row)}
              disabled={busy}
            >
              <i className="bi bi-pencil-square" aria-hidden="true" />
              <span>Editar lineas</span>
            </button>
            <button
              className={`${actionClass} is-primary`}
              onClick={() => openReviewModal(row, 'aprobar')}
              disabled={busy}
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
            {canConvertir && (
              <button
                className={`${actionClass} is-primary`}
                onClick={() => aprobarYAbrirConversion(row)}
                disabled={busy}
              >
                <i className="bi bi-lightning-charge" aria-hidden="true" />
                <span>Aprobar y comprar</span>
              </button>
            )}
          </>
        )}
        {estado === 'APROBADA' && canConvertir && (
          <button className={`${actionClass} is-primary`} onClick={() => openConvert(row)} disabled={busy}>
            <i className="bi bi-receipt-cutoff" aria-hidden="true" />
            <span>Convertir</span>
          </button>
        )}
        {estado === 'EN_COMPRA' && canRecepcionar && !parsePositiveInt(row?.id_archivo_factura_recepcion) && (
          <button className={`${actionClass} is-neutral`} onClick={() => openRecepcionModal(row)} disabled={busy}>
            <i className="bi bi-receipt" aria-hidden="true" />
            <span>Subir factura</span>
          </button>
        )}
        {estado === 'EN_COMPRA' && canAbastecer && (
          <button
            className={`${actionClass} is-success`}
            onClick={() => openSupplyModal(row)}
            disabled={busy || !parsePositiveInt(row?.id_archivo_factura_recepcion)}
          >
            <i className="bi bi-box-arrow-in-down" aria-hidden="true" />
            <span>{parsePositiveInt(row?.id_archivo_factura_recepcion) ? 'Abastecer' : 'Esperando factura'}</span>
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
                      <span className="inv-oc-warehouse-base__title">Sucursal destino de la orden</span>
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
                              Sucursal:{' '}
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
                ) : ordenes.length === 0 ? (
                  <div className="inv-oc-empty-state">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <span>Sin ordenes para este filtro.</span>
                  </div>
                ) : (
                  <div className="inv-oc-flow-grid">
                    {ordenes.map((row) => {
                      const estado = resolveEstado(row);
                      const toneClass = estadoToneClass(estado);
                      const usuario = row.solicitante_nombre_usuario || `Usuario #${row.id_usuario}`;
                      const rol = row.solicitante_roles || 'Rol no disponible';
                      return (
                        <article key={row.id_orden_compra} className={`inv-oc-flow-card ${toneClass}`}>
                          <div className="inv-oc-flow-card__head">
                            <div className="inv-oc-flow-card__identity">
                              <span className="inv-oc-flow-card__order">
                                <i className="bi bi-journal-check" aria-hidden="true" />
                                Orden #{row.id_orden_compra}
                              </span>
                              <strong>{usuario}</strong>
                              <small>{rol}</small>
                            </div>
                            <span className={`badge ${badgeClass(estado)}`}>
                              <i className={`${estadoIconClass(estado)} me-1`} aria-hidden="true" />
                              {estado}
                            </span>
                          </div>
                          <div className="inv-oc-flow-card__date">
                            <i className="bi bi-clock-history" aria-hidden="true" />
                            <span>{formatDate(row.fecha)}</span>
                          </div>
                          <div className="inv-oc-flow-card__meta">
                            <span>
                              <i className="bi bi-box2 me-1" aria-hidden="true" />
                              Items: {row.total_items || 0}
                            </span>
                            <span>
                              <i className="bi bi-123 me-1" aria-hidden="true" />
                              Cantidad: {row.total_cantidad || 0}
                            </span>
                            <span>
                              <i className="bi bi-receipt-cutoff me-1" aria-hidden="true" />
                              Recepcion:{' '}
                              {resolveEstado(row) === 'EN_COMPRA'
                                ? parsePositiveInt(row?.id_archivo_factura_recepcion)
                                  ? 'Factura cargada'
                                  : 'Pendiente'
                                : '-'}
                            </span>
                          </div>
                          {hasValue(row?.observacion_solicitud) && (
                            <p className="inv-oc-flow-card__note">
                              <i className="bi bi-chat-left-text me-1" aria-hidden="true" />
                              {row.observacion_solicitud}
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

                          <label className="form-label mb-1 mt-2">Sucursal destino (1)</label>
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
                      const compra = detalleActual.data?.compra_actual || {};
                      const detalles = Array.isArray(detalleActual.data?.detalles) ? detalleActual.data.detalles : [];
                      const solicitudes = Array.isArray(detalleActual.data?.solicitudes_item)
                        ? detalleActual.data.solicitudes_item
                        : [];
                      const estadoOrden = resolveEstado(orden);
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
                                  <i className="bi bi-clock me-1" aria-hidden="true" />
                                  {formatDate(orden.fecha)}
                                </span>
                              </p>
                            </div>
                            <span className={`badge ${badgeClass(estadoOrden)} inv-oc-detail-state-badge`}>
                              <i className={`${estadoIconClass(estadoOrden)} me-1`} aria-hidden="true" />
                              {estadoOrden}
                            </span>
                          </section>

                          <section className="inv-oc-detail-summary-grid">
                            <article>
                              <span>Compra vinculada</span>
                              <strong>{compra?.id_compra ? `#${compra.id_compra}` : 'Sin compra'}</strong>
                            </article>
                            <article>
                              <span>Comprobante transferencia</span>
                              {compra?.transferencia_url_publica ? (
                                <a
                                  href={resolveInventarioImageUrl(compra.transferencia_url_publica)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="small"
                                >
                                  Ver evidencia
                                </a>
                              ) : (
                                <strong>-</strong>
                              )}
                            </article>
                            <article>
                              <span>Factura recepcion</span>
                              {orden?.factura_recepcion_url_publica ? (
                                <a
                                  href={resolveInventarioImageUrl(orden.factura_recepcion_url_publica)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="small"
                                >
                                  Ver evidencia
                                </a>
                              ) : (
                                <strong>Pendiente</strong>
                              )}
                            </article>
                          </section>

                          {hasValue(orden?.observacion_solicitud) && (
                            <section className="inv-oc-detail-note-card">
                              <span>Observacion de solicitud</span>
                              <p>{orden.observacion_solicitud}</p>
                            </section>
                          )}

                          <section className="inv-oc-detail-section">
                            <h6 className="mb-2">Items de la orden</h6>
                            {detalles.length === 0 ? (
                              <div className="inv-oc-empty-state">
                                <i className="bi bi-card-list" aria-hidden="true" />
                                <span>Sin detalles registrados.</span>
                              </div>
                            ) : (
                              <div className="inv-oc-detail-items-grid">
                                {detalles.map((row) => (
                                  <article key={row.id_detalle_orden} className="inv-oc-detail-item-card">
                                    <div className="inv-oc-detail-item-card__head">
                                      <div>
                                        <strong>{row.item_nombre || '-'}</strong>
                                        <small className="text-capitalize">
                                          {row.item_tipo || '-'} - Detalle #{row.id_detalle_orden}
                                        </small>
                                      </div>
                                      <span className="badge text-bg-light">OC: {row.cantidad_orden || 0}</span>
                                    </div>
                                    <div className="inv-oc-detail-item-card__meta">
                                      <span>
                                        <i className="bi bi-building me-1" aria-hidden="true" />
                                        Destino:{' '}
                                        {row.almacen_destino_nombre ||
                                          formatAlmacenDisplay(
                                            almacenesMap.get(parsePositiveInt(row.id_almacen_destino))
                                          )}
                                      </span>
                                      <span>
                                        <i className="bi bi-bag-check me-1" aria-hidden="true" />
                                        Compra: {row.cantidad_compra || '-'}
                                      </span>
                                      <span>
                                        <i className="bi bi-cash-coin me-1" aria-hidden="true" />
                                        Total:{' '}
                                        {hasValue(row.total_detalle_compra)
                                          ? formatMoney(row.total_detalle_compra)
                                          : '-'}
                                      </span>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </section>

                          <section className="inv-oc-detail-section">
                            <h6 className="mb-2">Solicitudes de item no registrado</h6>
                            {solicitudes.length === 0 ? (
                              <div className="inv-oc-empty-state">
                                <i className="bi bi-lightbulb" aria-hidden="true" />
                                <span>Sin solicitudes de item nuevo.</span>
                              </div>
                            ) : (
                              <div className="inv-oc-detail-request-grid">
                                {solicitudes.map((row) => (
                                  <article key={row.id_solicitud_item} className="inv-oc-detail-request-card">
                                    <div className="d-flex justify-content-between gap-2">
                                      <strong>{row.nombre_sugerido || '-'}</strong>
                                      <span className="badge text-bg-light">#{row.id_solicitud_item}</span>
                                    </div>
                                    <div className="inv-oc-detail-request-card__meta">
                                      <span className="text-capitalize">{row.tipo_item || '-'}</span>
                                      <span>Cantidad: {row.cantidad_sugerida || 0}</span>
                                      <span className="text-capitalize">Estado: {row.estado || '-'}</span>
                                    </div>
                                  </article>
                                ))}
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
                  Reportar recepcion de orden #{recepcionModal.orden?.id_orden_compra}
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
                <label className="form-label mb-1">Factura de recepcion (obligatoria)</label>
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
                  {recepcionModal.loading ? 'Enviando...' : 'Enviar factura'}
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
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-receipt-cutoff" aria-hidden="true" />
                  Convertir orden #{convertPanel.orden?.id_orden_compra || '-'}
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
                  <div className="col-12 col-md-5">
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
                  <div className="col-12 col-md-3">
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
                  <div className="col-12 col-md-2">
                    <label className="form-label mb-1">ISV (%)</label>
                    <input
                      className={`form-control ${
                        parseNonNegativeNumber(convertPanel.isv_porcentaje) !== null &&
                        parseNonNegativeNumber(convertPanel.isv_porcentaje) <= 100
                          ? ''
                          : 'is-invalid'
                      }`}
                      value={convertPanel.isv_porcentaje}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          isv_porcentaje: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label mb-1">Tipo desc.</label>
                    <select
                      className="form-select"
                      value={convertPanel.descuento_tipo}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          descuento_tipo: e.target.value,
                          error: ''
                        }))
                      }
                    >
                      <option value={DISCOUNT_MODE_MONTO}>Monto</option>
                      <option value={DISCOUNT_MODE_PORCENTAJE}>Porcentaje</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label mb-1">
                      Descuento {convertPanel.descuento_tipo === DISCOUNT_MODE_PORCENTAJE ? '(%)' : '(L.)'}
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
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Referencia transferencia</label>
                    <input
                      className="form-control"
                      value={convertPanel.referencia_transferencia}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          referencia_transferencia: e.target.value,
                          error: ''
                        }))
                      }
                      placeholder="No. transferencia, banco u observacion corta..."
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Comprobante de transferencia (obligatorio)</label>
                    <input
                      className={`form-control ${convertPanel.transferencia_error ? 'is-invalid' : ''}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
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
                          transferencia_preview_url: URL.createObjectURL(file),
                          transferencia_error: ''
                        }));
                      }}
                    />
                    {convertPanel.transferencia_error && (
                      <div className="invalid-feedback d-block">{convertPanel.transferencia_error}</div>
                    )}
                  </div>
                </div>

                <div className="table-responsive mb-3">
                  <table className="table table-sm table-striped align-middle">
                    <thead>
                      <tr>
                        <th>Detalle</th>
                        <th>Item</th>
                        <th>Cantidad</th>
                        <th>Precio unit.</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {convertPanel.detalles.map((row) => {
                        const rowError = getConvertRowError(row);
                        const cantidad = parsePositiveInt(row.cantidad) || 0;
                        const precio = parseNonNegativeNumber(row.precio_unitario) || 0;
                        const subtotal = cantidad * precio;
                        return (
                          <tr key={row.id_detalle_orden}>
                            <td>#{row.id_detalle_orden}</td>
                            <td>
                              {row.item_nombre}
                              {rowError && <div className="text-danger small mt-1">{rowError}</div>}
                            </td>
                            <td>{row.cantidad}</td>
                            <td>
                              <input
                                className={`form-control form-control-sm ${
                                  parseNonNegativeNumber(row.precio_unitario) === null ? 'is-invalid' : ''
                                }`}
                                value={row.precio_unitario}
                                onChange={(e) =>
                                  setConvertPanel((prev) => ({
                                    ...prev,
                                    error: '',
                                    detalles: prev.detalles.map((item) =>
                                      item.id_detalle_orden === row.id_detalle_orden
                                        ? { ...item, precio_unitario: sanitizeDecimal(e.target.value) }
                                        : item
                                    )
                                  }))
                                }
                              />
                            </td>
                            <td className={subtotal < 0 ? 'text-danger' : ''}>{formatMoney(subtotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="inv-oc-convert-summary">
                  <article>
                    <span>Subtotal bruto</span>
                    <strong>{formatMoney(convertSummary.subtotalBruto)}</strong>
                  </article>
                  <article>
                    <span>Descuento</span>
                    <strong>{formatMoney(convertSummary.descuentoAplicado)}</strong>
                  </article>
                  <article>
                    <span>Subtotal neto</span>
                    <strong>{formatMoney(convertSummary.subtotal)}</strong>
                  </article>
                  <article>
                    <span>ISV</span>
                    <strong>{formatMoney(convertSummary.isvValue)}</strong>
                  </article>
                  <article>
                    <span>Total estimado</span>
                    <strong>{formatMoney(convertSummary.total)}</strong>
                  </article>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeConvertPanel}
                  disabled={convertPanel.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={doConvert} disabled={convertPanel.loading}>
                  {convertPanel.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Convirtiendo...
                    </>
                  ) : (
                    'Convertir a compra'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenesCompraTab;





