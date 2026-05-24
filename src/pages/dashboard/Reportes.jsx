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
  tipo_diferencia: '',
  tipo_descuento: '',
  tipo_item: '',
  solo_criticos: '',
  categoria: '',
  estado: ''
};

const FILTER_LABELS = Object.freeze({
  fecha_inicio: 'Fecha inicio',
  fecha_fin: 'Fecha fin',
  sucursal: 'Sucursal',
  almacen: 'Almacén',
  caja: 'Caja',
  usuario: 'Usuario',
  tipo_diferencia: 'Tipo diferencia',
  tipo_descuento: 'Tipo descuento',
  tipo_item: 'Tipo ítem',
  solo_criticos: 'Solo críticos',
  categoria: 'Categoría',
  estado: 'Estado'
});

const sanitizeAdvancedFiltersForDrawer = (source = INITIAL_FILTERS) => ({
  ...source,
  almacen: '',
  usuario: '',
  tipo_diferencia: '',
  tipo_descuento: '',
  tipo_item: '',
  solo_criticos: '',
  categoria: '',
  estado: ''
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const REPORTS_PAGE_SIZE = 10;

const money = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

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
      { label: 'Total ventas', value: `L ${money(kpis.total_ventas)}`, icon: 'bi bi-cash-stack', tone: 'is-ok' },
      { label: 'Cantidad ventas', value: kpis.cantidad_ventas || 0, icon: 'bi bi-receipt', tone: 'is-neutral' },
      { label: 'Total neto', value: `L ${money(kpis.total_neto)}`, icon: 'bi bi-bar-chart-line', tone: 'is-ok' },
      { label: 'Promedio venta', value: `L ${money(kpis.promedio_por_venta)}`, icon: 'bi bi-graph-up', tone: 'is-neutral' },
      { label: 'Canceladas/Anuladas', value: kpis.ventas_canceladas_o_anuladas || 0, icon: 'bi bi-slash-circle', tone: 'is-alert' }
    ];
  }

  if (tab === 'ventas-metodos-pago') {
    return [
      { label: 'Total general', value: `L ${money(kpis.total_general)}`, icon: 'bi bi-cash-stack', tone: 'is-ok' },
      { label: 'Total ventas', value: kpis.total_ventas || 0, icon: 'bi bi-receipt-cutoff', tone: 'is-neutral' },
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
      { label: 'Diferencias', value: kpis.cantidad_diferencias || 0, icon: 'bi bi-exclamation-diamond', tone: 'is-alert' },
      { label: 'Total absoluto', value: `L ${money(kpis.total_diferencia_absoluta)}`, icon: 'bi bi-calculator', tone: 'is-soft' },
      { label: 'Total faltantes', value: `L ${money(kpis.total_faltantes)}`, icon: 'bi bi-arrow-down-circle', tone: 'is-alert' },
      { label: 'Total sobrantes', value: `L ${money(kpis.total_sobrantes)}`, icon: 'bi bi-arrow-up-circle', tone: 'is-ok' },
      { label: 'Cantidad faltantes', value: kpis.cantidad_faltantes || 0, icon: 'bi bi-dash-circle', tone: 'is-alert' },
      { label: 'Cantidad sobrantes', value: kpis.cantidad_sobrantes || 0, icon: 'bi bi-plus-circle', tone: 'is-ok' }
    ];
  }

  if (tab === 'inventario-stock-critico') {
    return [
      { label: 'Items revisados', value: kpis.total_items_revisados || 0, icon: 'bi bi-list-check', tone: 'is-neutral' },
      { label: 'Total críticos', value: kpis.total_criticos || 0, icon: 'bi bi-exclamation-triangle', tone: 'is-alert' },
      { label: 'Agotados', value: kpis.total_agotados || 0, icon: 'bi bi-x-octagon', tone: 'is-alert' },
      { label: 'Bajo stock', value: kpis.total_stock_bajo || 0, icon: 'bi bi-thermometer-half', tone: 'is-soft' },
      { label: 'Productos críticos', value: kpis.productos_criticos || 0, icon: 'bi bi-box-seam', tone: 'is-ok' },
      { label: 'Insumos críticos', value: kpis.insumos_criticos || 0, icon: 'bi bi-box2-heart', tone: 'is-neutral' }
    ];
  }

  if (tab === 'inventario-kardex') {
    return [
      { label: 'Total movimientos', value: kpis.total_movimientos || 0, icon: 'bi bi-arrow-left-right', tone: 'is-neutral' },
      { label: 'Entradas', value: kpis.entradas || 0, icon: 'bi bi-arrow-down-right', tone: 'is-ok' },
      { label: 'Salidas', value: kpis.salidas || 0, icon: 'bi bi-arrow-up-right', tone: 'is-alert' },
      { label: 'Ajustes/Otros', value: kpis.ajustes_otros || 0, icon: 'bi bi-sliders', tone: 'is-soft' },
      { label: 'Items únicos', value: kpis.items_unicos || 0, icon: 'bi bi-hash', tone: 'is-neutral' }
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
        const [sucursalesResult, cajasResult] = await Promise.allSettled([
          sucursalesService.getAll(),
          cajasService.listCajaCatalogo({ incluir_inactivas: false })
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

    setLoading(true);
    setError('');

    try {
      const data = await fetcher(customFilters);
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
    runReport(activeTab, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!allowedTabs.length) return;
    refreshFilterCatalogs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs]);

  const handleClearFilters = async () => {
    const reset = { ...INITIAL_FILTERS };
    setDraftFilters(reset);
    setFilters(reset);
    setShowFiltersDrawer(false);
    await runReport(activeTab, reset);
    await refreshFilterCatalogs(reset);
  };

  const handleApplyFilters = async () => {
    const next = sanitizeAdvancedFiltersForDrawer(draftFilters);
    setFilters(next);
    setShowFiltersDrawer(false);
    await runReport(activeTab, next);
    await refreshFilterCatalogs(next);
  };

  const handleOpenFilters = () => {
    setDraftFilters(sanitizeAdvancedFiltersForDrawer(filters));
    setShowFiltersDrawer(true);
    if (catalogRows.length === 0 && !loadingCatalogs) {
      refreshFilterCatalogs(filters);
    }
  };

  const handleExportExcel = async () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    if (!reporte) return;

    setExporting(true);
    setError('');

    try {
      const { blob, filename } = await reportesService.exportExcel({ reporte, filters });
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

    setExportingPdf(true);
    setError('');

    try {
      const { blob, filename } = await reportesService.exportPdf({ reporte, filters });
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
        filtros: filters
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
  const ventasItemsResumen = Array.isArray(payload?.data?.resumen_items) ? payload.data.resumen_items : [];
  const ventasItemsDetalle = Array.isArray(payload?.data?.detalle) ? payload.data.detalle : [];

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

  const activeFilterChips = Object.entries(filters)
    .filter(([, value]) => String(value ?? '').trim() !== '')
    .map(([key, value]) => ({ key, label: FILTER_LABELS[key] || key, value: formatFilterDisplayValue(key, value) }));
  const activeFiltersCount = activeFilterChips.length;

  const kpiCards = getKpiCards(activeTab, kpis);

  const isVentasResumenTab = activeTab === 'ventas-resumen';
  const isVentasMetodosTab = activeTab === 'ventas-metodos-pago';
  const isCajaCierresTab = activeTab === 'caja-cierres';
  const isCajaDiferenciasTab = activeTab === 'caja-diferencias';
  const isStockCriticoTab = activeTab === 'inventario-stock-critico';
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
                          <th className="text-end">Ventas</th>
                          <th className="text-end">Total neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serieDiaria.length === 0 ? (
                          <tr><td colSpan={3} className="rep-table-empty">Sin datos para los filtros seleccionados.</td></tr>
                        ) : paginatedRows.map((item) => (
                          <tr key={item.fecha}>
                            <td>{item.fecha}</td>
                            <td className="text-end">{item.cantidad_ventas}</td>
                            <td className="text-end">L {money(item.total_neto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                        <th className="text-end">Ventas</th>
                        <th className="text-end">Total vendido</th>
                        <th className="text-end">%</th>
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
                        <th className="text-end">Esperado</th>
                        <th className="text-end">Contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierresCaja.length === 0 ? (
                        <tr><td colSpan={8} className="rep-table-empty">Sin cierres para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={item.id_cierre_caja}>
                          <td>{item.fecha_cierre || item.fecha_apertura || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.codigo_caja ? `${item.codigo_caja} - ${item.caja || ''}` : (item.caja || '-')}</td>
                          <td>{item.responsable || item.usuario_cierre || '-'}</td>
                          <td className="text-end">L {money(item.total_esperado)}</td>
                          <td className="text-end">L {money(item.total_contado)}</td>
                          <td className="text-end">L {money(item.diferencia)}</td>
                          <td>{item.estado_cierre || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        <th className="text-end">Esperado</th>
                        <th className="text-end">Contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Tipo</th>
                        <th>Resolución</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diferenciasCaja.length === 0 ? (
                        <tr><td colSpan={10} className="rep-table-empty">Sin diferencias para los filtros aplicados.</td></tr>
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
                          <td>{item.estado_resolucion || '-'}</td>
                          <td>{item.observacion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Stock mínimo</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCriticoItems.length === 0 ? (
                        <tr><td colSpan={9} className="rep-table-empty">Sin ítems para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item, index) => (
                        <tr key={`${item.tipo_item}-${item.nombre}-${item.almacen}-${index}`}>
                          <td>{item.tipo_item || '-'}</td>
                          <td>{item.nombre || '-'}</td>
                          <td>{item.categoria || '-'}</td>
                          <td>{item.almacen || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td className="text-end">{item.cantidad_actual ?? 0}</td>
                          <td className="text-end">{item.stock_minimo ?? 0}</td>
                          <td className="text-end">{item.diferencia_minimo ?? 0}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        <th>Tipo mov.</th>
                        <th>Tipo ítem</th>
                        <th>Ítem</th>
                        <th>Almacén</th>
                        <th>Sucursal</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Saldo antes</th>
                        <th className="text-end">Saldo después</th>
                        <th>Referencia</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexMovimientos.length === 0 ? (
                        <tr><td colSpan={11} className="rep-table-empty">Sin movimientos para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item) => (
                        <tr key={item.id_movimiento}>
                          <td>{item.fecha_mov || '-'}</td>
                          <td>{item.tipo || '-'}</td>
                          <td>{item.item_tipo || '-'}</td>
                          <td>{item.item_nombre || '-'}</td>
                          <td>{item.nombre_almacen || '-'}</td>
                          <td>{item.nombre_sucursal || '-'}</td>
                          <td className="text-end">{item.cantidad ?? 0}</td>
                          <td className="text-end">{item.saldo_antes ?? 0}</td>
                          <td className="text-end">{item.saldo_despues ?? 0}</td>
                          <td>{item.ref_origen ? `${item.ref_origen}${item.id_ref ? ` #${item.id_ref}` : ''}` : '-'}</td>
                          <td>{item.descripcion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        <th className="text-end">Descuento</th>
                        <th className="text-end">Subtotal línea</th>
                        <th className="text-end">Total línea</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descuentosDetalle.length === 0 ? (
                        <tr><td colSpan={12} className="rep-table-empty">Sin descuentos aplicados para los filtros.</td></tr>
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
                          <td className="text-end">L {money(item.descuento)}</td>
                          <td className="text-end">L {money(item.subtotal_linea)}</td>
                          <td className="text-end">L {money(item.total_linea)}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        <th className="text-end">Subtotal</th>
                        <th className="text-end">Descuento</th>
                        <th className="text-end">Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasItemsDetalle.length === 0 ? (
                        <tr><td colSpan={14} className="rep-table-empty">Sin detalle para los filtros aplicados.</td></tr>
                      ) : paginatedRows.map((item, index) => (
                        <tr key={`${item.factura}-${item.pedido || 'na'}-${item.tipo_item || 'na'}-${index}`}>
                          <td>{item.fecha || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.caja || '-'}</td>
                          <td>{item.usuario || '-'}</td>
                          <td>{item.factura || '-'}</td>
                          <td>{item.pedido || '-'}</td>
                          <td>{item.tipo_item || '-'}</td>
                          <td>{item.item || '-'}</td>
                          <td>{item.categoria || '-'}</td>
                          <td className="text-end">{item.cantidad ?? 0}</td>
                          <td className="text-end">L {money(item.subtotal)}</td>
                          <td className="text-end">L {money(item.descuento)}</td>
                          <td className="text-end">L {money(item.total)}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <section className="inv-prod-drawer-section inv-cat-filter-card">
                  <h4>Período</h4>
                  <div className="rep-drawer__grid rep-drawer__grid--2">
                    <div className="rep-field">
                      <label htmlFor="rep-filter-fecha-inicio">Fecha inicio</label>
                      <input
                        id="rep-filter-fecha-inicio"
                        type="date"
                        value={draftFilters.fecha_inicio}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
                      />
                    </div>
                    <div className="rep-field">
                      <label htmlFor="rep-filter-fecha-fin">Fecha fin</label>
                      <input
                        id="rep-filter-fecha-fin"
                        type="date"
                        value={draftFilters.fecha_fin}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, fecha_fin: event.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section className="inv-prod-drawer-section inv-cat-filter-card">
                  <h4>Contexto</h4>
                  <div className="rep-drawer__grid rep-drawer__grid--2">
                    <div className="rep-field">
                      <label htmlFor="rep-filter-sucursal">Sucursal</label>
                      <select
                        id="rep-filter-sucursal"
                        value={draftFilters.sucursal}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, sucursal: event.target.value, caja: '' }))
                        }
                        disabled={(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1}
                      >
                        {(loadingCatalogs || loadingBaseCatalogs) && sucursalOptions.length <= 1 ? (
                          <option value="">Cargando sucursales...</option>
                        ) : (
                          sucursalOptions.map((option) => (
                            <option key={`sucursal-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-caja">Caja</label>
                      <select
                        id="rep-filter-caja"
                        value={draftFilters.caja}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, caja: event.target.value }))}
                        disabled={(loadingCatalogs || loadingBaseCatalogs) && cajaOptions.length <= 1}
                      >
                        {(loadingCatalogs || loadingBaseCatalogs) && cajaOptions.length <= 1 ? (
                          <option value="">Cargando cajas...</option>
                        ) : (
                          cajaOptions.map((option) => (
                            <option key={`caja-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </section>
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


