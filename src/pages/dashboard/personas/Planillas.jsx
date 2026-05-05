import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import {
  PLANILLAS_NAV_QUERY_PARAM,
  PLANILLAS_NAV_TAB_KEYS,
  resolvePlanillasNavTab
} from '../../../modules/planillas/navigation';
import sucursalesService from '../../../services/sucursalesService';
import planillasService from '../../../services/planillasService';
import PlanillasHeader from './components/planillas/PlanillasHeader';
import PlanillasResumenCards from './components/planillas/PlanillasResumenCards';
import PlanillasTable from './components/planillas/PlanillasTable';
import PlanillasAdelantosInsight from './components/planillas/PlanillasAdelantosInsight';
import PlanillasHorasExtraInsight from './components/planillas/PlanillasHorasExtraInsight';
import PlanillasBonosDeduccionesInsight from './components/planillas/PlanillasBonosDeduccionesInsight';
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
import PlanillaHorasExtraRegistroModal from './components/planillas/PlanillaHorasExtraRegistroModal';
import PlanillaAdelantosPendientesModal from './components/planillas/PlanillaAdelantosPendientesModal';
import PlanillaAdelantosHistorialModal from './components/planillas/PlanillaAdelantosHistorialModal';
import PlanillaAdelantoRegistroGlobalModal from './components/planillas/PlanillaAdelantoRegistroGlobalModal';
import PlanillaBonosDeduccionesHistorialModal from './components/planillas/PlanillaBonosDeduccionesHistorialModal';
import PayrollFilters from './components/planillas/PayrollFilters';
import ExportModal from './components/planillas/ExportModal';
import { buildPageRangeLabel, buildVisiblePageNumbers } from './components/common/paginationWindow';

const LIST_LIMIT = 20;
const DETAIL_LIMIT = 10;
const DETAIL_FETCH_LIMIT = 2000;
const SUCURSAL_QUERY_PARAM = 'sucursal';
const PAGO_RESUMEN_CARD_KEYS = Object.freeze(['salario_base', 'bonos', 'deducciones', 'adelantos', 'neto']);
const ADELANTO_STATUS = Object.freeze({
  pendiente: 'pendiente',
  aplicado: 'aplicado',
  eliminado: 'eliminado'
});
const MOVIMIENTO_TIPO = Object.freeze({
  bono: 'bono',
  deduccion: 'deduccion'
});
const MOVIMIENTO_ESTADO = Object.freeze({
  vigente: 'vigente',
  anulada: 'anulada'
});
const TIPO_PERIODO = Object.freeze({
  mensual: 'mensual',
  quincenal: 'quincenal'
});
const QUINCENA_DEFAULT = '1';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const normalizeTipoPeriodo = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === TIPO_PERIODO.quincenal) return TIPO_PERIODO.quincenal;
  return TIPO_PERIODO.mensual;
};

const normalizeQuincena = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized === '2' ? '2' : '1';
};

const resolvePeriodoOperativoLabel = ({ periodo, tipoPeriodo, quincena }) => {
  const periodoLabel = String(periodo || '').trim() || 'Sin periodo';
  if (normalizeTipoPeriodo(tipoPeriodo) !== TIPO_PERIODO.quincenal) return `${periodoLabel} (Mensual)`;
  const quincenaLabel = normalizeQuincena(quincena) === '2' ? 'Q2 (16-fin)' : 'Q1 (1-15)';
  return `${periodoLabel} · ${quincenaLabel}`;
};

const buildPlanillasSucursalSelectStyles = () => ({
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 12,
    borderColor: state.isFocused ? 'rgba(158, 105, 61, 0.72)' : 'rgba(206, 196, 177, 0.9)',
    boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(158, 105, 61, 0.18)' : 'none',
    backgroundColor: '#fff',
    '&:hover': {
      borderColor: 'rgba(158, 105, 61, 0.72)'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  placeholder: (base) => ({
    ...base,
    color: 'rgba(98, 83, 73, 0.75)'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#2f1a10'
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'rgba(99, 58, 37, 0.9)' : 'rgba(99, 58, 37, 0.65)'
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgba(120, 84, 66, 0.72)'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 4200
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: '1px solid rgba(206, 196, 177, 0.9)',
    overflow: 'hidden',
    marginTop: 6,
    boxShadow: '0 14px 30px rgba(60, 36, 22, 0.2)'
  }),
  option: (base, state) => ({
    ...base,
    padding: '10px 12px',
    backgroundColor: state.isFocused
      ? 'rgba(245, 235, 221, 0.95)'
      : state.isSelected
        ? 'rgba(236, 218, 198, 0.96)'
        : '#fff',
    color: '#2f1a10'
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'rgba(100, 68, 50, 0.82)',
    fontSize: '0.92rem'
  })
});

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

const collectPaginatedApiRows = async (fetchPage, { pageSize = 100, maxPages = 80 } = {}) => {
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(String(pageSize), 10) || 100));
  const safeMaxPages = Math.max(1, Number.parseInt(String(maxPages), 10) || 80);
  const rows = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (page <= safeMaxPages && rows.length < total) {
    const response = await fetchPage({ page, limit: safePageSize });
    const parsed = normalizeListResponse(response);
    const chunk = Array.isArray(parsed.items) ? parsed.items : [];
    const parsedTotal = Number(parsed.total);
    if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
      total = parsedTotal;
    }

    rows.push(...chunk);
    if (chunk.length < safePageSize) break;
    page += 1;
  }

  return rows;
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

const resolveDniValue = (row = {}) =>
  toText(
    row?.dni ||
      row?.persona_dni ||
      row?.dni_persona ||
      row?.numero_dni ||
      row?.identidad ||
      row?.no_identidad ||
      row?.documento_identidad ||
      row?.documento ||
      row?.cedula
  );

const resolveDeduccionesSinAdelantos = ({
  salarioBase = 0,
  bonos = 0,
  deduccionesRaw = 0,
  adelantos = 0,
  neto = Number.NaN,
  deduccionesExplicit = Number.NaN
} = {}) => {
  const raw = Math.max(0, safeNumber(deduccionesRaw, 0));
  const adelantosAplicados = Math.max(0, safeNumber(adelantos, 0));
  const explicit = safeNumber(deduccionesExplicit, Number.NaN);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  if (raw === 0) return 0;

  const netoEsperado = safeNumber(neto, Number.NaN);
  if (Number.isFinite(netoEsperado)) {
    const base = safeNumber(salarioBase, 0);
    const totalBonos = safeNumber(bonos, 0);
    const netoSiDeduccionesSeparadas = base + totalBonos - raw - adelantosAplicados;
    const netoSiDeduccionesIncluyenAdelantos = base + totalBonos - raw;

    const diffSeparadas = Math.abs(netoSiDeduccionesSeparadas - netoEsperado);
    const diffIncluidas = Math.abs(netoSiDeduccionesIncluyenAdelantos - netoEsperado);

    if (diffIncluidas + 0.01 < diffSeparadas) {
      return Math.max(0, raw - adelantosAplicados);
    }
    if (diffSeparadas + 0.01 < diffIncluidas) {
      return raw;
    }
  }

  if (adelantosAplicados > 0 && raw >= adelantosAplicados) {
    return Math.max(0, raw - adelantosAplicados);
  }

  return raw;
};

const normalizeDetalleRowForDisplay = (row = {}) => {
  const adelantos = Math.max(
    0,
    safeNumber(
      row?.total_adelantos_aplicados ??
        row?.total_adelantos ??
        row?.adelantos_aplicados ??
        row?.adelantos,
      0
    )
  );

  const deduccionesRaw = Math.max(0, safeNumber(row?.total_deducciones ?? row?.deducciones, 0));
  const deducciones = resolveDeduccionesSinAdelantos({
    salarioBase: row?.salario_base,
    bonos: row?.total_bonos ?? row?.bonos,
    deduccionesRaw,
    adelantos,
    neto: row?.neto_pagar ?? row?.total_neto_pagar ?? row?.neto,
    deduccionesExplicit: row?.total_deducciones_sin_adelantos ?? row?.deducciones_sin_adelantos
  });

  return {
    ...row,
    dni: resolveDniValue(row),
    total_deducciones_raw: deduccionesRaw,
    total_deducciones: deducciones,
    deducciones,
    total_adelantos_aplicados: adelantos,
    total_adelantos: adelantos,
    adelantos
  };
};

const normalizeResumenForDisplay = (resumen = {}) => {
  const adelantos = Math.max(
    0,
    safeNumber(
      resumen?.total_adelantos_aplicados ??
        resumen?.total_adelantos ??
        resumen?.adelantos_aplicados ??
        resumen?.adelantos,
      0
    )
  );

  const deduccionesRaw = Math.max(0, safeNumber(resumen?.total_deducciones ?? resumen?.deducciones, 0));
  const deducciones = resolveDeduccionesSinAdelantos({
    salarioBase: resumen?.total_salario_base ?? resumen?.salario_base_total,
    bonos: resumen?.total_bonos ?? resumen?.bonos,
    deduccionesRaw,
    adelantos,
    neto: resumen?.total_neto_pagar ?? resumen?.total_neto ?? resumen?.neto,
    deduccionesExplicit: resumen?.total_deducciones_sin_adelantos ?? resumen?.deducciones_sin_adelantos
  });

  return {
    ...resumen,
    total_deducciones_raw: deduccionesRaw,
    total_deducciones: deducciones,
    deducciones,
    total_adelantos_aplicados: adelantos,
    total_adelantos: adelantos,
    adelantos
  };
};

const formatMoney = (value) => {
  const amount = safeNumber(value, 0);
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const resolveToastIconClass = (variant = 'success') => {
  if (variant === 'danger') return 'bi bi-x-octagon-fill';
  if (variant === 'warning') return 'bi bi-exclamation-triangle-fill';
  if (variant === 'info') return 'bi bi-info-circle-fill';
  return 'bi bi-check2-circle';
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

const resolveHoraExtraId = (item = {}) =>
  item?.id_horas_extras || item?.id_horas_extra || item?.id_hora_extra || null;

const resolveHoraExtraEmpleadoId = (item = {}) =>
  safeNumber(item?.id_empleado ?? item?.id_empleado_planilla ?? item?.id_persona_empleado, 0);

const normalizeStatusNote = (value = '') => String(value ?? '').trim().toLowerCase();

const stripAdelantoStatusMarkers = (value = '') =>
  String(value ?? '')
    .replace(/\[(eliminado_ad|corregido_ad)\]\s*/gi, '')
    .replace(/edici[oó]n?\s+deshabilitada:\s*este movimiento no tiene id_adelanto reutilizable\.?/gi, '')
    .trim();

const resolveMovimientoPlanillaId = (row = {}) =>
  safeNumber(row?.id_movimiento_planilla ?? row?.id_movimiento ?? row?.id_movimiento_detalle ?? row?.id, 0);

const resolveAdelantoPeriodo = (row = {}) => {
  const periodCandidates = [
    row?.periodo,
    row?.periodo_planilla,
    row?.periodo_nomina,
    row?.periodo_pago,
    row?.mes_periodo,
    row?.mes_planilla,
    row?.periodo_movimiento,
    row?.periodo_referencia
  ];
  for (const value of periodCandidates) {
    const normalized = normalizePeriodoMonth(value);
    if (normalized) return normalized;
  }

  const dateCandidates = [
    row?.fecha_periodo,
    row?.fecha_inicio_periodo,
    row?.fecha_inicio,
    row?.fecha_aplicacion,
    row?.fecha_registro,
    row?.fecha,
    row?.created_at
  ];
  for (const value of dateCandidates) {
    const normalized = normalizePeriodoMonth(value);
    if (normalized) return normalized;
  }

  return '';
};

const resolveDatePartsFromAny = (value = '') => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    const maxDay = new Date(year, month, 0).getDate();
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= maxDay
    ) {
      return { year, month, day };
    }
  }

  const dayFirstMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/);
  if (dayFirstMatch) {
    const day = Number.parseInt(dayFirstMatch[1], 10);
    const month = Number.parseInt(dayFirstMatch[2], 10);
    const year = Number.parseInt(dayFirstMatch[3], 10);
    const maxDay = new Date(year, month, 0).getDate();
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= maxDay
    ) {
      return { year, month, day };
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate()
  };
};

const matchesAdelantoContext = ({
  row = {},
  periodoScope = '',
  tipoPeriodoScope = TIPO_PERIODO.mensual,
  quincenaScope = QUINCENA_DEFAULT
} = {}) => {
  const normalizedTipo = normalizeTipoPeriodo(tipoPeriodoScope);
  if (normalizedTipo !== TIPO_PERIODO.quincenal) return true;

  const dateCandidates = [
    row?.fecha,
    row?.fecha_registro,
    row?.created_at,
    row?.fecha_aplicacion,
    row?.fecha_periodo,
    row?.fecha_inicio_periodo,
    row?.fecha_inicio
  ];

  let dateParts = null;
  for (const candidate of dateCandidates) {
    dateParts = resolveDatePartsFromAny(candidate);
    if (dateParts) break;
  }
  if (!dateParts) return false;

  const targetPeriodo = normalizePeriodoMonth(periodoScope);
  if (targetPeriodo) {
    const rowPeriodo = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}`;
    if (rowPeriodo !== targetPeriodo) return false;
  }

  const targetQuincena = normalizeQuincena(quincenaScope);
  if (targetQuincena === '1') return dateParts.day >= 1 && dateParts.day <= 15;
  return dateParts.day >= 16;
};

const resolveMovimientoPlanillaOwnerId = (row = {}) =>
  safeNumber(
    row?.id_planilla ??
      row?.id_planilla_nomina ??
      row?.id_planilla_detalle ??
      row?.id_planilla_movimiento ??
      row?.id_planilla_origen ??
      row?.planilla_id ??
      row?.planillaId,
    0
  );

const scopeMovimientosToPlanillaContext = ({
  movimientos = [],
  detalleRows = [],
  idPlanilla = 0,
  periodoScope = ''
} = {}) => {
  const rows = Array.isArray(movimientos) ? movimientos : [];
  const detailIds = new Set(
    (Array.isArray(detalleRows) ? detalleRows : [])
      .map((row) => safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0))
      .filter((id) => id > 0)
      .map((id) => String(id))
  );
  const targetPlanillaId = safeNumber(idPlanilla, 0);
  const targetPeriodo = normalizePeriodoMonth(periodoScope);

  if (detailIds.size === 0 && targetPlanillaId <= 0) {
    return rows;
  }

  return rows.filter((row) => {
    const rowPlanillaId = resolveMovimientoPlanillaOwnerId(row);
    if (targetPlanillaId > 0 && rowPlanillaId > 0 && rowPlanillaId !== targetPlanillaId) {
      return false;
    }

    const rowDetailId = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
    const hasDetailMatch = rowDetailId > 0 && detailIds.has(String(rowDetailId));
    const hasPlanillaMatch = rowPlanillaId > 0 && targetPlanillaId > 0 && rowPlanillaId === targetPlanillaId;

    // If we have context identifiers, require at least one strong match.
    if (targetPlanillaId > 0 || detailIds.size > 0) {
      const canUseDetailFallback = rowPlanillaId <= 0 && hasDetailMatch;
      if (!hasPlanillaMatch && !canUseDetailFallback) {
        return false;
      }
    }

    if (targetPeriodo) {
      const rowPeriodo = resolveAdelantoPeriodo(row);
      if (!rowPeriodo || rowPeriodo !== targetPeriodo) {
        return false;
      }
    }

    return true;
  });
};

const resolveAdelantoOrigenId = (row = {}) =>
  safeNumber(
    row?.id_adelanto_salario ??
      row?.id_adelanto ??
      row?.id_adelanto_origen ??
      row?.adelanto_id ??
      row?.id_adelanto_planilla ??
      row?.id_adelanto_detalle ??
      row?.id_adelanto_aplicado ??
      row?.id_origen ??
      row?.id_origen_movimiento ??
      row?.origen_id ??
      row?.id_referencia ??
      row?.id_referencia_origen ??
      row?.referencia_id ??
      row?.id_registro_origen,
    0
  );

const resolveAdelantoEmpleadoId = (row = {}, detalleByDetalleId = new Map()) => {
  const direct = safeNumber(row?.id_empleado ?? row?.id_empleado_planilla ?? row?.id_persona_empleado, 0);
  if (direct > 0) return direct;

  const idDetalle = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
  if (!(idDetalle > 0)) return 0;

  const detalleRow = detalleByDetalleId.get(String(idDetalle));
  return safeNumber(detalleRow?.id_empleado, 0);
};

const isMovimientoAdelanto = (row = {}) => {
  const tipo = normalizeMovimientoTipo(row);
  const origen = toText(row?.origen_movimiento, '').toLowerCase();
  const concepto = toText(row?.concepto, '').toLowerCase();
  return (
    origen.includes('adelanto') ||
    tipo.includes('adelanto') ||
    concepto.includes('adelanto') ||
    resolveAdelantoOrigenId(row) > 0
  );
};

const isMovimientoAnulado = (row = {}) => {
  const estado = toText(row?.estado || row?.estado_movimiento || row?.estado_descripcion, '').toLowerCase();
  const note = normalizeStatusNote(row?.observacion || row?.motivo || '');

  return (
    row?.anulado === true ||
    row?.es_anulado === true ||
    row?.activo === false ||
    estado.includes('anulad') ||
    note.includes('[eliminado_ad]') ||
    note.includes('eliminado') ||
    note.includes('anulado')
  );
};

const sortByDateDesc = (a = {}, b = {}) => {
  const aDate = new Date(a?.fecha || 0).getTime();
  const bDate = new Date(b?.fecha || 0).getTime();
  if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) return bDate - aDate;
  return String(b?.id || '').localeCompare(String(a?.id || ''), 'es-HN');
};

const normalizeAdelantosDataset = ({
  pendientes = [],
  movimientos = [],
  detalleRows = [],
  onlyEmpleadoId = 0,
  periodoScope = '',
  tipoPeriodoScope = TIPO_PERIODO.mensual,
  quincenaScope = QUINCENA_DEFAULT
} = {}) => {
  const normalizedPeriodoScope = normalizePeriodoMonth(periodoScope);
  const matchesPeriodoScope = (row = {}) => {
    if (!normalizedPeriodoScope) return true;
    const rowPeriodo = resolveAdelantoPeriodo(row);
    if (!rowPeriodo) return false;
    return rowPeriodo === normalizedPeriodoScope;
  };

  const detalleByDetalleId = new Map();
  const detalleByEmpleadoId = new Map();

  (Array.isArray(detalleRows) ? detalleRows : []).forEach((row) => {
    const idEmpleado = safeNumber(row?.id_empleado, 0);
    if (idEmpleado > 0) {
      detalleByEmpleadoId.set(String(idEmpleado), row);
    }

    const idDetalle = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
    if (idDetalle > 0) {
      detalleByDetalleId.set(String(idDetalle), row);
    }
  });

  const pendingRows = (Array.isArray(pendientes) ? pendientes : [])
    .map((item, index) => {
      const idEmpleado = safeNumber(item?.id_empleado, 0);
      const idAdelanto = safeNumber(item?.id_adelanto_salario ?? item?.id_adelanto, 0);
      const detalleRow = detalleByEmpleadoId.get(String(idEmpleado));
      const empleadoNombre = toText(
        item?.nombre_completo || item?.empleado_nombre || extractEmpleadoNombre(detalleRow),
        'Empleado'
      );
      const saldo = Math.max(0, safeNumber(item?.saldo ?? item?.monto_pendiente ?? item?.saldo_disponible, 0));

      return {
        id: `pendiente-${idAdelanto || index}`,
        estado: ADELANTO_STATUS.pendiente,
        id_movimiento: null,
        id_adelanto: idAdelanto || null,
        id_empleado: idEmpleado || null,
        id_detalle: safeNumber(detalleRow?.id_detalle_planilla ?? detalleRow?.id_detalle, 0) || null,
        monto: Math.max(0, safeNumber(item?.monto, 0)),
        saldo,
        fecha: toText(item?.fecha || item?.fecha_registro, ''),
        observacion: toText(item?.observacion, ''),
        empleado_nombre: empleadoNombre,
        cargo: toText(item?.cargo || detalleRow?.cargo, ''),
        editable: false,
        raw: item
      };
    })
    .filter((item) => {
      if (onlyEmpleadoId > 0) return safeNumber(item?.id_empleado, 0) === onlyEmpleadoId;
      return true;
    })
    .filter((item) => matchesPeriodoScope(item?.raw || item))
    .filter((item) =>
      matchesAdelantoContext({
        row: item?.raw || item,
        periodoScope,
        tipoPeriodoScope,
        quincenaScope
      })
    );

  const movimientoRows = (Array.isArray(movimientos) ? movimientos : [])
    .filter((row) => isMovimientoAdelanto(row))
    .map((row, index) => {
      const idMovimiento = resolveMovimientoPlanillaId(row);
      const idAdelanto = resolveAdelantoOrigenId(row);
      const idEmpleado = resolveAdelantoEmpleadoId(row, detalleByDetalleId);
      const detalleRow = detalleByEmpleadoId.get(String(idEmpleado));
      const empleadoNombre = toText(
        row?.nombre_completo || row?.empleado_nombre || extractEmpleadoNombre(detalleRow),
        idEmpleado > 0 ? `Empleado #${idEmpleado}` : 'Empleado'
      );
      const estado = isMovimientoAnulado(row) ? ADELANTO_STATUS.eliminado : ADELANTO_STATUS.aplicado;
      const idDetalleMovimiento =
        safeNumber(
          row?.id_detalle_planilla ?? row?.id_detalle ?? detalleRow?.id_detalle_planilla ?? detalleRow?.id_detalle,
          0
        ) || null;
      const editable = Boolean(estado === ADELANTO_STATUS.aplicado && (idAdelanto > 0 || (idMovimiento > 0 && idDetalleMovimiento > 0)));

      return {
        id: `mov-${idMovimiento || index}`,
        estado,
        id_movimiento: idMovimiento || null,
        id_adelanto: idAdelanto || null,
        id_empleado: idEmpleado || null,
        id_detalle: idDetalleMovimiento,
        monto: Math.max(0, safeNumber(row?.monto_aplicado ?? row?.monto, 0)),
        saldo: 0,
        fecha: toText(row?.fecha_registro || row?.fecha || row?.created_at, ''),
        observacion: stripAdelantoStatusMarkers(toText(row?.observacion || row?.motivo, '')),
        empleado_nombre: empleadoNombre,
        cargo: toText(row?.cargo || detalleRow?.cargo, ''),
        editable,
        raw: row
      };
    })
    .filter((item) => {
      if (onlyEmpleadoId > 0) return safeNumber(item?.id_empleado, 0) === onlyEmpleadoId;
      return true;
    })
    .filter((item) => matchesPeriodoScope(item?.raw || item))
    .filter((item) =>
      matchesAdelantoContext({
        row: item?.raw || item,
        periodoScope,
        tipoPeriodoScope,
        quincenaScope
      })
    );

  const merged = [...pendingRows, ...movimientoRows];
  merged.sort(sortByDateDesc);
  return merged;
};

const normalizeBonoDeduccionTipo = (row = {}) => {
  const tipo = normalizeMovimientoTipo(row);
  if (tipo.includes('bono')) return MOVIMIENTO_TIPO.bono;
  if (tipo.includes('deduc')) return MOVIMIENTO_TIPO.deduccion;
  return '';
};

const normalizeBonosDeduccionesDataset = ({ movimientos = [], detalleRows = [] } = {}) => {
  const detalleByDetalleId = new Map();

  (Array.isArray(detalleRows) ? detalleRows : []).forEach((row) => {
    const idDetalle = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
    if (idDetalle > 0) {
      detalleByDetalleId.set(String(idDetalle), row);
    }
  });

  const rows = (Array.isArray(movimientos) ? movimientos : [])
    .map((row, index) => {
      const tipo = normalizeBonoDeduccionTipo(row);
      if (!tipo) return null;

      const idMovimiento = resolveMovimientoPlanillaId(row);
      const idDetalle = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
      const detalleRow = idDetalle > 0 ? detalleByDetalleId.get(String(idDetalle)) : null;
      const idEmpleado = resolveAdelantoEmpleadoId(row, detalleByDetalleId);
      const estado = isMovimientoAnulado(row) ? MOVIMIENTO_ESTADO.anulada : MOVIMIENTO_ESTADO.vigente;

      return {
        id: `mov-bd-${idMovimiento || index}`,
        id_movimiento: idMovimiento || null,
        id_detalle: idDetalle || null,
        id_empleado: idEmpleado || null,
        tipo,
        estado,
        monto: Math.max(0, safeNumber(row?.monto, 0)),
        concepto: toText(row?.concepto, ''),
        fecha: toText(row?.fecha_registro || row?.fecha || row?.created_at, ''),
        observacion: stripAdelantoStatusMarkers(toText(row?.observacion || row?.motivo, '')),
        empleado_nombre: toText(
          row?.nombre_completo || row?.empleado_nombre || extractEmpleadoNombre(detalleRow),
          'Empleado'
        ),
        raw: row
      };
    })
    .filter(Boolean);

  rows.sort(sortByDateDesc);
  return rows;
};


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
  description: '',
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

const normalizePeriodoMonth = (value = '') => {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const yearMonthMatch = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonthMatch) {
    const year = Number.parseInt(yearMonthMatch[1], 10);
    const month = Number.parseInt(yearMonthMatch[2], 10);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  const yearMonthDayMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yearMonthDayMatch) {
    const year = Number.parseInt(yearMonthDayMatch[1], 10);
    const month = Number.parseInt(yearMonthDayMatch[2], 10);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  const isoPrefixMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoPrefixMatch) {
    const year = Number.parseInt(isoPrefixMatch[1], 10);
    const month = Number.parseInt(isoPrefixMatch[2], 10);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  const dayFirstMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/);
  if (dayFirstMatch) {
    const day = Number.parseInt(dayFirstMatch[1], 10);
    const month = Number.parseInt(dayFirstMatch[2], 10);
    const year = Number.parseInt(dayFirstMatch[3], 10);
    const maxDay = new Date(year, month, 0).getDate();
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= maxDay
    ) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseDateParts = (value = '') => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    const maxDay = new Date(year, month, 0).getDate();
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= maxDay
    ) {
      return {
        year,
        month,
        day,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      };
    }
  }

  const dayFirstMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const day = Number.parseInt(dayFirstMatch[1], 10);
    const month = Number.parseInt(dayFirstMatch[2], 10);
    const year = Number.parseInt(dayFirstMatch[3], 10);
    const maxDay = new Date(year, month, 0).getDate();
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= maxDay
    ) {
      return {
        year,
        month,
        day,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      };
    }
  }

  return null;
};

const resolveAdelantoFechaEnContexto = ({
  rawFecha = '',
  periodo = '',
  tipoPeriodo = TIPO_PERIODO.mensual,
  quincena = QUINCENA_DEFAULT
} = {}) => {
  const periodoNormalizado = normalizePeriodoMonth(periodo);
  if (!periodoNormalizado) return null;

  const [yearText, monthText] = periodoNormalizado.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const lastDay = new Date(year, month, 0).getDate();
  const tipoNormalizado = normalizeTipoPeriodo(tipoPeriodo);
  const quincenaNormalizada = normalizeQuincena(quincena);
  const minDay = tipoNormalizado === TIPO_PERIODO.quincenal && quincenaNormalizada === '2' ? 16 : 1;
  const maxDay = tipoNormalizado === TIPO_PERIODO.quincenal && quincenaNormalizada === '1' ? 15 : lastDay;
  const fallbackDay = Math.min(Math.max(minDay, 1), maxDay);
  const fallbackIso = `${yearText}-${monthText}-${String(fallbackDay).padStart(2, '0')}`;

  const parsed = parseDateParts(rawFecha);
  if (!parsed) return fallbackIso;

  if (parsed.year !== year || parsed.month !== month) return fallbackIso;
  if (parsed.day < minDay || parsed.day > maxDay) return fallbackIso;

  return parsed.iso;
};

const resolvePlanillaId = (planilla = {}) => safeNumber(planilla?.id_planilla, 0);

const resolvePlanillaPeriodo = (planilla = {}) => {
  const directPeriodo = toText(
    planilla?.periodo ||
      planilla?.periodo_planilla ||
      planilla?.periodo_nomina ||
      planilla?.periodo_pago ||
      planilla?.mes_periodo ||
      planilla?.mes_planilla,
    ''
  );
  if (directPeriodo) {
    const normalized = normalizePeriodoMonth(directPeriodo);
    if (normalized) return normalized;
  }

  const anio = safeNumber(planilla?.anio ?? planilla?.ano ?? planilla?.year, 0);
  const mes = safeNumber(planilla?.mes ?? planilla?.mes_numero ?? planilla?.month, 0);
  if (anio > 0 && mes >= 1 && mes <= 12) {
    return `${anio}-${String(mes).padStart(2, '0')}`;
  }

  return normalizePeriodoMonth(
    planilla?.fecha_inicio_periodo ||
      planilla?.fecha_inicio ||
      planilla?.fecha_planilla ||
      planilla?.fecha_pago ||
      planilla?.created_at ||
      ''
  );
};

const resolvePlanillaTipoPeriodo = (planilla = {}) => {
  const rawTipo = String(
    planilla?.tipo_periodo ??
      planilla?.periodo_tipo ??
      planilla?.tipoPeriodo ??
      ''
  )
    .trim()
    .toLowerCase();

  if (rawTipo === TIPO_PERIODO.quincenal) return TIPO_PERIODO.quincenal;
  if (rawTipo === TIPO_PERIODO.mensual) return TIPO_PERIODO.mensual;

  const rawQuincena = String(
    planilla?.quincena ??
      planilla?.numero_quincena ??
      planilla?.id_quincena ??
      planilla?.subperiodo ??
      ''
  )
    .trim()
    .toLowerCase();

  if (rawQuincena === '1' || rawQuincena === '2' || rawQuincena.includes('q1') || rawQuincena.includes('q2')) {
    return TIPO_PERIODO.quincenal;
  }

  return TIPO_PERIODO.mensual;
};

const resolvePlanillaQuincena = (planilla = {}) => {
  const numericCandidates = [planilla?.quincena, planilla?.numero_quincena, planilla?.id_quincena];
  for (const candidate of numericCandidates) {
    const parsed = Number.parseInt(String(candidate ?? '').trim(), 10);
    if (parsed === 1 || parsed === 2) return String(parsed);
  }

  const textCandidates = [
    planilla?.subperiodo,
    planilla?.periodo_subtipo,
    planilla?.periodo_label,
    planilla?.descripcion_periodo,
    planilla?.codigo_planilla
  ];
  for (const candidate of textCandidates) {
    const text = String(candidate ?? '').trim().toLowerCase();
    if (!text) continue;
    if (/(^|\b)q\s*1(\b|$)/i.test(text) || /quincena\s*1/i.test(text)) return '1';
    if (/(^|\b)q\s*2(\b|$)/i.test(text) || /quincena\s*2/i.test(text)) return '2';
  }

  const inicioPeriodo = String(planilla?.periodo_inicio ?? planilla?.fecha_inicio_periodo ?? '').trim();
  if (inicioPeriodo) {
    const parsed = new Date(inicioPeriodo);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getUTCDate() <= 15 ? '1' : '2';
    }
  }

  return null;
};

const scopePlanillasByContext = ({
  items = [],
  periodoTarget = '',
  tipoPeriodoTarget = TIPO_PERIODO.mensual,
  quincenaTarget = null
} = {}) => {
  const rows = Array.isArray(items) ? items : [];
  const normalizedTarget = normalizePeriodoMonth(periodoTarget);
  const normalizedTipo = normalizeTipoPeriodo(tipoPeriodoTarget);
  const normalizedQuincena =
    normalizedTipo === TIPO_PERIODO.quincenal ? normalizeQuincena(quincenaTarget) : null;

  const rowsWithContext = rows.map((row) => ({
    row,
    periodo: resolvePlanillaPeriodo(row),
    tipo: resolvePlanillaTipoPeriodo(row),
    quincena: resolvePlanillaQuincena(row)
  }));

  let filtered = rowsWithContext;
  if (normalizedTarget) {
    const hasAtLeastOnePeriodo = rowsWithContext.some((entry) => Boolean(entry.periodo));
    if (hasAtLeastOnePeriodo) {
      filtered = filtered.filter((entry) => entry.periodo === normalizedTarget);
    }
  }

  if (normalizedTipo === TIPO_PERIODO.quincenal) {
    filtered = filtered.filter((entry) => entry.tipo === TIPO_PERIODO.quincenal);
    if (normalizedQuincena) {
      filtered = filtered.filter((entry) => entry.quincena === String(normalizedQuincena));
    }
  } else {
    filtered = filtered.filter((entry) => entry.tipo === TIPO_PERIODO.mensual);
  }

  return filtered.map((entry) => entry.row);
};

const pickContextPlanilla = ({
  items = [],
  periodoTarget = '',
  tipoPeriodoTarget = TIPO_PERIODO.mensual,
  quincenaTarget = null
} = {}) =>
  scopePlanillasByContext({
    items,
    periodoTarget,
    tipoPeriodoTarget,
    quincenaTarget
  }).find((planilla) => resolvePlanillaId(planilla) > 0) || null;

const buildEmpleadoOption = (item = {}) => {
  const idEmpleado = safeNumber(item?.id_empleado ?? item?.id_empleado_planilla ?? item?.id_persona_empleado, 0);
  if (!(idEmpleado > 0)) return null;

  const label = extractEmpleadoNombre(item);
  const searchText = [label, item?.dni, item?.cargo, item?.id_empleado]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  return {
    value: String(idEmpleado),
    label,
    searchText
  };
};

const createPrintWindow = () => {
  const popup = window.open('', '_blank', 'width=1150,height=900');
  if (!popup) throw new Error('No se pudo abrir la vista imprimible. Habilita ventanas emergentes.');
  return popup;
};

const showPendingPrintWindow = (popup) => {
  if (!popup || popup.closed) return;
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generando vista imprimible...</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; color: #2f1a10; background: #fff; }
    .box { text-align: center; padding: 28px 32px; border: 1px solid rgba(129,103,84,.28); border-radius: 14px; }
    .box h1 { margin: 0 0 8px; font-size: 1.1rem; }
    .box p { margin: 0; color: #6e5a4d; }
  </style>
</head>
<body>
  <section class="box">
    <h1>Generando vista imprimible...</h1>
    <p>Espera un momento, estamos preparando el documento.</p>
  </section>
</body>
</html>`);
  popup.document.close();
};

const openPrintWindow = (html, popupRef = null) => {
  const popup = popupRef && !popupRef.closed ? popupRef : createPrintWindow();
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 220);
};

const buildDetalleLookupMaps = (rows = []) => {
  const byDetalle = new Map();
  const byEmpleado = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const detalleId = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
    if (detalleId > 0 && !byDetalle.has(String(detalleId))) {
      byDetalle.set(String(detalleId), row);
    }

    const empleadoId = safeNumber(row?.id_empleado ?? row?.id_empleado_planilla ?? row?.id_persona_empleado, 0);
    if (empleadoId > 0 && !byEmpleado.has(String(empleadoId))) {
      byEmpleado.set(String(empleadoId), row);
    }
  });

  return { byDetalle, byEmpleado };
};

const resolveMovimientoEmpleadoNombre = (row = {}, detalleLookup = { byDetalle: new Map(), byEmpleado: new Map() }) => {
  const inlineName = toText(
    row?.empleado_nombre ||
      row?.nombre_completo ||
      row?.nombre_empleado ||
      `${toText(row?.nombre)} ${toText(row?.apellido)}`.trim()
  );
  if (inlineName) return inlineName;

  const detalleId = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
  if (detalleId > 0) {
    const detalleRow = detalleLookup.byDetalle?.get?.(String(detalleId));
    if (detalleRow) return extractEmpleadoNombre(detalleRow);
  }

  const empleadoId = safeNumber(row?.id_empleado ?? row?.id_empleado_planilla ?? row?.id_persona_empleado, 0);
  if (empleadoId > 0) {
    const detalleRow = detalleLookup.byEmpleado?.get?.(String(empleadoId));
    if (detalleRow) return extractEmpleadoNombre(detalleRow);
    return `Empleado ID ${empleadoId}`;
  }

  return 'Empleado no identificado';
};

const buildPrintTemplate = ({ planillaLabel, periodo, resumen, rows, includeCorreo, movimientos }) => {
  const totalColumns = includeCorreo ? 18 : 17;
  const detalleLookup = buildDetalleLookupMaps(rows);
  const generatedAt = new Date().toLocaleString('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

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
        <td class="employee-col">${escapeHtml(resolveMovimientoEmpleadoNombre(row, detalleLookup))}</td>
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
    :root { --bg:#ffffff; --ink:#1f2937; --muted:#4b5563; --line:#d1d5db; --panel:#ffffff; --head:#f3f4f6; --accent:#111827; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; background: var(--bg); color: var(--ink); font-family: "Segoe UI", system-ui, sans-serif; }
    .sheet { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(17,24,39,.06); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
    .head h1 { margin: 0; font-size: 24px; line-height: 1.2; color: var(--accent); }
    .head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
    .head .meta { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .badge { border-radius: 999px; padding: 6px 12px; font-weight: 700; font-size: 11px; background: #f9fafb; border: 1px solid var(--line); color: #111827; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .summary > div { border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #fff; }
    .summary span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .summary strong { font-size: 17px; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; table-layout: fixed; }
    th { background: var(--head); color: #111827; padding: 7px 6px; border: 1px solid var(--line); text-transform: uppercase; letter-spacing: .04em; font-size: 8.4px; text-align: left; }
    td { border: 1px solid var(--line); padding: 6px; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
    tbody tr:nth-child(even) td { background: #fbfbfc; }
    .section-title { margin: 18px 0 6px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
    .employee-col { font-weight: 600; color: #0f172a; }
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
        <p>Periodo: ${escapeHtml(periodo || 'Sin periodo')} - Empleados: ${rows.length}</p>
        <div class="meta">Generado: ${escapeHtml(generatedAt)}</div>
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
        ? `<div class="section-title">Movimientos</div><table><thead><tr><th>Tipo</th><th>Empleado</th><th>Concepto</th><th>Monto</th><th>Observacion</th><th>Fecha</th></tr></thead><tbody>${movimientosHtml}</tbody></table>`
        : ''
    }
  </section>
</body>
</html>`;
};

export default function Planillas({
  openToast,
  selectedSucursalId = ''
}) {
  const { canAny } = usePermisos();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const rawPlanillasTab = String(searchParams.get(PLANILLAS_NAV_QUERY_PARAM) || '').trim().toLowerCase();
  const activePlanillasTab = useMemo(
    () => resolvePlanillasNavTab(rawPlanillasTab),
    [rawPlanillasTab]
  );
  const showPagoSection = activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.pagoPlanilla;
  const showHorasSection = activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.horasExtras;
  const showAdelantosSection = activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.adelantosSalario;
  const showBonosDeduccionesSection = activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.bonosDeducciones;
  const showPlanillaActions = showPagoSection;

  const [localToast, setLocalToast] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success'
  });

  const closeLocalToast = useCallback(() => {
    setLocalToast((previous) => ({ ...previous, show: false }));
  }, []);

  const safeToast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') {
        openToast(title, message, variant);
        return;
      }
      setLocalToast({
        show: true,
        title: toText(title, 'AVISO'),
        message: toText(message, ''),
        variant: toText(variant, 'success')
      });
    },
    [openToast]
  );

  useEffect(() => {
    if (!localToast.show) return undefined;
    const timer = window.setTimeout(() => {
      setLocalToast((previous) => ({ ...previous, show: false }));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [localToast.show]);

  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [periodo, setPeriodo] = useState(currentMonth());
  const [tipoPeriodo, setTipoPeriodo] = useState(TIPO_PERIODO.mensual);
  const [quincena, setQuincena] = useState(QUINCENA_DEFAULT);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [listPage, setListPage] = useState(1);
  const [filters, setFilters] = useState(buildInitialFilters(''));

  const [planillas, setPlanillas] = useState([]);
  const [planillasTotal, setPlanillasTotal] = useState(0);
  const [selectedPlanillaId, setSelectedPlanillaId] = useState('');
  const [planillaPeriodoLookup, setPlanillaPeriodoLookup] = useState({
    loading: false,
    hasPlanilla: false,
    idPlanilla: 0
  });

  const [resumen, setResumen] = useState({});
  const [empleadosActivosSucursal, setEmpleadosActivosSucursal] = useState([]);
  const [adelantosPendientes, setAdelantosPendientes] = useState([]);
  const [adelantosHistorialMovimientos, setAdelantosHistorialMovimientos] = useState([]);
  const [bonosDeduccionesHistorial, setBonosDeduccionesHistorial] = useState([]);
  const [detalle, setDetalle] = useState([]);
  const [detallePage, setDetallePage] = useState(1);
  const [detalleTotal, setDetalleTotal] = useState(0);

  const [loadingSucursales, setLoadingSucursales] = useState(true);
  const [loadingPlanillas, setLoadingPlanillas] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [loadingEmpleadosActivos, setLoadingEmpleadosActivos] = useState(false);
  const [loadingAdelantosPendientes, setLoadingAdelantosPendientes] = useState(false);
  const [loadingAdelantosHistorial, setLoadingAdelantosHistorial] = useState(false);
  const [loadingBonosDeduccionesHistorial, setLoadingBonosDeduccionesHistorial] = useState(false);
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
    mode: 'detalle',
    selectedEmpleadoId: '',
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
  const [adelantoRegistroGlobalModal, setAdelantoRegistroGlobalModal] = useState({
    open: false,
    registering: false
  });
  const [adelantosHistorialModal, setAdelantosHistorialModal] = useState({
    open: false,
    loading: false,
    item: null,
    empleadoLabel: '',
    items: [],
    updatingId: null,
    deletingId: null
  });

  const [auditoriaModal, setAuditoriaModal] = useState({
    open: false,
    loading: false,
    items: []
  });
  const [bonosDeduccionesHistorialModal, setBonosDeduccionesHistorialModal] = useState({
    open: false,
    loading: false,
    items: [],
    deletingId: null
  });
  const [horasExtraModal, setHorasExtraModal] = useState({
    open: false,
    loading: false,
    item: null,
    empleadoLabel: '',
    items: [],
    summary: {},
    compensatingId: null,
    updatingId: null,
    deletingId: null
  });
  const [horasExtraRegistroModal, setHorasExtraRegistroModal] = useState({
    open: false,
    registering: false,
    defaultEmpleadoId: ''
  });
  const [adelantosPendientesModalOpen, setAdelantosPendientesModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(buildInitialConfirmModal);
  const planillasRequestRef = useRef(0);
  const detalleRequestRef = useRef(0);
  const adelantosHistorialRequestRef = useRef(0);

  const externalSucursalId = useMemo(
    () => normalizeSucursalId(selectedSucursalId),
    [selectedSucursalId]
  );
  const urlSucursalId = useMemo(
    () => normalizeSucursalId(searchParams.get(SUCURSAL_QUERY_PARAM)),
    [searchParams]
  );
  const preferredSucursalId = externalSucursalId || urlSucursalId;

  useEffect(() => {
    if (rawPlanillasTab === activePlanillasTab) return;
    const next = new URLSearchParams(searchParams);
    next.set(PLANILLAS_NAV_QUERY_PARAM, activePlanillasTab);
    setSearchParams(next, { replace: true });
  }, [activePlanillasTab, rawPlanillasTab, searchParams, setSearchParams]);

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
          `Sucursal #${sucursal.id_sucursal}`,
        searchText: [
          sucursal.nombre_sucursal,
          sucursal.nombre,
          sucursal.sucursal,
          sucursal.id_sucursal
        ]
          .map((value) => String(value ?? '').trim().toLowerCase())
          .filter(Boolean)
          .join(' ')
      })),
    [sucursales]
  );
  const selectedSucursalOption = useMemo(() => {
    const normalizedId = normalizeSucursalId(selectedSucursal);
    if (!normalizedId) return null;
    return sucursalOptions.find((option) => normalizeSucursalId(option?.value) === normalizedId) || null;
  }, [selectedSucursal, sucursalOptions]);
  const sucursalSelectStyles = useMemo(() => buildPlanillasSucursalSelectStyles(), []);
  const filterSucursalOption = useCallback((candidate, inputValue) => {
    const needle = String(inputValue ?? '').trim().toLowerCase();
    if (!needle) return true;
    const haystack = String(candidate?.data?.searchText || candidate?.label || '').toLowerCase();
    return haystack.includes(needle);
  }, []);

  const selectedPlanillaLabel = useMemo(() => {
    if (!selectedPlanilla?.id_planilla) return 'Planilla seleccionada';
    return selectedPlanilla.codigo_planilla || `Planilla #${selectedPlanilla.id_planilla}`;
  }, [selectedPlanilla]);
  const selectedSucursalLabel = useMemo(() => {
    const selected = sucursalOptions.find((option) => String(option.value) === String(selectedSucursal));
    return selected?.label || 'la sucursal seleccionada';
  }, [selectedSucursal, sucursalOptions]);
  const activePlanillaSucursalId = useMemo(() => {
    const fromPlanilla = safeNumber(
      selectedPlanilla?.id_sucursal ?? selectedPlanilla?.id_sucursal_planilla,
      0
    );
    if (fromPlanilla > 0) return fromPlanilla;
    const fromSelection = safeNumber(selectedSucursal, 0);
    return fromSelection > 0 ? fromSelection : 0;
  }, [selectedPlanilla?.id_sucursal, selectedPlanilla?.id_sucursal_planilla, selectedSucursal]);

  const planillaEstadoRaw = useMemo(() => extractEstadoPlanilla(selectedPlanilla), [selectedPlanilla]);
  const isPlanillaPagada = useMemo(
    () => planillaEstadoRaw.includes('pagad'),
    [planillaEstadoRaw]
  );
  const periodoOperativoLabel = useMemo(
    () => resolvePeriodoOperativoLabel({ periodo, tipoPeriodo, quincena }),
    [periodo, tipoPeriodo, quincena]
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
  const totalPagesPlanillas = useMemo(() => Math.max(1, Math.ceil(planillasTotal / LIST_LIMIT)), [planillasTotal]);
  const visiblePlanillaPageNumbers = useMemo(
    () => buildVisiblePageNumbers(listPage, totalPagesPlanillas),
    [listPage, totalPagesPlanillas]
  );
  const visibleDetallePageNumbers = useMemo(
    () => buildVisiblePageNumbers(detallePage, totalPagesDetalle),
    [detallePage, totalPagesDetalle]
  );
  const planillasPageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page: listPage, limit: LIST_LIMIT, total: planillasTotal, currentLength: planillas.length }),
    [listPage, planillas.length, planillasTotal]
  );
  const detallePageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page: detallePage, limit: DETAIL_LIMIT, total: filteredDetalle.length, currentLength: pagedDetalle.length }),
    [detallePage, filteredDetalle.length, pagedDetalle.length]
  );
  const detalleEmpleadoOptions = useMemo(
    () => (Array.isArray(detalle) ? detalle : []).map((row) => buildEmpleadoOption(row)).filter(Boolean),
    [detalle]
  );
  const empleadosActivosOptions = useMemo(
    () =>
      (Array.isArray(empleadosActivosSucursal) ? empleadosActivosSucursal : [])
        .map((row) => buildEmpleadoOption(row))
        .filter(Boolean),
    [empleadosActivosSucursal]
  );
  const empleadosRegistroOptions = useMemo(() => {
    const merged = [];
    const seen = new Set();
    [empleadosActivosOptions, detalleEmpleadoOptions].forEach((source) => {
      source.forEach((employee) => {
        const key = String(employee?.value || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(employee);
      });
    });
    return merged;
  }, [detalleEmpleadoOptions, empleadosActivosOptions]);

  const hasSucursalSelected = Boolean(normalizeSucursalId(selectedSucursal));
  const hasPlanillaForPeriodo = Boolean(planillaPeriodoLookup.hasPlanilla);
  const canGenerarForPeriodo = Boolean(
    canGenerar && hasSucursalSelected && !planillaPeriodoLookup.loading && !hasPlanillaForPeriodo
  );
  const canExportPlanilla = Boolean(canViewDetalle && selectedPlanilla?.id_planilla && isPlanillaPagada);
  const adelantosHistorialMovimientosScoped = useMemo(
    () =>
      scopeMovimientosToPlanillaContext({
        movimientos: adelantosHistorialMovimientos,
        detalleRows: detalle,
        idPlanilla: selectedPlanilla?.id_planilla,
        periodoScope: periodo
      }),
    [adelantosHistorialMovimientos, detalle, periodo, selectedPlanilla?.id_planilla]
  );
  const adelantosDataset = useMemo(
    () =>
      normalizeAdelantosDataset({
        pendientes: adelantosPendientes,
        movimientos: adelantosHistorialMovimientosScoped,
        detalleRows: detalle,
        periodoScope: periodo,
        tipoPeriodoScope: tipoPeriodo,
        quincenaScope: quincena
      }),
    [adelantosHistorialMovimientosScoped, adelantosPendientes, detalle, periodo, quincena, tipoPeriodo]
  );
  const adelantosStatusTotals = useMemo(
    () =>
      adelantosDataset.reduce(
        (acc, item) => {
          const estado = item?.estado;
          if (estado === ADELANTO_STATUS.pendiente) {
            acc.pendientes += 1;
            acc.montoPendiente += safeNumber(item?.saldo ?? item?.monto, 0);
            return acc;
          }
          if (estado === ADELANTO_STATUS.aplicado) {
            acc.aplicados += 1;
            acc.montoAplicado += safeNumber(item?.monto, 0);
            return acc;
          }
          if (estado === ADELANTO_STATUS.eliminado) {
            acc.eliminados += 1;
            acc.montoEliminado += safeNumber(item?.monto, 0);
          }
          return acc;
        },
        { pendientes: 0, aplicados: 0, eliminados: 0, montoPendiente: 0, montoAplicado: 0, montoEliminado: 0 }
      ),
    [adelantosDataset]
  );
  const adelantosInsightSummary = useMemo(() => {
    if (adelantosStatusTotals.pendientes <= 0) {
      return 'No hay adelantos pendientes por aplicar en este contexto.';
    }
    return `${adelantosStatusTotals.pendientes} adelanto(s) pendiente(s) por aplicar, total ${formatMoney(
      adelantosStatusTotals.montoPendiente
    )}.`;
  }, [adelantosStatusTotals]);
  const adelantosKpiCards = useMemo(
    () => [
      {
        key: 'adelantos-pendientes-cantidad',
        iconClass: 'bi-hourglass-split',
        label: 'Pendientes (cantidad)',
        value: String(adelantosStatusTotals.pendientes),
        accent: 'warning'
      },
      {
        key: 'adelantos-pendientes-monto',
        iconClass: 'bi-wallet2',
        label: 'Monto pendiente',
        value: formatMoney(adelantosStatusTotals.montoPendiente),
        accent: 'warning'
      },
      {
        key: 'adelantos-aplicados-monto',
        iconClass: 'bi-check-circle',
        label: 'Monto aplicado',
        value: formatMoney(adelantosStatusTotals.montoAplicado),
        accent: 'success'
      },
      {
        key: 'adelantos-eliminados-monto',
        iconClass: 'bi-trash3',
        label: 'Monto eliminado',
        value: formatMoney(adelantosStatusTotals.montoEliminado),
        accent: 'danger'
      }
    ],
    [adelantosStatusTotals]
  );
  const bonosDeduccionesDataset = useMemo(
    () =>
      normalizeBonosDeduccionesDataset({
        movimientos: bonosDeduccionesHistorial,
        detalleRows: detalle
      }),
    [bonosDeduccionesHistorial, detalle]
  );
  const bonosDeduccionesStats = useMemo(
    () =>
      bonosDeduccionesDataset.reduce(
        (acc, row) => {
          const monto = Math.max(0, safeNumber(row?.monto, 0));
          if (row?.estado === MOVIMIENTO_ESTADO.anulada) {
            acc.montoAnulado += monto;
            acc.totalAnuladas += 1;
            return acc;
          }

          if (row?.tipo === MOVIMIENTO_TIPO.bono) {
            acc.bonosVigentes += monto;
            acc.totalVigentes += 1;
            return acc;
          }

          acc.deduccionesVigentes += monto;
          acc.totalVigentes += 1;
          return acc;
        },
        {
          bonosVigentes: 0,
          deduccionesVigentes: 0,
          montoAnulado: 0,
          totalVigentes: 0,
          totalAnuladas: 0
        }
      ),
    [bonosDeduccionesDataset]
  );
  const bonosDeduccionesImpactoNeto = useMemo(
    () => bonosDeduccionesStats.bonosVigentes - bonosDeduccionesStats.deduccionesVigentes,
    [bonosDeduccionesStats.bonosVigentes, bonosDeduccionesStats.deduccionesVigentes]
  );
  const bonosDeduccionesInsightSummary = useMemo(() => {
    if (bonosDeduccionesStats.totalVigentes <= 0) {
      return 'No hay movimientos vigentes de bonos o deducciones en este contexto.';
    }
    return `${bonosDeduccionesStats.totalVigentes} movimiento(s) vigente(s). Bonos ${formatMoney(
      bonosDeduccionesStats.bonosVigentes
    )}, deducciones ${formatMoney(bonosDeduccionesStats.deduccionesVigentes)}.`;
  }, [bonosDeduccionesStats]);
  const bonosDeduccionesKpiCards = useMemo(
    () => [
      {
        key: 'bd-bonos-vigentes',
        iconClass: 'bi-plus-circle',
        label: 'Bonos vigentes',
        value: formatMoney(bonosDeduccionesStats.bonosVigentes),
        accent: 'success'
      },
      {
        key: 'bd-deducciones-vigentes',
        iconClass: 'bi-dash-circle',
        label: 'Deducciones vigentes',
        value: formatMoney(bonosDeduccionesStats.deduccionesVigentes),
        accent: 'warning'
      },
      {
        key: 'bd-impacto-neto',
        iconClass: 'bi-graph-up-arrow',
        label: 'Impacto neto',
        value: formatMoney(bonosDeduccionesImpactoNeto),
        accent: bonosDeduccionesImpactoNeto >= 0 ? 'success' : 'danger'
      },
      {
        key: 'bd-monto-anulado',
        iconClass: 'bi-trash3',
        label: 'Monto anulado',
        value: formatMoney(bonosDeduccionesStats.montoAnulado),
        accent: 'danger'
      }
    ],
    [bonosDeduccionesImpactoNeto, bonosDeduccionesStats]
  );
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
    const validSucursalIds = new Set(sucursalOptions.map((option) => normalizeSucursalId(option.value)));
    const firstSucursalId = normalizeSucursalId(sucursalOptions[0]?.value);

    setSelectedSucursal((previous) => {
      const currentId = normalizeSucursalId(previous);
      if (preferredSucursalId && validSucursalIds.has(preferredSucursalId)) return preferredSucursalId;
      if (currentId && validSucursalIds.has(currentId)) return currentId;
      return firstSucursalId || '';
    });
  }, [preferredSucursalId, sucursalOptions]);

  useEffect(() => {
    setFilters((previous) => ({
      ...previous,
      sucursal: selectedSucursal || ''
    }));
  }, [selectedSucursal]);

  useEffect(() => {
    const currentParam = normalizeSucursalId(searchParams.get(SUCURSAL_QUERY_PARAM));
    const selectedParam = normalizeSucursalId(selectedSucursal);
    if (currentParam === selectedParam) return;

    const next = new URLSearchParams(searchParams);
    if (selectedParam) {
      next.set(SUCURSAL_QUERY_PARAM, selectedParam);
    } else {
      next.delete(SUCURSAL_QUERY_PARAM);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedSucursal, setSearchParams]);

  const loadPlanillasByContext = useCallback(
    async ({ idSucursal, periodoTarget, tipoPeriodoTarget, quincenaTarget } = {}) => {
      const normalizedSucursal = normalizeSucursalId(idSucursal ?? selectedSucursal);
      const normalizedPeriodo = toText(periodoTarget ?? periodo, '');
      const normalizedTipoPeriodo = normalizeTipoPeriodo(tipoPeriodoTarget ?? tipoPeriodo);
      const normalizedQuincena =
        normalizedTipoPeriodo === TIPO_PERIODO.quincenal ? normalizeQuincena(quincenaTarget ?? quincena) : null;
      if (!normalizedSucursal || !normalizedPeriodo) return [];

      const response = await planillasService.listarPlanillas({
        page: 1,
        limit: DETAIL_FETCH_LIMIT,
        id_sucursal: normalizedSucursal,
        periodo: normalizedPeriodo,
        tipo_periodo: normalizedTipoPeriodo,
        quincena: normalizedQuincena || undefined
      });
      return scopePlanillasByContext({
        items: normalizeListResponse(response).items,
        periodoTarget: normalizedPeriodo,
        tipoPeriodoTarget: normalizedTipoPeriodo,
        quincenaTarget: normalizedQuincena
      });
    },
    [periodo, quincena, selectedSucursal, tipoPeriodo]
  );

  const loadEmpleadosActivos = useCallback(async () => {
    if (!selectedSucursal || !canView) {
      setEmpleadosActivosSucursal([]);
      setLoadingEmpleadosActivos(false);
      return;
    }

    setLoadingEmpleadosActivos(true);
    try {
      const response = await planillasService.listarEmpleadosActivosSucursal(selectedSucursal, {
        page: 1,
        limit: DETAIL_FETCH_LIMIT
      });
      setEmpleadosActivosSucursal(normalizeListResponse(response).items);
    } catch {
      setEmpleadosActivosSucursal([]);
    } finally {
      setLoadingEmpleadosActivos(false);
    }
  }, [canView, selectedSucursal]);

  const loadPlanillas = useCallback(async () => {
    const requestId = planillasRequestRef.current + 1;
    planillasRequestRef.current = requestId;

    if (!canView || !selectedSucursal) {
      if (requestId === planillasRequestRef.current) {
        setPlanillas([]);
        setPlanillasTotal(0);
        setSelectedPlanillaId('');
      }
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
        estado: estadoFiltro || undefined,
        tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
        quincena: normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal ? normalizeQuincena(quincena) : undefined
      });

      const parsed = normalizeListResponse(response);
      if (requestId !== planillasRequestRef.current) return;
      const scopedItems = scopePlanillasByContext({
        items: parsed.items,
        periodoTarget: periodo,
        tipoPeriodoTarget: tipoPeriodo,
        quincenaTarget: quincena
      });
      setPlanillas(scopedItems);
      setPlanillasTotal(scopedItems.length !== parsed.items.length ? scopedItems.length : parsed.total);

      if (scopedItems.length === 0) {
        setSelectedPlanillaId('');
        return;
      }

      const stillExists = scopedItems.some(
        (planilla) => String(planilla.id_planilla ?? '') === String(selectedPlanillaId)
      );

      if (!selectedPlanillaId || !stillExists) {
        setSelectedPlanillaId(String(scopedItems[0].id_planilla ?? ''));
      }
    } catch (error) {
      if (requestId !== planillasRequestRef.current) return;
      setListError(error.message || 'No se pudo cargar planillas');
      setPlanillas([]);
      setPlanillasTotal(0);
      setSelectedPlanillaId('');
    } finally {
      if (requestId === planillasRequestRef.current) {
        setLoadingPlanillas(false);
      }
    }
  }, [canView, estadoFiltro, listPage, periodo, quincena, selectedPlanillaId, selectedSucursal, tipoPeriodo]);

  const loadDetalleAndResumen = useCallback(async () => {
    const requestId = detalleRequestRef.current + 1;
    detalleRequestRef.current = requestId;

    if (!selectedPlanilla?.id_planilla || !canViewDetalle || !activePlanillaSucursalId) {
      if (requestId === detalleRequestRef.current) {
        setDetalle([]);
        setResumen({});
        setDetalleTotal(0);
      }
      return;
    }

    const planillaSucursalId = normalizeSucursalId(
      selectedPlanilla?.id_sucursal || selectedPlanilla?.id_sucursal_planilla
    );
    const currentSucursalId = normalizeSucursalId(activePlanillaSucursalId);
    if (planillaSucursalId && currentSucursalId && planillaSucursalId !== currentSucursalId) {
      if (requestId === detalleRequestRef.current) {
        setDetalle([]);
        setResumen({});
        setDetalleTotal(0);
      }
      return;
    }

    setLoadingDetalle(true);
    try {
      const [resumenResp, detalleItems] = await Promise.all([
        planillasService.obtenerResumenPlanilla(selectedPlanilla.id_planilla, {
          id_sucursal: activePlanillaSucursalId || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        }),
        collectPaginatedApiRows(
          ({ page, limit }) =>
            planillasService.listarDetallePlanilla(selectedPlanilla.id_planilla, {
              page,
              limit,
              id_sucursal: activePlanillaSucursalId || undefined,
              tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
              quincena:
                normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                  ? normalizeQuincena(quincena)
                  : undefined
            }),
          { pageSize: 100, maxPages: 80 }
        )
      ]);

      if (requestId !== detalleRequestRef.current) return;
      setResumen(normalizeResumenForDisplay(normalizeResumen(resumenResp)));
      const normalizedDetalle = (Array.isArray(detalleItems) ? detalleItems : []).map((row) =>
        normalizeDetalleRowForDisplay(row)
      );
      setDetalle(normalizedDetalle);
      setDetalleTotal(normalizedDetalle.length);
    } catch (error) {
      if (requestId !== detalleRequestRef.current) return;
      safeToast('ERROR', error.message || 'No se pudo cargar el detalle de planilla', 'danger');
      setDetalle([]);
      setDetalleTotal(0);
      setResumen({});
    } finally {
      if (requestId === detalleRequestRef.current) {
        setLoadingDetalle(false);
      }
    }
  }, [
    activePlanillaSucursalId,
    canViewDetalle,
    quincena,
    safeToast,
    selectedPlanilla?.id_planilla,
    selectedPlanilla?.id_sucursal,
    selectedPlanilla?.id_sucursal_planilla,
    tipoPeriodo
  ]);

  const fetchPlanillaMovimientos = useCallback(async ({ idPlanilla, idSucursal, idDetalle = 0 } = {}) => {
    const safePlanillaId = safeNumber(idPlanilla, 0);
    if (!(safePlanillaId > 0)) return [];

    const safeDetalleId = safeNumber(idDetalle, 0);
    return collectPaginatedApiRows(
      ({ page, limit }) => {
        if (safeDetalleId > 0) {
          return planillasService.listarMovimientosPlanillaDetalle(safePlanillaId, safeDetalleId, {
            page,
            limit,
            id_sucursal: idSucursal || undefined,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          });
        }
        return planillasService.listarMovimientosPlanilla(safePlanillaId, {
          page,
          limit,
          id_sucursal: idSucursal || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
      },
      { pageSize: 100, maxPages: 80 }
    );
  }, [quincena, tipoPeriodo]);

  const loadAdelantosPendientes = useCallback(async () => {
    if (!selectedSucursal || !canViewDetalle) {
      setAdelantosPendientes([]);
      setLoadingAdelantosPendientes(false);
      return;
    }

    setLoadingAdelantosPendientes(true);
    try {
      const rows = await collectPaginatedApiRows(
        ({ page, limit }) =>
          planillasService.listarAdelantosPendientesSucursal(selectedSucursal, {
            page,
            limit,
            periodo
          }),
        { pageSize: 100, maxPages: 80 }
      );
      const scopedRows = (Array.isArray(rows) ? rows : []).filter((row) =>
        matchesAdelantoContext({
          row,
          periodoScope: periodo,
          tipoPeriodoScope: tipoPeriodo,
          quincenaScope: quincena
        })
      );
      setAdelantosPendientes(scopedRows);
    } catch (error) {
      safeToast('ERROR', error?.message || 'No se pudieron cargar los adelantos pendientes.', 'danger');
      setAdelantosPendientes([]);
    } finally {
      setLoadingAdelantosPendientes(false);
    }
  }, [canViewDetalle, periodo, quincena, safeToast, selectedSucursal, tipoPeriodo]);

  const loadAdelantosHistorial = useCallback(async () => {
    const requestId = adelantosHistorialRequestRef.current + 1;
    adelantosHistorialRequestRef.current = requestId;

    if (!selectedPlanilla?.id_planilla || !canViewDetalle || !activePlanillaSucursalId) {
      if (requestId === adelantosHistorialRequestRef.current) {
        setAdelantosHistorialMovimientos([]);
        setLoadingAdelantosHistorial(false);
      }
      return;
    }

    const planillaSucursalId = normalizeSucursalId(
      selectedPlanilla?.id_sucursal || selectedPlanilla?.id_sucursal_planilla
    );
    const currentSucursalId = normalizeSucursalId(activePlanillaSucursalId);
    if (planillaSucursalId && currentSucursalId && planillaSucursalId !== currentSucursalId) {
      if (requestId === adelantosHistorialRequestRef.current) {
        setAdelantosHistorialMovimientos([]);
        setLoadingAdelantosHistorial(false);
      }
      return;
    }

    setLoadingAdelantosHistorial(true);
    try {
      const movimientosRows = await fetchPlanillaMovimientos({
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: activePlanillaSucursalId || undefined
      });
      if (requestId !== adelantosHistorialRequestRef.current) return;
      const scopedItems = scopeMovimientosToPlanillaContext({
        movimientos: movimientosRows,
        detalleRows: detalle,
        idPlanilla: selectedPlanilla?.id_planilla,
        periodoScope: periodo
      });
      setAdelantosHistorialMovimientos(scopedItems);
    } catch {
      if (requestId !== adelantosHistorialRequestRef.current) return;
      setAdelantosHistorialMovimientos([]);
    } finally {
      if (requestId === adelantosHistorialRequestRef.current) {
        setLoadingAdelantosHistorial(false);
      }
    }
  }, [
    activePlanillaSucursalId,
    canViewDetalle,
    detalle,
    fetchPlanillaMovimientos,
    periodo,
    selectedPlanilla?.id_planilla,
    selectedPlanilla?.id_sucursal,
    selectedPlanilla?.id_sucursal_planilla
  ]);

  const loadBonosDeduccionesHistorial = useCallback(async () => {
    if (!selectedPlanilla?.id_planilla || !canViewDetalle || !activePlanillaSucursalId) {
      setBonosDeduccionesHistorial([]);
      setLoadingBonosDeduccionesHistorial(false);
      return;
    }

    const planillaSucursalId = normalizeSucursalId(
      selectedPlanilla?.id_sucursal || selectedPlanilla?.id_sucursal_planilla
    );
    const currentSucursalId = normalizeSucursalId(activePlanillaSucursalId);
    if (planillaSucursalId && currentSucursalId && planillaSucursalId !== currentSucursalId) {
      setBonosDeduccionesHistorial([]);
      setLoadingBonosDeduccionesHistorial(false);
      return;
    }

    setLoadingBonosDeduccionesHistorial(true);
    try {
      const items = await fetchPlanillaMovimientos({
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: activePlanillaSucursalId || undefined
      });
      const filtered = items.filter((row) => {
        const tipo = normalizeBonoDeduccionTipo(row);
        return tipo === MOVIMIENTO_TIPO.bono || tipo === MOVIMIENTO_TIPO.deduccion;
      });
      setBonosDeduccionesHistorial(filtered);
    } catch {
      setBonosDeduccionesHistorial([]);
    } finally {
      setLoadingBonosDeduccionesHistorial(false);
    }
  }, [
    activePlanillaSucursalId,
    canViewDetalle,
    fetchPlanillaMovimientos,
    selectedPlanilla?.id_planilla,
    selectedPlanilla?.id_sucursal,
    selectedPlanilla?.id_sucursal_planilla
  ]);

  const refreshPlanillaPeriodoLookup = useCallback(async () => {
    if (!canView || !selectedSucursal || !toText(periodo, '')) {
      setPlanillaPeriodoLookup({
        loading: false,
        hasPlanilla: false,
        idPlanilla: 0
      });
      return;
    }

    setPlanillaPeriodoLookup((previous) => ({ ...previous, loading: true }));
    try {
      const items = await loadPlanillasByContext({
        idSucursal: selectedSucursal,
        periodoTarget: periodo,
        tipoPeriodoTarget: tipoPeriodo,
        quincenaTarget: quincena
      });
      const planilla = pickContextPlanilla({
        items,
        periodoTarget: periodo,
        tipoPeriodoTarget: tipoPeriodo,
        quincenaTarget: quincena
      });
      const idPlanilla = resolvePlanillaId(planilla);
      setPlanillaPeriodoLookup({
        loading: false,
        hasPlanilla: idPlanilla > 0,
        idPlanilla
      });
    } catch {
      setPlanillaPeriodoLookup({
        loading: false,
        hasPlanilla: false,
        idPlanilla: 0
      });
    }
  }, [canView, loadPlanillasByContext, periodo, quincena, selectedSucursal, tipoPeriodo]);

  useEffect(() => {
    loadSucursales();
  }, [loadSucursales]);

  useEffect(() => {
    setListPage(1);
  }, [selectedSucursal, periodo, estadoFiltro, tipoPeriodo, quincena]);

  useEffect(() => {
    if (!selectedSucursal) return;
    setSelectedPlanillaId('');
    setDetalle([]);
    setResumen({});
    setDetalleTotal(0);
    setDetallePage(1);
    setAdelantosHistorialMovimientos([]);
    setBonosDeduccionesHistorial([]);
  }, [periodo, quincena, selectedSucursal, tipoPeriodo]);

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
    void refreshPlanillaPeriodoLookup();
  }, [refreshPlanillaPeriodoLookup]);

  useEffect(() => {
    setDetallePage(1);
  }, [selectedPlanillaId, filters.search, filters.sucursal, filters.cargo, filters.salarioMin, filters.salarioMax]);

  useEffect(() => {
    loadDetalleAndResumen();
  }, [loadDetalleAndResumen]);

  useEffect(() => {
    loadEmpleadosActivos();
  }, [loadEmpleadosActivos]);

  useEffect(() => {
    loadAdelantosPendientes();
  }, [loadAdelantosPendientes]);

  useEffect(() => {
    loadAdelantosHistorial();
  }, [loadAdelantosHistorial]);

  useEffect(() => {
    loadBonosDeduccionesHistorial();
  }, [loadBonosDeduccionesHistorial]);

  useEffect(() => {
    if (detallePage > totalPagesDetalle) {
      setDetallePage(totalPagesDetalle);
    }
  }, [detallePage, totalPagesDetalle]);

  useEffect(() => {
    if (listPage > totalPagesPlanillas) {
      setListPage(totalPagesPlanillas);
    }
  }, [listPage, totalPagesPlanillas]);

  useEffect(() => {
    if (hasSucursalSelected) return;
    setEmpleadosActivosSucursal([]);
    setAdelantosPendientesModalOpen(false);
    setAdelantosHistorialModal({
      open: false,
      loading: false,
      item: null,
      empleadoLabel: '',
      items: [],
      updatingId: null,
      deletingId: null
    });
    setHorasExtraModal({
      open: false,
      loading: false,
      item: null,
      empleadoLabel: '',
      items: [],
      summary: {},
      compensatingId: null,
      updatingId: null,
      deletingId: null
      });
    setHorasExtraRegistroModal({
      open: false,
      registering: false,
      defaultEmpleadoId: ''
    });
    setAdelantoRegistroGlobalModal({
      open: false,
      registering: false
    });
    setAdelantosHistorialMovimientos([]);
    setBonosDeduccionesHistorial([]);
    setMovimientoFormModal({
      open: false,
      tipo: 'bono',
      item: null,
      mode: 'detalle',
      selectedEmpleadoId: '',
      loading: false
    });
    setBonosDeduccionesHistorialModal({
      open: false,
      loading: false,
      items: [],
      deletingId: null
    });
  }, [hasSucursalSelected]);

  const ensurePlanillaForRegistro = useCallback(
    async ({ notifyOnCreate = true } = {}) => {
      const idSucursal = safeNumber(selectedSucursal, 0);
      const periodoValue = toText(periodo, '');
      const tipoPeriodoValue = normalizeTipoPeriodo(tipoPeriodo);
      const quincenaValue = tipoPeriodoValue === TIPO_PERIODO.quincenal ? normalizeQuincena(quincena) : null;

      if (!(idSucursal > 0)) {
        safeToast('ERROR', 'Selecciona una sucursal valida antes de registrar movimientos.', 'warning');
        return null;
      }

      if (!periodoValue) {
        safeToast('ERROR', 'Selecciona un periodo valido antes de registrar movimientos.', 'warning');
        return null;
      }

      if (tipoPeriodoValue === TIPO_PERIODO.quincenal && !quincenaValue) {
        safeToast('ERROR', 'Selecciona una quincena valida antes de continuar.', 'warning');
        return null;
      }

      const resolveExistingPlanilla = async () => {
        const items = await loadPlanillasByContext({
          idSucursal,
          periodoTarget: periodoValue,
          tipoPeriodoTarget: tipoPeriodoValue,
          quincenaTarget: quincenaValue
        });
        const planilla = pickContextPlanilla({
          items,
          periodoTarget: periodoValue,
          tipoPeriodoTarget: tipoPeriodoValue,
          quincenaTarget: quincenaValue
        });
        return {
          planilla,
          idPlanilla: resolvePlanillaId(planilla)
        };
      };

      try {
        let { planilla, idPlanilla } = await resolveExistingPlanilla();

        if (!(idPlanilla > 0)) {
          let generatedNow = false;
          try {
            await planillasService.generarPlanilla({
              id_sucursal: idSucursal,
              periodo: periodoValue,
              tipo_periodo: tipoPeriodoValue,
              quincena: quincenaValue || undefined
            });
            generatedNow = true;
          } catch (error) {
            const message = toText(error?.message, '').toLowerCase();
            const canRetryLookup =
              message.includes('exist') || message.includes('ya existe') || message.includes('duplic');
            if (!canRetryLookup) throw error;
          }

          const refreshed = await resolveExistingPlanilla();
          planilla = refreshed.planilla;
          idPlanilla = refreshed.idPlanilla;

          if (!(idPlanilla > 0)) {
            throw new Error('No se pudo preparar una planilla valida para la sucursal y periodo seleccionados.');
          }

          if (generatedNow && notifyOnCreate) {
            safeToast('OK', 'Se creo una planilla en borrador para continuar con el registro.', 'success');
          }
        }

        setSelectedPlanillaId(String(idPlanilla));
        setPlanillaPeriodoLookup({
          loading: false,
          hasPlanilla: true,
          idPlanilla
        });

        const idSucursalPlanilla =
          safeNumber(planilla?.id_sucursal ?? planilla?.id_sucursal_planilla, 0) || idSucursal;

        return {
          idPlanilla,
          idSucursal: idSucursalPlanilla,
          planilla
        };
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo preparar la planilla para este contexto.', 'danger');
        return null;
      }
    },
    [loadPlanillasByContext, periodo, quincena, safeToast, selectedSucursal, tipoPeriodo]
  );

  const resolveDetalleIdForEmpleado = useCallback(
    async ({ idPlanilla, idEmpleado, idSucursal } = {}) => {
      if (!(safeNumber(idPlanilla, 0) > 0) || !(safeNumber(idEmpleado, 0) > 0)) return 0;

      const localDetalle = (Array.isArray(detalle) ? detalle : []).find(
        (row) => safeNumber(row?.id_empleado, 0) === safeNumber(idEmpleado, 0)
      );
      const localId = safeNumber(localDetalle?.id_detalle_planilla ?? localDetalle?.id_detalle, 0);
      if (localId > 0) return localId;

      const rows = (await collectPaginatedApiRows(
        ({ page, limit }) =>
          planillasService.listarDetallePlanilla(idPlanilla, {
            page,
            limit,
            id_sucursal: idSucursal || undefined,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          }),
        { pageSize: 100, maxPages: 80 }
      )).map((row) => normalizeDetalleRowForDisplay(row));

      setDetalle(rows);
      setDetalleTotal(rows.length);

      const remoteDetalle = rows.find((row) => safeNumber(row?.id_empleado, 0) === safeNumber(idEmpleado, 0));
      return safeNumber(remoteDetalle?.id_detalle_planilla ?? remoteDetalle?.id_detalle, 0);
    },
    [detalle, quincena, tipoPeriodo]
  );

  const refreshPlanillaData = useCallback(
    async () => {
      await Promise.all([
        loadPlanillas(),
        refreshPlanillaPeriodoLookup(),
        loadEmpleadosActivos(),
        loadDetalleAndResumen(),
        loadAdelantosPendientes(),
        loadAdelantosHistorial(),
        loadBonosDeduccionesHistorial()
      ]);
    },
    [
      loadAdelantosHistorial,
      loadAdelantosPendientes,
      loadBonosDeduccionesHistorial,
      loadDetalleAndResumen,
      loadEmpleadosActivos,
      loadPlanillas,
      refreshPlanillaPeriodoLookup
    ]
  );

  const withAction = useCallback(
    async (task, successConfig) => {
      const options =
        typeof successConfig === 'string'
          ? { successMessage: successConfig }
          : successConfig && typeof successConfig === 'object'
            ? successConfig
            : {};
      const successMessage = toText(options.successMessage, '');
      const skipReload = options.skipReload === true;

      setLoadingAction(true);
      try {
        await task();
        if (typeof options.onSuccess === 'function') {
          await options.onSuccess();
        }
        if (successMessage) safeToast('OK', successMessage, 'success');
        if (!skipReload) {
          await refreshPlanillaData();
        }
        return true;
      } catch (error) {
        if (typeof options.onError === 'function') {
          options.onError(error);
        }
        safeToast('ERROR', error.message || 'No se pudo ejecutar la accion', 'danger');
        return false;
      } finally {
        setLoadingAction(false);
      }
    },
    [refreshPlanillaData, safeToast]
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
      description: config.description || '',
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
    const detalleLookup = buildDetalleLookupMaps(rows);

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
      lines.push(['Tipo', 'Empleado', 'Concepto', 'Monto', 'Observacion', 'Fecha']);
      movimientos.forEach((row) => {
        lines.push([
          toText(row.tipo_movimiento || row.tipo, '-'),
          resolveMovimientoEmpleadoNombre(row, detalleLookup),
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
    let summaryData = normalizeResumenForDisplay(resumen);
    let rows = filteredDetalle.map((row) => normalizeDetalleRowForDisplay(row));
    let movimientos = [];
    const normalizedTipoPeriodo = normalizeTipoPeriodo(tipoPeriodo);
    const normalizedQuincena =
      normalizedTipoPeriodo === TIPO_PERIODO.quincenal ? normalizeQuincena(quincena) : undefined;
    const isQuincenalContext = normalizedTipoPeriodo === TIPO_PERIODO.quincenal;

    if (!selectedPlanilla?.id_planilla) {
      return { summaryData, rows, movimientos };
    }

    if (!isQuincenalContext) {
      try {
        const response = await planillasService.obtenerPlanillaCompleta(selectedPlanilla.id_planilla, {
          id_sucursal: activePlanillaSucursalId || undefined,
          tipo_periodo: normalizedTipoPeriodo,
          quincena: normalizedQuincena
        });
        const parsed = normalizePlanillaCompleta(response);
        if (parsed.detalle.length > 0) {
          const normalizedRows = parsed.detalle.map((row) => normalizeDetalleRowForDisplay(row));
          rows = filterDetalleRows({
            rows: normalizedRows,
            filters,
            selectedSucursal,
            selectedPlanilla
          });
        }
        if (Object.keys(parsed.resumen || {}).length > 0) {
          summaryData = normalizeResumenForDisplay(parsed.resumen);
        }
      } catch {
        // fallback
      }
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
            id_sucursal: activePlanillaSucursalId || undefined,
            tipo_periodo: normalizedTipoPeriodo,
            quincena: normalizedQuincena
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

    return {
      summaryData: normalizeResumenForDisplay(summaryData),
      rows: rows.map((row) => normalizeDetalleRowForDisplay(row)),
      movimientos
    };
  }, [
    activePlanillaSucursalId,
    filters,
    filteredDetalle,
    quincena,
    resumen,
    safeToast,
    selectedPlanilla,
    selectedSucursal,
    tipoPeriodo
  ]);

  const handleExportSubmit = useCallback(async (options) => {
    if (!selectedPlanilla?.id_planilla) return;

    let printPopup = null;
    setLoadingExport(true);
    try {
      if (options?.format !== 'excel') {
        // Reservamos la ventana dentro del gesto de usuario para evitar bloqueo del navegador
        // cuando la carga de datos tarda y se ejecuta asincrónicamente.
        printPopup = createPrintWindow();
        showPendingPrintWindow(printPopup);
      }

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
        openPrintWindow(html, printPopup);
        printPopup = null;
        safeToast('OK', 'Vista imprimible abierta. Puedes guardarla como PDF.', 'success');
      }

      setExportModalOpen(false);
    } catch (error) {
      if (printPopup && !printPopup.closed) {
        printPopup.close();
      }
      safeToast('ERROR', error.message || 'No se pudo generar la exportacion.', 'danger');
    } finally {
      setLoadingExport(false);
    }
  }, [buildCsvContent, periodo, resolveExportDataset, safeToast, selectedPlanilla?.id_planilla, selectedPlanillaLabel]);

  const handleTipoPeriodoChange = useCallback((nextValue) => {
    const normalized = normalizeTipoPeriodo(nextValue);
    setTipoPeriodo(normalized);
    if (normalized !== TIPO_PERIODO.quincenal) {
      setQuincena(QUINCENA_DEFAULT);
    }
  }, []);

  const handleQuincenaChange = useCallback((nextValue) => {
    setQuincena(normalizeQuincena(nextValue));
  }, []);

  const handleGenerar = () => {
    if (!selectedSucursal || !periodo) {
      safeToast('ERROR', 'Selecciona sucursal y periodo antes de generar planilla.', 'warning');
      return;
    }
    if (hasPlanillaForPeriodo) {
      safeToast('AVISO', 'Ya existe una planilla para el periodo seleccionado.', 'warning');
      return;
    }

    openConfirmModal({
      actionType: 'generar_planilla',
      title: 'CONFIRMAR GENERACION',
      subtitle: 'Se preparara la planilla del periodo seleccionado',
      question: 'Deseas generar la planilla para esta sucursal?',
      description:
        'La generacion toma el detalle actual de empleados, bonos, deducciones y adelantos para construir la planilla del periodo.',
      detail: `${selectedSucursalLabel} - ${periodoOperativoLabel}`,
      detailIconClass: 'bi bi-calendar2-check',
      confirmText: 'Generar',
      confirmIconClass: 'bi bi-plus-circle',
      payload: {
        idSucursal: Number(selectedSucursal),
        periodo,
        tipoPeriodo: normalizeTipoPeriodo(tipoPeriodo),
        quincena: normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal ? normalizeQuincena(quincena) : null
      }
    });
  };

  const handleRecalcular = () => {
    if (!selectedPlanilla?.id_planilla) return;
    openConfirmModal({
      actionType: 'recalcular_planilla',
      title: 'CONFIRMAR RECALCULO',
      subtitle: 'Se actualizaran los totales de planilla',
      question: 'Deseas recalcular la planilla seleccionada?',
      description:
        'Se volveran a calcular los montos de la planilla con la informacion mas reciente de su detalle.',
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-arrow-repeat',
      confirmText: 'Recalcular',
      confirmIconClass: 'bi bi-arrow-repeat',
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: activePlanillaSucursalId || undefined
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
    const estadoDescriptionMap = {
      cerrada: 'La planilla quedara cerrada para evitar cambios operativos y continuar con el flujo de pago.',
      pagada: 'La planilla quedara marcada como pagada y se cerrara el ciclo de pago del periodo.',
      anulada: 'La planilla se marcara como anulada y no podra seguir el flujo normal.',
      borrador: 'La planilla regresara a borrador para permitir ajustes en el flujo operativo.',
      calculada: 'La planilla se dejara en estado calculada para revisar resultados antes del cierre.'
    };
    const normalizedEstado = estadoMap[String(estado || '').toLowerCase()] || estado;
    const actionLabel = estadoLabelMap[String(estado || '').toLowerCase()] || 'actualizar estado';
    const actionDescription =
      estadoDescriptionMap[String(estado || '').toLowerCase()] ||
      'El estado de la planilla se actualizara segun la accion seleccionada.';
    openConfirmModal({
      actionType: 'estado_planilla',
      title: 'CONFIRMAR CAMBIO DE ESTADO',
      subtitle: 'Esta accion se registrara en planilla',
      question: `Confirma que deseas ${actionLabel} la planilla seleccionada?`,
      description: actionDescription,
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-check2-square',
      confirmText: 'Confirmar',
      confirmIconClass: 'bi bi-check2-circle',
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: activePlanillaSucursalId || undefined,
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
      description:
        'Al anular, la planilla deja de ser operativa y la accion quedara registrada en auditoria.',
      detail: `Planilla #${selectedPlanilla.id_planilla}`,
      detailIconClass: 'bi bi-exclamation-triangle-fill',
      confirmText: 'Anular',
      confirmIconClass: 'bi bi-trash3',
      requireReason: true,
      payload: {
        idPlanilla: selectedPlanilla.id_planilla,
        idSucursal: activePlanillaSucursalId || undefined
      }
    });
  };

  const openMovimientos = useCallback(
    async (item) => {
      if (!selectedPlanilla?.id_planilla || !item) return;
      setMovimientosModal({ open: true, item, loading: true, items: [] });
      try {
        const response = await planillasService.listarMovimientosPlanilla(selectedPlanilla.id_planilla, {
          page: 1,
          limit: 50,
          id_detalle: item.id_detalle_planilla || item.id_detalle,
          id_sucursal: activePlanillaSucursalId || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
        setMovimientosModal({ open: true, item, loading: false, items: normalizeListResponse(response).items });
      } catch (error) {
        setMovimientosModal({ open: true, item, loading: false, items: [] });
        safeToast('ERROR', error.message || 'No se pudieron cargar movimientos', 'danger');
      }
    },
    [activePlanillaSucursalId, quincena, safeToast, selectedPlanilla?.id_planilla, tipoPeriodo]
  );

  const openBonosDeduccionesRegistroGlobal = useCallback(async () => {
    const context = await ensurePlanillaForRegistro();
    if (!context) return;

    setMovimientoFormModal({
      open: true,
      tipo: 'bono',
      item: null,
      mode: 'global',
      selectedEmpleadoId: '',
      loading: false
    });
  }, [ensurePlanillaForRegistro]);

  const openBonosDeduccionesHistorial = useCallback(async () => {
    const context = await ensurePlanillaForRegistro();
    if (!context) return;

    setBonosDeduccionesHistorialModal({
      open: true,
      loading: true,
      items: [],
      deletingId: null
    });

    try {
      const response = await planillasService.listarMovimientosPlanilla(context.idPlanilla, {
        page: 1,
        limit: DETAIL_FETCH_LIMIT,
        id_sucursal: context.idSucursal || undefined,
        tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
        quincena:
          normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
            ? normalizeQuincena(quincena)
            : undefined
      });
      const items = normalizeListResponse(response).items;
      const filtered = items.filter((row) => {
        const tipo = normalizeBonoDeduccionTipo(row);
        return tipo === MOVIMIENTO_TIPO.bono || tipo === MOVIMIENTO_TIPO.deduccion;
      });
      setBonosDeduccionesHistorial(filtered);
      setBonosDeduccionesHistorialModal({
        open: true,
        loading: false,
        items: normalizeBonosDeduccionesDataset({
          movimientos: filtered,
          detalleRows: detalle
        }),
        deletingId: null
      });
    } catch (error) {
      setBonosDeduccionesHistorialModal({
        open: true,
        loading: false,
        items: [],
        deletingId: null
      });
      safeToast('ERROR', error.message || 'No se pudo cargar el historial de movimientos.', 'danger');
    }
  }, [detalle, ensurePlanillaForRegistro, quincena, safeToast, tipoPeriodo]);

  const handleAnularBonoDeduccion = useCallback(
    async (row) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      const idMovimiento = safeNumber(row?.id_movimiento, 0);
      if (!(idMovimiento > 0) || !context?.idPlanilla) {
        safeToast('ERROR', 'No se pudo identificar el movimiento a anular.', 'danger');
        return;
      }

      const tipoLabel = row?.tipo === MOVIMIENTO_TIPO.bono ? 'Bono' : 'Deducción';
      openConfirmModal({
        actionType: 'anular_movimiento_bono_deduccion',
        title: 'CONFIRMAR ANULACION',
        subtitle: 'Esta accion afectara el calculo de planilla',
        question: `Deseas anular este ${tipoLabel.toLowerCase()}?`,
        description: 'El movimiento quedara registrado como anulado en el historial.',
        detail: `${tipoLabel} - ${toText(row?.empleado_nombre, 'Empleado')}`,
        detailIconClass: 'bi bi-trash3',
        confirmText: 'Anular movimiento',
        confirmIconClass: 'bi bi-trash3',
        requireReason: true,
        payload: {
          rowId: row?.id || null,
          idMovimiento,
          idPlanilla: context.idPlanilla,
          idSucursal: context.idSucursal || undefined
        }
      });
    },
    [ensurePlanillaForRegistro, openConfirmModal, safeToast]
  );

  const openAdelantoRegistroGlobal = useCallback(async () => {
    const context = await ensurePlanillaForRegistro();
    if (!context) return;
    setAdelantoRegistroGlobalModal({ open: true, registering: false });
  }, [ensurePlanillaForRegistro]);

  const openAdelantos = useCallback(
    async (item) => {
      const context = await ensurePlanillaForRegistro();
      if (!context || !item) return;
      setAdelantosModal({ open: true, item, loading: true, applying: false, registering: false, items: [] });
      try {
        const response = await planillasService.listarAdelantosAplicablesPlanilla(context.idPlanilla, {
          page: 1,
          limit: 50,
          id_detalle: item.id_detalle_planilla || item.id_detalle,
          id_sucursal: context.idSucursal || undefined
        });
        const scopedItems = normalizeListResponse(response).items.filter((row) =>
          matchesAdelantoContext({
            row,
            periodoScope: periodo,
            tipoPeriodoScope: tipoPeriodo,
            quincenaScope: quincena
          })
        );
        setAdelantosModal({
          open: true,
          item,
          loading: false,
          applying: false,
          registering: false,
          items: scopedItems
        });
      } catch (error) {
        setAdelantosModal({ open: true, item, loading: false, applying: false, registering: false, items: [] });
        safeToast('ERROR', error.message || 'No se pudieron cargar adelantos', 'danger');
      }
    },
    [ensurePlanillaForRegistro, periodo, quincena, safeToast, tipoPeriodo]
  );

  const openAdelantosHistorial = useCallback(
    async (item = null) => {
      const context = await ensurePlanillaForRegistro();
      if (!context) return;

      const onlyEmpleadoId = safeNumber(item?.id_empleado, 0);
      const empleadoLabel = onlyEmpleadoId > 0 ? extractEmpleadoNombre(item) : '';

      setAdelantosHistorialModal({
        open: true,
        loading: true,
        item: item || null,
        empleadoLabel,
        items: [],
        updatingId: null,
        deletingId: null
      });

      try {
        const idDetalle = safeNumber(item?.id_detalle_planilla ?? item?.id_detalle, 0);
        const movimientosRows = await fetchPlanillaMovimientos({
          idPlanilla: context.idPlanilla,
          idSucursal: context.idSucursal || undefined
        });
        const scopedBaseRows = scopeMovimientosToPlanillaContext({
          movimientos: movimientosRows,
          detalleRows: detalle,
          idPlanilla: context.idPlanilla,
          periodoScope: periodo
        });
        setAdelantosHistorialMovimientos(scopedBaseRows);

        const detalleByDetalleId = new Map(
          (Array.isArray(detalle) ? detalle : [])
            .map((row) => [String(safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0)), row])
            .filter(([id]) => id !== '0')
        );

        let movimientos = scopedBaseRows;
        if (idDetalle > 0) {
          movimientos = scopedBaseRows.filter((row) => {
            const rowDetalleId = safeNumber(row?.id_detalle_planilla ?? row?.id_detalle, 0);
            const rowEmpleadoId = resolveAdelantoEmpleadoId(row, detalleByDetalleId);
            return rowDetalleId === idDetalle || (onlyEmpleadoId > 0 && rowEmpleadoId === onlyEmpleadoId);
          });
        } else if (onlyEmpleadoId > 0) {
          movimientos = scopedBaseRows.filter(
            (row) => resolveAdelantoEmpleadoId(row, detalleByDetalleId) === onlyEmpleadoId
          );
        }

        const dataset = normalizeAdelantosDataset({
          pendientes: adelantosPendientes,
          movimientos,
          detalleRows: detalle,
          onlyEmpleadoId,
          periodoScope: periodo,
          tipoPeriodoScope: tipoPeriodo,
          quincenaScope: quincena
        });

        setAdelantosHistorialModal({
          open: true,
          loading: false,
          item: item || null,
          empleadoLabel,
          items: dataset,
          updatingId: null,
          deletingId: null
        });
      } catch (error) {
        const fallbackDataset = normalizeAdelantosDataset({
          pendientes: adelantosPendientes,
          movimientos: adelantosHistorialMovimientosScoped,
          detalleRows: detalle,
          onlyEmpleadoId,
          periodoScope: periodo,
          tipoPeriodoScope: tipoPeriodo,
          quincenaScope: quincena
        });
        setAdelantosHistorialModal({
          open: true,
          loading: false,
          item: item || null,
          empleadoLabel,
          items: fallbackDataset,
          updatingId: null,
          deletingId: null
        });
      safeToast('ERROR', error.message || 'No se pudo cargar el historial de adelantos.', 'danger');
      }
    },
    [
      adelantosHistorialMovimientosScoped,
      adelantosPendientes,
      detalle,
      ensurePlanillaForRegistro,
      fetchPlanillaMovimientos,
      periodo,
      quincena,
      safeToast,
      tipoPeriodo,
    ]
  );

  const openHorasExtra = useCallback(
    async (item = null) => {
      const context = await ensurePlanillaForRegistro();
      if (!context) return;

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
        updatingId: null,
        deletingId: null
      });

      try {
        const response = await planillasService.listarHorasExtraPlanilla(context.idPlanilla, {
          page: 1,
          limit: 200,
          id_empleado: idEmpleado || undefined,
          id_sucursal: context.idSucursal || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
        const parsed = normalizeHorasExtraResponse(response);
        setHorasExtraModal((previous) => ({
          ...previous,
          open: true,
          loading: false,
          item: item || null,
          empleadoLabel,
          items: parsed.items,
          summary: parsed.summary || {},
          updatingId: null,
          deletingId: null
        }));
      } catch (error) {
        setHorasExtraModal((previous) => ({
          ...previous,
          open: true,
          loading: false,
          items: [],
          summary: {},
          updatingId: null,
          deletingId: null
        }));
        safeToast('ERROR', error.message || 'No se pudieron cargar horas extra.', 'danger');
      }
    },
    [ensurePlanillaForRegistro, quincena, safeToast, tipoPeriodo]
  );

  const openHorasExtraRegistro = useCallback(
    async (item = null) => {
      const context = await ensurePlanillaForRegistro();
      if (!context) return;
      const idEmpleado = safeNumber(item?.id_empleado, 0) || null;
      setHorasExtraRegistroModal({
        open: true,
        registering: false,
        defaultEmpleadoId: idEmpleado ? String(idEmpleado) : ''
      });
    },
    [ensurePlanillaForRegistro]
  );

  const handleCompensarHoraExtra = useCallback(
    async (horaExtraItem, observacion = '') => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      const idHoraExtra = resolveHoraExtraId(horaExtraItem);
      if (!idHoraExtra) return;

      setHorasExtraModal((previous) => ({ ...previous, compensatingId: idHoraExtra }));

      try {
        await planillasService.compensarHoraExtraPlanilla(context.idPlanilla, idHoraExtra, {
          observacion,
          id_sucursal: context.idSucursal || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
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
      quincena,
      ensurePlanillaForRegistro,
      safeToast,
      tipoPeriodo
    ]
  );

  const handleActualizarHoraExtra = useCallback(
    async (horaExtraItem, payload = {}) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      const idHoraExtra = resolveHoraExtraId(horaExtraItem);
      if (!idHoraExtra) return;

      setHorasExtraModal((previous) => ({ ...previous, updatingId: idHoraExtra }));

      try {
        const idSucursal = context.idSucursal || undefined;
        const idEmpleado = safeNumber(payload?.id_empleado, 0) || resolveHoraExtraEmpleadoId(horaExtraItem);
        const fecha = toText(payload?.fecha || horaExtraItem?.fecha, '');
        const horas = safeNumber(payload?.horas, Number.NaN);
        const observacion = toText(payload?.observacion, '');

        if (!(idEmpleado > 0 && fecha && Number.isFinite(horas) && horas > 0)) {
          throw new Error('Datos incompletos para actualizar la hora extra.');
        }

        await planillasService.actualizarHoraExtraPlanilla(context.idPlanilla, idHoraExtra, {
          id_empleado: idEmpleado,
          fecha,
          horas,
          observacion: observacion || undefined,
          id_sucursal: idSucursal,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });

        safeToast('OK', 'Hora extra actualizada correctamente.', 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen()]);
        await openHorasExtra(horasExtraModal.item);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo actualizar la hora extra.', 'danger');
        throw error;
      } finally {
        setHorasExtraModal((previous) => ({ ...previous, updatingId: null }));
      }
    },
    [
      horasExtraModal.item,
      loadDetalleAndResumen,
      loadPlanillas,
      openHorasExtra,
      quincena,
      ensurePlanillaForRegistro,
      safeToast,
      tipoPeriodo
    ]
  );

  const handleEliminarHoraExtra = useCallback(
    async (horaExtraItem) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;
      const idHoraExtra = resolveHoraExtraId(horaExtraItem);
      if (!idHoraExtra) return;

      openConfirmModal({
        actionType: 'anular_hora_extra',
        title: 'CONFIRMAR ELIMINACION',
        subtitle: 'Esta accion quitara la hora extra del registro',
        question: 'Deseas eliminar este registro de hora extra?',
        description:
          'Utiliza esta accion cuando el registro se cargo por error. La accion quedara reflejada en planilla.',
        detail: `${formatFriendlyDate(horaExtraItem?.fecha)} - ${formatHoursLabel(horaExtraItem?.horas)}`,
        detailIconClass: 'bi bi-clock-history',
        confirmText: 'Eliminar',
        confirmIconClass: 'bi bi-trash3',
        requireReason: true,
        payload: {
          idHoraExtra,
          idPlanilla: context.idPlanilla,
          idSucursal: context.idSucursal || undefined
        }
      });
    },
    [ensurePlanillaForRegistro, openConfirmModal]
  );

  const handleRegistrarHoraExtra = useCallback(
    async (payload) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      setHorasExtraRegistroModal((previous) => ({ ...previous, registering: true }));

      try {
        await planillasService.registrarHoraExtraPlanilla(context.idPlanilla, {
          ...payload,
          id_sucursal: context.idSucursal || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
        safeToast('OK', 'Hora extra registrada correctamente.', 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen()]);
        if (horasExtraModal.open) {
          await openHorasExtra(horasExtraModal.item);
        }
        setHorasExtraRegistroModal({
          open: false,
          registering: false,
          defaultEmpleadoId: ''
        });
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo registrar la hora extra.', 'danger');
        setHorasExtraRegistroModal((previous) => ({ ...previous, registering: false }));
      }
    },
    [
      horasExtraModal.item,
      horasExtraModal.open,
      loadDetalleAndResumen,
      loadPlanillas,
      openHorasExtra,
      quincena,
      ensurePlanillaForRegistro,
      safeToast,
      tipoPeriodo
    ]
  );

  const handleRegistrarAdelanto = useCallback(
    async (payload) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla || !adelantosModal.item) return;

      setAdelantosModal((previous) => ({ ...previous, registering: true }));
      try {
        const fechaContexto = resolveAdelantoFechaEnContexto({
          rawFecha: payload?.fecha,
          periodo,
          tipoPeriodo,
          quincena
        });
        await planillasService.registrarAdelantoPlanilla(context.idPlanilla, {
          ...payload,
          fecha: fechaContexto || undefined,
          id_sucursal: context.idSucursal || undefined
        });
        safeToast('OK', 'Adelanto registrado correctamente.', 'success');
        await Promise.all([
          loadPlanillas(),
          loadDetalleAndResumen(),
          loadAdelantosPendientes(),
          loadAdelantosHistorial()
        ]);
        await openAdelantos(adelantosModal.item);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo registrar el adelanto.', 'danger');
      } finally {
        setAdelantosModal((previous) => ({ ...previous, registering: false }));
      }
    },
    [
      adelantosModal.item,
      loadAdelantosHistorial,
      loadAdelantosPendientes,
      loadDetalleAndResumen,
      loadPlanillas,
      openAdelantos,
      ensurePlanillaForRegistro,
      periodo,
      quincena,
      safeToast,
      tipoPeriodo,
    ]
  );

  const requestApplyAdelantoDirecto = useCallback(
    async (adelantoPendiente) => {
      const context = await ensurePlanillaForRegistro();
      if (!context) return;

      const source = adelantoPendiente && typeof adelantoPendiente === 'object' ? adelantoPendiente : {};
      const raw =
        source?.raw && typeof source.raw === 'object'
          ? source.raw
          : source?.raw && typeof source.raw === 'string'
            ? {}
            : {};
      const idAdelanto = safeNumber(
        source?.id_adelanto_salario ?? source?.id_adelanto ?? raw?.id_adelanto_salario ?? raw?.id_adelanto,
        0
      );
      if (!(idAdelanto > 0)) {
        safeToast('ERROR', 'No se encontro un adelanto valido para aplicar.', 'danger');
        return;
      }

      const montoAplicarCandidates = [
        source?.monto,
        raw?.monto,
        source?.saldo,
        raw?.saldo,
        source?.monto_pendiente,
        raw?.monto_pendiente,
        source?.saldo_disponible,
        raw?.saldo_disponible
      ];
      const montoAplicar = montoAplicarCandidates.reduce((resolved, candidate) => {
        if (Number.isFinite(resolved) && resolved > 0) return resolved;
        const parsed = safeNumber(candidate, Number.NaN);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : resolved;
      }, Number.NaN);

      if (!Number.isFinite(montoAplicar) || montoAplicar <= 0) {
        safeToast('ERROR', 'No se pudo determinar el monto fijo del adelanto seleccionado.', 'danger');
        return;
      }

      const idSucursal = context.idSucursal || undefined;
      if (!idSucursal) {
        safeToast('ERROR', 'Selecciona una sucursal valida para aplicar adelantos.', 'warning');
        return;
      }

      const empleadoLabel = toText(
        source?.empleado_nombre ||
          source?.nombre_completo ||
          source?.nombre_empleado ||
          raw?.empleado_nombre ||
          raw?.nombre_completo ||
          raw?.nombre_empleado,
        'Empleado'
      );

      openConfirmModal({
        actionType: 'aplicar_adelanto_directo',
        title: 'CONFIRMAR APLICACION',
        subtitle: 'Aplicacion rapida de adelanto pendiente',
        question: `Deseas aplicar este adelanto a ${empleadoLabel}?`,
        description:
          'Se aplicara con el monto original registrado en este adelanto pendiente. Este flujo no permite editar monto.',
        detail: `${empleadoLabel} - ${formatMoney(montoAplicar)}`,
        detailIconClass: 'bi bi-wallet2',
        confirmText: 'Aplicar adelanto',
        confirmIconClass: 'bi bi-check2-circle',
        payload: {
          idPlanilla: context.idPlanilla,
          idSucursal,
          idAdelanto,
          montoAplicar
        }
      });
    },
    [
      ensurePlanillaForRegistro,
      openConfirmModal,
      safeToast,
    ]
  );

  const handleApplyFromPendientes = useCallback(
    (adelantoPendiente) => {
      setAdelantosPendientesModalOpen(false);
      void requestApplyAdelantoDirecto(adelantoPendiente);
    },
    [requestApplyAdelantoDirecto]
  );

  const handleApplyFromAdelantosHistorial = useCallback(
    (adelantoItem) => {
      setAdelantosHistorialModal((previous) => ({
        ...previous,
        open: false,
        loading: false,
        updatingId: null,
        deletingId: null
      }));
      void requestApplyAdelantoDirecto(adelantoItem);
    },
    [requestApplyAdelantoDirecto]
  );

  const handleActualizarAdelantoAplicado = useCallback(
    async (adelantoItem, payload = {}) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      const estadoAdelanto = toText(adelantoItem?.estado, '').toLowerCase();
      const isPendiente = estadoAdelanto === ADELANTO_STATUS.pendiente;
      const idMovimiento = safeNumber(adelantoItem?.id_movimiento, 0);
      const idAdelanto = safeNumber(adelantoItem?.id_adelanto, 0);
      const idDetalle = safeNumber(adelantoItem?.id_detalle, 0);
      const rowTrackingId = String(adelantoItem?.id || idMovimiento || `ad-${idAdelanto || 'na'}`);
      const montoAplicar = safeNumber(payload?.monto_aplicar, Number.NaN);
      const observacion = toText(payload?.observacion, '');
      const idSucursal = context.idSucursal || undefined;

      if (!Number.isFinite(montoAplicar) || montoAplicar <= 0) {
        throw new Error('Ingresa un monto valido mayor que 0.');
      }

      setAdelantosHistorialModal((previous) => ({ ...previous, updatingId: rowTrackingId }));
      try {
        if (isPendiente) {
          if (!(idAdelanto > 0)) {
            throw new Error('No se pudo identificar el adelanto pendiente para editarlo.');
          }

          await planillasService.actualizarAdelantoPlanilla(context.idPlanilla, idAdelanto, {
            id_empleado: safeNumber(adelantoItem?.id_empleado, 0) || undefined,
            monto: montoAplicar,
            fecha: toText(adelantoItem?.fecha, '') || undefined,
            observacion,
            id_sucursal: idSucursal
          });

          setAdelantosHistorialModal((previous) => ({
            ...previous,
            items: (Array.isArray(previous.items) ? previous.items : []).map((row) => {
              const sameRow =
                String(row?.id || '') === rowTrackingId || safeNumber(row?.id_adelanto, 0) === idAdelanto;
              if (!sameRow) return row;
              const montoNormalizado = Math.max(0, montoAplicar);
              return {
                ...row,
                estado: ADELANTO_STATUS.pendiente,
                monto: montoNormalizado,
                saldo: montoNormalizado,
                observacion: observacion || row?.observacion || ''
              };
            })
          }));
          safeToast('OK', 'Adelanto pendiente actualizado correctamente.', 'success');
          void refreshPlanillaData();
          return;
        }

        if (!(idMovimiento > 0)) {
          throw new Error('No se pudo ubicar el movimiento aplicado para editarlo.');
        }

        const markerBase = observacion || 'Ajuste de adelanto aplicado desde historial.';
        await planillasService.anularMovimientoPlanilla(idMovimiento, {
          motivo: `[CORREGIDO_AD] ${markerBase}`,
          id_planilla: context.idPlanilla,
          id_sucursal: idSucursal
        });

        if (idAdelanto > 0) {
          await planillasService.aplicarAdelantoPlanilla(context.idPlanilla, {
            id_adelanto_salario: idAdelanto,
            monto_aplicar: montoAplicar,
            id_sucursal: idSucursal,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          });
        } else {
          if (!(idDetalle > 0)) {
            throw new Error('No se pudo determinar el detalle para recrear el ajuste de adelanto.');
          }
          await planillasService.registrarMovimientoPlanilla(context.idPlanilla, {
            id_detalle: idDetalle,
            tipo: 'DEDUCCION',
            tipo_movimiento: 'DEDUCCION',
            concepto: 'Ajuste de adelanto aplicado',
            monto: montoAplicar,
            observacion: `[CORREGIDO_AD] ${markerBase}`,
            id_sucursal: idSucursal,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          });
        }

        setAdelantosHistorialModal((previous) => ({
          ...previous,
          items: (Array.isArray(previous.items) ? previous.items : []).map((row) => {
            const sameRow =
              String(row?.id || '') === rowTrackingId || safeNumber(row?.id_movimiento, 0) === idMovimiento;
            if (!sameRow) return row;
            return {
              ...row,
              estado: ADELANTO_STATUS.eliminado,
              saldo: 0,
              observacion: observacion || 'Adelanto corregido desde historial.'
            };
          })
        }));
        safeToast('OK', 'Adelanto actualizado correctamente.', 'success');
        void refreshPlanillaData();
      } catch (error) {
        safeToast(
          'ERROR',
          error.message || `No se pudo actualizar el adelanto ${isPendiente ? 'pendiente' : 'aplicado'}.`,
          'danger'
        );
        throw error;
      } finally {
        setAdelantosHistorialModal((previous) => ({ ...previous, updatingId: null }));
      }
    },
    [ensurePlanillaForRegistro, quincena, refreshPlanillaData, safeToast, tipoPeriodo]
  );

  const handleRegistrarAdelantoGlobal = useCallback(
    async (payload) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      setAdelantoRegistroGlobalModal({ open: true, registering: true });
      try {
        const fechaContexto = resolveAdelantoFechaEnContexto({
          rawFecha: payload?.fecha,
          periodo,
          tipoPeriodo,
          quincena
        });
        await planillasService.registrarAdelantoPlanilla(context.idPlanilla, {
          ...payload,
          fecha: fechaContexto || undefined,
          id_sucursal: context.idSucursal || undefined
        });
        safeToast('OK', 'Adelanto registrado correctamente.', 'success');
        await Promise.all([
          loadPlanillas(),
          loadDetalleAndResumen(),
          loadAdelantosPendientes(),
          loadAdelantosHistorial()
        ]);
        if (adelantosHistorialModal.open) {
          await openAdelantosHistorial(adelantosHistorialModal.item);
        }
        setAdelantoRegistroGlobalModal({ open: false, registering: false });
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo registrar el adelanto.', 'danger');
        setAdelantoRegistroGlobalModal({ open: true, registering: false });
      }
    },
    [
      adelantosHistorialModal.item,
      adelantosHistorialModal.open,
      loadAdelantosHistorial,
      loadAdelantosPendientes,
      loadDetalleAndResumen,
      loadPlanillas,
      openAdelantosHistorial,
      ensurePlanillaForRegistro,
      periodo,
      quincena,
      safeToast,
      tipoPeriodo,
    ]
  );

  const handleEliminarAdelantoAplicado = useCallback(
    async (adelantoItem) => {
      const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
      if (!context?.idPlanilla) return;

      const estadoAdelanto = toText(adelantoItem?.estado, '').toLowerCase();
      const isPendiente = estadoAdelanto === ADELANTO_STATUS.pendiente;
      const idMovimiento = safeNumber(adelantoItem?.id_movimiento, 0);
      const idAdelanto = safeNumber(adelantoItem?.id_adelanto, 0);
      const rowTrackingId = String(
        adelantoItem?.id ||
          (isPendiente ? `pendiente-${idAdelanto || 'na'}` : `mov-${idMovimiento || 'na'}`)
      );

      if (isPendiente && !(idAdelanto > 0)) {
        safeToast('ERROR', 'No se pudo ubicar el adelanto pendiente para eliminarlo.', 'danger');
        return;
      }
      if (!isPendiente && !(idMovimiento > 0)) {
        safeToast('ERROR', 'No se pudo ubicar el movimiento de este adelanto para eliminarlo.', 'danger');
        return;
      }

      openConfirmModal({
        actionType: isPendiente ? 'anular_adelanto_pendiente' : 'anular_adelanto_aplicado',
        title: 'CONFIRMAR ELIMINACION',
        subtitle: isPendiente
          ? 'El adelanto pendiente sera eliminado del listado actual'
          : 'El adelanto aplicado sera anulado del calculo',
        question: isPendiente
          ? 'Deseas eliminar este adelanto pendiente?'
          : 'Deseas eliminar este adelanto aplicado?',
        description:
          'Se registrara como eliminado en historial para mantener trazabilidad operativa de la planilla.',
        detail: `${toText(adelantoItem?.empleado_nombre, 'Empleado')} - ${formatMoney(adelantoItem?.monto)}`,
        detailIconClass: 'bi bi-wallet2',
        confirmText: 'Eliminar',
        confirmIconClass: 'bi bi-trash3',
        requireReason: true,
        payload: {
          rowId: rowTrackingId,
          idAdelanto: idAdelanto > 0 ? idAdelanto : undefined,
          idMovimiento,
          idPlanilla: context.idPlanilla,
          idSucursal: context.idSucursal || undefined
        }
      });
    },
    [ensurePlanillaForRegistro, openConfirmModal, safeToast]
  );

  const handleApplyAllPendientes = useCallback(async () => {
    const context = await ensurePlanillaForRegistro();
    if (!context) return;

    let detalleRows = Array.isArray(detalle) ? detalle : [];
    if (detalleRows.length === 0) {
      try {
        const detalleResponse = await planillasService.listarDetallePlanilla(context.idPlanilla, {
          page: 1,
          limit: DETAIL_FETCH_LIMIT,
          id_sucursal: context.idSucursal || undefined,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
        const parsed = normalizeListResponse(detalleResponse);
        detalleRows = parsed.items.map((row) => normalizeDetalleRowForDisplay(row));
        setDetalle(detalleRows);
        setDetalleTotal(parsed.total || detalleRows.length);
      } catch {
        detalleRows = [];
      }
    }

    const itemsAplicables = adelantosPendientes.filter((item) => {
      const idEmpleado = safeNumber(item?.id_empleado, 0);
      return detalleRows.some((row) => safeNumber(row?.id_empleado, 0) === idEmpleado);
    });

    if (itemsAplicables.length === 0) {
      safeToast('AVISO', 'No hay adelantos aplicables para el detalle actual de la planilla.', 'warning');
      return;
    }

    void withAction(
      async () => {
        for (const item of itemsAplicables) {
          const idAdelanto = item?.id_adelanto_salario || item?.id_adelanto;
          if (!idAdelanto) continue;
          await planillasService.aplicarAdelantoPlanilla(context.idPlanilla, {
            id_adelanto_salario: idAdelanto,
            id_sucursal: context.idSucursal || undefined,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          });
        }
      },
      `Se aplicaron ${itemsAplicables.length} adelanto(s) pendientes.`
    );
  }, [adelantosPendientes, detalle, ensurePlanillaForRegistro, quincena, safeToast, tipoPeriodo, withAction]);

  const openAuditoria = async () => {
    if (!selectedPlanilla?.id_planilla) return;
    setAuditoriaModal({ open: true, loading: true, items: [] });
    try {
      const response = await planillasService.listarAuditoriaPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 100,
        id_sucursal: activePlanillaSucursalId || undefined
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
      description:
        'El movimiento se anulara del calculo actual y quedara trazabilidad en la bitacora de la planilla.',
      detail: movimiento.concepto || `Movimiento #${id}`,
      detailIconClass: 'bi bi-journal-x',
      confirmText: 'Anular',
      confirmIconClass: 'bi bi-trash3',
      requireReason: true,
        payload: {
          idMovimiento: id,
          idPlanilla: selectedPlanilla?.id_planilla,
          idSucursal: activePlanillaSucursalId || undefined
        }
      });
  };

  const executeConfirmAction = useCallback(async () => {
    const actionType = confirmModal.actionType;
    const payload = confirmModal.payload || {};
    const motivo = toText(confirmModal.reason, '');

    closeConfirmModal();

    if (actionType === 'generar_planilla') {
      await withAction(
        () =>
          planillasService.generarPlanilla({
            id_sucursal: payload.idSucursal,
            periodo: payload.periodo,
            tipo_periodo: normalizeTipoPeriodo(payload.tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(payload.tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(payload.quincena)
                : undefined
          }),
        'Planilla generada correctamente'
      );
      return;
    }

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
            id_sucursal: payload.idSucursal,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
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

    if (actionType === 'aplicar_adelanto_directo') {
      await withAction(
        () =>
          planillasService.aplicarAdelantoPlanilla(payload.idPlanilla, {
            id_adelanto_salario: payload.idAdelanto,
            id_adelanto: payload.idAdelanto,
            monto_aplicar: payload.montoAplicar,
            id_sucursal: payload.idSucursal,
            tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
            quincena:
              normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                ? normalizeQuincena(quincena)
                : undefined
          }),
        'Adelanto aplicado correctamente'
      );
      return;
    }

    if (actionType === 'anular_hora_extra') {
      setHorasExtraModal((previous) => ({ ...previous, deletingId: payload.idHoraExtra }));
      await withAction(async () => {
        const motivoLimpio = toText(motivo, '');
        const observacionEliminacion = `[ELIMINADA_HE] ${
          motivoLimpio || 'Registro eliminado desde la gestion de horas extra.'
        }`;
        await planillasService.compensarHoraExtraPlanilla(payload.idPlanilla, payload.idHoraExtra, {
          observacion: observacionEliminacion,
          id_sucursal: payload.idSucursal,
          tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
          quincena:
            normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
              ? normalizeQuincena(quincena)
              : undefined
        });
      }, 'Hora extra eliminada correctamente');
      if (horasExtraModal.open) {
        await openHorasExtra(horasExtraModal.item);
      }
      setHorasExtraModal((previous) => ({ ...previous, deletingId: null }));
      return;
    }

    if (actionType === 'anular_adelanto_aplicado') {
      setAdelantosHistorialModal((previous) => ({ ...previous, deletingId: payload.rowId || payload.idMovimiento }));
      const motivoLimpio = toText(motivo, '');
      const eliminadoObservacion = motivoLimpio || 'Adelanto eliminado desde historial de planilla.';
      const updated = await withAction(
        async () => {
          await planillasService.anularMovimientoPlanilla(payload.idMovimiento, {
            motivo: `[ELIMINADO_AD] ${eliminadoObservacion}`,
            id_planilla: payload.idPlanilla,
            id_sucursal: payload.idSucursal
          });
        },
        {
          successMessage: 'Adelanto eliminado correctamente',
          skipReload: true,
          onSuccess: () => {
            setAdelantosHistorialModal((previous) => ({
              ...previous,
              items: (Array.isArray(previous.items) ? previous.items : []).map((row) => {
                const sameRow =
                  String(row?.id || '') === String(payload.rowId || '') ||
                  safeNumber(row?.id_movimiento, 0) === safeNumber(payload.idMovimiento, 0);
                if (!sameRow) return row;
                return {
                  ...row,
                  estado: ADELANTO_STATUS.eliminado,
                  saldo: 0,
                  observacion: eliminadoObservacion
                };
              })
            }));
          }
        }
      );
      setAdelantosHistorialModal((previous) => ({ ...previous, deletingId: null }));
      if (updated) {
        void refreshPlanillaData();
      }
      return;
    }

    if (actionType === 'anular_adelanto_pendiente') {
      setAdelantosHistorialModal((previous) => ({
        ...previous,
        deletingId: payload.rowId || `pendiente-${payload.idAdelanto || 'na'}`
      }));
      const motivoLimpio = toText(motivo, '');
      const eliminadoObservacion = motivoLimpio || 'Adelanto pendiente eliminado desde historial de planilla.';
      const updated = await withAction(
        async () => {
          await planillasService.anularAdelantoPlanilla(payload.idPlanilla, payload.idAdelanto, {
            motivo: `[ELIMINADO_AD] ${eliminadoObservacion}`,
            observacion: motivoLimpio || undefined,
            id_sucursal: payload.idSucursal
          });
        },
        {
          successMessage: 'Adelanto eliminado correctamente',
          skipReload: true,
          onSuccess: () => {
            setAdelantosHistorialModal((previous) => ({
              ...previous,
              items: (Array.isArray(previous.items) ? previous.items : []).map((row) => {
                const sameRow =
                  String(row?.id || '') === String(payload.rowId || '') ||
                  safeNumber(row?.id_adelanto, 0) === safeNumber(payload.idAdelanto, 0);
                if (!sameRow) return row;
                return {
                  ...row,
                  estado: ADELANTO_STATUS.eliminado,
                  saldo: 0,
                  observacion: eliminadoObservacion
                };
              })
            }));
          }
        }
      );
      setAdelantosHistorialModal((previous) => ({ ...previous, deletingId: null }));
      if (updated) {
        void refreshPlanillaData();
      }
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
      return;
    }

    if (actionType === 'anular_movimiento_bono_deduccion') {
      setBonosDeduccionesHistorialModal((previous) => ({
        ...previous,
        deletingId: payload.rowId || payload.idMovimiento
      }));
      const updated = await withAction(
        async () => {
          await planillasService.anularMovimientoPlanilla(payload.idMovimiento, {
            motivo,
            id_planilla: payload.idPlanilla,
            id_sucursal: payload.idSucursal
          });
        },
        {
          successMessage: 'Movimiento anulado correctamente',
          skipReload: true,
          onSuccess: () => {
            setBonosDeduccionesHistorial((previous) =>
              (Array.isArray(previous) ? previous : []).map((row) => {
                const sameRow =
                  safeNumber(resolveMovimientoPlanillaId(row), 0) === safeNumber(payload.idMovimiento, 0);
                if (!sameRow) return row;
                return {
                  ...row,
                  anulado: true,
                  es_anulado: true,
                  estado: 'ANULADO',
                  observacion: motivo || row?.observacion || 'Movimiento anulado.'
                };
              })
            );
            setBonosDeduccionesHistorialModal((previous) => ({
              ...previous,
              items: (Array.isArray(previous.items) ? previous.items : []).map((row) => {
                const sameRow =
                  String(row?.id || '') === String(payload.rowId || '') ||
                  safeNumber(row?.id_movimiento, 0) === safeNumber(payload.idMovimiento, 0);
                if (!sameRow) return row;
                return {
                  ...row,
                  estado: MOVIMIENTO_ESTADO.anulada,
                  observacion: motivo || row?.observacion || 'Movimiento anulado.'
                };
              })
            }));
          }
        }
      );
      setBonosDeduccionesHistorialModal((previous) => ({ ...previous, deletingId: null }));
      if (updated) {
        void refreshPlanillaData();
      }
    }
  }, [
    closeConfirmModal,
    confirmModal.actionType,
    confirmModal.payload,
    confirmModal.reason,
    horasExtraModal.item,
    horasExtraModal.open,
    movimientosModal.item,
    openHorasExtra,
    openMovimientos,
    quincena,
    refreshPlanillaData,
    tipoPeriodo,
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
          <div className="planillas-toolbar planillas-toolbar--sucursal">
            <div className="planillas-toolbar__title-wrap">
              <span className="planillas-toolbar__title-icon" aria-hidden="true">
                <i className="bi bi-buildings" />
              </span>
                <div>
                  <div className="planillas-toolbar__title">Seleccionar sucursal</div>
                </div>
            </div>
            <div className="planillas-toolbar__field planillas-toolbar__field--sucursal">
              <label htmlFor="planillas-sucursal-context">Sucursal</label>
              <Select
                id="planillas-sucursal-context"
                inputId="planillas-sucursal-context"
                classNamePrefix="planillas-sucursal-rs"
                className="planillas-sucursal-select"
                aria-label="Seleccionar sucursal"
                value={selectedSucursalOption}
                onChange={(option) => setSelectedSucursal(normalizeSucursalId(option?.value))}
                options={sucursalOptions}
                filterOption={filterSucursalOption}
                placeholder={sucursalOptions.length === 0 ? 'No hay sucursales disponibles' : 'Seleccione sucursal'}
                noOptionsMessage={({ inputValue }) =>
                  String(inputValue || '').trim() ? 'Sin coincidencias' : 'No hay sucursales disponibles'
                }
                isClearable
                isSearchable
                isDisabled={loadingAction || loadingSucursales || sucursalOptions.length === 0}
                styles={sucursalSelectStyles}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                maxMenuHeight={280}
              />
            </div>
          </div>

          <PlanillasHeader
            periodo={periodo}
            tipoPeriodo={tipoPeriodo}
            quincena={quincena}
            onPeriodoChange={setPeriodo}
            onTipoPeriodoChange={handleTipoPeriodoChange}
            onQuincenaChange={handleQuincenaChange}
            selectedPlanilla={selectedPlanilla}
            onGenerar={handleGenerar}
            onRecalcular={handleRecalcular}
            onCerrar={() => handleChangeEstado('cerrada')}
            onPagar={() => handleChangeEstado('pagada')}
            onAnular={handleAnular}
            onExport={() => setExportModalOpen(true)}
            canGenerar={showPlanillaActions && canGenerarForPeriodo}
            canRecalcular={showPlanillaActions && canRecalcular}
            canCerrar={showPlanillaActions && canCerrar}
            canPagar={showPlanillaActions && canPagar}
            canAnular={showPlanillaActions && canAnular}
            canExport={showPlanillaActions && canExportPlanilla}
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
          {showPagoSection ? (
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
                      {planilla.codigo_planilla || `Planilla #${planilla.id_planilla}`} -{' '}
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
          ) : null}

          {showPagoSection ? (
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
          ) : null}

          {showAdelantosSection ? <PlanillasResumenCards customCards={adelantosKpiCards} /> : null}
          {showBonosDeduccionesSection ? <PlanillasResumenCards customCards={bonosDeduccionesKpiCards} /> : null}

          <div className="planillas-alerts">
            {showAdelantosSection ? (
              <PlanillasAdelantosInsight
                summaryText={adelantosInsightSummary}
                loading={loadingAdelantosPendientes || loadingAdelantosHistorial}
                items={adelantosDataset}
                loadingAction={loadingAction}
                canAplicarAdelantos={canAplicarAdelantos}
                onApplyItem={handleApplyFromAdelantosHistorial}
                onApplyAll={handleApplyAllPendientes}
                onOpenRegister={openAdelantoRegistroGlobal}
                onOpenDetail={openAdelantosHistorial}
                formatFriendlyDate={formatFriendlyDate}
                formatMoney={formatMoney}
              />
            ) : null}

            {showBonosDeduccionesSection ? (
              <PlanillasBonosDeduccionesInsight
                summaryText={bonosDeduccionesInsightSummary}
                loading={loadingBonosDeduccionesHistorial}
                items={bonosDeduccionesDataset}
                loadingAction={loadingAction}
                canRegistrarMovimiento={canRegistrarMovimiento}
                onOpenRegister={openBonosDeduccionesRegistroGlobal}
                onOpenDetail={openBonosDeduccionesHistorial}
                formatFriendlyDate={formatFriendlyDate}
                formatMoney={formatMoney}
              />
            ) : null}

            {showHorasSection ? (
              <PlanillasHorasExtraInsight
                totalPendientesLabel={formatHoursLabel(horasExtraStats.totalPendientes)}
                empleadosConHoras={safeNumber(horasExtraStats.empleadosConHoras, 0)}
                canRegistrar={canRecalcular && !loadingEmpleadosActivos}
                onOpenDetalle={() => openHorasExtra()}
                onOpenRegistro={() => openHorasExtraRegistro()}
              />
            ) : null}
          </div>

          {showPagoSection ? (
            <>
              <PlanillasResumenCards resumen={resumen} cardKeys={PAGO_RESUMEN_CARD_KEYS} />

          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>
              {loadingPlanillas
                ? 'Cargando planillas...'
                : `Planillas: ${planillas.length} (total: ${planillasTotal}) · ${periodoOperativoLabel}`}
            </span>
            <span>
              {loadingDetalle
                ? 'Cargando detalle...'
                : `Detalle visible: ${pagedDetalle.length} (filtrado: ${filteredDetalle.length} - total: ${detalleTotal})`}
            </span>
          </div>

          <div className="inv-warehouse-moves__pagination inv-ins-pagination mt-2">
            <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
              {`Mostrando ${planillasPageWindowLabel} de ${planillasTotal}`}
            </div>

            <div className="inv-warehouse-moves__pagination-controls">
              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setListPage((current) => Math.max(1, current - 1))}
                disabled={listPage <= 1 || loadingPlanillas || planillasTotal === 0}
                aria-label="Pagina anterior de planillas"
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                <span>Anterior</span>
              </button>

              <div className="inv-warehouse-moves__pagination-pages">
                {visiblePlanillaPageNumbers.map((pageNumber) => (
                  <button
                    key={`planillas-page-${pageNumber}`}
                    type="button"
                    className={`inv-warehouse-moves__page-number ${pageNumber === listPage ? 'is-active' : ''}`.trim()}
                    onClick={() => setListPage(pageNumber)}
                    aria-label={`Ir a la pagina ${pageNumber} de planillas`}
                    aria-current={pageNumber === listPage ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                {`Pagina ${listPage} de ${totalPagesPlanillas}`}
              </div>

              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setListPage((current) => Math.min(totalPagesPlanillas, current + 1))}
                disabled={listPage >= totalPagesPlanillas || loadingPlanillas || planillasTotal === 0}
                aria-label="Pagina siguiente de planillas"
              >
                <span>Siguiente</span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>

          {loadingPlanillas ? (
            <PlanillasLoadingState message="Cargando planillas..." />
          ) : listError ? (
            <PlanillasErrorState message={listError} onRetry={loadPlanillas} />
          ) : hasNoData ? (
            <PlanillasEmptyState onGenerar={handleGenerar} canGenerar={canGenerarForPeriodo} />
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
                  onOpenHorasExtra={
                    activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.pagoPlanilla ? undefined : openHorasExtra
                  }
                  onOpenAdelanto={openAdelantos}
                  onRecalcularDetalle={(item) =>
                    withAction(
                      () =>
                        planillasService.recalcularDetallePlanilla(
                          selectedPlanilla.id_planilla,
                          item.id_detalle_planilla || item.id_detalle,
                          { id_sucursal: activePlanillaSucursalId || undefined }
                        ),
                      'Detalle recalculado correctamente'
                    )
                  }
                  canAplicarAdelanto={
                    activePlanillasTab === PLANILLAS_NAV_TAB_KEYS.pagoPlanilla ? false : canAplicarAdelantos
                  }
                  canRecalcular={canRecalcular}
                />
              )}

              <div className="inv-warehouse-moves__pagination inv-ins-pagination">
                <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
                  {`Mostrando ${detallePageWindowLabel} de ${filteredDetalle.length}`}
                </div>

                <div className="inv-warehouse-moves__pagination-controls">
                  <button
                    type="button"
                    className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                    onClick={() => setDetallePage((current) => Math.max(1, current - 1))}
                    disabled={detallePage <= 1 || loadingDetalle}
                    aria-label="Pagina anterior de detalle"
                  >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                    <span>Anterior</span>
                  </button>

                  <div className="inv-warehouse-moves__pagination-pages">
                    {visibleDetallePageNumbers.map((pageNumber) => (
                      <button
                        key={`detalle-page-${pageNumber}`}
                        type="button"
                        className={`inv-warehouse-moves__page-number ${pageNumber === detallePage ? 'is-active' : ''}`.trim()}
                        onClick={() => setDetallePage(pageNumber)}
                        aria-label={`Ir a la pagina ${pageNumber} del detalle`}
                        aria-current={pageNumber === detallePage ? 'page' : undefined}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>

                  <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                    {`Pagina ${detallePage} de ${totalPagesDetalle}`}
                  </div>

                  <button
                    type="button"
                    className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                    onClick={() => setDetallePage((current) => Math.min(totalPagesDetalle, current + 1))}
                    disabled={detallePage >= totalPagesDetalle || loadingDetalle}
                    aria-label="Pagina siguiente de detalle"
                  >
                    <span>Siguiente</span>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
            </>
          ) : null}
            </>
          )}
        </div>
      </div>

      <PlanillaDetallePanel
        open={Boolean(detailItem)}
        item={detailItem}
        planillaEstado={
          selectedPlanilla?.estado_descripcion ||
          selectedPlanilla?.estado_planilla ||
          selectedPlanilla?.estado ||
          selectedPlanilla?.descripcion_estado ||
          ''
        }
        onClose={() => setDetailItem(null)}
      />

      <PlanillaMovimientosModal
        open={movimientosModal.open}
        item={movimientosModal.item}
        loading={movimientosModal.loading}
        movimientos={movimientosModal.items}
        onClose={() => setMovimientosModal({ open: false, item: null, loading: false, items: [] })}
        onAnular={handleAnularMovimiento}
        canAnular={canAnularMovimiento}
      />

      <PlanillaBonosDeduccionesHistorialModal
        open={bonosDeduccionesHistorialModal.open}
        loading={bonosDeduccionesHistorialModal.loading}
        rows={bonosDeduccionesHistorialModal.items}
        loadingAction={loadingAction}
        anulandoId={bonosDeduccionesHistorialModal.deletingId}
        canAnular={canAnularMovimiento}
        onClose={() =>
          setBonosDeduccionesHistorialModal({
            open: false,
            loading: false,
            items: [],
            deletingId: null
          })
        }
        onAnular={handleAnularBonoDeduccion}
      />

      <PlanillaMovimientoFormModal
        key={`movimiento-form-${movimientoFormModal.open ? 'open' : 'closed'}-${movimientoFormModal.mode}-${
          movimientoFormModal.tipo
        }-${movimientoFormModal.item?.id_detalle_planilla || movimientoFormModal.item?.id_detalle || 'global'}-${
          movimientoFormModal.selectedEmpleadoId || 'none'
        }`}
        open={movimientoFormModal.open}
        item={movimientoFormModal.item}
        tipo={movimientoFormModal.tipo}
        allowEmployeeSelect={movimientoFormModal.mode === 'global'}
        employees={empleadosRegistroOptions}
        selectedEmpleadoId={movimientoFormModal.selectedEmpleadoId}
        loading={movimientoFormModal.loading}
        onClose={() =>
          setMovimientoFormModal({
            open: false,
            tipo: 'bono',
            item: null,
            mode: 'detalle',
            selectedEmpleadoId: '',
            loading: false
          })
        }
        onSubmit={(payload) => {
          void withAction(
            async () => {
              setMovimientoFormModal((state) => ({ ...state, loading: true }));
              try {
                const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
                if (!context?.idPlanilla) {
                  throw new Error('No se pudo preparar la planilla para registrar el movimiento.');
                }

                const isGlobal = movimientoFormModal.mode === 'global';
                const idEmpleadoPayload = safeNumber(payload?.id_empleado, 0);
                let idDetalle = safeNumber(
                  movimientoFormModal.item?.id_detalle_planilla || movimientoFormModal.item?.id_detalle,
                  0
                );

                if (isGlobal) {
                  idDetalle = await resolveDetalleIdForEmpleado({
                    idPlanilla: context.idPlanilla,
                    idEmpleado: idEmpleadoPayload,
                    idSucursal: context.idSucursal
                  });
                }

                if (!(idDetalle > 0)) {
                  throw new Error('No se pudo ubicar el detalle de planilla del empleado seleccionado.');
                }

                const { id_empleado: _unusedIdEmpleado, ...payloadSinEmpleado } = payload;
                await planillasService.registrarMovimientoPlanilla(context.idPlanilla, {
                  id_detalle: idDetalle,
                  id_sucursal: context.idSucursal || undefined,
                  tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
                  quincena:
                    normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                      ? normalizeQuincena(quincena)
                      : undefined,
                  ...payloadSinEmpleado
                });
                setMovimientoFormModal({
                  open: false,
                  tipo: 'bono',
                  item: null,
                  mode: 'detalle',
                  selectedEmpleadoId: '',
                  loading: false
                });
              } finally {
                setMovimientoFormModal((state) => ({ ...state, loading: false }));
              }
            },
            {
              successMessage: 'Movimiento registrado correctamente',
              onError: () => {
                setMovimientoFormModal((state) => ({ ...state, loading: false }));
              }
            }
          );
        }}
      />

      <PlanillaAdelantosModal
        key={`ad-apply-${adelantosModal.open ? 'open' : 'closed'}-${safeNumber(adelantosModal.item?.id_empleado, 0)}`}
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
          if (!adelantosModal.item) return;
          void withAction(
            async () => {
              const context = await ensurePlanillaForRegistro({ notifyOnCreate: false });
              if (!context?.idPlanilla) {
                throw new Error('No se pudo preparar la planilla para aplicar el adelanto.');
              }
              setAdelantosModal((state) => ({ ...state, applying: true }));
              await planillasService.aplicarAdelantoPlanilla(context.idPlanilla, {
                id_sucursal: context.idSucursal || undefined,
                tipo_periodo: normalizeTipoPeriodo(tipoPeriodo),
                quincena:
                  normalizeTipoPeriodo(tipoPeriodo) === TIPO_PERIODO.quincenal
                    ? normalizeQuincena(quincena)
                    : undefined,
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
            {
              successMessage: 'Adelanto aplicado correctamente',
              onError: () => {
                setAdelantosModal((state) => ({ ...state, applying: false }));
              }
            }
          );
        }}
        onRegister={handleRegistrarAdelanto}
      />

      <PlanillaAdelantoRegistroGlobalModal
        key={`ad-register-global-${adelantoRegistroGlobalModal.open ? 'open' : 'closed'}-${
          selectedPlanilla?.id_planilla || 'na'
        }`}
        open={adelantoRegistroGlobalModal.open}
        registering={adelantoRegistroGlobalModal.registering}
        canRegister={canAplicarAdelantos && !loadingEmpleadosActivos}
        empleados={empleadosRegistroOptions}
        onClose={() => setAdelantoRegistroGlobalModal({ open: false, registering: false })}
        onSubmit={handleRegistrarAdelantoGlobal}
      />

      <PlanillaAdelantosHistorialModal
        key={`ad-detail-${adelantosHistorialModal.open ? 'open' : 'closed'}-${
          adelantosHistorialModal.item?.id_empleado || 'all'
        }-${selectedPlanilla?.id_planilla || 'na'}`}
        open={adelantosHistorialModal.open}
        loading={adelantosHistorialModal.loading}
        loadingAction={loadingAction}
        rows={adelantosHistorialModal.items}
        empleadoLabel={adelantosHistorialModal.empleadoLabel}
        updatingId={adelantosHistorialModal.updatingId}
        deletingId={adelantosHistorialModal.deletingId}
        canEditar={canAplicarAdelantos}
        canEliminar={canAplicarAdelantos}
        hasPlanillaSeleccionada={hasSucursalSelected && Boolean(toText(periodo, ''))}
        onClose={() =>
          setAdelantosHistorialModal({
            open: false,
            loading: false,
            item: null,
            empleadoLabel: '',
            items: [],
            updatingId: null,
            deletingId: null
          })
        }
        onAplicarPendiente={handleApplyFromAdelantosHistorial}
        onEditar={handleActualizarAdelantoAplicado}
        onEliminar={handleEliminarAdelantoAplicado}
      />

      <PlanillaAdelantosPendientesModal
        open={adelantosPendientesModalOpen}
        loading={loadingAdelantosPendientes}
        loadingAction={loadingAction}
        items={adelantosPendientes}
        hasPlanillaSeleccionada={hasSucursalSelected && Boolean(toText(periodo, ''))}
        onClose={() => setAdelantosPendientesModalOpen(false)}
        onApplyForEmpleado={handleApplyFromPendientes}
      />

      <PlanillaHorasExtraModal
        key={`he-detail-${horasExtraModal.open ? 'open' : 'closed'}-${
          horasExtraModal.item?.id_empleado || 'all'
        }-${selectedPlanilla?.id_planilla || 'na'}`}
        open={horasExtraModal.open}
        loading={horasExtraModal.loading}
        rows={horasExtraModal.items}
        resumen={horasExtraModal.summary}
        empleadoLabel={horasExtraModal.empleadoLabel}
        compensatingId={horasExtraModal.compensatingId}
        updatingId={horasExtraModal.updatingId}
        deletingId={horasExtraModal.deletingId}
        canEditar={canRecalcular}
        canEliminar={canRecalcular}
        onClose={() =>
          setHorasExtraModal({
            open: false,
            loading: false,
            item: null,
            empleadoLabel: '',
            items: [],
            summary: {},
            compensatingId: null,
            updatingId: null,
            deletingId: null
          })
        }
        onCompensar={handleCompensarHoraExtra}
        onActualizar={handleActualizarHoraExtra}
        onEliminar={handleEliminarHoraExtra}
      />

      <PlanillaHorasExtraRegistroModal
        key={`he-register-${horasExtraRegistroModal.open ? 'open' : 'closed'}-${
          horasExtraRegistroModal.defaultEmpleadoId || 'none'
        }-${selectedPlanilla?.id_planilla || 'na'}`}
        open={horasExtraRegistroModal.open}
        registering={horasExtraRegistroModal.registering}
        canRegister={canRecalcular && !loadingEmpleadosActivos}
        empleados={empleadosRegistroOptions}
        defaultEmpleadoId={horasExtraRegistroModal.defaultEmpleadoId}
        onClose={() =>
          setHorasExtraRegistroModal({
            open: false,
            registering: false,
            defaultEmpleadoId: ''
          })
        }
        onSubmit={handleRegistrarHoraExtra}
      />

      <PlanillaAuditoriaModal
        open={auditoriaModal.open}
        loading={auditoriaModal.loading}
        items={auditoriaModal.items}
        onClose={() => setAuditoriaModal({ open: false, loading: false, items: [] })}
      />

      <ExportModal
        key={`export-${exportModalOpen ? 'open' : 'closed'}-${safeNumber(selectedPlanilla?.id_planilla, 0)}`}
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onSubmit={handleExportSubmit}
        loading={loadingExport}
        resumen={resumen}
        planillaLabel={selectedPlanillaLabel}
      />

      {localToast.show ? (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${toText(localToast.variant, 'success')}`}>
            <div className="inv-toast-icon">
              <i className={resolveToastIconClass(localToast.variant)} />
            </div>
            <div className="inv-toast-content">
              <div className="inv-toast-title">{toText(localToast.title, 'AVISO')}</div>
              <div className="inv-toast-message">{toText(localToast.message, '')}</div>
            </div>
            <button
              type="button"
              className="inv-toast-close"
              onClick={closeLocalToast}
              aria-label="Cerrar notificacion"
            >
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-toast-progress" />
          </div>
        </div>
      ) : null}

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
              {confirmModal.description ? (
                <div className="inv-pro-confirm-description">{confirmModal.description}</div>
              ) : null}
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



