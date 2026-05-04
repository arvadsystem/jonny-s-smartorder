import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { usePermisos } from '../../context/PermisosContext';
import {
  MODULE_PRIMARY_PERMISSION,
  getAllowedTabs
} from '../../utils/permissions';
import { reportesService } from '../../services/reportesService';

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

const makeCatalogOptions = (rows, { idKeys = [], labelKeys = [], allLabel = 'Todos' }) => {
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

    if (!resolvedValue && resolvedLabel) {
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
      { label: 'Subtotal', value: `L ${money(kpis.subtotal)}`, icon: 'bi bi-wallet2', tone: 'is-neutral' },
      { label: 'Descuentos', value: `L ${money(kpis.descuentos)}`, icon: 'bi bi-tags', tone: 'is-soft' },
      { label: 'Impuestos', value: `L ${money(kpis.impuestos)}`, icon: 'bi bi-percent', tone: 'is-soft' },
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

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);
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

  const categoryShellRef = useRef(null);
  const featuresRef = useRef(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('reportes', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );
  const allowedTabSet = useMemo(() => new Set(allowedTabs.map((item) => item.key)), [allowedTabs]);

  const canExportExcel = useMemo(
    () => isSuperAdmin || (Array.isArray(permisos) && permisos.includes('REPORTES_EXPORTAR_EXCEL')),
    [isSuperAdmin, permisos]
  );
  const canExportPdf = useMemo(
    () => isSuperAdmin || (Array.isArray(permisos) && permisos.includes('REPORTES_EXPORTAR_PDF')),
    [isSuperAdmin, permisos]
  );
  const canSendEmail = useMemo(
    () => isSuperAdmin || (Array.isArray(permisos) && permisos.includes('REPORTES_ENVIAR_CORREO')),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0]?.key || null;
  const rawTab = String(searchParams.get('tab') || fallbackTab || '').toLowerCase();
  const normalizedTab = REPORT_KEYS.includes(rawTab) ? rawTab : fallbackTab;
  const activeTab = allowedTabs.some((tab) => tab.key === normalizedTab) ? normalizedTab : fallbackTab;

  const activeReport = REPORT_META[activeTab] || null;

  const groupedTabs = useMemo(
    () =>
      REPORT_GROUPS.map((group) => ({
        ...group,
        tabs: group.tabs.filter((tabKey) => allowedTabSet.has(tabKey))
      })).filter((group) => group.tabs.length > 0),
    [allowedTabSet]
  );

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
    if (showEmailModal || showFiltersDrawer) return;

    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (categoryShellRef.current && !categoryShellRef.current.contains(target)) {
        setOpenCategory(null);
      }

      if (featuresRef.current && !featuresRef.current.contains(target)) {
        setShowFeaturesMenu(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showEmailModal, showFiltersDrawer]);

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
      if (showFeaturesMenu) {
        setShowFeaturesMenu(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showEmailModal, sendingEmail, showFiltersDrawer, showFeaturesMenu]);

  const showToast = (title, message, variant = 'success') => {
    setNotice({ show: true, title, message, variant });
  };

  const runReport = async (tabKey, customFilters = filters) => {
    const fetcher = REPORT_HANDLERS[tabKey];
    if (!fetcher) return;

    setLoading(true);
    setError('');

    try {
      const data = await fetcher(customFilters);
      setPayload(data || null);
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

  const handleSelectTab = (tabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabKey);
    setSearchParams(next);
    setOpenCategory(null);
  };

  const handleClearFilters = async () => {
    const reset = { ...INITIAL_FILTERS };
    setDraftFilters(reset);
    setFilters(reset);
    setShowFiltersDrawer(false);
    await runReport(activeTab, reset);
  };

  const handleApplyFilters = async () => {
    const next = { ...draftFilters };
    setFilters(next);
    setShowFiltersDrawer(false);
    await runReport(activeTab, next);
  };

  const handleOpenFilters = () => {
    setDraftFilters(filters);
    setShowFiltersDrawer(true);
    setShowFeaturesMenu(false);
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
    setShowFeaturesMenu(false);
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

  if (permisosLoading) return null;

  if (!fallbackTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.reportes}
        detalle="No tienes acceso a ningún reporte habilitado."
      />
    );
  }

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

  const sourceRows = [];
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

  const sucursalOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_sucursal', 'sucursal_id'],
    labelKeys: ['nombre_sucursal', 'sucursal'],
    allLabel: 'Todas las sucursales'
  });

  const cajaOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_caja'],
    labelKeys: ['codigo_caja', 'nombre_caja', 'caja'],
    allLabel: 'Todas las cajas'
  });

  const almacenOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_almacen'],
    labelKeys: ['nombre_almacen', 'almacen'],
    allLabel: 'Todos los almacenes'
  });

  const usuarioOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_usuario'],
    labelKeys: ['usuario', 'responsable', 'usuario_cierre', 'nombre_usuario'],
    allLabel: 'Todos los usuarios'
  });

  const categoriaOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_categoria', 'id_categoria_producto', 'id_categoria_insumo'],
    labelKeys: ['categoria', 'nombre_categoria'],
    allLabel: 'Todas las categorías'
  });

  const estadoOptions = makeCatalogOptions(sourceRows, {
    idKeys: [],
    labelKeys: ['estado', 'estado_cierre', 'estado_resolucion'],
    allLabel: 'Todos los estados'
  });

  const tipoDescuentoOptions = makeCatalogOptions(sourceRows, {
    idKeys: ['id_tipo_descuento'],
    labelKeys: ['tipo_descuento'],
    allLabel: 'Todos los tipos'
  });

  const dynamicTipoItemOptions = makeCatalogOptions(sourceRows, {
    idKeys: [],
    labelKeys: ['tipo_item', 'item_tipo'],
    allLabel: 'Todos'
  });

  const tipoItemOptions = [
    { value: '', label: 'Todos' },
    { value: 'producto', label: 'Producto' },
    { value: 'combo', label: 'Combo' },
    { value: 'receta', label: 'Receta' },
    { value: 'insumo', label: 'Insumo' }
  ];

  dynamicTipoItemOptions.slice(1).forEach((option) => {
    if (!tipoItemOptions.some((base) => base.value === option.value)) {
      tipoItemOptions.push(option);
    }
  });

  const tipoDiferenciaOptions = [
    { value: '', label: 'Todos' },
    { value: 'faltante', label: 'Faltante' },
    { value: 'sobrante', label: 'Sobrante' }
  ];

  const soloCriticosOptions = [
    { value: '', label: 'Todos' },
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' }
  ];

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

  return (
    <div className="container-fluid p-3 reportes-page">
      <div className="rep-shell-card rep-shell-card--header" ref={categoryShellRef}>
        <div className="rep-shell-categories" role="tablist" aria-label="Categorías de reportes">
          {groupedTabs.map((group) => {
            const isActiveCategory = activeReport?.category === group.key;
            const isOpen = openCategory === group.key;

            return (
              <button
                key={group.key}
                type="button"
                className={`rep-shell-category-btn ${isActiveCategory ? 'is-active' : ''}`}
                onClick={() => setOpenCategory((current) => (current === group.key ? null : group.key))}
                aria-expanded={isOpen}
              >
                <i className={group.icon} aria-hidden="true" />
                <span>{group.label}</span>
                <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {openCategory ? (
          <div className="rep-shell-submenu" role="menu" aria-label="Submódulos de reportes">
            {(groupedTabs.find((group) => group.key === openCategory)?.tabs || []).map((tabKey) => {
              const meta = REPORT_META[tabKey];
              const isActive = tabKey === activeTab;

              return (
                <button
                  key={tabKey}
                  type="button"
                  className={`rep-shell-submenu-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleSelectTab(tabKey)}
                >
                  <span className="rep-shell-submenu-item__icon" aria-hidden="true">
                    <i className={meta?.icon || 'bi bi-file-earmark-text'} />
                  </span>
                  <span>{meta?.label || tabKey}</span>
                  {isActive ? <span className="rep-shell-submenu-item__dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="rep-shell-card rep-module-head">
        <div className="rep-module-head__title-wrap">
          <div className="rep-module-head__title-row">
            <i className={`${activeReport?.icon || 'bi bi-file-bar-graph'} rep-module-head__icon`} aria-hidden="true" />
            <h2 className="rep-module-head__title">{activeReport?.label || 'Reportes'}</h2>
          </div>
        </div>

        <div className="rep-module-head__actions">
          <button
            type="button"
            className="btn inv-prod-btn-outline rep-action-btn"
            onClick={handleOpenFilters}
          >
            <i className="bi bi-funnel" aria-hidden="true" />
            <span>Filtros</span>
          </button>

          <div className="rep-functionalities" ref={featuresRef}>
            <button
              type="button"
              className="btn inv-prod-btn-subtle rep-action-btn"
              onClick={() => setShowFeaturesMenu((current) => !current)}
              aria-expanded={showFeaturesMenu}
            >
              <i className="bi bi-grid-3x3-gap" aria-hidden="true" />
              <span>Funcionalidades</span>
              <i className={`bi ${showFeaturesMenu ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
            </button>

            {showFeaturesMenu ? (
              <div className="rep-functionalities-menu" role="menu" aria-label="Acciones de reporte">
                {canExportExcel ? (
                  <button
                    type="button"
                    className="rep-functionalities-menu__item"
                    onClick={handleExportExcel}
                    disabled={exporting || loading}
                  >
                    <i className="bi bi-filetype-csv" aria-hidden="true" />
                    <span>{exporting ? 'Exportando CSV/Excel...' : 'Exportar CSV/Excel'}</span>
                  </button>
                ) : null}

                {canExportPdf ? (
                  <button
                    type="button"
                    className="rep-functionalities-menu__item"
                    onClick={handleExportPdf}
                    disabled={exportingPdf || loading}
                  >
                    <i className="bi bi-filetype-pdf" aria-hidden="true" />
                    <span>{exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}</span>
                  </button>
                ) : null}

                {canSendEmail ? (
                  <button
                    type="button"
                    className="rep-functionalities-menu__item"
                    onClick={openEmailModal}
                    disabled={sendingEmail || loading}
                  >
                    <i className="bi bi-envelope-paper" aria-hidden="true" />
                    <span>Enviar por correo</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="btn inv-prod-btn-primary rep-action-btn"
            onClick={() => runReport(activeTab, filters)}
            disabled={loading}
          >
            <i className="bi bi-search" aria-hidden="true" />
            <span>{loading ? 'Generando...' : 'Generar reporte'}</span>
          </button>

          <button
            type="button"
            className="btn inv-prod-btn-subtle rep-action-btn"
            onClick={handleClearFilters}
            disabled={loading}
          >
            <i className="bi bi-eraser" aria-hidden="true" />
            <span>Limpiar filtros</span>
          </button>
        </div>
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
                        <tr><td colSpan={3} className="rep-table-empty">Sin datos diarios.</td></tr>
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
                  className="inv-warehouse-moves__pagination-btn"
                  onClick={() => setListPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  aria-label="Pagina anterior"
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                  <span>Anterior</span>
                </button>

                <div className="inv-warehouse-moves__pagination-pages">
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={`rep-page-${pageNumber}`}
                      type="button"
                      className={`inv-warehouse-moves__pagination-page ${pageNumber === safePage ? 'is-active' : ''}`}
                      onClick={() => setListPage(pageNumber)}
                      aria-label={`Ir a la pagina ${pageNumber}`}
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
                  className="inv-warehouse-moves__pagination-btn"
                  onClick={() => setListPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Pagina siguiente"
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
        <div className="reportes-page">
          <div className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop rep-drawer-backdrop show" onClick={() => setShowFiltersDrawer(false)} aria-hidden="true" />
          <aside className="inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters rep-drawer show" role="dialog" aria-modal="true" aria-label="Filtros de reportes">
            <div className="inv-prod-drawer-body inv-cat-v2__drawer-body rep-drawer__body">
              <header className="inv-cat-create-hero inv-cat-filter-hero rep-drawer__head">
                <div className="inv-cat-create-hero__icon">
                  <i className="bi bi-funnel" aria-hidden="true" />
                </div>
                <div className="inv-cat-create-hero__copy">
                  <p className="inv-cat-create-hero__kicker rep-drawer__kicker">Vista De Filtros</p>
                  <h3 className="inv-cat-create-hero__title inv-prod-drawer-title rep-drawer__title">Ajusta estado y contexto del reporte</h3>
                </div>
                <div className="inv-cat-create-hero__chips">
                  <span className="inv-cat-create-hero__chip">
                    <i className="bi bi-sliders2" aria-hidden="true" />
                    {activeFiltersCount > 0 ? `${activeFiltersCount} filtros activos` : 'Sin filtros activos'}
                  </span>
                </div>
                <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close rep-drawer__close" onClick={() => setShowFiltersDrawer(false)} aria-label="Cerrar filtros">
                  <i className="bi bi-x-lg" />
                </button>
              </header>

              <div className="inv-cat-filter-grid rep-drawer-grid">
                <section className="inv-cat-filter-card rep-drawer__section">
                  <h4>Periodo</h4>
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

                <section className="inv-cat-filter-card rep-drawer__section">
                  <h4>Contexto</h4>
                  <div className="rep-drawer__grid rep-drawer__grid--2">
                    <div className="rep-field">
                      <label htmlFor="rep-filter-sucursal">Sucursal</label>
                      <select
                        id="rep-filter-sucursal"
                        value={draftFilters.sucursal}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, sucursal: event.target.value }))}
                      >
                        {sucursalOptions.map((option) => (
                          <option key={`sucursal-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-caja">Caja</label>
                      <select
                        id="rep-filter-caja"
                        value={draftFilters.caja}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, caja: event.target.value }))}
                      >
                        {cajaOptions.map((option) => (
                          <option key={`caja-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-almacen">Almacén</label>
                      <select
                        id="rep-filter-almacen"
                        value={draftFilters.almacen}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, almacen: event.target.value }))}
                      >
                        {almacenOptions.map((option) => (
                          <option key={`almacen-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-usuario">Usuario</label>
                      <select
                        id="rep-filter-usuario"
                        value={draftFilters.usuario}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, usuario: event.target.value }))}
                      >
                        {usuarioOptions.map((option) => (
                          <option key={`usuario-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-estado">Estado</label>
                      <select
                        id="rep-filter-estado"
                        value={draftFilters.estado}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, estado: event.target.value }))}
                      >
                        {estadoOptions.map((option) => (
                          <option key={`estado-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-categoria">Categoría</label>
                      <select
                        id="rep-filter-categoria"
                        value={draftFilters.categoria}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, categoria: event.target.value }))}
                      >
                        {categoriaOptions.map((option) => (
                          <option key={`categoria-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="inv-cat-filter-card rep-drawer__section">
                  <h4>Filtros específicos</h4>
                  <div className="rep-drawer__grid rep-drawer__grid--2">
                    <div className="rep-field">
                      <label htmlFor="rep-filter-tipo-diferencia">Tipo diferencia</label>
                      <select
                        id="rep-filter-tipo-diferencia"
                        value={draftFilters.tipo_diferencia}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_diferencia: event.target.value }))}
                      >
                        {tipoDiferenciaOptions.map((option) => (
                          <option key={`diferencia-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-tipo-descuento">Tipo descuento</label>
                      <select
                        id="rep-filter-tipo-descuento"
                        value={draftFilters.tipo_descuento}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_descuento: event.target.value }))}
                      >
                        {tipoDescuentoOptions.map((option) => (
                          <option key={`tipo-descuento-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-tipo-item">Tipo ítem</label>
                      <select
                        id="rep-filter-tipo-item"
                        value={draftFilters.tipo_item}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, tipo_item: event.target.value }))}
                      >
                        {tipoItemOptions.map((option) => (
                          <option key={`tipo-item-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rep-field">
                      <label htmlFor="rep-filter-solo-criticos">Solo críticos</label>
                      <select
                        id="rep-filter-solo-criticos"
                        value={draftFilters.solo_criticos}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, solo_criticos: event.target.value }))}
                      >
                        {soloCriticosOptions.map((option) => (
                          <option key={`solo-criticos-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              </div>
              <footer className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions rep-drawer__footer">
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
              </div>

              <div className="rep-mail-modal__grid">
                <div className="rep-field">
                  <label htmlFor="rep-mail-formato">Formato</label>
                  <select
                    id="rep-mail-formato"
                    value={emailForm.formato}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, formato: event.target.value }))}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
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

