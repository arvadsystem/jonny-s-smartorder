import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { usePermisos } from '../../context/PermisosContext';
import {
  MODULE_PRIMARY_PERMISSION,
  getAllowedTabs
} from '../../utils/permissions';
import { reportesService } from '../../services/reportesService';
import sucursalesService from '../../services/sucursalesService';
import cajasService from '../../services/cajasService';
import { inventarioService } from '../../services/inventarioService';
import ventasService from '../../services/ventasService';
import { personaService } from '../../services/personasService';

const REPORT_KEYS = [
  'ventas-resumen',
  'ventas-metodos-pago',
  'caja-cierres',
  'caja-diferencias',
  'inventario-stock-critico',
  'inventario-kardex',
  'ventas-descuentos',
  'ventas-items'
];

const REPORT_HANDLERS = {
  'ventas-resumen': reportesService.getVentasResumen,
  'ventas-metodos-pago': reportesService.getVentasMetodosPago,
  'caja-cierres': reportesService.getCajaCierres,
  'caja-diferencias': reportesService.getCajaDiferencias,
  'inventario-stock-critico': reportesService.getInventarioStockCritico,
  'inventario-kardex': reportesService.getInventarioKardex,
  'ventas-descuentos': reportesService.getVentasDescuentos,
  'ventas-items': reportesService.getVentasItems
};

const EXPORT_REPORT_KEYS = Object.freeze({
  'ventas-resumen': 'ventas_resumen',
  'ventas-metodos-pago': 'ventas_metodos_pago',
  'caja-cierres': 'caja_cierres',
  'caja-diferencias': 'caja_diferencias',
  'inventario-stock-critico': 'inventario_stock_critico',
  'inventario-kardex': 'inventario_kardex',
  'ventas-descuentos': 'ventas_descuentos',
  'ventas-items': 'ventas_items'
});

const REPORT_META = Object.freeze({
  'ventas-resumen': {
    key: 'ventas-resumen',
    category: 'ventas',
    label: 'Resumen de ventas',
    subtitle: 'Consolidado diario de desempeño comercial.',
    icon: 'bi bi-graph-up-arrow'
  },
  'ventas-metodos-pago': {
    key: 'ventas-metodos-pago',
    category: 'ventas',
    label: 'Métodos de pago',
    subtitle: 'Distribución y ticket por método de cobro.',
    icon: 'bi bi-credit-card-2-front'
  },
  'ventas-descuentos': {
    key: 'ventas-descuentos',
    category: 'ventas',
    label: 'Descuentos aplicados',
    subtitle: 'Seguimiento de descuentos por línea y venta.',
    icon: 'bi bi-tags'
  },
  'ventas-items': {
    key: 'ventas-items',
    category: 'ventas',
    label: 'Ventas por ítem',
    subtitle: 'Resumen por producto, receta y combo.',
    icon: 'bi bi-list-check'
  },
  'caja-cierres': {
    key: 'caja-cierres',
    category: 'caja',
    label: 'Cierres de caja',
    subtitle: 'Control de esperado, contado y diferencias.',
    icon: 'bi bi-safe2'
  },
  'caja-diferencias': {
    key: 'caja-diferencias',
    category: 'caja',
    label: 'Diferencias de caja',
    subtitle: 'Análisis de faltantes y sobrantes por cierre.',
    icon: 'bi bi-exclamation-diamond'
  },
  'inventario-stock-critico': {
    key: 'inventario-stock-critico',
    category: 'inventario',
    label: 'Stock crítico',
    subtitle: 'Alertas de agotado y bajo stock por inventario.',
    icon: 'bi bi-exclamation-triangle'
  },
  'inventario-kardex': {
    key: 'inventario-kardex',
    category: 'inventario',
    label: 'Kardex',
    subtitle: 'Movimientos y saldos por ítem y almacén.',
    icon: 'bi bi-journal-text'
  }
});

const REPORT_GROUPS = Object.freeze([
  {
    key: 'ventas',
    label: 'Ventas',
    icon: 'bi bi-graph-up-arrow',
    tabs: ['ventas-resumen', 'ventas-metodos-pago', 'ventas-descuentos', 'ventas-items']
  },
  {
    key: 'caja',
    label: 'Caja',
    icon: 'bi bi-cash-stack',
    tabs: ['caja-cierres', 'caja-diferencias']
  },
  {
    key: 'inventario',
    label: 'Inventario',
    icon: 'bi bi-box-seam',
    tabs: ['inventario-stock-critico', 'inventario-kardex']
  }
]);

const REPORT_CATEGORY_LABELS = Object.freeze(
  REPORT_GROUPS.reduce((acc, group) => {
    acc[group.key] = group.label;
    return acc;
  }, {})
);

const INITIAL_FILTERS = {
  fecha_inicio: '',
  fecha_fin: '',
  sucursal: '',
  almacen: '',
  caja: '',
  usuario: '',
  metodo_pago: '',
  tipo_diferencia: '',
  tipo_descuento: '',
  tipo_item: '',
  solo_criticos: '',
  categoria: '',
  estado: '',
  tipo_movimiento: '',
  item: '',
  producto: ''
};

const FILTER_LABELS = Object.freeze({
  fecha_inicio: 'Fecha inicio',
  fecha_fin: 'Fecha fin',
  sucursal: 'Sucursal',
  almacen: 'Almacén',
  caja: 'Caja',
  usuario: 'Usuario',
  metodo_pago: 'Metodo pago',
  tipo_diferencia: 'Tipo diferencia',
  tipo_descuento: 'Tipo descuento',
  tipo_item: 'Tipo ítem',
  solo_criticos: 'Solo críticos',
  categoria: 'Categoría',
  estado: 'Estado',
  tipo_movimiento: 'Tipo movimiento',
  item: 'Item',
  producto: 'Producto'
});

const TIPO_DIFERENCIA_OPTIONS = Object.freeze([
  { value: '', label: 'Todas' },
  { value: 'faltante', label: 'Faltante' },
  { value: 'sobrante', label: 'Sobrante' }
]);

const TIPO_MOVIMIENTO_OPTIONS = Object.freeze([
  { value: '', label: 'Todos' },
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SALIDA', label: 'Salida' },
  { value: 'AJUSTE', label: 'Ajuste' }
]);

const TIPO_ITEM_OPTIONS = Object.freeze([
  { value: '', label: 'Todos' },
  { value: 'producto', label: 'Producto' },
  { value: 'insumo', label: 'Insumo' },
  { value: 'combo', label: 'Combo' },
  { value: 'receta', label: 'Receta' },
  { value: 'todos', label: 'Todos' }
]);

const SOLO_CRITICOS_OPTIONS = Object.freeze([
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Si' },
  { value: 'false', label: 'No' }
]);

const STOCK_ESTADO_OPTIONS = Object.freeze([
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' }
]);

const REPORT_FILTERS_BY_TAB = Object.freeze({
  'ventas-resumen': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado'],
  'ventas-metodos-pago': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado', 'metodo_pago'],
  'ventas-descuentos': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado', 'tipo_descuento'],
  'ventas-items': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado', 'tipo_item', 'categoria', 'item'],
  'caja-cierres': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado'],
  'caja-diferencias': ['fecha_inicio', 'fecha_fin', 'sucursal', 'caja', 'usuario', 'estado', 'tipo_diferencia'],
  'inventario-stock-critico': ['sucursal', 'almacen', 'categoria', 'tipo_item', 'estado', 'solo_criticos'],
  'inventario-kardex': ['fecha_inicio', 'fecha_fin', 'sucursal', 'almacen', 'tipo_movimiento', 'tipo_item', 'categoria', 'item']
});

const REPORT_SPECIFIC_FILTER_KEYS = Object.freeze(['metodo_pago', 'tipo_descuento', 'tipo_diferencia', 'tipo_item', 'categoria', 'item', 'tipo_movimiento', 'solo_criticos']);

const getAllowedFilterKeysByTab = (tabKey) => REPORT_FILTERS_BY_TAB[tabKey] || ['fecha_inicio', 'fecha_fin', 'sucursal'];

const sanitizeFiltersForTab = (tabKey, source = INITIAL_FILTERS) => {
  const allowedKeys = new Set(getAllowedFilterKeysByTab(tabKey));
  const sanitized = Object.keys(INITIAL_FILTERS).reduce((acc, key) => {
    if (!allowedKeys.has(key)) {
      acc[key] = '';
      return acc;
    }
    const value = source?.[key];
    acc[key] = value === undefined || value === null ? '' : String(value).trim();
    return acc;
  }, {});
  if (tabKey === 'inventario-stock-critico' && !sanitized.solo_criticos) {
    sanitized.solo_criticos = 'true'; // AM: default operativo para ver solo sin stock/critico/bajo.
  }
  return sanitized;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const REPORTS_PAGE_SIZE = 10;

const money = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const compactText = (value, max = 44) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  return raw.length > max ? `${raw.slice(0, Math.max(0, max - 1))}…` : raw;
};

const pushRow = (target, row) => {
  if (!row || typeof row !== 'object') return;
  target.push(row);
};

const normalizeApiRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const makeCatalogOptions = (
  rows,
  {
    idKeys = [],
    labelKeys = [],
    allLabel = 'Todos',
    allowLabelAsValue = true
  }
) => {
  const options = [{ value: '', label: allLabel }];
  const seen = new Set();

  rows.forEach((row) => {
    let resolvedValue = '';
    let resolvedLabel = '';

    for (const idKey of idKeys) {
      const raw = row?.[idKey];
      if (raw !== undefined && raw !== null && String(raw).trim()) {
        resolvedValue = String(raw).trim();
        break;
      }
    }

    for (const labelKey of labelKeys) {
      const raw = row?.[labelKey];
      if (raw !== undefined && raw !== null && String(raw).trim()) {
        resolvedLabel = String(raw).trim();
        break;
      }
    }

    if (!resolvedValue && resolvedLabel && allowLabelAsValue) {
      resolvedValue = resolvedLabel;
    }

    if (!resolvedValue || seen.has(resolvedValue)) return;

    options.push({
      value: resolvedValue,
      label: resolvedLabel || resolvedValue
    });
    seen.add(resolvedValue);
  });

  return options;
};

const extractRowsFromReportPayload = (responsePayload) => {
  const data = responsePayload?.data;
  if (!data || typeof data !== 'object') return [];

  const rows = [];
  Object.values(data).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => pushRow(rows, item));
  });
  return rows;
};

const getToastIconClass = (variant) => {
  if (variant === 'danger') return 'bi bi-x-octagon-fill';
  if (variant === 'warning') return 'bi bi-exclamation-triangle-fill';
  if (variant === 'info') return 'bi bi-info-circle-fill';
  return 'bi bi-check2-circle';
};

const formatFilterDisplayValue = (key, value) => {
  if (key === 'solo_criticos') {
    if (value === 'true') return 'Sí';
    if (value === 'false') return 'No';
  }
  return String(value);
};

const getKpiCards = (tab, kpis) => {
  if (!kpis) return [];

  if (tab === 'ventas-resumen') {
    return [
      { label: 'Cantidad total de ventas', value: kpis.cantidad_ventas || 0, icon: 'bi bi-receipt', tone: 'is-neutral' },
      { label: 'Subtotal general', value: `L ${money(kpis.subtotal_general ?? kpis.subtotal)}`, icon: 'bi bi-cash-stack', tone: 'is-soft' },
      { label: 'Descuento general', value: `L ${money(kpis.descuento_general ?? kpis.descuentos)}`, icon: 'bi bi-tags', tone: 'is-alert' },
      { label: 'Impuesto general', value: `L ${money(kpis.impuesto_general ?? kpis.impuestos)}`, icon: 'bi bi-percent', tone: 'is-neutral' },
      { label: 'Total neto general', value: `L ${money(kpis.total_neto_general ?? kpis.total_neto)}`, icon: 'bi bi-bar-chart-line', tone: 'is-ok' },
      { label: 'Ticket promedio general', value: `L ${money(kpis.ticket_promedio_general ?? kpis.promedio_por_venta)}`, icon: 'bi bi-graph-up', tone: 'is-neutral' },
      { label: 'Canceladas/Anuladas', value: kpis.ventas_canceladas_o_anuladas || 0, icon: 'bi bi-slash-circle', tone: 'is-alert' }
    ];
  }

  if (tab === 'ventas-metodos-pago') {
    return [
      { label: 'Total general', value: `L ${money(kpis.total_general)}`, icon: 'bi bi-cash-stack', tone: 'is-ok' },
      { label: 'Total ventas', value: kpis.total_ventas || 0, icon: 'bi bi-receipt-cutoff', tone: 'is-neutral' },
      { label: 'Ticket promedio general', value: `L ${money(kpis.ticket_promedio_general)}`, icon: 'bi bi-graph-up-arrow', tone: 'is-soft' },
      { label: 'Métodos activos', value: kpis.metodos_activos || 0, icon: 'bi bi-credit-card-2-front', tone: 'is-soft' }
    ];
  }

  if (tab === 'caja-cierres') {
    return [
      { label: 'Cierres', value: kpis.cantidad_cierres || 0, icon: 'bi bi-safe2', tone: 'is-neutral' },
      { label: 'Total esperado', value: `L ${money(kpis.total_esperado)}`, icon: 'bi bi-clipboard2-data', tone: 'is-soft' },
      { label: 'Total contado', value: `L ${money(kpis.total_contado)}`, icon: 'bi bi-cash', tone: 'is-ok' },
      { label: 'Diferencia total', value: `L ${money(kpis.diferencia_total)}`, icon: 'bi bi-calculator', tone: 'is-alert' },
      { label: 'Con diferencia', value: kpis.cierres_con_diferencia || 0, icon: 'bi bi-exclamation-diamond', tone: 'is-alert' },
      { label: 'Sin diferencia', value: kpis.cierres_sin_diferencia || 0, icon: 'bi bi-check2-circle', tone: 'is-ok' }
    ];
  }

  if (tab === 'caja-diferencias') {
    return [
      { label: 'Cantidad de diferencias', value: kpis.cantidad_diferencias || 0, icon: 'bi bi-exclamation-diamond', tone: 'is-alert' },
      { label: 'Total faltantes', value: `L ${money(kpis.total_faltantes)}`, icon: 'bi bi-arrow-down-circle', tone: 'is-alert' },
      { label: 'Total sobrantes', value: `L ${money(kpis.total_sobrantes)}`, icon: 'bi bi-arrow-up-circle', tone: 'is-ok' },
      { label: 'Diferencia neta', value: `L ${money(kpis.diferencia_neta)}`, icon: 'bi bi-calculator', tone: 'is-soft' },
      { label: 'Mayor diferencia registrada', value: `L ${money(kpis.mayor_diferencia_registrada)}`, icon: 'bi bi-graph-up-arrow', tone: 'is-neutral' }
    ];
  }

  if (tab === 'inventario-stock-critico') {
    return [
      { label: 'Total items criticos/bajos', value: kpis.total_items_criticos_bajos ?? kpis.total_criticos ?? 0, icon: 'bi bi-list-check', tone: 'is-neutral' },
      { label: 'Total sin stock', value: kpis.total_sin_stock ?? kpis.total_agotados ?? 0, icon: 'bi bi-x-octagon', tone: 'is-alert' },
      { label: 'Total bajo minimo', value: kpis.total_bajo_minimo ?? kpis.total_stock_bajo ?? 0, icon: 'bi bi-thermometer-half', tone: 'is-soft' },
      { label: 'Productos afectados', value: kpis.productos_afectados ?? kpis.productos_criticos ?? 0, icon: 'bi bi-box-seam', tone: 'is-ok' },
      { label: 'Insumos afectados', value: kpis.insumos_afectados ?? kpis.insumos_criticos ?? 0, icon: 'bi bi-box2-heart', tone: 'is-neutral' },
      { label: 'Almacenes afectados', value: kpis.almacenes_afectados ?? 0, icon: 'bi bi-building', tone: 'is-alert' }
    ];
  }

  if (tab === 'inventario-kardex') {
    return [
      { label: 'Total movimientos', value: kpis.total_movimientos || 0, icon: 'bi bi-arrow-left-right', tone: 'is-neutral' },
      { label: 'Total entradas', value: kpis.total_entradas ?? kpis.entradas ?? 0, icon: 'bi bi-arrow-down-right', tone: 'is-ok' },
      { label: 'Total salidas', value: kpis.total_salidas ?? kpis.salidas ?? 0, icon: 'bi bi-arrow-up-right', tone: 'is-alert' },
      { label: 'Total ajustes', value: kpis.total_ajustes ?? kpis.ajustes_otros ?? 0, icon: 'bi bi-sliders', tone: 'is-soft' },
      { label: 'Cantidad neta movida', value: Number(kpis.cantidad_neta_movida ?? 0).toFixed(2), icon: 'bi bi-calculator', tone: 'is-neutral' },
      { label: 'Items afectados', value: kpis.items_afectados ?? kpis.items_unicos ?? 0, icon: 'bi bi-hash', tone: 'is-neutral' },
      { label: 'Almacenes afectados', value: kpis.almacenes_afectados ?? 0, icon: 'bi bi-building', tone: 'is-alert' }
    ];
  }

  if (tab === 'ventas-descuentos') {
    return [
      { label: 'Total descuento', value: `L ${money(kpis.total_descuento)}`, icon: 'bi bi-tags', tone: 'is-soft' },
      { label: 'Ventas con descuento', value: kpis.ventas_con_descuento || 0, icon: 'bi bi-receipt-cutoff', tone: 'is-neutral' },
      { label: 'Líneas con descuento', value: kpis.lineas_con_descuento || 0, icon: 'bi bi-list-ol', tone: 'is-alert' },
      { label: 'Ticket promedio descuento', value: `L ${money(kpis.ticket_promedio_descuento)}`, icon: 'bi bi-graph-up-arrow', tone: 'is-ok' }
    ];
  }

  if (tab === 'ventas-items') {
    return [
      { label: 'Total vendido', value: `L ${money(kpis.total_vendido)}`, icon: 'bi bi-cash-stack', tone: 'is-ok' },
      { label: 'Ventas', value: kpis.ventas || 0, icon: 'bi bi-receipt', tone: 'is-neutral' },
      { label: 'Líneas', value: kpis.lineas || 0, icon: 'bi bi-list-check', tone: 'is-soft' },
      { label: 'Items únicos', value: kpis.cantidad_items || 0, icon: 'bi bi-box-seam', tone: 'is-neutral' },
      { label: 'Ticket promedio', value: `L ${money(kpis.ticket_promedio)}`, icon: 'bi bi-bar-chart', tone: 'is-soft' }
    ];
  }

  return [];
};

const Reportes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const hasPermiso = (permiso) => {
    if (permisos instanceof Set) return permisos.has(permiso);
    if (Array.isArray(permisos)) return permisos.includes(permiso);
    return false;
  };

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [emailForm, setEmailForm] = useState({
    destinatarios: '',
    formato: 'pdf',
    asunto: '',
    mensaje: 'Adjunto reporte solicitado.',
    confirmado: false
  });
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [notice, setNotice] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success'
  });
  const [listPage, setListPage] = useState(1);
  const [catalogRows, setCatalogRows] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [sucursalesCatalog, setSucursalesCatalog] = useState([]);
  const [cajasCatalog, setCajasCatalog] = useState([]);
  const [almacenesCatalog, setAlmacenesCatalog] = useState([]);
  const [usuariosCatalog, setUsuariosCatalog] = useState([]);
  const [metodosPagoCatalog, setMetodosPagoCatalog] = useState([]);
  const [tiposDescuentoCatalog, setTiposDescuentoCatalog] = useState([]);
  const [categoriasProductosCatalog, setCategoriasProductosCatalog] = useState([]);
  const [categoriasInsumosCatalog, setCategoriasInsumosCatalog] = useState([]);
  const [productosCatalog, setProductosCatalog] = useState([]);
  const [insumosCatalog, setInsumosCatalog] = useState([]);
  const [estadosPedidoCatalog, setEstadosPedidoCatalog] = useState([]);
  const [estadosCierreCatalog, setEstadosCierreCatalog] = useState([]);
  const [loadingBaseCatalogs, setLoadingBaseCatalogs] = useState(false);

  const allowedTabs = useMemo(
    () => getAllowedTabs('reportes', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  const canExportExcel = isSuperAdmin || hasPermiso('REPORTES_EXPORTAR_EXCEL');
  const canExportPdf = isSuperAdmin || hasPermiso('REPORTES_EXPORTAR_PDF');
  const canSendEmail = isSuperAdmin || hasPermiso('REPORTES_ENVIAR_CORREO');

  const fallbackTab = allowedTabs[0]?.key || null;
  const rawTab = String(searchParams.get('tab') || fallbackTab || '').toLowerCase();
  const normalizedTab = REPORT_KEYS.includes(rawTab) ? rawTab : fallbackTab;
  const activeTab = allowedTabs.some((tab) => tab.key === normalizedTab) ? normalizedTab : fallbackTab;

  const activeReport = REPORT_META[activeTab] || null;
  const activeCategoryLabel = REPORT_CATEGORY_LABELS[activeReport?.category] || 'General';
  const activeAllowedFilterKeys = useMemo(() => getAllowedFilterKeysByTab(activeTab), [activeTab]);

  useEffect(() => {
    if (!notice.show) return;
    const t = setTimeout(() => {
      setNotice((prev) => ({ ...prev, show: false }));
    }, 3200);
    return () => clearTimeout(t);
  }, [notice.show]);

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, rawTab, permisosLoading, searchParams, setSearchParams]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (showEmailModal && !sendingEmail) {
        setShowEmailModal(false);
        return;
      }
      if (showFiltersDrawer) {
        setShowFiltersDrawer(false);
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showEmailModal, sendingEmail, showFiltersDrawer]);

  const showToast = (title, message, variant = 'success') => {
    setNotice({ show: true, title, message, variant });
  };

  useEffect(() => {
    let ignore = false;

    const loadBaseCatalogs = async () => {
      setLoadingBaseCatalogs(true);
      try {
        const [
          sucursalesResult,
          cajasResult,
          almacenesResult,
          usuariosResult,
          metodosPagoResult,
          tiposDescuentoResult,
          categoriasProductosResult,
          categoriasInsumosResult,
          productosResult,
          insumosResult,
          estadosPedidoResult
        ] = await Promise.allSettled([
          sucursalesService.getAll(),
          cajasService.listCajaCatalogo({ incluir_inactivas: false }),
          inventarioService.getAlmacenes({ include_inactivos: false }),
          personaService.getUsuariosV2({ page: 1, limit: 500, estado: true }),
          cajasService.getCatalogos(),
          ventasService.getTiposDescuentoCatalog(),
          inventarioService.getCategorias({ incluirInactivos: false }),
          inventarioService.getCategoriasInsumos({ incluirInactivos: false }),
          inventarioService.getProductos({ pageSize: 500, estado: 'activo' }),
          inventarioService.getInsumos({ estado: true }),
          ventasService.list({ page: 1, pageSize: 1 }).catch(() => null)
        ]);

        if (!ignore && sucursalesResult.status === 'fulfilled') {
          const rows = normalizeApiRows(sucursalesResult.value)
            .map((row) => ({
              id_sucursal: Number(row?.id_sucursal ?? row?.id ?? 0) || 0,
              nombre_sucursal: String(row?.nombre_sucursal ?? row?.sucursal ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id_sucursal > 0 && row.nombre_sucursal)
            .filter((row) => row.estado !== false)
            .sort((a, b) =>
              a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
            );
          setSucursalesCatalog(rows);
        }

        if (!ignore && cajasResult.status === 'fulfilled') {
          const rows = normalizeApiRows(cajasResult.value)
            .map((row) => ({
              id_caja: Number(row?.id_caja ?? 0) || 0,
              id_sucursal: Number(row?.id_sucursal ?? 0) || 0,
              codigo_caja: String(row?.codigo_caja ?? '').trim(),
              nombre_caja: String(row?.nombre_caja ?? row?.caja ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id_caja > 0 && row.nombre_caja)
            .filter((row) => row.estado !== false)
            .sort((a, b) =>
              `${a.codigo_caja} ${a.nombre_caja}`.localeCompare(
                `${b.codigo_caja} ${b.nombre_caja}`,
                'es',
                { sensitivity: 'base' }
              )
            );
          setCajasCatalog(rows);
        }

        if (!ignore && almacenesResult.status === 'fulfilled') {
          const rows = normalizeApiRows(almacenesResult.value)
            .map((row) => ({
              id_almacen: Number(row?.id_almacen ?? 0) || 0,
              id_sucursal: Number(row?.id_sucursal ?? 0) || 0,
              nombre_almacen: String(row?.nombre_almacen ?? row?.nombre ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id_almacen > 0 && row.nombre_almacen)
            .filter((row) => row.estado !== false);
          setAlmacenesCatalog(rows);
        }

        if (!ignore && usuariosResult.status === 'fulfilled') {
          const rows = normalizeApiRows(usuariosResult.value?.items ?? usuariosResult.value)
            .map((row) => ({
              id_usuario: Number(row?.id_usuario ?? 0) || 0,
              nombre_usuario: String(row?.nombre_completo ?? row?.nombre_usuario ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id_usuario > 0 && row.nombre_usuario)
            .filter((row) => row.estado !== false);
          setUsuariosCatalog(rows);
        }

        if (!ignore && metodosPagoResult.status === 'fulfilled') {
          const rows = normalizeApiRows(metodosPagoResult.value?.metodos_pago ?? metodosPagoResult.value)
            .map((row) => ({
              value: String(row?.codigo ?? row?.nombre ?? '').trim(),
              label: String(row?.nombre ?? row?.codigo ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.value && row.label)
            .filter((row) => row.estado !== false);
          setMetodosPagoCatalog(rows);

          const cierreRows = normalizeApiRows(metodosPagoResult.value?.resoluciones_cierre ?? [])
            .map((row) => String(row?.nombre ?? '').trim())
            .filter(Boolean);
          setEstadosCierreCatalog(cierreRows);
        }

        if (!ignore && tiposDescuentoResult.status === 'fulfilled') {
          const rows = normalizeApiRows(tiposDescuentoResult.value)
            .map((row) => ({
              value: String(row?.id_tipo_descuento ?? '').trim(),
              label: String(row?.nombre_tipo_descuento ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.value && row.label)
            .filter((row) => row.estado !== false);
          setTiposDescuentoCatalog(rows);
        }

        if (!ignore && categoriasProductosResult.status === 'fulfilled') {
          const rows = normalizeApiRows(categoriasProductosResult.value)
            .map((row) => ({
              id: String(row?.id_categoria_producto ?? '').trim(),
              label: String(row?.nombre_categoria ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id && row.label)
            .filter((row) => row.estado !== false);
          setCategoriasProductosCatalog(rows);
        }

        if (!ignore && categoriasInsumosResult.status === 'fulfilled') {
          const rows = normalizeApiRows(categoriasInsumosResult.value)
            .map((row) => ({
              id: String(row?.id_categoria_insumo ?? '').trim(),
              label: String(row?.nombre_categoria ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id && row.label)
            .filter((row) => row.estado !== false);
          setCategoriasInsumosCatalog(rows);
        }

        if (!ignore && productosResult.status === 'fulfilled') {
          const rows = normalizeApiRows(productosResult.value)
            .map((row) => ({
              id: String(row?.id_producto ?? '').trim(),
              nombre: String(row?.nombre_producto ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id && row.nombre)
            .filter((row) => row.estado !== false);
          setProductosCatalog(rows);
        }

        if (!ignore && insumosResult.status === 'fulfilled') {
          const rows = normalizeApiRows(insumosResult.value)
            .map((row) => ({
              id: String(row?.id_insumo ?? '').trim(),
              nombre: String(row?.nombre_insumo ?? '').trim(),
              estado: row?.estado
            }))
            .filter((row) => row.id && row.nombre)
            .filter((row) => row.estado !== false);
          setInsumosCatalog(rows);
        }

        if (!ignore && estadosPedidoResult.status === 'fulfilled') {
          const rows = normalizeApiRows(estadosPedidoResult.value?.data?.desglose_por_estado ?? [])
            .map((row) => String(row?.estado ?? '').trim())
            .filter(Boolean);
          setEstadosPedidoCatalog((prev) => (rows.length ? rows : prev));
        }
      } finally {
        if (!ignore) setLoadingBaseCatalogs(false);
      }
    };

    void loadBaseCatalogs();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshFilterCatalogs = async (baseFilters = filters) => {
    if (!allowedTabs.length) return;

    setLoadingCatalogs(true);
    try {
      const settled = await Promise.allSettled(
        allowedTabs
          .map((tab) => REPORT_HANDLERS[tab.key])
          .filter(Boolean)
          .map((fetcher) => fetcher(baseFilters))
      );

      const rows = [];
      settled.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        extractRowsFromReportPayload(result.value).forEach((row) => rows.push(row));
      });

      setCatalogRows(rows);

      if (import.meta.env.DEV) {
        console.log('[Reportes][Catalogos] rows', rows.length);
      }
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const runReport = async (tabKey, customFilters = filters) => {
    const fetcher = REPORT_HANDLERS[tabKey];
    if (!fetcher) return;
    const sanitizedFilters = sanitizeFiltersForTab(tabKey, customFilters);

    setLoading(true);
    setError('');

    try {
      const data = await fetcher(sanitizedFilters);
      setPayload(data || null);
      setCatalogRows((prev) => {
        const merged = [...prev, ...extractRowsFromReportPayload(data)];
        return merged.length > 4000 ? merged.slice(merged.length - 4000) : merged;
      });
    } catch (err) {
      const message = err?.message || 'No se pudo generar el reporte solicitado.';
      setError(message);
      showToast('Error', message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTab) return;
    const sanitized = sanitizeFiltersForTab(activeTab, filters);
    setFilters((prev) => ({ ...prev, ...sanitized }));
    setDraftFilters((prev) => ({ ...prev, ...sanitized }));
    runReport(activeTab, sanitized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!showFiltersDrawer) return;
    if (!draftFilters.sucursal || !draftFilters.almacen) return;
    const exists = almacenesCatalog.some((row) => String(row.id_almacen) === String(draftFilters.almacen) && String(row.id_sucursal) === String(draftFilters.sucursal));
    if (!exists) {
      setDraftFilters((prev) => ({ ...prev, almacen: '' }));
    }
  }, [showFiltersDrawer, draftFilters.sucursal, draftFilters.almacen, almacenesCatalog]);

  useEffect(() => {
    if (!showFiltersDrawer) return;
    const tipo = String(draftFilters.tipo_item || '').trim().toLowerCase();
    if (tipo === 'producto' || tipo === 'insumo' || tipo === '') return;
    if (draftFilters.categoria || draftFilters.item) {
      setDraftFilters((prev) => ({ ...prev, categoria: '', item: '' }));
    }
  }, [showFiltersDrawer, draftFilters.tipo_item, draftFilters.categoria, draftFilters.item]);

  useEffect(() => {
    if (!allowedTabs.length) return;
    refreshFilterCatalogs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs]);

  const handleClearFilters = async () => {
    const reset = sanitizeFiltersForTab(activeTab, INITIAL_FILTERS);
    setDraftFilters(reset);
    setFilters(reset);
    setShowFiltersDrawer(false);
    await runReport(activeTab, reset);
    await refreshFilterCatalogs(reset);
  };

  const handleApplyFilters = async () => {
    const next = sanitizeFiltersForTab(activeTab, draftFilters);
    setFilters(next);
    setShowFiltersDrawer(false);
    await runReport(activeTab, next);
    await refreshFilterCatalogs(next);
  };

  const handleOpenFilters = () => {
    setDraftFilters(sanitizeFiltersForTab(activeTab, filters));
    setShowFiltersDrawer(true);
    if (catalogRows.length === 0 && !loadingCatalogs) {
      refreshFilterCatalogs(filters);
    }
  };

  const handleExportExcel = async () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    if (!reporte) return;
    const sanitizedFilters = sanitizeFiltersForTab(activeTab, filters);

    setExporting(true);
    setError('');

    try {
      const { blob, filename } = await reportesService.exportExcel({ reporte, filters: sanitizedFilters });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename || `reporte_${reporte}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast('Exportación completada', 'El archivo CSV/Excel se descargó correctamente.', 'success');
    } catch (err) {
      const message = err?.message || 'No se pudo exportar el reporte.';
      setError(message);
      showToast('Error de exportación', message, 'danger');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    if (!reporte) return;
    const sanitizedFilters = sanitizeFiltersForTab(activeTab, filters);

    setExportingPdf(true);
    setError('');

    try {
      const { blob, filename } = await reportesService.exportPdf({ reporte, filters: sanitizedFilters });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename || `reporte_${reporte}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast('Exportación completada', 'El archivo PDF se descargó correctamente.', 'success');
    } catch (err) {
      const message = err?.message || 'No se pudo exportar el reporte.';
      setError(message);
      showToast('Error de exportación', message, 'danger');
    } finally {
      setExportingPdf(false);
    }
  };

  const openEmailModal = () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    setEmailForm({
      destinatarios: '',
      formato: 'pdf',
      asunto: `Reporte ${reporte || 'general'}`,
      mensaje: 'Adjunto reporte solicitado.',
      confirmado: false
    });
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    if (sendingEmail) return;
    setShowEmailModal(false);
  };

  const handleSendEmail = async () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    if (!reporte) return;
    const sanitizedFilters = sanitizeFiltersForTab(activeTab, filters);

    const recipients = emailForm.destinatarios
      .split(/[,\n;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (recipients.length < 1) {
      const message = 'Debes indicar al menos un destinatario.';
      setError(message);
      showToast('Validación', message, 'warning');
      return;
    }
    if (recipients.length > 10) {
      const message = 'Solo se permiten hasta 10 destinatarios por envío.';
      setError(message);
      showToast('Validación', message, 'warning');
      return;
    }
    const invalid = recipients.find((email) => !EMAIL_RE.test(email));
    if (invalid) {
      const message = `El correo ${invalid} no es válido.`;
      setError(message);
      showToast('Validación', message, 'warning');
      return;
    }
    if (!emailForm.confirmado) {
      const message = 'Debes confirmar el envío antes de continuar.';
      setError(message);
      showToast('Confirmación requerida', message, 'warning');
      return;
    }

    setSendingEmail(true);
    setError('');

    try {
      await reportesService.sendByEmail({
        reporte,
        formato: emailForm.formato,
        destinatarios: recipients,
        asunto: emailForm.asunto,
        mensaje: emailForm.mensaje,
        filtros: sanitizedFilters
      });
      setShowEmailModal(false);
      showToast('Correo enviado', 'Reporte enviado por correo correctamente.', 'success');
    } catch (err) {
      const message = err?.message || 'No se pudo enviar el reporte por correo.';
      setError(message);
      showToast('Error de envío', message, 'danger');
    } finally {
      setSendingEmail(false);
    }
  };

  const kpis = payload?.data?.kpis || null;
  const serieDiaria = Array.isArray(payload?.data?.serie_diaria) ? payload.data.serie_diaria : [];
  const desgloseEstado = Array.isArray(payload?.data?.desglose_por_estado) ? payload.data.desglose_por_estado : [];
  const resumenMetodos = Array.isArray(payload?.data?.resumen_por_metodo) ? payload.data.resumen_por_metodo : [];
  const serieMetodo = Array.isArray(payload?.data?.serie_diaria_por_metodo) ? payload.data.serie_diaria_por_metodo : [];
  const cierresCaja = Array.isArray(payload?.data?.cierres) ? payload.data.cierres : [];
  const diferenciasCaja = Array.isArray(payload?.data?.diferencias) ? payload.data.diferencias : [];
  const stockCriticoItems = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const kardexMovimientos = Array.isArray(payload?.data?.movimientos) ? payload.data.movimientos : [];
  const descuentosResumen = Array.isArray(payload?.data?.resumen_tipo_descuento) ? payload.data.resumen_tipo_descuento : [];
  const descuentosDetalle = Array.isArray(payload?.data?.detalle) ? payload.data.detalle : [];
  const descuentosTotals = {
    cantidad: Number(payload?.data?.kpis?.cantidad_descuentos_aplicados ?? descuentosDetalle.length),
    subtotal: Number(payload?.data?.kpis?.subtotal_afectado ?? descuentosDetalle.reduce((sum, row) => sum + Number(row?.subtotal_linea || 0), 0)),
    descuento: Number(payload?.data?.kpis?.total_descuento ?? descuentosDetalle.reduce((sum, row) => sum + Number(row?.descuento || 0), 0)),
    total: Number(payload?.data?.kpis?.total_neto_despues_descuento ?? descuentosDetalle.reduce((sum, row) => sum + Number(row?.total_linea || 0), 0))
  };
  const ventasItemsResumen = Array.isArray(payload?.data?.resumen_items) ? payload.data.resumen_items : [];
  const ventasItemsDetalle = Array.isArray(payload?.data?.detalle) ? payload.data.detalle : [];
  const ventasItemsTotals = {
    cantidad: Number(payload?.data?.kpis?.cantidad_total_vendida ?? ventasItemsDetalle.reduce((sum, row) => sum + Number(row?.cantidad || 0), 0)),
    subtotal: Number(payload?.data?.kpis?.subtotal_total ?? ventasItemsDetalle.reduce((sum, row) => sum + Number(row?.subtotal || 0), 0)),
    descuento: Number(payload?.data?.kpis?.descuento_total ?? ventasItemsDetalle.reduce((sum, row) => sum + Number(row?.descuento || 0), 0)),
    total: Number(payload?.data?.kpis?.total_neto ?? ventasItemsDetalle.reduce((sum, row) => sum + Number(row?.total || 0), 0))
  };

  const sourceRows = [...catalogRows];
  serieDiaria.forEach((row) => pushRow(sourceRows, row));
  desgloseEstado.forEach((row) => pushRow(sourceRows, row));
  resumenMetodos.forEach((row) => pushRow(sourceRows, row));
  serieMetodo.forEach((row) => pushRow(sourceRows, row));
  cierresCaja.forEach((row) => pushRow(sourceRows, row));
  diferenciasCaja.forEach((row) => pushRow(sourceRows, row));
  stockCriticoItems.forEach((row) => pushRow(sourceRows, row));
  kardexMovimientos.forEach((row) => pushRow(sourceRows, row));
  descuentosResumen.forEach((row) => pushRow(sourceRows, row));
  descuentosDetalle.forEach((row) => pushRow(sourceRows, row));
  ventasItemsResumen.forEach((row) => pushRow(sourceRows, row));
  ventasItemsDetalle.forEach((row) => pushRow(sourceRows, row));

  const fallbackSucursalOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_sucursal', 'sucursal_id'],
    labelKeys: ['nombre_sucursal', 'sucursal'],
    allLabel: 'Todas las sucursales',
    allowLabelAsValue: false
  });

  const fallbackCajaOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_caja'],
    labelKeys: ['codigo_caja', 'nombre_caja', 'caja'],
    allLabel: 'Todas las cajas',
    allowLabelAsValue: false
  });

  const branchCatalogRows = sucursalesCatalog.map((row) => ({
    id_sucursal: row.id_sucursal,
    nombre_sucursal: row.nombre_sucursal
  }));
  const sucursalOptions = makeCatalogOptions([...branchCatalogRows, ...sourceRows], {
    idKeys: ['id_sucursal', 'sucursal_id'],
    labelKeys: ['nombre_sucursal', 'sucursal'],
    allLabel: 'Todas las sucursales',
    allowLabelAsValue: false
  });

  const selectedSucursalForCaja = String(
    showFiltersDrawer ? draftFilters.sucursal || filters.sucursal || '' : filters.sucursal || ''
  ).trim();
  const cajaCatalogRows = cajasCatalog
    .filter((row) => !selectedSucursalForCaja || String(row.id_sucursal) === selectedSucursalForCaja)
    .map((row) => ({
      id_caja: row.id_caja,
      codigo_caja: row.codigo_caja,
      nombre_caja: row.nombre_caja
    }));
  const cajaOptions = makeCatalogOptions([...cajaCatalogRows, ...sourceRows], {
    idKeys: ['id_caja'],
    labelKeys: ['codigo_caja', 'nombre_caja', 'caja'],
    allLabel: 'Todas las cajas',
    allowLabelAsValue: false
  });

  const categoriaOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_categoria', 'id_categoria_producto', 'id_categoria_insumo'],
    labelKeys: ['categoria', 'nombre_categoria'],
    allLabel: 'Todas las categorias'
  });

  const itemOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['item_id', 'id_item', 'id_producto', 'id_insumo'],
    labelKeys: ['item_nombre', 'item', 'nombre', 'nombre_item', 'nombre_producto', 'nombre_insumo'],
    allLabel: 'Todos los items'
  });

  const selectedSucursalForAdvanced = String(
    showFiltersDrawer ? (draftFilters.sucursal || filters.sucursal || '') : (filters.sucursal || '')
  ).trim();
  const selectedTipoItem = String(showFiltersDrawer ? draftFilters.tipo_item : filters.tipo_item).trim().toLowerCase();

  const usuariosOptions = [
    { value: '', label: 'Todos los usuarios' },
    ...usuariosCatalog.map((row) => ({ value: String(row.id_usuario), label: row.nombre_usuario }))
  ];

  const metodoPagoOptions = [
    { value: '', label: 'Todos los metodos' },
    ...metodosPagoCatalog.map((row) => ({ value: row.value, label: row.label }))
  ];

  const tipoDescuentoOptions = [
    { value: '', label: 'Todos los tipos' },
    ...tiposDescuentoCatalog.map((row) => ({ value: row.value, label: row.label }))
  ];

  const estadoVentasCandidates = new Set(
    [
      ...estadosPedidoCatalog,
      ...normalizeApiRows(payload?.data?.desglose_por_estado).map((row) => String(row?.estado ?? '').trim())
    ].filter(Boolean)
  );
  estadoVentasCandidates.add('VENTA DIRECTA');
  const estadoVentasOptions = [{ value: '', label: 'Todos' }, ...[...estadoVentasCandidates].sort((a, b) => a.localeCompare(b, 'es')).map((value) => ({ value, label: value }))];

  const estadoCajaOptions = [
    { value: '', label: 'Todos' },
    ...[...new Set(estadosCierreCatalog.filter(Boolean))].map((value) => ({ value, label: value }))
  ];

  const almacenesFiltrados = almacenesCatalog.filter((row) => !selectedSucursalForAdvanced || String(row.id_sucursal) === selectedSucursalForAdvanced);
  const almacenControlledOptions = [
    { value: '', label: 'Todos los almacenes' },
    ...almacenesFiltrados.map((row) => ({ value: String(row.id_almacen), label: row.nombre_almacen }))
  ];

  const categoriaControlledOptions = (() => {
    if (selectedTipoItem === 'producto') {
      return [{ value: '', label: 'Todas las categorias' }, ...categoriasProductosCatalog.map((row) => ({ value: row.id, label: row.label }))];
    }
    if (selectedTipoItem === 'insumo') {
      return [{ value: '', label: 'Todas las categorias' }, ...categoriasInsumosCatalog.map((row) => ({ value: row.id, label: row.label }))];
    }
    return categoriaOptions;
  })();

  const itemControlledOptions = (() => {
    if (selectedTipoItem === 'producto') {
      return [{ value: '', label: 'Todos los items' }, ...productosCatalog.map((row) => ({ value: row.id, label: row.nombre }))];
    }
    if (selectedTipoItem === 'insumo') {
      return [{ value: '', label: 'Todos los items' }, ...insumosCatalog.map((row) => ({ value: row.id, label: row.nombre }))];
    }
    if (selectedTipoItem === 'combo' || selectedTipoItem === 'receta') {
      const byTipoRows = sourceRows.filter(
        (row) => String(row?.tipo_item || '').trim().toLowerCase() === selectedTipoItem
      );
      return makeCatalogOptions(byTipoRows, {
        idKeys: ['id_item', 'item_id'],
        labelKeys: ['item', 'nombre_item', 'item_nombre', 'nombre'],
        allLabel: 'Todos los items'
      });
    }
    return itemOptions;
  })();

  const activeFilterChips = Object.entries(filters)
    .filter(([key]) => activeAllowedFilterKeys.includes(key))
    .filter(([, value]) => String(value ?? '').trim() !== '')
    .map(([key, value]) => ({ key, label: FILTER_LABELS[key] || key, value: formatFilterDisplayValue(key, value) }));
  const activeFiltersCount = activeFilterChips.length;

  const kpiCards = getKpiCards(activeTab, kpis);

  const isVentasResumenTab = activeTab === 'ventas-resumen';
  const isVentasMetodosTab = activeTab === 'ventas-metodos-pago';
  const isCajaCierresTab = activeTab === 'caja-cierres';
  const isCajaDiferenciasTab = activeTab === 'caja-diferencias';
  const isStockCriticoTab = activeTab === 'inventario-stock-critico';
  const activeContextTitle = activeReport?.category === 'inventario' ? 'Contexto de inventario' : (activeReport?.category === 'caja' ? 'Contexto de caja' : 'Contexto de venta');
  const activeSpecificFilterKeys = useMemo(
    () => activeAllowedFilterKeys.filter((key) => REPORT_SPECIFIC_FILTER_KEYS.includes(key)),
    [activeAllowedFilterKeys]
  );
  const isKardexTab = activeTab === 'inventario-kardex';
  const isVentasDescuentosTab = activeTab === 'ventas-descuentos';
  const isVentasItemsTab = activeTab === 'ventas-items';

  const activeTableRows = useMemo(() => {
    if (isVentasResumenTab) return serieDiaria;
    if (isVentasMetodosTab) return resumenMetodos;
    if (isCajaCierresTab) return cierresCaja;
    if (isCajaDiferenciasTab) return diferenciasCaja;
    if (isStockCriticoTab) return stockCriticoItems;
    if (isKardexTab) return kardexMovimientos;
    if (isVentasDescuentosTab) return descuentosDetalle;
    if (isVentasItemsTab) return ventasItemsDetalle;
    return [];
  }, [
    isVentasResumenTab,
    isVentasMetodosTab,
    isCajaCierresTab,
    isCajaDiferenciasTab,
    isStockCriticoTab,
    isKardexTab,
    isVentasDescuentosTab,
    isVentasItemsTab,
    serieDiaria,
    resumenMetodos,
    cierresCaja,
    diferenciasCaja,
    stockCriticoItems,
    kardexMovimientos,
    descuentosDetalle,
    ventasItemsDetalle
  ]);

  const paginationTotal = activeTableRows.length;
  const totalPages = Math.max(1, Math.ceil(paginationTotal / REPORTS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, listPage), totalPages);
  const pageStartIndex = (safePage - 1) * REPORTS_PAGE_SIZE;
  const paginatedRows = activeTableRows.slice(pageStartIndex, pageStartIndex + REPORTS_PAGE_SIZE);
  const pageWindowStart = paginationTotal === 0 ? 0 : pageStartIndex + 1;
  const pageWindowEnd = Math.min(pageStartIndex + REPORTS_PAGE_SIZE, paginationTotal);
  const pageNumbers = useMemo(() => {
    const maxButtons = 4;
    const start = Math.max(1, Math.min(safePage - 1, totalPages - maxButtons + 1));
    const end = Math.min(totalPages, start + maxButtons - 1);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [safePage, totalPages]);

  useEffect(() => {
    setListPage(1);
  }, [activeTab, payload]);

  useEffect(() => {
    if (listPage !== safePage) {
      setListPage(safePage);
    }
  }, [listPage, safePage]);

  useEffect(() => {
    if (!import.meta.env.DEV || !showFiltersDrawer) return;
    console.log('[Reportes][Filtros] options', {
      sucursal: sucursalOptions.length,
      caja: cajaOptions.length,
      fallbackSucursal: fallbackSucursalOptions.length,
      fallbackCaja: fallbackCajaOptions.length,
      sucursalesCatalog: sucursalesCatalog.length,
      cajasCatalog: cajasCatalog.length,
      loadingCatalogs,
      loadingBaseCatalogs,
      draftFilters
    });
  }, [
    showFiltersDrawer,
    sucursalOptions.length,
    cajaOptions.length,
    fallbackSucursalOptions.length,
    fallbackCajaOptions.length,
    sucursalesCatalog.length,
    cajasCatalog.length,
    loadingCatalogs,
    loadingBaseCatalogs,
    draftFilters
  ]);

  if (permisosLoading) return null;

  if (!fallbackTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.reportes}
        detalle="No tienes acceso a ningún reporte habilitado."
      />
    );
  }

  return (
    <div className="container-fluid p-3 reportes-page">
      <header className="rep-shell-card rep-module-header">
        <div className="rep-module-header__main">
          <p className="rep-module-header__kicker">Inteligencia comercial</p>
          <h1 className="rep-module-header__title">Reportes</h1>
          <p className="rep-module-header__desc">
            Consulta indicadores, aplica filtros y comparte resultados por exportación o correo.
          </p>
          <div className="rep-module-header__meta">
            <span className="rep-meta-pill">{activeCategoryLabel}</span>
            <span className="rep-meta-pill rep-meta-pill--active">
              <i className={activeReport?.icon || 'bi bi-file-bar-graph'} aria-hidden="true" />
              {activeReport?.label || 'Reporte activo'}
            </span>
          </div>
        </div>

        <div className="rep-module-header__actions">
          {canExportExcel ? (
            <button
              type="button"
              className="btn inv-prod-btn-subtle rep-action-btn"
              onClick={handleExportExcel}
              disabled={exporting || loading}
            >
              <i className="bi bi-filetype-csv" aria-hidden="true" />
              <span>{exporting ? 'Exportando CSV/Excel...' : 'CSV/Excel'}</span>
            </button>
          ) : null}

          {canExportPdf ? (
            <button
              type="button"
              className="btn inv-prod-btn-subtle rep-action-btn"
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
            >
              <i className="bi bi-filetype-pdf" aria-hidden="true" />
              <span>{exportingPdf ? 'Exportando PDF...' : 'PDF'}</span>
            </button>
          ) : null}

          {canSendEmail ? (
            <button
              type="button"
              className="btn inv-prod-btn-outline rep-action-btn"
              onClick={openEmailModal}
              disabled={sendingEmail || loading}
            >
              <i className="bi bi-envelope-paper" aria-hidden="true" />
              <span>Enviar por correo</span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="rep-shell-card rep-filters-card" aria-label="Filtros rápidos">
        <div className="rep-filters-inline">
          <div className="rep-field rep-field--fecha-inicio">
            <label htmlFor="rep-quick-fecha-inicio">Fecha inicio</label>
            <input
              id="rep-quick-fecha-inicio"
              type="date"
              value={filters.fecha_inicio}
              onChange={(event) => setFilters((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
            />
          </div>

          <div className="rep-field rep-field--fecha-fin">
            <label htmlFor="rep-quick-fecha-fin">Fecha fin</label>
            <input
              id="rep-quick-fecha-fin"
              type="date"
              value={filters.fecha_fin}
              onChange={(event) => setFilters((prev) => ({ ...prev, fecha_fin: event.target.value }))}
            />
          </div>

          <div className="rep-field rep-field--sucursal">
            <label htmlFor="rep-quick-sucursal">Sucursal</label>
            <select
              id="rep-quick-sucursal"
              value={filters.sucursal}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sucursal: event.target.value, caja: '' }))
              }
              disabled={(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1}
            >
              {(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1 ? (
                <option value="">Cargando sucursales...</option>
              ) : (
                sucursalOptions.map((option) => (
                  <option key={`quick-sucursal-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            className="btn inv-prod-btn-primary rep-action-btn rep-action-btn--aplicar"
            onClick={() => runReport(activeTab, filters)}
            disabled={loading}
          >
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            <span>{loading ? 'Actualizando...' : 'Aplicar filtros'}</span>
          </button>

          <button
            type="button"
            className="btn inv-prod-btn-subtle rep-action-btn rep-action-btn--limpiar"
            onClick={handleClearFilters}
            disabled={loading}
          >
            <i className="bi bi-eraser" aria-hidden="true" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            className="btn inv-prod-btn-outline rep-action-btn rep-action-btn--mas-filtros"
            onClick={handleOpenFilters}
          >
            <i className="bi bi-sliders2" aria-hidden="true" />
            <span>Más filtros</span>
          </button>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="rep-filter-chips" aria-label="Filtros activos">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className="rep-filter-chip">
                <strong>{chip.label}:</strong> {chip.value}
              </span>
            ))}
          </div>
        ) : (
          <div className="rep-filter-chips rep-filter-chips--empty">Sin filtros activos.</div>
        )}
      </section>

      {kpiCards.length > 0 ? (
        <div className="rep-kpi-grid">
          {kpiCards.map((kpi) => (
            <article key={kpi.label} className={`rep-kpi-card inv-invstat-card ${kpi.tone || 'is-neutral'}`}>
              <span className="inv-invstat-icon" aria-hidden="true">
                <i className={kpi.icon || 'bi bi-bar-chart'} />
              </span>
              <div className="rep-kpi-card__content">
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="rep-shell-card rep-result-shell">
        {loading ? (
          <div className="rep-state rep-state--loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Generando reporte...</span>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rep-state rep-state--error" role="alert">
            <i className="bi bi-exclamation-octagon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {!loading && !error && payload ? (
          <>
            {isVentasResumenTab ? (
              <div className="rep-ventas-layout">
                <div className="rep-table-shell">
                  <div className="rep-table-responsive">
                    <table className="rep-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th className="text-end">Cantidad de ventas</th>
                          <th className="text-end">Subtotal</th>
                          <th className="text-end">Descuento</th>
                          <th className="text-end">Impuesto</th>
                          <th className="text-end">Total neto</th>
                          <th className="text-end">Ticket promedio</th>
                          <th>Estado principal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serieDiaria.length === 0 ? (
                          <tr><td colSpan={8} className="rep-table-empty">Sin datos para los filtros seleccionados.</td></tr>
                        ) : paginatedRows.map((item) => (
                          <tr key={item.fecha}>
                            <td>{item.fecha}</td>
                            <td className="text-end">{item.cantidad_ventas}</td>
                            <td className="text-end">L {money(item.subtotal)}</td>
                            <td className="text-end">L {money(item.descuento)}</td>
                            <td className="text-end">L {money(item.impuesto)}</td>
                            <td className="text-end">L {money(item.total_neto)}</td>
                            <td className="text-end">L {money(item.ticket_promedio)}</td>
                            <td>{item.estado_principal || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                      
                    </table>
                  </div>

                                  <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Cantidad total de ventas:</strong> {kpis?.cantidad_ventas ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Subtotal general:</strong> L {money(kpis?.subtotal_general ?? kpis?.subtotal ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Descuento general:</strong> L {money(kpis?.descuento_general ?? kpis?.descuentos ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Impuesto general:</strong> L {money(kpis?.impuesto_general ?? kpis?.impuestos ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Total neto general:</strong> L {money(kpis?.total_neto_general ?? kpis?.total_neto ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Ticket promedio general:</strong> L {money(kpis?.ticket_promedio_general ?? kpis?.promedio_por_venta ?? 0)}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Resumen de ventas en tarjetas">
                    {serieDiaria.length === 0 ? (
                      <div className="rep-mobile-sales-empty">Sin datos para los filtros seleccionados.</div>
                    ) : paginatedRows.map((item, index) => (
                      <article key={`sales-mobile-${item.fecha}-${index}`} className="rep-mobile-sales-card">
                        <div className="rep-mobile-sales-card__head">
                          <span className="rep-mobile-sales-card__icon" aria-hidden="true">
                            <i className="bi bi-graph-up-arrow" />
                          </span>
                          <strong>{item.fecha || '-'}</strong>
                        </div>
                        <div className="rep-mobile-sales-card__body">
                          <div>
                            <span>Ventas</span>
                            <b>{item.cantidad_ventas ?? 0}</b>
                          </div>
                          <div>
                            <span>Total neto</span>
                            <b>L {money(item.total_neto)}</b>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="rep-ventas-sidecard">
                  <header className="rep-ventas-sidecard__head">
                    <h3>Estado de ventas</h3>
                    <p>Distribución de ventas por estado en el período.</p>
                  </header>

                  {desgloseEstado.length === 0 ? (
                    <div className="rep-ventas-sidecard__empty">Sin desglose por estado.</div>
                  ) : (
                    <ul className="rep-ventas-sidecard__list">
                      {desgloseEstado.map((item, index) => (
                        <li key={`${item.estado || 'estado'}-${index}`} className="rep-ventas-sidecard__item">
                          <div>
                            <strong>{item.estado || 'Sin estado'}</strong>
                            <span>{item.cantidad_ventas || 0} ventas</span>
                          </div>
                          <b>L {money(item.total_neto)}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            ) : null}

            {isVentasMetodosTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Método de pago</th>
                        <th className="text-end">Cantidad de ventas</th>
                        <th className="text-end">Total vendido</th>
                        <th className="text-end">Porcentaje de participación</th>
                        <th className="text-end">Ticket promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMetodos.length === 0 ? (
                        <tr><td colSpan={5} className="rep-table-empty">Sin datos por método.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={`${item.metodo_pago_codigo || item.metodo_pago}-${item.total_vendido}`}>
                          <td>{item.metodo_pago}</td>
                          <td className="text-end">{item.cantidad_ventas}</td>
                          <td className="text-end">L {money(item.total_vendido)}</td>
                          <td className="text-end">{money(item.porcentaje_sobre_total)}%</td>
                          <td className="text-end">L {money(item.ticket_promedio)}</td>
                        </tr>
                      ))}
                    </tbody>
                    
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Total ventas:</strong> {kpis?.total_ventas ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total vendido general:</strong> L {money(kpis?.total_general ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Participaci?n:</strong> 100.00%</span>
                  <span className="rep-filter-chip"><strong>Ticket promedio general:</strong> L {money(kpis?.ticket_promedio_general ?? 0)}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Métodos de pago en tarjetas">
                  {resumenMetodos.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin datos por método.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`metodos-mobile-${item.metodo_pago_codigo || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-credit-card-2-front" /></span>
                        <strong>{item.metodo_pago || '-'}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Ventas</span><b>{item.cantidad_ventas ?? 0}</b></div>
                        <div><span>Total vendido</span><b>{`L ${money(item.total_vendido)}`}</b></div>
                        <div><span>Participación</span><b>{`${money(item.porcentaje_sobre_total)}%`}</b></div>
                        <div><span>Ticket promedio</span><b>{`L ${money(item.ticket_promedio)}`}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isCajaCierresTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Fecha cierre</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Responsable</th>
                        <th className="text-end">Monto esperado</th>
                        <th className="text-end">Monto contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado</th>
                        <th>Resolución</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierresCaja.length === 0 ? (
                        <tr><td colSpan={10} className="rep-table-empty">Sin cierres para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={item.id_cierre_caja}>
                          <td>{item.fecha_cierre || item.fecha_apertura || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.codigo_caja ? `${item.codigo_caja} - ${item.caja || ''}` : (item.caja || '-')}</td>
                          <td>{item.responsable || item.usuario_cierre || '-'}</td>
                          <td className="text-end">L {money(item.total_esperado)}</td>
                          <td className="text-end">L {money(item.total_contado)}</td>
                          <td className="text-end">L {money(item.diferencia)}</td>
                          <td>{item.estado || '-'}</td>
                          <td className="rep-cell-truncate" title={item.resolucion || item.estado_cierre || '-'}>{compactText(item.resolucion || item.estado_cierre || '-', 28)}</td>
                          <td className="rep-cell-truncate rep-cell-truncate--wide" title={item.observacion || '-'}>{compactText(item.observacion || '-', 42)}</td>
                        </tr>
                      ))}
                    </tbody>
                    
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Cantidad de cierres:</strong> {kpis?.cantidad_cierres ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total esperado:</strong> L {money(kpis?.total_esperado ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Total contado:</strong> L {money(kpis?.total_contado ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Diferencia neta:</strong> L {money(kpis?.diferencia_neta ?? kpis?.diferencia_total ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Con diferencia:</strong> {kpis?.cantidad_con_diferencia ?? kpis?.cierres_con_diferencia ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Sin diferencia:</strong> {kpis?.cantidad_sin_diferencia ?? kpis?.cierres_sin_diferencia ?? 0}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Cierres de caja en tarjetas">
                  {cierresCaja.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin cierres para los filtros aplicados.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`cierres-mobile-${item.id_cierre_caja || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-safe2" /></span>
                        <strong>{`${item.caja || 'Caja'} · ${item.fecha_cierre || '-'}`}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Sucursal / Responsable</span><b>{`${item.sucursal || '-'} / ${item.responsable || item.usuario_cierre || '-'}`}</b></div>
                        <div><span>Esperado / Contado</span><b>{`L ${money(item.total_esperado)} / L ${money(item.total_contado)}`}</b></div>
                        <div><span>Diferencia</span><b>{`L ${money(item.diferencia)}`}</b></div>
                        <div><span>Estado</span><b>{item.estado || '-'}</b></div>
                        <div><span>Resolución</span><b title={item.resolucion || item.estado_cierre || '-'}>{compactText(item.resolucion || item.estado_cierre || '-', 36)}</b></div>
                        <div><span>Observación</span><b title={item.observacion || '-'}>{compactText(item.observacion || '-', 36)}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isCajaDiferenciasTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Fecha cierre</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Responsable</th>
                        <th className="text-end">Monto esperado</th>
                        <th className="text-end">Monto contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Tipo diferencia</th>
                        <th>Resolución</th>
                        <th>Observación</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diferenciasCaja.length === 0 ? (
                        <tr><td colSpan={11} className="rep-table-empty">Sin diferencias para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={`${item.id_cierre_caja}-${item.tipo_diferencia}`}>
                          <td>{item.fecha_cierre || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.codigo_caja ? `${item.codigo_caja} - ${item.caja || ''}` : (item.caja || '-')}</td>
                          <td>{item.responsable || '-'}</td>
                          <td className="text-end">L {money(item.total_esperado)}</td>
                          <td className="text-end">L {money(item.total_contado)}</td>
                          <td className="text-end">L {money(item.diferencia)}</td>
                          <td>{item.tipo_diferencia || '-'}</td>
                          <td className="rep-cell-truncate" title={item.resolucion || item.estado_resolucion || '-'}>{compactText(item.resolucion || item.estado_resolucion || '-', 28)}</td>
                          <td className="rep-cell-truncate rep-cell-truncate--wide" title={item.observacion || '-'}>{compactText(item.observacion || '-', 40)}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Cantidad de diferencias:</strong> {kpis?.cantidad_diferencias ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total faltantes:</strong> L {money(kpis?.total_faltantes ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Total sobrantes:</strong> L {money(kpis?.total_sobrantes ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Diferencia neta:</strong> L {money(kpis?.diferencia_neta ?? 0)}</span>
                  <span className="rep-filter-chip"><strong>Mayor diferencia registrada:</strong> L {money(kpis?.mayor_diferencia_registrada ?? 0)}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Diferencias de caja en tarjetas">
                  {diferenciasCaja.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin diferencias para los filtros aplicados.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`diferencias-mobile-${item.id_cierre_caja || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-exclamation-diamond" /></span>
                        <strong>{`${item.caja || 'Caja'} · ${item.fecha_cierre || '-'}`}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Sucursal / Responsable</span><b>{`${item.sucursal || '-'} / ${item.responsable || '-'}`}</b></div>
                        <div><span>Tipo / Estado</span><b>{`${item.tipo_diferencia || '-'} / ${item.estado || '-'}`}</b></div>
                        <div><span>Diferencia</span><b>{`L ${money(item.diferencia)}`}</b></div>
                        <div><span>Esperado / Contado</span><b>{`L ${money(item.total_esperado)} / L ${money(item.total_contado)}`}</b></div>
                        <div><span>Resolución</span><b title={item.resolucion || item.estado_resolucion || '-'}>{compactText(item.resolucion || item.estado_resolucion || '-', 36)}</b></div>
                        <div><span>Observación</span><b title={item.observacion || '-'}>{compactText(item.observacion || '-', 36)}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isStockCriticoTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Almacén</th>
                        <th>Sucursal</th>
                        <th className="text-end">Cantidad actual</th>
                        <th className="text-end">Stock mínimo</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado stock</th>
                        <th>Estado item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCriticoItems.length === 0 ? (
                        <tr><td colSpan={10} className="rep-table-empty">Sin ítems para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item, index) => (
                        <tr key={`${item.tipo_item}-${item.nombre}-${item.almacen}-${index}`}>
                          <td>{item.tipo_item || '-'}</td>
                          <td className="rep-cell-truncate" title={item.nombre || '-'}>{compactText(item.nombre || '-', 42)}</td>
                          <td>{item.categoria || '-'}</td>
                          <td>{item.almacen || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td className="text-end">{item.cantidad_actual ?? 0}</td>
                          <td className="text-end">{item.stock_minimo ?? 0}</td>
                          <td className="text-end">{item.diferencia_minimo ?? 0}</td>
                          <td>{item.estado_stock || item.estado || '-'}</td>
                          <td>{item.estado_item || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Total ?tems cr?ticos/bajos:</strong> {kpis?.total_items_criticos_bajos ?? kpis?.total_criticos ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total sin stock:</strong> {kpis?.total_sin_stock ?? kpis?.total_agotados ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total bajo m?nimo:</strong> {kpis?.total_bajo_minimo ?? kpis?.total_stock_bajo ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Productos afectados:</strong> {kpis?.productos_afectados ?? kpis?.productos_criticos ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Insumos afectados:</strong> {kpis?.insumos_afectados ?? kpis?.insumos_criticos ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Almacenes afectados:</strong> {kpis?.almacenes_afectados ?? 0}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Stock crítico en tarjetas">
                  {stockCriticoItems.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin ítems para los filtros aplicados.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`stock-mobile-${item.tipo_item || 'item'}-${index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-box-seam" /></span>
                        <strong title={item.nombre || '-'}>{compactText(item.nombre || '-', 40)}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Tipo / Categoría</span><b>{`${item.tipo_item || '-'} / ${item.categoria || '-'}`}</b></div>
                        <div><span>Sucursal / Almacén</span><b>{`${item.sucursal || '-'} / ${item.almacen || '-'}`}</b></div>
                        <div><span>Actual / Mínimo</span><b>{`${item.cantidad_actual ?? 0} / ${item.stock_minimo ?? 0}`}</b></div>
                        <div><span>Diferencia</span><b>{item.diferencia_minimo ?? 0}</b></div>
                        <div><span>Estado stock</span><b>{item.estado_stock || item.estado || '-'}</b></div>
                        <div><span>Estado ítem</span><b>{item.estado_item || '-'}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isKardexTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Sucursal</th>
                        <th>Almacén</th>
                        <th>Tipo ítem</th>
                        <th>Ítem</th>
                        <th>Categoría</th>
                        <th>Tipo movimiento</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Saldo antes</th>
                        <th className="text-end">Saldo después</th>
                        <th>Referencia</th>
                        <th>Origen / módulo</th>
                        <th>Usuario</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexMovimientos.length === 0 ? (
                        <tr><td colSpan={14} className="rep-table-empty">Sin movimientos para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={item.id_movimiento}>
                          <td>{item.fecha_mov || '-'}</td>
                          <td>{item.nombre_sucursal || '-'}</td>
                          <td>{item.nombre_almacen || '-'}</td>
                          <td>{item.item_tipo || '-'}</td>
                          <td className="rep-cell-truncate" title={item.item_nombre || '-'}>{compactText(item.item_nombre || '-', 36)}</td>
                          <td>{item.categoria || '-'}</td>
                          <td>{item.tipo || '-'}</td>
                          <td className="text-end">{item.cantidad ?? 0}</td>
                          <td className="text-end">{item.saldo_antes ?? 0}</td>
                          <td className="text-end">{item.saldo_despues ?? 0}</td>
                          <td className="rep-cell-truncate" title={item.referencia || (item.ref_origen ? `${item.ref_origen}${item.id_ref ? ` #${item.id_ref}` : ''}` : '-')}>{compactText(item.referencia || (item.ref_origen ? `${item.ref_origen}${item.id_ref ? ` #${item.id_ref}` : ''}` : '-'), 30)}</td>
                          <td className="rep-cell-truncate" title={item.origen_modulo || item.ref_origen || '-'}>{compactText(item.origen_modulo || item.ref_origen || '-', 24)}</td>
                          <td>{item.usuario || '-'}</td>
                          <td className="rep-cell-truncate rep-cell-truncate--wide" title={item.descripcion || '-'}>{compactText(item.descripcion || '-', 42)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Total movimientos:</strong> {kpis?.total_movimientos ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total entradas:</strong> {kpis?.total_entradas ?? kpis?.entradas ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total salidas:</strong> {kpis?.total_salidas ?? kpis?.salidas ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Total ajustes:</strong> {kpis?.total_ajustes ?? kpis?.ajustes_otros ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Cantidad neta movida:</strong> {Number(kpis?.cantidad_neta_movida ?? 0).toFixed(2)}</span>
                  <span className="rep-filter-chip"><strong>?tems afectados:</strong> {kpis?.items_afectados ?? kpis?.items_unicos ?? 0}</span>
                  <span className="rep-filter-chip"><strong>Almacenes afectados:</strong> {kpis?.almacenes_afectados ?? 0}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Kardex en tarjetas">
                  {kardexMovimientos.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin movimientos para los filtros aplicados.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`kardex-mobile-${item.id_movimiento || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-arrow-left-right" /></span>
                        <strong title={item.item_nombre || '-'}>{compactText(item.item_nombre || '-', 40)}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Fecha / Almacén</span><b>{`${item.fecha_mov || '-'} / ${item.nombre_almacen || '-'}`}</b></div>
                        <div><span>Tipo mov. / Tipo ítem</span><b>{`${item.tipo || '-'} / ${item.item_tipo || '-'}`}</b></div>
                        <div><span>Cantidad</span><b>{item.cantidad ?? 0}</b></div>
                        <div><span>Saldo ant. / post.</span><b>{`${item.saldo_antes ?? 0} / ${item.saldo_despues ?? 0}`}</b></div>
                        <div><span>Referencia / Origen</span><b title={`${item.referencia || '-'} / ${item.origen_modulo || item.ref_origen || '-'}`}>{compactText(`${item.referencia || '-'} / ${item.origen_modulo || item.ref_origen || '-'}`, 36)}</b></div>
                        <div><span>Usuario</span><b>{item.usuario || '-'}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isVentasDescuentosTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Usuario</th>
                        <th>Factura</th>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Tipo descuento</th>
                        <th>Ítem</th>
                        <th className="text-end">Subtotal línea</th>
                        <th className="text-end">Descuento</th>
                        <th className="text-end">Total línea</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descuentosDetalle.length === 0 ? (
                        <tr><td colSpan={13} className="rep-table-empty">Sin descuentos aplicados para los filtros.</td></tr>
                      ) : paginatedRows.map((item, index) => (
                        <tr key={`${item.factura}-${item.pedido || 'na'}-${index}`}>
                          <td>{item.fecha || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.caja || '-'}</td>
                          <td>{item.usuario || '-'}</td>
                          <td>{item.factura || '-'}</td>
                          <td>{item.pedido || '-'}</td>
                          <td>{item.cliente || '-'}</td>
                          <td>{item.tipo_descuento || '-'}</td>
                          <td className="rep-cell-truncate" title={item.item || '-'}>{compactText(item.item || '-', 32)}</td>
                          <td className="text-end">L {money(item.subtotal_linea)}</td>
                          <td className="text-end">L {money(item.descuento)}</td>
                          <td className="text-end">L {money(item.total_linea)}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Cantidad de descuentos aplicados:</strong> {descuentosTotals.cantidad}</span>
                  <span className="rep-filter-chip"><strong>Subtotal afectado:</strong> L {money(descuentosTotals.subtotal)}</span>
                  <span className="rep-filter-chip"><strong>Descuento total:</strong> L {money(descuentosTotals.descuento)}</span>
                  <span className="rep-filter-chip"><strong>Total neto despu?s de descuento:</strong> L {money(descuentosTotals.total)}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Descuentos en tarjetas">
                  {descuentosDetalle.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin descuentos aplicados para los filtros.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`descuentos-mobile-${item.factura || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-tags" /></span>
                        <strong title={item.item || '-'}>{compactText(item.item || '-', 40)}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Fecha / Factura</span><b>{`${item.fecha || '-'} / ${item.factura || '-'}`}</b></div>
                        <div><span>Sucursal / Caja</span><b>{`${item.sucursal || '-'} / ${item.caja || '-'}`}</b></div>
                        <div><span>Tipo descuento</span><b>{item.tipo_descuento || '-'}</b></div>
                        <div><span>Subtotal / Desc.</span><b>{`L ${money(item.subtotal_linea)} / L ${money(item.descuento)}`}</b></div>
                        <div><span>Total</span><b>{`L ${money(item.total_linea)}`}</b></div>
                        <div><span>Estado</span><b>{item.estado || '-'}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {isVentasItemsTab ? (
              <div className="rep-table-shell">
                <div className="rep-table-responsive">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Usuario</th>
                        <th>Factura</th>
                        <th>Pedido</th>
                        <th>Tipo ítem</th>
                        <th>Ítem</th>
                        <th>Categoría</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Precio unitario</th>
                        <th className="text-end">Subtotal</th>
                        <th className="text-end">Descuento</th>
                        <th className="text-end">Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasItemsDetalle.length === 0 ? (
                        <tr><td colSpan={15} className="rep-table-empty">Sin detalle para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item, index) => (
                        <tr key={`${item.factura}-${item.pedido || 'na'}-${item.tipo_item || 'na'}-${index}`}>
                          <td>{item.fecha || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.caja || '-'}</td>
                          <td>{item.usuario || '-'}</td>
                          <td>{item.factura || '-'}</td>
                          <td>{item.pedido || '-'}</td>
                          <td>{item.tipo_item || '-'}</td>
                          <td className="rep-cell-truncate" title={item.item || '-'}>{compactText(item.item || '-', 34)}</td>
                          <td>{item.categoria || '-'}</td>
                          <td className="text-end">{item.cantidad ?? 0}</td>
                          <td className="text-end">L {money(item.precio_unitario ?? ((Number(item.cantidad || 0) > 0) ? (Number(item.subtotal || 0) / Number(item.cantidad || 1)) : 0))}</td>
                          <td className="text-end">L {money(item.subtotal)}</td>
                          <td className="text-end">L {money(item.descuento)}</td>
                          <td className="text-end">L {money(item.total)}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    
                  </table>
                </div>
                                <div className="rep-filter-chips" style={{ padding: '0.55rem 0.65rem', borderTop: '1px solid rgba(157, 150, 112, 0.24)' }}>
                  <span className="rep-filter-chip"><strong>Totales</strong></span>
                  <span className="rep-filter-chip"><strong>Cantidad total vendida:</strong> {ventasItemsTotals.cantidad}</span>
                  <span className="rep-filter-chip"><strong>Subtotal total:</strong> L {money(ventasItemsTotals.subtotal)}</span>
                  <span className="rep-filter-chip"><strong>Descuento total:</strong> L {money(ventasItemsTotals.descuento)}</span>
                  <span className="rep-filter-chip"><strong>Total neto:</strong> L {money(ventasItemsTotals.total)}</span>
                </div>
<div className="rep-mobile-sales-list" aria-label="Ventas por ítem en tarjetas">
                  {ventasItemsDetalle.length === 0 ? (
                    <div className="rep-mobile-sales-empty">Sin detalle para los filtros aplicados.</div>
                  ) : paginatedRows.map((item, index) => (
                    <article key={`ventas-items-mobile-${item.factura || index}`} className="rep-mobile-sales-card">
                      <div className="rep-mobile-sales-card__head">
                        <span className="rep-mobile-sales-card__icon" aria-hidden="true"><i className="bi bi-bag-check" /></span>
                        <strong title={item.item || '-'}>{compactText(item.item || '-', 40)}</strong>
                      </div>
                      <div className="rep-mobile-sales-card__body">
                        <div><span>Fecha / Factura</span><b>{`${item.fecha || '-'} / ${item.factura || '-'}`}</b></div>
                        <div><span>Sucursal / Caja / Usuario</span><b>{`${item.sucursal || '-'} / ${item.caja || '-'} / ${item.usuario || '-'}`}</b></div>
                        <div><span>Tipo / Categoría</span><b>{`${item.tipo_item || '-'} / ${item.categoria || '-'}`}</b></div>
                        <div><span>Cantidad / P. unitario</span><b>{`${item.cantidad ?? 0} / L ${money(item.precio_unitario ?? 0)}`}</b></div>
                        <div><span>Total</span><b>{`L ${money(item.total)}`}</b></div>
                        <div><span>Estado</span><b>{item.estado || '-'}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="inv-warehouse-moves__pagination inv-ins-pagination">
              <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
                {`Mostrando ${pageWindowStart}-${pageWindowEnd} de ${paginationTotal}`}
              </div>

              <div className="inv-warehouse-moves__pagination-controls">
                <button
                  type="button"
                  className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                  onClick={() => setListPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                  <span>Anterior</span>
                </button>

                <div className="inv-warehouse-moves__pagination-pages">
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={`rep-page-${pageNumber}`}
                      type="button"
                      className={`inv-warehouse-moves__page-number ${pageNumber === safePage ? 'is-active' : ''}`.trim()}
                      onClick={() => setListPage(pageNumber)}
                      aria-label={`Ir a la página ${pageNumber}`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                  {`Pagina ${safePage} de ${totalPages}`}
                </div>

                <button
                  type="button"
                  className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                  onClick={() => setListPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Página siguiente"
                >
                  <span>Siguiente</span>
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : null}

        {!loading && !error && !payload ? (
          <div className="rep-state rep-state--empty">
            <i className="bi bi-inbox" aria-hidden="true" />
            <span>No hay datos para mostrar con los filtros actuales.</span>
          </div>
        ) : null}
      </div>

      {showFiltersDrawer ? createPortal(
        <div className="reportes-page rep-overlay-root">
          <div className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop show" onClick={() => setShowFiltersDrawer(false)} aria-hidden="true" />
          <aside className="inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters show" role="dialog" aria-modal="true" aria-label="Filtros avanzados de reportes">
            <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
              <header className="inv-cat-create-hero inv-cat-filter-hero">
                <div className="inv-cat-create-hero__icon" aria-hidden="true">
                  <i className="bi bi-funnel" aria-hidden="true" />
                </div>
                <div className="inv-cat-create-hero__copy">
                  <p className="inv-cat-create-hero__kicker">Filtros</p>
                  <h3 className="inv-cat-create-hero__title inv-prod-drawer-title">Filtros avanzados</h3>
                </div>
                <div className="inv-cat-create-hero__chips">
                  <span className="inv-cat-create-hero__chip">
                    <i className="bi bi-sliders2" aria-hidden="true" />
                    {activeFiltersCount > 0 ? `${activeFiltersCount} filtros activos` : 'Sin filtros activos'}
                  </span>
                </div>
                <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close" onClick={() => setShowFiltersDrawer(false)} aria-label="Cerrar filtros">
                  <i className="bi bi-x-lg" />
                </button>
              </header>

              <div className="inv-cat-filter-grid">
                {(activeAllowedFilterKeys.includes('fecha_inicio') || activeAllowedFilterKeys.includes('fecha_fin')) ? (
                  <section className="inv-prod-drawer-section inv-cat-filter-card">
                    <h4>Periodo</h4>
                    <div className="rep-drawer__grid rep-drawer__grid--2">
                      {activeAllowedFilterKeys.includes('fecha_inicio') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-fecha-inicio">Fecha inicio</label>
                          <input id="rep-filter-fecha-inicio" type="date" value={draftFilters.fecha_inicio} onChange={(event) => setDraftFilters((prev) => ({ ...prev, fecha_inicio: event.target.value }))} />
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('fecha_fin') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-fecha-fin">Fecha fin</label>
                          <input id="rep-filter-fecha-fin" type="date" value={draftFilters.fecha_fin} onChange={(event) => setDraftFilters((prev) => ({ ...prev, fecha_fin: event.target.value }))} />
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <section className="inv-prod-drawer-section inv-cat-filter-card">
                  <h4>{activeContextTitle}</h4>
                  <div className="rep-drawer__grid rep-drawer__grid--2">
                    {activeAllowedFilterKeys.includes('sucursal') ? (
                      <div className="rep-field">
                        <label htmlFor="rep-filter-sucursal">Sucursal</label>
                        <select id="rep-filter-sucursal" value={draftFilters.sucursal} onChange={(event) => setDraftFilters((prev) => ({ ...prev, sucursal: event.target.value, caja: '' }))} disabled={(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1}>
                          {(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1 ? (<option value="">Cargando sucursales...</option>) : (sucursalOptions.map((option) => (<option key={`sucursal-${option.value || 'all'}`} value={option.value}>{option.label}</option>)))}
                        </select>
                      </div>
                    ) : null}
                    {activeAllowedFilterKeys.includes('caja') ? (
                      <div className="rep-field">
                        <label htmlFor="rep-filter-caja">Caja</label>
                        <select id="rep-filter-caja" value={draftFilters.caja} onChange={(event) => setDraftFilters((prev) => ({ ...prev, caja: event.target.value }))} disabled={(loadingCatalogs || loadingBaseCatalogs) && cajaOptions.length <= 1}>
                          {(loadingCatalogs || loadingBaseCatalogs) && cajaOptions.length <= 1 ? (<option value="">Cargando cajas...</option>) : (cajaOptions.map((option) => (<option key={`caja-${option.value || 'all'}`} value={option.value}>{option.label}</option>)))}
                        </select>
                      </div>
                    ) : null}
                    {activeAllowedFilterKeys.includes('almacen') ? (
                      <div className="rep-field">
                        <label htmlFor="rep-filter-almacen">Almacen</label>
                        <select id="rep-filter-almacen" value={draftFilters.almacen} onChange={(event) => setDraftFilters((prev) => ({ ...prev, almacen: event.target.value }))}>
                          {almacenControlledOptions.map((option) => (<option key={`almacen-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                        </select>
                      </div>
                    ) : null}
                    {activeAllowedFilterKeys.includes('usuario') ? (
                      <div className="rep-field">
                        <label htmlFor="rep-filter-usuario">Usuario</label>
                        <select id="rep-filter-usuario" value={draftFilters.usuario} onChange={(event) => setDraftFilters((prev) => ({ ...prev, usuario: event.target.value }))}>
                          {usuariosOptions.map((option) => (<option key={`usuario-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                        </select>
                      </div>
                    ) : null}
                    {activeAllowedFilterKeys.includes('estado') ? (
                      <div className="rep-field">
                        <label htmlFor="rep-filter-estado">Estado</label>
                        <select id="rep-filter-estado" value={draftFilters.estado} onChange={(event) => setDraftFilters((prev) => ({ ...prev, estado: event.target.value }))}>
                          {(isStockCriticoTab ? STOCK_ESTADO_OPTIONS : (isCajaCierresTab || isCajaDiferenciasTab ? estadoCajaOptions : estadoVentasOptions)).map((option) => (
                            <option key={`estado-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </section>
                {activeSpecificFilterKeys.length > 0 ? (
                  <section className="inv-prod-drawer-section inv-cat-filter-card">
                    <h4>Filtro específico</h4>
                    <div className="rep-drawer__grid rep-drawer__grid--2">
                      {activeAllowedFilterKeys.includes('metodo_pago') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-metodo-pago">Metodo pago</label>
                          <select id="rep-filter-metodo-pago" value={draftFilters.metodo_pago} onChange={(event) => setDraftFilters((prev) => ({ ...prev, metodo_pago: event.target.value }))}>
                            {metodoPagoOptions.map((option) => (<option key={`metodo-pago-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('tipo_descuento') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-tipo-descuento">Tipo descuento</label>
                          <select id="rep-filter-tipo-descuento" value={draftFilters.tipo_descuento} onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_descuento: event.target.value }))}>
                            {tipoDescuentoOptions.map((option) => (<option key={`tipo-descuento-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('tipo_diferencia') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-tipo-diferencia">Tipo diferencia</label>
                          <select id="rep-filter-tipo-diferencia" value={draftFilters.tipo_diferencia} onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_diferencia: event.target.value }))}>
                            {TIPO_DIFERENCIA_OPTIONS.map((option) => (<option key={`tipo-diferencia-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('tipo_item') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-tipo-item">Tipo item</label>
                          <select id="rep-filter-tipo-item" value={draftFilters.tipo_item} onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_item: event.target.value }))}>
                            {TIPO_ITEM_OPTIONS.map((option) => (<option key={`tipo-item-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('categoria') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-categoria">Categoria</label>
                          <select id="rep-filter-categoria" value={draftFilters.categoria} onChange={(event) => setDraftFilters((prev) => ({ ...prev, categoria: event.target.value }))}>
                            {categoriaControlledOptions.map((option) => (<option key={`categoria-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('item') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-item">Item</label>
                          <select id="rep-filter-item" value={draftFilters.item} onChange={(event) => setDraftFilters((prev) => ({ ...prev, item: event.target.value }))}>
                            {itemControlledOptions.map((option) => (<option key={`item-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('tipo_movimiento') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-tipo-movimiento">Tipo movimiento</label>
                          <select id="rep-filter-tipo-movimiento" value={draftFilters.tipo_movimiento} onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_movimiento: event.target.value }))}>
                            {TIPO_MOVIMIENTO_OPTIONS.map((option) => (<option key={`tipo-mov-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                      {activeAllowedFilterKeys.includes('solo_criticos') ? (
                        <div className="rep-field">
                          <label htmlFor="rep-filter-solo-criticos">Solo criticos</label>
                          <select id="rep-filter-solo-criticos" value={draftFilters.solo_criticos} onChange={(event) => setDraftFilters((prev) => ({ ...prev, solo_criticos: event.target.value }))}>
                            {SOLO_CRITICOS_OPTIONS.map((option) => (<option key={`solo-criticos-${option.value || 'all'}`} value={option.value}>{option.label}</option>))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
              <footer className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions">
                <button type="button" className="btn inv-prod-btn-subtle" onClick={() => setShowFiltersDrawer(false)} disabled={loading}>
                  Cerrar
                </button>
                <button type="button" className="btn inv-prod-btn-subtle" onClick={handleClearFilters} disabled={loading}>
                  Limpiar
                </button>
                <button type="button" className="btn inv-prod-btn-primary" onClick={handleApplyFilters} disabled={loading}>
                  Aplicar
                </button>
              </footer>
            </div>
          </aside>
        </div>,
        document.body
      ) : null}

      {showEmailModal ? createPortal(
        <div className="rep-mail-backdrop" role="dialog" aria-modal="true" aria-label="Enviar reporte por correo" onClick={closeEmailModal}>
          <div className="rep-mail-modal" onClick={(event) => event.stopPropagation()}>
            <header className="rep-mail-modal__head">
              <div className="rep-mail-modal__head-main">
                <span className="rep-mail-modal__icon" aria-hidden="true">
                  <i className="bi bi-envelope-paper-heart" />
                </span>
                <div>
                  <p className="rep-mail-modal__kicker">Reportes</p>
                  <h3 className="rep-mail-modal__title">Enviar por correo</h3>
                  <p className="rep-mail-modal__subtitle">Compartí este reporte con destinatarios autorizados.</p>
                </div>
              </div>
              <button type="button" className="rep-mail-modal__close" aria-label="Cerrar" onClick={closeEmailModal} disabled={sendingEmail}>
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="rep-mail-modal__body">
              <div className="rep-mail-modal__note">
                <i className="bi bi-shield-check" aria-hidden="true" />
                <p>El envío requiere confirmación explícita y respeta los permisos del reporte seleccionado.</p>
              </div>

              <div className="rep-field rep-field--full">
                <label htmlFor="rep-mail-destinatarios">Destinatarios</label>
                <textarea
                  id="rep-mail-destinatarios"
                  rows={3}
                  placeholder="correo1@dominio.com, correo2@dominio.com"
                  value={emailForm.destinatarios}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, destinatarios: event.target.value }))}
                />
                <small className="rep-mail-modal__helper">Separá varios correos con coma o salto de línea.</small>
              </div>

              <div className="rep-mail-modal__grid">
                <div className="rep-field">
                  <label>Formato</label>
                  <div className="rep-mail-format-toggle" role="radiogroup" aria-label="Formato de reporte">
                    <button
                      type="button"
                      className={`rep-mail-format-toggle__btn ${emailForm.formato === 'pdf' ? 'is-active' : ''}`.trim()}
                      onClick={() => setEmailForm((prev) => ({ ...prev, formato: 'pdf' }))}
                      aria-pressed={emailForm.formato === 'pdf'}
                    >
                      <i className="bi bi-file-earmark-pdf" aria-hidden="true" />
                      PDF
                    </button>
                    <button
                      type="button"
                      className={`rep-mail-format-toggle__btn ${emailForm.formato === 'excel' ? 'is-active' : ''}`.trim()}
                      onClick={() => setEmailForm((prev) => ({ ...prev, formato: 'excel' }))}
                      aria-pressed={emailForm.formato === 'excel'}
                    >
                      <i className="bi bi-file-earmark-spreadsheet" aria-hidden="true" />
                      Excel
                    </button>
                  </div>
                </div>

                <div className="rep-field">
                  <label htmlFor="rep-mail-asunto">Asunto</label>
                  <input
                    id="rep-mail-asunto"
                    type="text"
                    value={emailForm.asunto}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, asunto: event.target.value }))}
                  />
                </div>
              </div>

              <div className="rep-field rep-field--full">
                <label htmlFor="rep-mail-mensaje">Mensaje</label>
                <textarea
                  id="rep-mail-mensaje"
                  rows={3}
                  value={emailForm.mensaje}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, mensaje: event.target.value }))}
                />
              </div>

              <label className="rep-mail-confirm">
                <input
                  type="checkbox"
                  checked={emailForm.confirmado}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, confirmado: event.target.checked }))}
                />
                <span>Confirmo que deseo enviar este reporte por correo.</span>
              </label>
            </div>

            <footer className="rep-mail-modal__footer">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={closeEmailModal} disabled={sendingEmail}>
                Cancelar
              </button>
              <button type="button" className="btn inv-prod-btn-primary" onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </footer>
          </div>
        </div>,
        document.body
      ) : null}

      {notice.show ? createPortal(
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${notice.variant || 'success'}`}>
            <div className="inv-toast-icon">
              <i className={getToastIconClass(notice.variant)} />
            </div>

            <div className="inv-toast-content">
              <div className="inv-toast-title">{notice.title}</div>
              <div className="inv-toast-message">{notice.message}</div>
            </div>

            <button
              type="button"
              className="inv-toast-close"
              onClick={() => setNotice((prev) => ({ ...prev, show: false }))}
              aria-label="Cerrar notificación"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div className="inv-toast-progress" />
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default Reportes;
