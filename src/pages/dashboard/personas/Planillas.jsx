import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import sucursalesService from '../../../services/sucursalesService';
import planillasService from '../../../services/planillasService';
import PlanillasHeader from './components/planillas/PlanillasHeader';
import PlanillasResumenCards from './components/planillas/PlanillasResumenCards';
import PlanillasTable from './components/planillas/PlanillasTable';
import {
  PlanillasLoadingState,
  PlanillasErrorState,
  PlanillasEmptyState
} from './components/planillas/PlanillasStates';
import PlanillaDetallePanel from './components/planillas/PlanillaDetallePanel';
import PlanillaMovimientosModal from './components/planillas/PlanillaMovimientosModal';
import PlanillaMovimientoFormModal from './components/planillas/PlanillaMovimientoFormModal';
import PlanillaAdelantosModal from './components/planillas/PlanillaAdelantosModal';
import PlanillaAuditoriaModal from './components/planillas/PlanillaAuditoriaModal';
import PlanillaHorasExtraModal from './components/planillas/PlanillaHorasExtraModal';
import PlanillaAdelantosPendientesModal from './components/planillas/PlanillaAdelantosPendientesModal';
import PayrollFilters from './components/planillas/PayrollFilters';
import ExportModal from './components/planillas/ExportModal';

const LIST_LIMIT = 20;
const DETAIL_LIMIT = 10;
const DETAIL_FETCH_LIMIT = 2000;

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const toText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizeListResponse = (response) => {
  if (Array.isArray(response)) {
    return { items: response, total: response.length, page: 1, limit: response.length || 1 };
  }

  const items = Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.rows)
        ? response.rows
        : [];

  return {
    items,
    total: Number(response?.total ?? items.length) || items.length,
    page: Number(response?.page ?? 1) || 1,
    limit: Number(response?.limit ?? Math.max(items.length, 1)) || Math.max(items.length, 1)
  };
};

const normalizeResumen = (response) => {
  if (!response) return {};
  if (response.data && typeof response.data === 'object') return response.data;
  if (Array.isArray(response.items) && response.items[0]) return response.items[0];
  if (Array.isArray(response) && response[0]) return response[0];
  if (typeof response === 'object') return response;
  return {};
};

const normalizeHorasExtraResponse = (response) => {
  const parsed = normalizeListResponse(response);
  const summary =
    (response && typeof response === 'object' && (response.summary || response.resumen || response.totales)) || {};
  return {
    items: parsed.items,
    total: parsed.total,
    summary
  };
};

const normalizeSucursalId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMoney = (value) => {
  const amount = safeNumber(value, 0);
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toHoursNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatHoursLabel = (value) => {
  const hours = toHoursNumber(value);
  const hasDecimals = Math.abs(hours % 1) > 0.001;
  return `${hours.toLocaleString('es-HN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}h`;
};

const formatFriendlyDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return 'Fecha no disponible';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeMovimientoTipo = (row = {}) =>
  toText(row.tipo_movimiento || row.tipo || row.origen_movimiento, '').toLowerCase();

const isHorasExtraMovimiento = (row = {}) => {
  const tipo = normalizeMovimientoTipo(row);
  return (
    row.es_monetario === false ||
    row.origen_movimiento === 'HORAS_EXTRA' ||
    tipo.includes('hora') ||
    tipo.includes('h.e') ||
    tipo.includes('tiempo')
  );
};

const formatMovimientoMonto = (row = {}) => {
  if (isHorasExtraMovimiento(row)) {
    return formatHoursLabel(row.monto_horas ?? row.horas ?? row.monto);
  }
  return formatMoney(row.monto);
};

const formatMovimientoFecha = (row = {}) => toText(row.fecha_registro || row.fecha || row.fecha_compensacion, '-');

const extractEmpleadoNombre = (row) =>
  toText(
    row?.nombre_completo ||
      row?.empleado_nombre ||
      row?.nombre_empleado ||
      `${toText(row?.nombre)} ${toText(row?.apellido)}`.trim(),
    'Empleado sin nombre'
  );

const extractEstadoPlanilla = (planilla) =>
  toText(
    planilla?.estado_descripcion || planilla?.estado_planilla || planilla?.estado || planilla?.descripcion_estado
  ).toLowerCase();

const buildInitialFilters = (selectedSucursal = '') => ({
  search: '',
  sucursal: selectedSucursal,
  cargo: '',
  salarioMin: '',
  salarioMax: '',
  _expanded: false
});

const filterDetalleRows = ({ rows = [], filters = {}, selectedSucursal = '', selectedPlanilla = null }) => {
  const searchTerm = toText(filters.search).toLowerCase();
  const sucursalTerm = normalizeSucursalId(filters.sucursal || selectedSucursal);
  const cargoTerm = toText(filters.cargo).toLowerCase();
  const salarioMin = Number.parseFloat(filters.salarioMin);
  const salarioMax = Number.parseFloat(filters.salarioMax);
  const hasMin = Number.isFinite(salarioMin);
  const hasMax = Number.isFinite(salarioMax);
  const planillaSucursal = normalizeSucursalId(selectedPlanilla?.id_sucursal || selectedSucursal);

  if (sucursalTerm && selectedPlanilla?.id_planilla && planillaSucursal && planillaSucursal !== sucursalTerm) {
    return [];
  }

  return rows.filter((item) => {
    const textBag = [
      extractEmpleadoNombre(item),
      item?.dni,
      item?.cargo,
      item?.sucursal,
      item?.nombre_sucursal,
      item?.telefono,
      item?.correo,
      item?.direccion
    ]
      .map((value) => toText(value).toLowerCase())
      .join(' ');

    if (searchTerm && !textBag.includes(searchTerm)) return false;
    if (cargoTerm && !toText(item?.cargo).toLowerCase().includes(cargoTerm)) return false;

    const salario = safeNumber(item?.salario_base, 0);
    if (hasMin && salario < salarioMin) return false;
    if (hasMax && salario > salarioMax) return false;

    if (sucursalTerm && !selectedPlanilla?.id_planilla) {
      const rowSucursal = normalizeSucursalId(
        item?.id_sucursal || item?.id_sucursal_empleado || selectedSucursal
      );
      if (!rowSucursal || rowSucursal !== sucursalTerm) return false;
    }

    return true;
  });
};

const csvValue = (value) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

const sanitizeFileName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'planilla';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadTextFile = ({ fileName, content, mimeType }) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const buildInitialConfirmModal = () => ({
  open: false,
  actionType: '',
  title: 'CONFIRMAR ACCION',
  subtitle: 'Esta accion puede afectar la planilla',
  question: 'Deseas continuar con esta accion?',
  detail: '',
  detailIconClass: 'bi bi-wallet2',
  confirmText: 'Confirmar',
  confirmIconClass: 'bi bi-check2-circle',
  requireReason: false,
  reason: '',
  payload: null
});

const normalizePlanillaCompleta = (response) => {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response;
  const base = payload && typeof payload === 'object' ? payload : {};

  const detalle = Array.isArray(base.detalle)
    ? base.detalle
    : Array.isArray(base.items)
      ? base.items
      : Array.isArray(base.rows)
        ? base.rows
        : [];

  const resumen = normalizeResumen(base.resumen || base.summary || base.encabezado || {});

  return { detalle, resumen };
};

const openPrintWindow = (html) => {
  const popup = window.open('', '_blank', 'width=1150,height=900');
  if (!popup) throw new Error('No se pudo abrir la vista imprimible. Habilita ventanas emergentes.');
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 220);
};

const buildPrintTemplate = ({ planillaLabel, periodo, resumen, rows, includeCorreo, movimientos }) => {
  const totalColumns = includeCorreo ? 18 : 17;
  const resumenCards = [
    { label: 'Total salario base', value: formatMoney(resumen.total_salario_base ?? resumen.salario_base_total) },
    { label: 'Total bonos', value: formatMoney(resumen.total_bonos) },
    { label: 'Total deducciones', value: formatMoney(resumen.total_deducciones) },
    { label: 'Adelantos aplicados', value: formatMoney(resumen.total_adelantos_aplicados ?? resumen.total_adelantos) },
    { label: 'Neto a pagar', value: formatMoney(resumen.total_neto_pagar ?? resumen.total_neto) }
  ];

  const rowsHtml = rows
    .map((row) => {
      const celdas = [
        extractEmpleadoNombre(row),
        toText(row?.id_empleado || row?.codigo || '-'),
        toText(row?.sucursal || row?.nombre_sucursal || '-'),
        toText(row?.dni, '-'),
        toText(row?.telefono, 'Sin telefono'),
        toText(row?.cargo, 'Sin cargo'),
        formatMoney(row?.salario_base),
        toText(row?.fecha_ingreso, '-'),
        toText(row?.nombre_referencia, 'Sin referencia'),
        toText(row?.telefono_referencia, 'Sin telefono referencia'),
        toText(row?.direccion, 'Sin direccion'),
        toText(row?.estado ? 'Activo' : row?.estado ?? 'Sin estado'),
        includeCorreo ? toText(row?.correo, 'Sin correo') : null,
        formatMoney(row?.total_bonos ?? row?.bonos),
        formatMoney(row?.total_deducciones ?? row?.deducciones),
        formatMoney(row?.total_adelantos_aplicados ?? row?.adelantos),
        toText(row?.he_tiempo ?? row?.horas_extra_tiempo ?? '0'),
        formatMoney(row?.neto_pagar ?? row?.total_neto_pagar ?? row?.neto)
      ].filter((cell) => cell !== null);

      return `<tr>${celdas.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('');

  const movimientosHtml = movimientos
    .map(
      (row) => `<tr>
        <td>${escapeHtml(toText(row?.tipo_movimiento || row?.tipo, '-'))}</td>
        <td>${escapeHtml(toText(row?.concepto, '-'))}</td>
        <td>${escapeHtml(formatMovimientoMonto(row))}</td>
        <td>${escapeHtml(toText(row?.observacion, '-'))}</td>
        <td>${escapeHtml(formatMovimientoFecha(row))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ficha de planilla</title>
  <style>
    :root { --bg:#f7f4ef; --ink:#2f1a10; --muted:#6e5a4d; --line:rgba(129,103,84,.28); --panel:#fff; --head:#3d2817; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: var(--bg); color: var(--ink); font-family: "Segoe UI", system-ui, sans-serif; }
    .sheet { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
    .head h1 { margin: 0; font-size: 20px; }
    .head p { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
    .badge { border-radius: 999px; padding: 6px 12px; font-weight: 700; font-size: 12px; background: rgba(61, 40, 23, .08); border: 1px solid var(--line); }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .summary > div { border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #fffefb; }
    .summary span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .summary strong { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; table-layout: fixed; }
    th { background: var(--head); color: #fff; padding: 6px; border: 1px solid rgba(255,255,255,.12); text-transform: uppercase; letter-spacing: .04em; font-size: 8.5px; text-align: left; }
    td { border: 1px solid var(--line); padding: 6px; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
    .section-title { margin: 18px 0 6px; font-size: 14px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { border: 0; box-shadow: none; border-radius: 0; padding: 0; }
      @page { size: A4 landscape; margin: 8mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <section class="sheet">
    <header class="head">
      <div>
        <h1>${escapeHtml(planillaLabel)}</h1>
        <p>Periodo: ${escapeHtml(periodo || 'Sin periodo')} · Empleados: ${rows.length}</p>
      </div>
      <span class="badge">Ficha imprimible</span>
    </header>
    <div class="summary">
      ${resumenCards
        .map((card) => `<div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>`)
        .join('')}
    </div>
    <div class="section-title">Detalle de empleados</div>
    <table>
      <thead>
        <tr>
          <th>Nombre completo</th><th>Codigo / ID</th><th>Sucursal</th><th>DNI</th><th>Telefono</th><th>Cargo</th><th>Sueldo</th>
          <th>Ingreso</th><th>Referencia</th><th>Telefono ref.</th><th>Direccion</th><th>Estado</th>
          ${includeCorreo ? '<th>Correo</th>' : ''}
          <th>Bonos</th><th>Deducciones</th><th>Adelantos</th><th>H.E. tiempo</th><th>Neto</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || `<tr><td colspan="${totalColumns}">Sin datos para exportar.</td></tr>`}</tbody>
    </table>
    ${
      movimientosHtml
        ? `<div class="section-title">Movimientos</div><table><thead><tr><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Observacion</th><th>Fecha</th></tr></thead><tbody>${movimientosHtml}</tbody></table>`
        : ''
    }
  </section>
</body>
</html>`;
};

export default function Planillas({
  openToast,
  selectedSucursalId = '',
  onSelectedSucursalChange,
}) {
  const { canAny } = usePermisos();

  const canView = canAny([PERMISSIONS.PLANILLAS_LISTADO_VER, PERMISSIONS.PLANILLAS_MODULO_VER]);
  const canViewDetalle = canAny([PERMISSIONS.PLANILLAS_DETALLE_VER]);
  const canGenerar = canAny([PERMISSIONS.PLANILLAS_GENERAR]);
  const canRecalcular = canAny([PERMISSIONS.PLANILLAS_RECALCULAR]);
  const canAplicarAdelantos = canAny([PERMISSIONS.PLANILLAS_ADELANTOS_APLICAR]);
  const canRegistrarMovimiento = canAny([PERMISSIONS.PLANILLAS_MOVIMIENTO_REGISTRAR]);
  const canAnularMovimiento = canAny([PERMISSIONS.PLANILLAS_MOVIMIENTO_ANULAR]);
  const canCerrar = canAny([PERMISSIONS.PLANILLAS_CERRAR]);
  const canPagar = canAny([PERMISSIONS.PLANILLAS_PAGAR]);
  const canAnular = canAny([PERMISSIONS.PLANILLAS_ANULAR]);
  const canVerAuditoria = canAny([PERMISSIONS.PLANILLAS_AUDITORIA_VER]);

  const safeToast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') openToast(title, message, variant);
    },
    [openToast]
  );

  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [periodo, setPeriodo] = useState(currentMonth());
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [listPage, setListPage] = useState(1);
  const [filters, setFilters] = useState(buildInitialFilters(''));

  const [planillas, setPlanillas] = useState([]);
  const [planillasTotal, setPlanillasTotal] = useState(0);
  const [selectedPlanillaId, setSelectedPlanillaId] = useState('');

  const [resumen, setResumen] = useState({});
  const [adelantosPendientes, setAdelantosPendientes] = useState([]);
  const [detalle, setDetalle] = useState([]);
  const [detallePage, setDetallePage] = useState(1);
  const [detalleTotal, setDetalleTotal] = useState(0);

  const [loadingSucursales, setLoadingSucursales] = useState(true);
  const [loadingPlanillas, setLoadingPlanillas] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [loadingAdelantosPendientes, setLoadingAdelantosPendientes] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [listError, setListError] = useState('');

  const [detailItem, setDetailItem] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [movimientosModal, setMovimientosModal] = useState({
    open: false,
    item: null,
    loading: false,
    items: []
  });

  const [movimientoFormModal, setMovimientoFormModal] = useState({
    open: false,
    tipo: 'bono',
    item: null,
    loading: false
  });

  const [adelantosModal, setAdelantosModal] = useState({
    open: false,
    item: null,
    loading: false,
    applying: false,
    registering: false,
    items: []
  });

  const [auditoriaModal, setAuditoriaModal] = useState({
    open: false,
    loading: false,
    items: []
  });
  const [horasExtraModal, setHorasExtraModal] = useState({
    open: false,
    loading: false,
    item: null,
    empleadoLabel: '',
    items: [],
    summary: {},
    compensatingId: null,
    registering: false,
    registerEmpleadoId: ''
  });
  const [adelantosPendientesModalOpen, setAdelantosPendientesModalOpen] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState({
    adelantos: false,
    horas: false
  });
  const [confirmModal, setConfirmModal] = useState(buildInitialConfirmModal);

  const externalSucursalId = useMemo(
    () => normalizeSucursalId(selectedSucursalId),
    [selectedSucursalId]
  );

  const handleSucursalChange = useCallback(
    (value) => {
      const normalized = normalizeSucursalId(value);
      setSelectedSucursal(normalized);
      setFilters((previous) => ({ ...previous, sucursal: normalized }));
      if (typeof onSelectedSucursalChange === 'function') {
        onSelectedSucursalChange(normalized);
      }
    },
    [onSelectedSucursalChange]
  );

  const selectedPlanilla = useMemo(
    () =>
      planillas.find((planilla) => String(planilla.id_planilla ?? '') === String(selectedPlanillaId)) ||
      null,
    [planillas, selectedPlanillaId]
  );

  const sucursalOptions = useMemo(
    () =>
      (Array.isArray(sucursales) ? sucursales : []).map((sucursal) => ({
        value: String(sucursal.id_sucursal),
        label:
          sucursal.nombre_sucursal ||
          sucursal.nombre ||
          sucursal.sucursal ||
          `Sucursal #${sucursal.id_sucursal}`
      })),
    [sucursales]
  );

  const selectedPlanillaLabel = useMemo(() => {
    if (!selectedPlanilla?.id_planilla) return 'Planilla seleccionada';
    return selectedPlanilla.codigo_planilla || `Planilla #${selectedPlanilla.id_planilla}`;
  }, [selectedPlanilla]);

  const planillaEstadoRaw = useMemo(() => extractEstadoPlanilla(selectedPlanilla), [selectedPlanilla]);
  const planillaEstadoId = useMemo(
    () => safeNumber(selectedPlanilla?.id_estado_planilla || selectedPlanilla?.id_estado, 0),
    [selectedPlanilla]
  );
  const isPlanillaPagada = useMemo(
    () => planillaEstadoRaw.includes('pagad') || planillaEstadoId === 3,
    [planillaEstadoId, planillaEstadoRaw]
  );

  const filteredDetalle = useMemo(
    () =>
      filterDetalleRows({
        rows: detalle,
        filters,
        selectedSucursal,
        selectedPlanilla
      }),
    [detalle, filters, selectedSucursal, selectedPlanilla]
  );

  const totalPagesDetalle = useMemo(
    () => Math.max(1, Math.ceil(filteredDetalle.length / DETAIL_LIMIT)),
    [filteredDetalle.length]
  );

  const pagedDetalle = useMemo(() => {
    const start = (detallePage - 1) * DETAIL_LIMIT;
    return filteredDetalle.slice(start, start + DETAIL_LIMIT);
  }, [detallePage, filteredDetalle]);

  const canExportPlanilla = Boolean(canViewDetalle && selectedPlanilla?.id_planilla && isPlanillaPagada);
  const hasSucursalSelected = Boolean(normalizeSucursalId(selectedSucursal));
  const adelantosPendientesTotal = useMemo(
    () =>
      adelantosPendientes.reduce(
        (acc, item) => acc + safeNumber(item?.saldo ?? item?.monto_pendiente ?? item?.monto, 0),
        0
      ),
    [adelantosPendientes]
  );
  const adelantosPendientesNombres = useMemo(() => {
    const unique = new Set();
    adelantosPendientes.forEach((item) => {
      const name = toText(item?.nombre_completo || item?.empleado_nombre, '');
      if (name) unique.add(name);
    });
    return Array.from(unique);
  }, [adelantosPendientes]);
  const adelantosPendientesResumen = useMemo(() => {
    if (adelantosPendientesNombres.length === 0) {
      return 'No hay adelantos pendientes para la sucursal seleccionada.';
    }
    if (adelantosPendientesNombres.length === 1) {
      return `${adelantosPendientesNombres[0]} tiene ${formatMoney(adelantosPendientesTotal)} en adelantos pendientes.`;
    }
    if (adelantosPendientesNombres.length === 2) {
      return `${adelantosPendientesNombres[0]} y ${adelantosPendientesNombres[1]} tienen ${formatMoney(
        adelantosPendientesTotal
      )} en adelantos pendientes.`;
    }
    return `${adelantosPendientesNombres[0]}, ${adelantosPendientesNombres[1]} y ${
      adelantosPendientesNombres.length - 2
    } empleado(s) tienen ${formatMoney(adelantosPendientesTotal)} en adelantos pendientes.`;
  }, [adelantosPendientesNombres, adelantosPendientesTotal]);
  const horasExtraStats = useMemo(() => {
    const totals = detalle.reduce(
      (acc, row) => {
        const horas = toHoursNumber(row?.he_tiempo ?? row?.horas_extra_tiempo);
        if (horas > 0) {
          acc.totalPendientes += horas;
          acc.empleadosConHoras += 1;
        }
        return acc;
      },
      { totalPendientes: 0, empleadosConHoras: 0 }
    );
    return totals;
  }, [detalle]);

  const loadSucursales = useCallback(async () => {
    setLoadingSucursales(true);
    try {
      const response = await sucursalesService.getAll();
      const parsed = normalizeListResponse(response);
      setSucursales(parsed.items);
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudieron cargar sucursales', 'danger');
    } finally {
      setLoadingSucursales(false);
    }
  }, [safeToast]);

  useEffect(() => {
    setSelectedSucursal((previous) => (previous === externalSucursalId ? previous : externalSucursalId));
    setFilters((previous) => ({
      ...previous,
      sucursal: externalSucursalId || ''
    }));
  }, [externalSucursalId]);

  const loadPlanillas = useCallback(async () => {
    if (!canView || !selectedSucursal) {
      setPlanillas([]);
      setPlanillasTotal(0);
      setSelectedPlanillaId('');
      return;
    }

    setLoadingPlanillas(true);
    setListError('');

    try {
      const response = await planillasService.listarPlanillas({
        page: listPage,
        limit: LIST_LIMIT,
        id_sucursal: selectedSucursal,
        periodo,
        estado: estadoFiltro || undefined
      });

      const parsed = normalizeListResponse(response);
      setPlanillas(parsed.items);
      setPlanillasTotal(parsed.total);

      if (parsed.items.length === 0) {
        setSelectedPlanillaId('');
        return;
      }

      const stillExists = parsed.items.some(
        (planilla) => String(planilla.id_planilla ?? '') === String(selectedPlanillaId)
      );

      if (!selectedPlanillaId || !stillExists) {
        setSelectedPlanillaId(String(parsed.items[0].id_planilla ?? ''));
      }
    } catch (error) {
      setListError(error.message || 'No se pudo cargar planillas');
      setPlanillas([]);
      setPlanillasTotal(0);
      setSelectedPlanillaId('');
    } finally {
      setLoadingPlanillas(false);
    }
  }, [canView, estadoFiltro, listPage, periodo, selectedPlanillaId, selectedSucursal]);

  const loadDetalleAndResumen = useCallback(async () => {
    if (!selectedPlanilla?.id_planilla || !canViewDetalle || !selectedSucursal) {
      setDetalle([]);
      setResumen({});
      setDetalleTotal(0);
      return;
    }

    const planillaSucursalId = normalizeSucursalId(
      selectedPlanilla?.id_sucursal || selectedPlanilla?.id_sucursal_planilla
    );
    const currentSucursalId = normalizeSucursalId(selectedSucursal);
    if (planillaSucursalId && currentSucursalId && planillaSucursalId !== currentSucursalId) {
      setDetalle([]);
      setResumen({});
      setDetalleTotal(0);
      return;
    }

    setLoadingDetalle(true);
    try {
      const [resumenResp, detalleResp] = await Promise.all([
        planillasService.obtenerResumenPlanilla(selectedPlanilla.id_planilla, {
          id_sucursal: selectedSucursal || undefined
        }),
        planillasService.listarDetallePlanilla(selectedPlanilla.id_planilla, {
          page: 1,
          limit: DETAIL_FETCH_LIMIT,
          id_sucursal: selectedSucursal || undefined
        })
      ]);

      setResumen(normalizeResumen(resumenResp));
      const parsedDetalle = normalizeListResponse(detalleResp);
      setDetalle(parsedDetalle.items);
      setDetalleTotal(parsedDetalle.total || parsedDetalle.items.length);
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo cargar el detalle de planilla', 'danger');
      setDetalle([]);
      setDetalleTotal(0);
      setResumen({});
    } finally {
      setLoadingDetalle(false);
    }
  }, [canViewDetalle, safeToast, selectedPlanilla?.id_planilla, selectedSucursal]);

  const loadAdelantosPendientes = useCallback(async () => {
    if (!selectedSucursal || !canViewDetalle) {
      setAdelantosPendientes([]);
      setLoadingAdelantosPendientes(false);
      return;
    }

    setLoadingAdelantosPendientes(true);
    try {
      const response = await planillasService.listarAdelantosPendientesSucursal(selectedSucursal, {
        page: 1,
        limit: 10,
        periodo
      });
      setAdelantosPendientes(normalizeListResponse(response).items);
    } catch {
      setAdelantosPendientes([]);
    } finally {
      setLoadingAdelantosPendientes(false);
    }
  }, [canViewDetalle, periodo, selectedSucursal]);

  useEffect(() => {
    loadSucursales();
  }, [loadSucursales]);

  useEffect(() => {
    setListPage(1);
  }, [selectedSucursal, periodo, estadoFiltro]);

  useEffect(() => {
    setSelectedPlanillaId('');
    setDetalle([]);
    setResumen({});
    setDetalleTotal(0);
    setDetallePage(1);
  }, [selectedSucursal]);

  useEffect(() => {
    loadPlanillas();
  }, [loadPlanillas]);

  useEffect(() => {
    setDetallePage(1);
  }, [selectedPlanillaId, filters.search, filters.sucursal, filters.cargo, filters.salarioMin, filters.salarioMax]);

  useEffect(() => {
    loadDetalleAndResumen();
  }, [loadDetalleAndResumen]);

  useEffect(() => {
    loadAdelantosPendientes();
  }, [loadAdelantosPendientes]);

  useEffect(() => {
    if (detallePage > totalPagesDetalle) {
      setDetallePage(totalPagesDetalle);
    }
  }, [detallePage, totalPagesDetalle]);

  useEffect(() => {
    if (hasSucursalSelected) return;
    setAdelantosPendientesModalOpen(false);
    setHorasExtraModal({
      open: false,
      loading: false,
      item: null,
      empleadoLabel: '',
      items: [],
      summary: {},
      compensatingId: null,
      registering: false,
      registerEmpleadoId: ''
      });
  }, [hasSucursalSelected]);

  useEffect(() => {
    setDismissedInsights({
      adelantos: false,
      horas: false
    });
  }, [selectedSucursal, selectedPlanillaId, periodo]);

  const withAction = useCallback(
    async (task, successMessage) => {
      setLoadingAction(true);
      try {
        await task();
        if (successMessage) safeToast('OK', successMessage, 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen(), loadAdelantosPendientes()]);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo ejecutar la accion', 'danger');
      } finally {
        setLoadingAction(false);
      }
    },
    [loadAdelantosPendientes, loadDetalleAndResumen, loadPlanillas, safeToast]
  );

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(buildInitialConfirmModal());
  }, []);

  const openConfirmModal = useCallback((config = {}) => {
    setConfirmModal({
      open: true,
      actionType: config.actionType || '',
      title: config.title || 'CONFIRMAR ACCION',
      subtitle: config.subtitle || 'Esta accion puede afectar la planilla',
      question: config.question || 'Deseas continuar con esta accion?',
      detail: config.detail || '',
      detailIconClass: config.detailIconClass || 'bi bi-wallet2',
      confirmText: config.confirmText || 'Confirmar',
      confirmIconClass: config.confirmIconClass || 'bi bi-check2-circle',
      requireReason: Boolean(config.requireReason),
      reason: '',
      payload: config.payload || null
    });
  }, []);

  const buildCsvContent = useCallback((rows, resumenData, movimientos, options) => {
    const includeCorreo = Boolean(options?.includeCorreo);

    const header = [
      'Nombre completo',
      'Codigo/ID',
      'Sucursal',
      'DNI',
      'Telefono',
      'Cargo',
      'Sueldo',
      'Fecha ingreso',
      'Nombre referencia',
      'Telefono referencia',
      'Direccion',
      'Estado',
      ...(includeCorreo ? ['Correo'] : []),
      'Bonos',
      'Deducciones',
      'Adelantos',
      'HE tiempo',
      'Neto a pagar'
    ];

    const lines = [
      ['Planilla', selectedPlanillaLabel],
      ['Periodo', periodo],
      ['Total salario base', formatMoney(resumenData.total_salario_base ?? resumenData.salario_base_total)],
      ['Total bonos', formatMoney(resumenData.total_bonos)],
      ['Total deducciones', formatMoney(resumenData.total_deducciones)],
      ['Adelantos aplicados', formatMoney(resumenData.total_adelantos_aplicados ?? resumenData.total_adelantos)],
      ['Neto a pagar', formatMoney(resumenData.total_neto_pagar ?? resumenData.total_neto)],
      [],
      header
    ];

    rows.forEach((row) => {
      lines.push([
        extractEmpleadoNombre(row),
        toText(row.id_empleado || row.codigo || '-'),
        toText(row.sucursal || row.nombre_sucursal || '-'),
        toText(row.dni, '-'),
        toText(row.telefono, 'Sin telefono'),
        toText(row.cargo, 'Sin cargo'),
        formatMoney(row.salario_base),
        toText(row.fecha_ingreso, '-'),
        toText(row.nombre_referencia, 'Sin referencia'),
        toText(row.telefono_referencia, 'Sin telefono referencia'),
        toText(row.direccion, 'Sin direccion'),
        toText(row.estado ? 'Activo' : row.estado ?? 'Sin estado'),
        ...(includeCorreo ? [toText(row.correo, 'Sin correo')] : []),
        formatMoney(row.total_bonos ?? row.bonos),
        formatMoney(row.total_deducciones ?? row.deducciones),
        formatMoney(row.total_adelantos_aplicados ?? row.adelantos),
        toText(row.he_tiempo ?? row.horas_extra_tiempo ?? '0'),
        formatMoney(row.neto_pagar ?? row.total_neto_pagar ?? row.neto)
      ]);
    });

    if (Array.isArray(movimientos) && movimientos.length > 0) {
      lines.push([]);
      lines.push(['Movimientos']);
      lines.push(['Tipo', 'Concepto', 'Monto', 'Observacion', 'Fecha']);
      movimientos.forEach((row) => {
        lines.push([
          toText(row.tipo_movimiento || row.tipo, '-'),
          toText(row.concepto, '-'),
          formatMovimientoMonto(row),
          toText(row.observacion, '-'),
          formatMovimientoFecha(row)
        ]);
      });
    }

    return lines.map((columns) => columns.map(csvValue).join(',')).join('\n');
  }, [periodo, selectedPlanillaLabel]);

  const resolveExportDataset = useCallback(async (options = {}) => {
    let summaryData = resumen;
    let rows = filteredDetalle;
    let movimientos = [];

    if (!selectedPlanilla?.id_planilla) {
      return { summaryData, rows, movimientos };
    }

    try {
      const response = await planillasService.obtenerPlanillaCompleta(selectedPlanilla.id_planilla, {
        id_sucursal: selectedSucursal || undefined
      });
      const parsed = normalizePlanillaCompleta(response);
      if (parsed.detalle.length > 0) {
        rows = filterDetalleRows({
          rows: parsed.detalle,
          filters,
          selectedSucursal,
          selectedPlanilla
        });
      }
      if (Object.keys(parsed.resumen || {}).length > 0) {
        summaryData = parsed.resumen;
      }
    } catch {
      // fallback
    }

    if (options.includeMovimientos) {
      try {
        const limit = 100;
        const maxPages = 50;
        let page = 1;
        let total = Infinity;
        const allRows = [];

        while (page <= maxPages && allRows.length < total) {
          const response = await planillasService.listarMovimientosPlanilla(selectedPlanilla.id_planilla, {
            page,
            limit,
            id_sucursal: selectedSucursal || undefined
          });
          const parsed = normalizeListResponse(response);
          const chunk = Array.isArray(parsed.items) ? parsed.items : [];
          if (page === 1) {
            total = Number(parsed.total ?? chunk.length) || chunk.length;
          }
          allRows.push(...chunk);
          if (chunk.length < limit) break;
          page += 1;
        }

        movimientos = allRows;
      } catch {
        safeToast('AVISO', 'No se pudieron incluir movimientos en la exportacion.', 'warning');
      }
    }

    return { summaryData, rows, movimientos };
  }, [filters, filteredDetalle, resumen, safeToast, selectedPlanilla, selectedSucursal]);

  const handleExportSubmit = useCallback(async (options) => {
    if (!selectedPlanilla?.id_planilla) return;

    setLoadingExport(true);
    try {
      const { summaryData, rows, movimientos } = await resolveExportDataset(options);

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('No hay datos en detalle para exportar con los filtros actuales.');
      }

      const fileBase = sanitizeFileName(`${selectedPlanillaLabel}_${periodo}`);

      if (options.format === 'excel') {
        const csv = buildCsvContent(rows, summaryData, movimientos, options);
        downloadTextFile({
          fileName: `${fileBase}.csv`,
          content: csv,
          mimeType: 'text/csv;charset=utf-8;'
        });
        safeToast('OK', 'Archivo CSV generado correctamente.', 'success');
      } else {
        const html = buildPrintTemplate({
          planillaLabel: selectedPlanillaLabel,
          periodo,
          resumen: summaryData,
          rows,
          includeCorreo: options.includeCorreo,
          movimientos
        });
        openPrintWindow(html);
        safeToast('OK', 'Vista imprimible abierta. Puedes guardarla como PDF.', 'success');
      }

      setExportModalOpen(false);
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo generar la exportacion.', 'danger');
    } finally {
      setLoadingExport(false);
    }
  }, [buildCsvContent, periodo, resolveExportDataset, safeToast, selectedPlanilla?.id_planilla, selectedPlanillaLabel]);

  const handleGenerar = () =>
    withAction(
      () => planillasService.generarPlanilla({ id_sucursal: Number(selectedSucursal), periodo }),
      'Planilla generada correctamente'
    );

  const handleRecalcular = () => {
    if (!selectedPlanilla?.id_planilla) return;
    openConfirmModal({
      actionType: 'recalcular_planilla',
      title: 'CONFIRMAR RECALCULO',
      subtitle: 'Se actualizaran los totales de planilla',
      question: 'Deseas recalcular la planilla seleccionada?',
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-arrow-repeat',
      confirmText: 'Recalcular',
      confirmIconClass: 'bi bi-arrow-repeat',
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: Number(selectedSucursal || 0) || undefined
      }
    });
  };

  const handleChangeEstado = (estado) => {
    if (!selectedPlanilla?.id_planilla) return;
    const estadoMap = {
      cerrada: 'CALCULADA',
      pagada: 'PAGADA',
      anulada: 'ANULADA',
      borrador: 'BORRADOR',
      calculada: 'CALCULADA',
    };
    const estadoLabelMap = {
      cerrada: 'cerrar',
      pagada: 'pagar',
      anulada: 'anular',
      borrador: 'marcar como borrador',
      calculada: 'calcular',
    };
    const normalizedEstado = estadoMap[String(estado || '').toLowerCase()] || estado;
    const actionLabel = estadoLabelMap[String(estado || '').toLowerCase()] || 'actualizar estado';
    openConfirmModal({
      actionType: 'estado_planilla',
      title: 'CONFIRMAR CAMBIO DE ESTADO',
      subtitle: 'Esta accion se registrara en planilla',
      question: `Confirma que deseas ${actionLabel} la planilla seleccionada?`,
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-check2-square',
      confirmText: 'Confirmar',
      confirmIconClass: 'bi bi-check2-circle',
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: Number(selectedSucursal || 0) || undefined,
        estado: normalizedEstado,
        label: estado
      }
    });
  };

  const handleAnular = () => {
    if (!selectedPlanilla?.id_planilla) return;
    openConfirmModal({
      actionType: 'anular_planilla',
      title: 'CONFIRMAR ANULACION',
      subtitle: 'Esta accion es permanente',
      question: 'Esta accion anulara la planilla completa y revertira adelantos aplicados. Deseas continuar?',
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-exclamation-triangle-fill',
      confirmText: 'Anular',
      confirmIconClass: 'bi bi-trash3',
      requireReason: true,
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: Number(selectedSucursal || 0) || undefined
      }
    });
  };

  const openMovimientos = async (item) => {
    setMovimientosModal({ open: true, item, loading: true, items: [] });
    try {
      const response = await planillasService.listarMovimientosPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 50,
        id_detalle: item.id_detalle_planilla || item.id_detalle,
        id_sucursal: selectedSucursal || undefined
      });
      setMovimientosModal({ open: true, item, loading: false, items: normalizeListResponse(response).items });
    } catch (error) {
      setMovimientosModal({ open: true, item, loading: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudieron cargar movimientos', 'danger');
    }
  };

  const openAdelantos = async (item) => {
    setAdelantosModal({ open: true, item, loading: true, applying: false, registering: false, items: [] });
    try {
      const response = await planillasService.listarAdelantosAplicablesPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 50,
        id_detalle: item.id_detalle_planilla || item.id_detalle,
        id_sucursal: selectedSucursal || undefined
      });
      setAdelantosModal({
        open: true,
        item,
        loading: false,
        applying: false,
        registering: false,
        items: normalizeListResponse(response).items
      });
    } catch (error) {
      setAdelantosModal({ open: true, item, loading: false, applying: false, registering: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudieron cargar adelantos', 'danger');
    }
  };

  const openHorasExtra = useCallback(
    async (item = null) => {
      if (!selectedPlanilla?.id_planilla) {
        safeToast('ERROR', 'Selecciona una planilla para consultar horas extra.', 'warning');
        return;
      }

      const idEmpleado = safeNumber(item?.id_empleado, 0) || null;
      const empleadoLabel = idEmpleado ? extractEmpleadoNombre(item) : '';

      setHorasExtraModal({
        open: true,
        loading: true,
        item: item || null,
        empleadoLabel,
        items: [],
        summary: {},
        compensatingId: null,
        registering: false,
        registerEmpleadoId: idEmpleado ? String(idEmpleado) : ''
      });

      try {
        const response = await planillasService.listarHorasExtraPlanilla(selectedPlanilla.id_planilla, {
          page: 1,
          limit: 200,
          id_empleado: idEmpleado || undefined,
          id_sucursal: selectedSucursal || undefined
        });
        const parsed = normalizeHorasExtraResponse(response);
        setHorasExtraModal((previous) => ({
          ...previous,
          open: true,
          loading: false,
          item: item || null,
          empleadoLabel,
          items: parsed.items,
          summary: parsed.summary || {}
        }));
      } catch (error) {
        setHorasExtraModal((previous) => ({
          ...previous,
          open: true,
          loading: false,
          items: [],
          summary: {}
        }));
        safeToast('ERROR', error.message || 'No se pudieron cargar horas extra.', 'danger');
      }
    },
    [safeToast, selectedPlanilla?.id_planilla, selectedSucursal]
  );

  const handleCompensarHoraExtra = useCallback(
    async (horaExtraItem, observacion = '') => {
      if (!selectedPlanilla?.id_planilla) return;

      const idHoraExtra =
        horaExtraItem?.id_horas_extras ||
        horaExtraItem?.id_horas_extra ||
        horaExtraItem?.id_hora_extra;
      if (!idHoraExtra) return;

      setHorasExtraModal((previous) => ({ ...previous, compensatingId: idHoraExtra }));

      try {
        await planillasService.compensarHoraExtraPlanilla(selectedPlanilla.id_planilla, idHoraExtra, {
          observacion,
          id_sucursal: Number(selectedSucursal || 0) || undefined
        });
        safeToast('OK', 'Hora extra compensada correctamente.', 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen()]);
        await openHorasExtra(horasExtraModal.item);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo compensar la hora extra.', 'danger');
      } finally {
        setHorasExtraModal((previous) => ({ ...previous, compensatingId: null }));
      }
    },
    [
      horasExtraModal.item,
      loadDetalleAndResumen,
      loadPlanillas,
      openHorasExtra,
      safeToast,
      selectedPlanilla?.id_planilla,
      selectedSucursal
    ]
  );

  const handleRegistrarHoraExtra = useCallback(
    async (payload) => {
      if (!selectedPlanilla?.id_planilla) return;

      setHorasExtraModal((previous) => ({ ...previous, registering: true }));

      try {
        await planillasService.registrarHoraExtraPlanilla(selectedPlanilla.id_planilla, {
          ...payload,
          id_sucursal: Number(selectedSucursal || 0) || undefined
        });
        safeToast('OK', 'Hora extra registrada correctamente.', 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen()]);
        await openHorasExtra(horasExtraModal.item);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo registrar la hora extra.', 'danger');
      } finally {
        setHorasExtraModal((previous) => ({ ...previous, registering: false }));
      }
    },
    [
      horasExtraModal.item,
      loadDetalleAndResumen,
      loadPlanillas,
      openHorasExtra,
      safeToast,
      selectedPlanilla?.id_planilla,
      selectedSucursal
    ]
  );

  const handleRegistrarAdelanto = useCallback(
    async (payload) => {
      if (!selectedPlanilla?.id_planilla || !adelantosModal.item) return;

      setAdelantosModal((previous) => ({ ...previous, registering: true }));
      try {
        await planillasService.registrarAdelantoPlanilla(selectedPlanilla.id_planilla, {
          ...payload,
          id_sucursal: Number(selectedSucursal || 0) || undefined
        });
        safeToast('OK', 'Adelanto registrado correctamente.', 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen(), loadAdelantosPendientes()]);
        await openAdelantos(adelantosModal.item);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo registrar el adelanto.', 'danger');
      } finally {
        setAdelantosModal((previous) => ({ ...previous, registering: false }));
      }
    },
    [
      adelantosModal.item,
      loadAdelantosPendientes,
      loadDetalleAndResumen,
      loadPlanillas,
      openAdelantos,
      safeToast,
      selectedPlanilla?.id_planilla,
      selectedSucursal
    ]
  );

  const handleApplyFromPendientes = useCallback(
    async (adelantoPendiente) => {
      if (!selectedPlanilla?.id_planilla) {
        safeToast('ERROR', 'Selecciona una planilla para aplicar adelantos.', 'warning');
        return;
      }

      const idEmpleado = safeNumber(adelantoPendiente?.id_empleado, 0);
      const detalleEmpleado = detalle.find(
        (row) => safeNumber(row?.id_empleado, 0) === idEmpleado
      );

      if (!detalleEmpleado) {
        safeToast('ERROR', 'El empleado no pertenece al detalle de la planilla seleccionada.', 'warning');
        return;
      }

      setAdelantosPendientesModalOpen(false);
      await openAdelantos(detalleEmpleado);
    },
    [detalle, openAdelantos, safeToast, selectedPlanilla?.id_planilla]
  );

  const handleApplyAllPendientes = useCallback(() => {
    if (!selectedPlanilla?.id_planilla) {
      safeToast('ERROR', 'Selecciona una planilla para aplicar adelantos pendientes.', 'warning');
      return;
    }

    const itemsAplicables = adelantosPendientes.filter((item) => {
      const idEmpleado = safeNumber(item?.id_empleado, 0);
      return detalle.some((row) => safeNumber(row?.id_empleado, 0) === idEmpleado);
    });

    if (itemsAplicables.length === 0) {
      safeToast('AVISO', 'No hay adelantos aplicables para el detalle actual de la planilla.', 'warning');
      return;
    }

    withAction(
      async () => {
        for (const item of itemsAplicables) {
          const idAdelanto = item?.id_adelanto_salario || item?.id_adelanto;
          if (!idAdelanto) continue;
          await planillasService.aplicarAdelantoPlanilla(selectedPlanilla.id_planilla, {
            id_adelanto_salario: idAdelanto,
            id_sucursal: Number(selectedSucursal || 0) || undefined
          });
        }
      },
      `Se aplicaron ${itemsAplicables.length} adelanto(s) pendientes.`
    );
  }, [adelantosPendientes, detalle, safeToast, selectedPlanilla?.id_planilla, selectedSucursal, withAction]);

  const openAuditoria = async () => {
    if (!selectedPlanilla?.id_planilla) return;
    setAuditoriaModal({ open: true, loading: true, items: [] });
    try {
      const response = await planillasService.listarAuditoriaPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 100,
        id_sucursal: selectedSucursal || undefined
      });
      setAuditoriaModal({ open: true, loading: false, items: normalizeListResponse(response).items });
    } catch (error) {
      setAuditoriaModal({ open: true, loading: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudo cargar la auditoria', 'danger');
    }
  };

  const handleAnularMovimiento = (movimiento) => {
    const id = movimiento.id_movimiento_planilla || movimiento.id_movimiento;
    if (!id) return;
    openConfirmModal({
      actionType: 'anular_movimiento',
      title: 'CONFIRMAR ANULACION',
      subtitle: 'Esta accion es permanente',
      question: 'Deseas anular este movimiento de planilla?',
      detail: movimiento.concepto || `Movimiento #${id}`,
      detailIconClass: 'bi bi-journal-x',
      confirmText: 'Anular',
      confirmIconClass: 'bi bi-trash3',
      requireReason: true,
      payload: {
        idMovimiento: id,
        idPlanilla: selectedPlanilla?.id_planilla,
        idSucursal: Number(selectedSucursal || 0) || undefined
      }
    });
  };

  const executeConfirmAction = useCallback(async () => {
    const actionType = confirmModal.actionType;
    const payload = confirmModal.payload || {};
    const motivo = toText(confirmModal.reason, '');

    closeConfirmModal();

    if (actionType === 'recalcular_planilla') {
      await withAction(
        () =>
          planillasService.recalcularPlanilla(payload.idPlanilla, {
            id_sucursal: payload.idSucursal
          }),
        'Planilla recalculada correctamente'
      );
      return;
    }

    if (actionType === 'estado_planilla') {
      await withAction(
        () =>
          planillasService.actualizarEstadoPlanilla(payload.idPlanilla, {
            estado: payload.estado,
            id_sucursal: payload.idSucursal
          }),
        `Planilla marcada como ${payload.label}`
      );
      return;
    }

    if (actionType === 'anular_planilla') {
      await withAction(
        () =>
          planillasService.anularPlanilla(payload.idPlanilla, {
            motivo,
            id_sucursal: payload.idSucursal
          }),
        'Planilla anulada correctamente'
      );
      return;
    }

    if (actionType === 'anular_movimiento') {
      await withAction(
        async () => {
          await planillasService.anularMovimientoPlanilla(payload.idMovimiento, {
            motivo,
            id_planilla: payload.idPlanilla,
            id_sucursal: payload.idSucursal
          });
          if (movimientosModal.item) {
            await openMovimientos(movimientosModal.item);
          }
        },
        'Movimiento anulado correctamente'
      );
    }
  }, [
    closeConfirmModal,
    confirmModal.actionType,
    confirmModal.payload,
    confirmModal.reason,
    movimientosModal.item,
    openMovimientos,
    withAction
  ]);

  const hasNoData = hasSucursalSelected && !loadingPlanillas && planillas.length === 0;

  if (!canView) {
    return (
      <div className="personas-page personas-page--planillas">
        <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3 p-4">
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-title">Sin permisos para Planillas</div>
            <div className="inv-catpro-empty-sub">
              Solicita el permiso PLANILLAS_MODULO_VER para acceder al submodulo.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="personas-page personas-page--planillas">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        <div className="inv-catpro-body inv-prod-body p-3">
          <PlanillasHeader
            sucursalOptions={sucursalOptions}
            sucursalId={selectedSucursal}
            onSucursalChange={handleSucursalChange}
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            selectedPlanilla={selectedPlanilla}
            onGenerar={handleGenerar}
            onRecalcular={handleRecalcular}
            onCerrar={() => handleChangeEstado('cerrada')}
            onPagar={() => handleChangeEstado('pagada')}
            onAnular={handleAnular}
            onExport={() => setExportModalOpen(true)}
            canGenerar={canGenerar}
            canRecalcular={canRecalcular}
            canCerrar={canCerrar}
            canPagar={canPagar}
            canAnular={canAnular}
            canExport={canExportPlanilla}
            exportLoading={loadingExport}
            loadingAction={loadingAction || loadingSucursales}
          />

          {!hasSucursalSelected ? (
            <div className="inv-catpro-empty planillas-state mt-3">
              <div className="inv-catpro-empty-icon">
                <i className="bi bi-building" />
              </div>
              <div className="inv-catpro-empty-title">Selecciona una sucursal para cargar planillas</div>
              <div className="inv-catpro-empty-sub">
                Sin sucursal seleccionada no se mostrara resumen, detalle ni acciones operativas.
              </div>
            </div>
          ) : (
            <>
          <div className="planillas-toolbar">
            <div className="planillas-toolbar__field">
              <label htmlFor="planillas-select">Planilla</label>
              <select
                id="planillas-select"
                className="form-select"
                value={selectedPlanillaId}
                onChange={(event) => setSelectedPlanillaId(event.target.value)}
                disabled={loadingPlanillas || planillas.length === 0}
              >
                <option value="">Seleccione planilla</option>
                {planillas.map((planilla) => (
                  <option key={planilla.id_planilla} value={planilla.id_planilla}>
                    {planilla.codigo_planilla || `Planilla #${planilla.id_planilla}`} ·{' '}
                    {planilla.estado_descripcion ||
                      planilla.estado_planilla ||
                      planilla.estado ||
                      'Sin estado'}
                  </option>
                ))}
              </select>
            </div>

            <div className="planillas-toolbar__field">
              <label htmlFor="planillas-estado-filtro">Estado</label>
              <select
                id="planillas-estado-filtro"
                className="form-select"
                value={estadoFiltro}
                onChange={(event) => setEstadoFiltro(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="CALCULADA">Calculada</option>
                <option value="PAGADA">Pagada</option>
                <option value="ANULADA">Anulada</option>
              </select>
            </div>

            {canVerAuditoria ? (
              <div className="planillas-toolbar__audit">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={openAuditoria}
                  disabled={!selectedPlanilla?.id_planilla}
                >
                  <i className="bi bi-clock-history me-1" />
                  Auditoria
                </button>
              </div>
            ) : null}
          </div>

          <PayrollFilters
            values={filters}
            onChange={setFilters}
            onClear={() =>
              setFilters((prev) => ({
                ...buildInitialFilters(selectedSucursal),
                _expanded: prev._expanded
              }))
            }
            sucursalOptions={sucursalOptions}
          />

          <div className="planillas-alerts">
            {!dismissedInsights.adelantos ? (
              <section className="planillas-insight planillas-insight--adelantos">
                <div className="planillas-insight__head">
                  <div className="planillas-insight__title-wrap">
                    <span className="planillas-insight__icon" aria-hidden="true">
                      <i className="bi bi-exclamation-circle" />
                    </span>
                    <div>
                      <h4>Adelantos Pendientes Detectados</h4>
                      <p>{adelantosPendientesResumen}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="planillas-insight__close"
                    onClick={() => setDismissedInsights((prev) => ({ ...prev, adelantos: true }))}
                    aria-label="Ocultar bloque de adelantos"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>

                {loadingAdelantosPendientes ? (
                  <div className="planillas-insight__empty">Cargando adelantos pendientes...</div>
                ) : adelantosPendientes.length === 0 ? (
                  <div className="planillas-insight__empty">No hay adelantos pendientes para este contexto.</div>
                ) : (
                  <>
                    <div className="planillas-insight__rows">
                      {adelantosPendientes.slice(0, 3).map((item, index) => {
                        const key = item?.id_adelanto_salario || item?.id_adelanto || index;
                        return (
                          <article key={key} className="planillas-insight__row">
                            <div>
                              <strong>Adelanto del {formatFriendlyDate(item?.fecha)}</strong>
                              <small>Monto original: {formatMoney(item?.monto)}</small>
                            </div>
                            <div className="planillas-insight__row-actions">
                              <span className="planillas-insight__pending-amount">
                                {formatMoney(item?.saldo)} <small>pendiente</small>
                              </span>
                              <button
                                type="button"
                                className="planillas-insight__apply-btn"
                                disabled={!selectedPlanilla?.id_planilla || !canAplicarAdelantos}
                                onClick={() => handleApplyFromPendientes(item)}
                              >
                                Aplicar
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {adelantosPendientes.length > 3 ? (
                      <div className="planillas-insight__more">
                        +{adelantosPendientes.length - 3} adelanto(s) adicional(es) en la sucursal.
                      </div>
                    ) : null}
                  </>
                )}

                <div className="planillas-insight__actions">
                  <button
                    type="button"
                    className="planillas-insight__primary"
                    onClick={handleApplyAllPendientes}
                    disabled={
                      loadingAction ||
                      loadingAdelantosPendientes ||
                      adelantosPendientes.length === 0 ||
                      !canAplicarAdelantos ||
                      !selectedPlanilla?.id_planilla
                    }
                  >
                    <i className="bi bi-check2 me-1" />
                    Aplicar Todos
                  </button>
                  <button
                    type="button"
                    className="planillas-insight__ghost"
                    onClick={() => setAdelantosPendientesModalOpen(true)}
                    disabled={loadingAdelantosPendientes}
                  >
                    <i className="bi bi-list-ul me-1" />
                    Ver detalle
                  </button>
                  <button
                    type="button"
                    className="planillas-insight__ghost"
                    onClick={() => setDismissedInsights((prev) => ({ ...prev, adelantos: true }))}
                  >
                    <i className="bi bi-x-lg me-1" />
                    Ignorar
                  </button>
                </div>
              </section>
            ) : null}

            {!dismissedInsights.horas ? (
              <section className="planillas-insight planillas-insight--horas">
                <div className="planillas-insight__head">
                  <div className="planillas-insight__title-wrap">
                    <span className="planillas-insight__icon" aria-hidden="true">
                      <i className="bi bi-clock-history" />
                    </span>
                    <div>
                      <h4>Horas Extra - Sistema Tiempo x Tiempo</h4>
                      <p>
                        En esta empresa, las <strong>horas extra NO se pagan en dinero.</strong> Se compensan con{' '}
                        <strong>tiempo libre equivalente.</strong>
                      </p>
                    </div>
                  </div>
                  <div className="planillas-insight__head-actions">
                    <button
                      type="button"
                      className="planillas-insight__ghost"
                      onClick={() => openHorasExtra()}
                      disabled={!selectedPlanilla?.id_planilla}
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      className="planillas-insight__close"
                      onClick={() => setDismissedInsights((prev) => ({ ...prev, horas: true }))}
                      aria-label="Ocultar bloque de horas extra"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </div>

                <div className="planillas-insight__stats">
                  <article>
                    <span>Total Horas Pendientes</span>
                    <strong>{formatHoursLabel(horasExtraStats.totalPendientes)}</strong>
                  </article>
                  <article>
                    <span>Empleados con H.E.</span>
                    <strong>{safeNumber(horasExtraStats.empleadosConHoras, 0)}</strong>
                  </article>
                  <article>
                    <span>Estado</span>
                    <strong className="planillas-insight__state-chip">NO AFECTA NETO A PAGAR</strong>
                  </article>
                </div>

                <div className="planillas-insight__note">
                  <i className="bi bi-lightbulb" />
                  <span>
                    <strong>Importante:</strong> Las horas extra se registran en la columna "H.E. Tiempo" para
                    control interno. No suman ni restan del calculo monetario de la planilla.
                  </span>
                </div>
              </section>
            ) : null}
          </div>

          <PlanillasResumenCards resumen={resumen} />

          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>
              {loadingPlanillas
                ? 'Cargando planillas...'
                : `Planillas: ${planillas.length} (total: ${planillasTotal})`}
            </span>
            <span>
              {loadingDetalle
                ? 'Cargando detalle...'
                : `Detalle visible: ${pagedDetalle.length} (filtrado: ${filteredDetalle.length} · total: ${detalleTotal})`}
            </span>
          </div>

          {loadingPlanillas ? (
            <PlanillasLoadingState message="Cargando planillas..." />
          ) : listError ? (
            <PlanillasErrorState message={listError} onRetry={loadPlanillas} />
          ) : hasNoData ? (
            <PlanillasEmptyState onGenerar={handleGenerar} canGenerar={canGenerar} />
          ) : loadingDetalle ? (
            <PlanillasLoadingState message="Cargando detalle de planilla..." />
          ) : (
            <>
              {filteredDetalle.length === 0 ? (
                <div className="inv-catpro-empty planillas-state">
                  <div className="inv-catpro-empty-icon">
                    <i className="bi bi-funnel" />
                  </div>
                  <div className="inv-catpro-empty-title">No hay detalle para los filtros aplicados</div>
                  <div className="inv-catpro-empty-sub">Ajusta los filtros avanzados o limpia la busqueda.</div>
                </div>
              ) : (
                <PlanillasTable
                  items={pagedDetalle}
                  page={detallePage}
                  limit={DETAIL_LIMIT}
                  onOpenDetalle={setDetailItem}
                  onOpenMovimientos={openMovimientos}
                  onOpenHorasExtra={openHorasExtra}
                  onOpenBono={(item) => setMovimientoFormModal({ open: true, tipo: 'bono', item, loading: false })}
                  onOpenDeduccion={(item) =>
                    setMovimientoFormModal({ open: true, tipo: 'deduccion', item, loading: false })
                  }
                  onOpenAdelanto={openAdelantos}
                  onRecalcularDetalle={(item) =>
                    withAction(
                      () =>
                        planillasService.recalcularDetallePlanilla(
                          selectedPlanilla.id_planilla,
                          item.id_detalle_planilla || item.id_detalle,
                          { id_sucursal: Number(selectedSucursal || 0) || undefined }
                        ),
                      'Detalle recalculado correctamente'
                    )
                  }
                  canRegistrarMovimiento={canRegistrarMovimiento}
                  canAplicarAdelanto={canAplicarAdelantos}
                  canRecalcular={canRecalcular}
                />
              )}

              <div className="personas-page__pagination">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={detallePage <= 1 || loadingDetalle}
                  onClick={() => setDetallePage((prev) => prev - 1)}
                >
                  <i className="bi bi-chevron-left me-1" />
                  Anterior
                </button>
                <span>
                  Pagina {detallePage} de {totalPagesDetalle}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={detallePage >= totalPagesDetalle || loadingDetalle}
                  onClick={() => setDetallePage((prev) => prev + 1)}
                >
                  Siguiente
                  <i className="bi bi-chevron-right ms-1" />
                </button>
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>

      <PlanillaDetallePanel open={Boolean(detailItem)} item={detailItem} onClose={() => setDetailItem(null)} />

      <PlanillaMovimientosModal
        open={movimientosModal.open}
        item={movimientosModal.item}
        loading={movimientosModal.loading}
        movimientos={movimientosModal.items}
        onClose={() => setMovimientosModal({ open: false, item: null, loading: false, items: [] })}
        onAnular={handleAnularMovimiento}
        canAnular={canAnularMovimiento}
      />

      <PlanillaMovimientoFormModal
        open={movimientoFormModal.open}
        item={movimientoFormModal.item}
        tipo={movimientoFormModal.tipo}
        loading={movimientoFormModal.loading}
        onClose={() => setMovimientoFormModal({ open: false, tipo: 'bono', item: null, loading: false })}
        onSubmit={(payload) => {
          if (!movimientoFormModal.item || !selectedPlanilla?.id_planilla) return;
          withAction(
            async () => {
              setMovimientoFormModal((state) => ({ ...state, loading: true }));
              await planillasService.registrarMovimientoPlanilla(selectedPlanilla.id_planilla, {
                id_detalle:
                  movimientoFormModal.item.id_detalle_planilla || movimientoFormModal.item.id_detalle,
                id_sucursal: Number(selectedSucursal || 0) || undefined,
                ...payload
              });
              setMovimientoFormModal({ open: false, tipo: 'bono', item: null, loading: false });
            },
            'Movimiento registrado correctamente'
          );
        }}
      />

      <PlanillaAdelantosModal
        open={adelantosModal.open}
        item={adelantosModal.item}
        adelantos={adelantosModal.items}
        loading={adelantosModal.loading}
        applying={adelantosModal.applying}
        registering={adelantosModal.registering}
        canRegister={canAplicarAdelantos}
        onClose={() =>
          setAdelantosModal({
            open: false,
            item: null,
            loading: false,
            applying: false,
            registering: false,
            items: []
          })
        }
        onApply={(payload) => {
          if (!adelantosModal.item || !selectedPlanilla?.id_planilla) return;
          withAction(
            async () => {
              setAdelantosModal((state) => ({ ...state, applying: true }));
              await planillasService.aplicarAdelantoPlanilla(selectedPlanilla.id_planilla, {
                id_sucursal: Number(selectedSucursal || 0) || undefined,
                ...payload
              });
              setAdelantosModal({
                open: false,
                item: null,
                loading: false,
                applying: false,
                registering: false,
                items: []
              });
            },
            'Adelanto aplicado correctamente'
          );
        }}
        onRegister={handleRegistrarAdelanto}
      />

      <PlanillaAdelantosPendientesModal
        open={adelantosPendientesModalOpen}
        loading={loadingAdelantosPendientes}
        items={adelantosPendientes}
        hasPlanillaSeleccionada={Boolean(selectedPlanilla?.id_planilla)}
        onClose={() => setAdelantosPendientesModalOpen(false)}
        onApplyForEmpleado={handleApplyFromPendientes}
      />

      <PlanillaHorasExtraModal
        open={horasExtraModal.open}
        loading={horasExtraModal.loading}
        rows={horasExtraModal.items}
        resumen={horasExtraModal.summary}
        empleadoLabel={horasExtraModal.empleadoLabel}
        compensatingId={horasExtraModal.compensatingId}
        registering={horasExtraModal.registering}
        canRegister={canRecalcular}
        defaultEmpleadoId={horasExtraModal.registerEmpleadoId}
        empleados={detalle
          .map((row) => ({
            value: String(row.id_empleado || ''),
            label: extractEmpleadoNombre(row)
          }))
          .filter((empleado) => empleado.value)}
        onClose={() =>
          setHorasExtraModal({
            open: false,
            loading: false,
            item: null,
            empleadoLabel: '',
            items: [],
            summary: {},
            compensatingId: null,
            registering: false,
            registerEmpleadoId: ''
          })
        }
        onCompensar={handleCompensarHoraExtra}
        onRegister={handleRegistrarHoraExtra}
      />

      <PlanillaAuditoriaModal
        open={auditoriaModal.open}
        loading={auditoriaModal.loading}
        items={auditoriaModal.items}
        onClose={() => setAuditoriaModal({ open: false, loading: false, items: [] })}
      />

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        loading={loadingExport}
        resumen={resumen}
        planillaLabel={selectedPlanillaLabel}
      />

      {confirmModal.open ? (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmModal}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">{confirmModal.title}</div>
                <div className="inv-pro-confirm-sub">{confirmModal.subtitle}</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmModal} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">{confirmModal.question}</div>
              {confirmModal.detail ? (
                <div className="inv-pro-confirm-name">
                  <i className={confirmModal.detailIconClass || 'bi bi-wallet2'} />
                  <span>{confirmModal.detail}</span>
                </div>
              ) : null}

              {confirmModal.requireReason ? (
                <div className="mt-2">
                  <label className="form-label fw-semibold mb-1">Motivo (opcional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    maxLength={255}
                    value={confirmModal.reason}
                    onChange={(event) =>
                      setConfirmModal((prev) => ({ ...prev, reason: event.target.value }))
                    }
                    placeholder="Escribe un motivo para la bitacora..."
                  />
                </div>
              ) : null}
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmModal} disabled={loadingAction}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={executeConfirmAction} disabled={loadingAction}>
                {confirmModal.confirmIconClass ? <i className={confirmModal.confirmIconClass} /> : null}
                <span>{loadingAction ? 'Procesando...' : confirmModal.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


