import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dashboardService from '../../../../services/dashboardService';
import { securityService } from '../../../../services/securityService';
import { PERMISSIONS } from '../../../../utils/permissions';
import {
  buildFallbackOrdersFlow,
  buildSummaryCacheKey,
  createTimedCache,
  dedupeOptions,
  getTimedCacheValue,
  resolveFinancialShape,
  setTimedCacheValue,
  toNumber
} from './dashboardDataUtils';
import { formatDateInput, resolvePreviousSalesRangeWindow, resolveSalesRangeWindow } from './dashboardDateUtils';
import {
  buildAlerts,
  buildBranchRanking,
  buildExecutiveInsights,
  buildFinancialView,
  buildHealthSemaphores,
  buildMetrics
} from './dashboardInsights';

const CACHE_TTL_MS = 90 * 1000;
const generalDashboardCache = createTimedCache();
const financialDashboardCache = createTimedCache();
const ordersFlowDashboardCache = createTimedCache();
const summaryDashboardCache = createTimedCache();
const summaryDashboardRequests = new Map();

const normalizeDashboardResponse = (response) => (
  response?.data && typeof response.data === 'object'
    ? response.data
    : response && typeof response === 'object'
      ? response
      : null
);

const normalizeLegacyDashboardResponse = (response, params = {}) => {
  const summary = response?.summary || {};
  const general = summary?.general || {};
  const pedidos = general?.pedidos || {};
  const inventario = general?.inventario || {};
  const sucursales = general?.sucursales || {};
  const financial = summary?.financial || {};
  const fechaOperacion = params?.fechaOperacion || formatDateInput(new Date());

  return {
    ventas: {
      totalHoy: toNumber(financial?.totalVendido, 0),
      totalCobradoHoy: toNumber(financial?.totalVendido, 0),
      facturasHoy: Number.parseInt(String(financial?.ventas ?? 0), 10) || 0,
      ticketPromedio: toNumber(financial?.ticketPromedio, 0),
      ventasUltimosDias: [],
      productosVendidos: [],
      resumenPeriodo: {
        fechaDesde: params?.fechaDesde || null,
        fechaHasta: params?.fechaHasta || null,
        totalCobrado: toNumber(financial?.totalVendido, 0),
        facturas: Number.parseInt(String(financial?.ventas ?? 0), 10) || 0,
        ticketPromedio: toNumber(financial?.ticketPromedio, 0)
      }
    },
    inventario: {
      productosActivos: 0,
      insumosActivos: 0,
      bajoStock: Number.parseInt(String(inventario?.stockBajo ?? 0), 10) || 0,
      sinStock: Number.parseInt(String(inventario?.agotados ?? 0), 10) || 0,
      alertasPendientes: 0,
      movimientosRecientes: []
    },
    pedidos: {
      abiertos: Number.parseInt(String(pedidos?.totalOperacion ?? 0), 10) || 0,
      pendientesPago: Number.parseInt(String(pedidos?.pendientesPago ?? 0), 10) || 0,
      enCocina: Number.parseInt(String(pedidos?.enCocina ?? 0), 10) || 0,
      listosEntrega: Number.parseInt(String(pedidos?.listosEntrega ?? 0), 10) || 0,
      pagadosHoy: 0,
      flujoHorario: Array.isArray(pedidos?.flujoHorario) ? pedidos.flujoHorario : [],
      porSucursal: []
    },
    compras: {
      ordenesPendientes: 0,
      comprasMes: 0
    },
    caja: {
      sesionesAbiertas: 0,
      cierresPendientes: 0
    },
    meta: {
      sucursales: [],
      sucursalesResumen: {
        total: Number.parseInt(String(sucursales?.total ?? 0), 10) || 0,
        activas: Number.parseInt(String(sucursales?.activas ?? 0), 10) || 0
      },
      fechaOperacion
    }
  };
};

const buildDashboardLoadError = (error, endpointLabel) => {
  const message = String(error?.message || '').trim();
  if (!message) {
    return `No se pudo cargar ${endpointLabel}.`;
  }
  return `${endpointLabel}: ${message}`;
};

const normalizeSecuritySummary = (payload) => (
  payload && typeof payload === 'object' ? payload : {}
);

const normalizeFlowRows = (rows = []) => (
  Array.isArray(rows) && rows.length
    ? rows.map((row) => ({
        hour: row?.hour || '00:00',
        pedidos: Number.parseInt(String(row?.pedidos ?? '0'), 10) || 0
      }))
    : buildFallbackOrdersFlow()
);

const hasUsefulInventorySummary = (summary) => {
  const inventario = summary?.inventario || {};
  return (
    toNumber(inventario?.productosActivos, 0) > 0
    || toNumber(inventario?.insumosActivos, 0) > 0
    || toNumber(inventario?.bajoStock, 0) > 0
    || toNumber(inventario?.sinStock, 0) > 0
    || toNumber(inventario?.alertasPendientes, 0) > 0
    || (Array.isArray(inventario?.movimientosRecientes) && inventario.movimientosRecientes.length > 0)
  );
};

const shouldKeepPreviousInventory = (nextSummary, previousSummary) => (
  Boolean(previousSummary)
  && hasUsefulInventorySummary(previousSummary)
  && !hasUsefulInventorySummary(nextSummary)
);

const mergeStableDashboardSummary = (nextSummary, previousSummary) => {
  if (!nextSummary || !previousSummary) return nextSummary;
  if (!shouldKeepPreviousInventory(nextSummary, previousSummary)) return nextSummary;

  return {
    ...nextSummary,
    inventario: previousSummary.inventario || nextSummary.inventario,
    meta: {
      ...(nextSummary.meta || {}),
      sucursales: Array.isArray(nextSummary?.meta?.sucursales) && nextSummary.meta.sucursales.length
        ? nextSummary.meta.sucursales
        : previousSummary?.meta?.sucursales || [],
      sucursalesDisponibles:
        Array.isArray(nextSummary?.meta?.sucursalesDisponibles) && nextSummary.meta.sucursalesDisponibles.length
          ? nextSummary.meta.sucursalesDisponibles
          : previousSummary?.meta?.sucursalesDisponibles || [],
      sucursalesResumen:
        toNumber(nextSummary?.meta?.sucursalesResumen?.total, 0) > 0
          ? nextSummary.meta.sucursalesResumen
          : previousSummary?.meta?.sucursalesResumen || nextSummary?.meta?.sucursalesResumen
    }
  };
};

export const useInicioDashboardData = ({
  can,
  isSuperAdmin,
  salesRange = 'day',
  sucursalFilter = 'all',
  turnFilter = 'all',
  ordersFlowDate = formatDateInput(new Date())
}) => {
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [loadingFinancial, setLoadingFinancial] = useState(true);
  const [error, setError] = useState('');
  const [financialError, setFinancialError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [payload, setPayload] = useState({
    dashboardSummary: null,
    securitySummary: {}
  });
  const [financialPayload, setFinancialPayload] = useState({});
  const [ordersFlowPayload, setOrdersFlowPayload] = useState({
    rows: buildFallbackOrdersFlow(),
    fechaOperacion: ordersFlowDate,
    usesFallback: true
  });
  const [dataSourceMode, setDataSourceMode] = useState('API consolidada');
  const canRef = useRef(can);

  useEffect(() => {
    canRef.current = can;
  }, [can]);

  const financialWindow = useMemo(() => resolveSalesRangeWindow(salesRange), [salesRange]);

  const fetchDashboardSummary = useCallback(async (params = {}, { force = false } = {}) => {
    const key = buildSummaryCacheKey(params);
    if (!force) {
      const cached = getTimedCacheValue(summaryDashboardCache, key, CACHE_TTL_MS);
      if (cached) return cached;
      if (summaryDashboardRequests.has(key)) {
        return summaryDashboardRequests.get(key);
      }
    }

    const requestPromise = (async () => {
      let normalized = null;
      let primaryError = null;
      let legacyError = null;
      const response = await dashboardService.getResumen(
        force ? { ...params, cache: 'skip' } : params
      ).catch((error) => {
        primaryError = error;
        return null;
      });
      normalized = normalizeDashboardResponse(response);
      if (!normalized) {
        const legacyResponse = await dashboardService.getLegacyResumen(
          force ? { ...params, cache: 'skip' } : params
        ).catch((error) => {
          legacyError = error;
          return null;
        });
        normalized = legacyResponse ? normalizeLegacyDashboardResponse(legacyResponse, params) : null;
      }
      if (normalized) {
        setTimedCacheValue(summaryDashboardCache, key, normalized);
        return normalized;
      }
      return {
        __dashboardError: [
          primaryError ? buildDashboardLoadError(primaryError, '/dashboard/resumen') : '',
          legacyError ? buildDashboardLoadError(legacyError, '/ventas/dashboard-resumen') : ''
        ].filter(Boolean).join(' | ')
      };
    })();

    if (!force) {
      summaryDashboardRequests.set(key, requestPromise);
    }

    try {
      return await requestPromise;
    } finally {
      if (!force) {
        summaryDashboardRequests.delete(key);
      }
    }
  }, []);

  const loadGeneralData = useCallback(async ({ force = false } = {}) => {
    const generalCacheKey = `general:${sucursalFilter}:${turnFilter}`;
    if (!force) {
      const cached = getTimedCacheValue(generalDashboardCache, generalCacheKey, CACHE_TTL_MS);
      if (cached) {
        setPayload(cached.payload);
        setError(cached.error);
        setDataSourceMode(cached.dataSourceMode);
        setLastUpdatedAt(cached.lastUpdatedAt);
        setLoadingGeneral(false);
        return;
      }
    }

    setLoadingGeneral(true);
    setError('');

    const summaryPromise = fetchDashboardSummary(
      {
        ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {}),
        turno: turnFilter
      },
      { force }
    );
    const securityPromise = isSuperAdmin && canRef.current(PERMISSIONS.SEGURIDAD_VER)
      ? securityService.getSecuritySummary().catch(() => ({}))
      : Promise.resolve({});

    const [dashboardSummaryResult, securitySummary] = await Promise.all([summaryPromise, securityPromise]);
    const nextDashboardSummary =
      dashboardSummaryResult && !dashboardSummaryResult.__dashboardError
        ? dashboardSummaryResult
        : null;
    const dashboardSummary = mergeStableDashboardSummary(
      nextDashboardSummary,
      payload.dashboardSummary
    );
    const loadErrorDetail = dashboardSummaryResult?.__dashboardError || '';
    const normalizedPayload = {
      dashboardSummary,
      securitySummary: normalizeSecuritySummary(securitySummary)
    };
    const nextUpdatedAt = new Date();
    const nextError = dashboardSummary
      ? ''
      : loadErrorDetail
        ? `No se pudo cargar el resumen centralizado del dashboard. ${loadErrorDetail}`
        : 'No se pudo cargar el resumen centralizado del dashboard. Se muestran valores vacios seguros.';

    setPayload(normalizedPayload);
    setDataSourceMode('API consolidada');
    setLastUpdatedAt(nextUpdatedAt);
    setError(nextError);

    setTimedCacheValue(generalDashboardCache, generalCacheKey, {
      payload: normalizedPayload,
      error: nextError,
      dataSourceMode: 'API consolidada',
      lastUpdatedAt: nextUpdatedAt
    });

    setLoadingGeneral(false);
  }, [fetchDashboardSummary, isSuperAdmin, payload.dashboardSummary, sucursalFilter, turnFilter]);

  const loadFinancialData = useCallback(async ({ force = false } = {}) => {
    if (!can(PERMISSIONS.VENTAS_VER)) {
      setFinancialPayload({});
      setFinancialError('');
      setLoadingFinancial(false);
      return;
    }

    const cacheKey = `${financialWindow.fechaDesde}:${financialWindow.fechaHasta}:${sucursalFilter}`;
    if (!force) {
      const cached = getTimedCacheValue(financialDashboardCache, cacheKey, CACHE_TTL_MS);
      if (cached) {
        setFinancialPayload(cached.payload);
        setFinancialError(cached.error);
        setLoadingFinancial(false);
        return;
      }
    }

    setLoadingFinancial(true);
    setFinancialError('');

    try {
      const previousWindow = resolvePreviousSalesRangeWindow(financialWindow);
      const [currentSummaryResult, previousSummaryResult] = await Promise.all([
        fetchDashboardSummary(
          {
            fechaDesde: financialWindow.fechaDesde,
            fechaHasta: financialWindow.fechaHasta,
            ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
          },
          { force }
        ),
        fetchDashboardSummary(
          {
            fechaDesde: previousWindow.fechaDesde,
            fechaHasta: previousWindow.fechaHasta,
            ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
          },
          { force }
        )
      ]);
      const currentSummary =
        currentSummaryResult && !currentSummaryResult.__dashboardError
          ? currentSummaryResult
          : null;
      const periodSummary = currentSummary?.ventas?.resumenPeriodo || {};
      const previousSummary =
        previousSummaryResult && !previousSummaryResult.__dashboardError
          ? previousSummaryResult
          : null;
      const previousPeriodSummary = previousSummary?.ventas?.resumenPeriodo || null;

      const nextPayload = {
        summary: {
          totalVendido: toNumber(periodSummary?.totalCobrado, 0),
          ventas: Number.parseInt(String(periodSummary?.facturas ?? 0), 10) || 0,
          ticketPromedio: toNumber(periodSummary?.ticketPromedio, 0),
          completadas: Number.parseInt(String(periodSummary?.facturas ?? 0), 10) || 0,
          pendientes: 0
        },
        comparisonSummary: previousPeriodSummary
          ? {
              totalVendido: toNumber(previousPeriodSummary?.totalCobrado, 0),
              ventas: Number.parseInt(String(previousPeriodSummary?.facturas ?? 0), 10) || 0,
              ticketPromedio: toNumber(previousPeriodSummary?.ticketPromedio, 0),
              completadas: Number.parseInt(String(previousPeriodSummary?.facturas ?? 0), 10) || 0,
              pendientes: 0
            }
          : null,
        comparisonWindow: previousWindow
      };

      setFinancialPayload(nextPayload);
      setTimedCacheValue(financialDashboardCache, cacheKey, {
        payload: nextPayload,
        error: ''
      });
    } catch {
      setFinancialPayload({});
      setFinancialError('No se pudo cargar el resumen financiero del periodo.');
    } finally {
      setLastUpdatedAt(new Date());
      setLoadingFinancial(false);
    }
  }, [can, fetchDashboardSummary, financialWindow, sucursalFilter]);

  const loadOrdersFlowData = useCallback(async ({ force = false } = {}) => {
    const cacheKey = `${ordersFlowDate}:${sucursalFilter}`;
    if (!force) {
      const cached = getTimedCacheValue(ordersFlowDashboardCache, cacheKey, CACHE_TTL_MS);
      if (cached) {
        setOrdersFlowPayload(cached);
        return;
      }
    }

    try {
      const responseResult = await fetchDashboardSummary(
        {
          fechaOperacion: ordersFlowDate,
          ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
        },
        { force }
      );
      const response =
        responseResult && !responseResult.__dashboardError
          ? responseResult
          : null;
      let rows = Array.isArray(response?.pedidos?.flujoHorario) ? response.pedidos.flujoHorario : [];
      if (!rows.length) {
        const legacyFlow = await dashboardService.getLegacyFlujoPedidos(
          {
            fechaOperacion: ordersFlowDate,
            ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
          }
        ).catch(() => null);
        rows = Array.isArray(legacyFlow?.summary?.rows) ? legacyFlow.summary.rows : rows;
      }
      const nextPayload = {
        rows: normalizeFlowRows(rows),
        fechaOperacion: response?.meta?.fechaOperacion || ordersFlowDate,
        usesFallback: rows.length === 0
      };
      setOrdersFlowPayload(nextPayload);
      setTimedCacheValue(ordersFlowDashboardCache, cacheKey, nextPayload);
    } catch {
      const nextPayload = {
        rows: buildFallbackOrdersFlow(),
        fechaOperacion: ordersFlowDate,
        usesFallback: true
      };
      setOrdersFlowPayload(nextPayload);
      setTimedCacheValue(ordersFlowDashboardCache, cacheKey, nextPayload);
    }
  }, [fetchDashboardSummary, ordersFlowDate, sucursalFilter]);

  const refresh = useCallback(async () => {
    generalDashboardCache.clear();
    financialDashboardCache.clear();
    ordersFlowDashboardCache.clear();
    summaryDashboardCache.clear();
    summaryDashboardRequests.clear();
    await Promise.all([
      loadGeneralData({ force: true }),
      loadFinancialData({ force: true }),
      loadOrdersFlowData({ force: true })
    ]);
  }, [loadFinancialData, loadGeneralData, loadOrdersFlowData]);

  useEffect(() => {
    loadGeneralData();
  }, [loadGeneralData]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  useEffect(() => {
    loadOrdersFlowData();
  }, [loadOrdersFlowData]);

  const dashboardSummary = payload.dashboardSummary;

  const sucursalOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Todas las sucursales' }];
    const source = Array.isArray(dashboardSummary?.meta?.sucursalesDisponibles) && dashboardSummary.meta.sucursalesDisponibles.length
      ? dashboardSummary.meta.sucursalesDisponibles
      : Array.isArray(dashboardSummary?.meta?.sucursales)
        ? dashboardSummary.meta.sucursales
        : [];
    const dynamic = source.map((row) => ({
          value: String(row?.id_sucursal ?? ''),
          label: row?.nombre_sucursal || `Sucursal #${row?.id_sucursal ?? '--'}`
        }));
    return base.concat(dedupeOptions(dynamic.filter((item) => item.value)));
  }, [dashboardSummary]);

  const turnOptions = useMemo(
    () => [
      { value: 'all', label: 'Todo el dia' },
      { value: 'manana', label: 'Turno manana' },
      { value: 'tarde', label: 'Turno tarde' },
      { value: 'noche', label: 'Turno noche' }
    ],
    []
  );

  const metrics = useMemo(
    () => buildMetrics({ payload }),
    [payload]
  );

  const financial = useMemo(() => {
    const base = resolveFinancialShape(financialPayload);
    return buildFinancialView({
      can,
      PERMISSIONS,
      loadingFinancial,
      financialError,
      financialPayload: {
        ...financialPayload,
        summary: base.summary,
        hasSummary: base.hasSummary
      },
      financialWindow
    });
  }, [can, financialError, financialPayload, financialWindow, loadingFinancial]);

  const alerts = useMemo(
    () => buildAlerts({ metrics, can, PERMISSIONS }),
    [can, metrics]
  );

  const charts = useMemo(() => ({
    inventoryRisk: [
      { id: 'agotados', name: 'Sin stock', value: metrics.agotados, color: '#c94f43' },
      { id: 'stock-bajo', name: 'Bajo stock', value: metrics.stockBajo, color: '#d39b38' }
    ],
    ordersStatus: [
      { name: 'Pendientes', value: metrics.pendientesPago, color: '#b88a4a' },
      { name: 'En cocina', value: metrics.enCocina, color: '#d97b33' },
      { name: 'Listos', value: metrics.listosEntrega, color: '#5f9f72' }
    ],
    ordersFlow: ordersFlowPayload.rows,
    ordersFlowUsesFallback: Boolean(ordersFlowPayload.usesFallback),
    ordersFlowDate: ordersFlowPayload.fechaOperacion || ordersFlowDate
  }), [metrics, ordersFlowDate, ordersFlowPayload]);

  const insights = useMemo(
    () => buildExecutiveInsights({ metrics, financial }),
    [financial, metrics]
  );

  const healthSemaphores = useMemo(
    () => buildHealthSemaphores({ metrics, financial }),
    [financial, metrics]
  );

  const branchRanking = useMemo(
    () => buildBranchRanking({
      sucursales: dashboardSummary?.meta?.sucursales || [],
      pedidosPorSucursal: dashboardSummary?.pedidos?.porSucursal || [],
      selectedSucursal: sucursalFilter
    }),
    [dashboardSummary, sucursalFilter]
  );

  const filtersSummary = useMemo(() => {
    const sucursalLabel =
      sucursalOptions.find((option) => option.value === sucursalFilter)?.label || 'Todas las sucursales';
    const turnoLabel = turnOptions.find((option) => option.value === turnFilter)?.label || 'Todo el dia';

    return {
      sucursalLabel,
      turnoLabel,
      inventoryScopeNotice: ''
    };
  }, [sucursalFilter, sucursalOptions, turnFilter, turnOptions]);

  return {
    loading: loadingGeneral,
    error,
    lastUpdatedAt,
    dataSourceMode,
    metrics,
    financial,
    alerts,
    charts,
    insights,
    branchRanking,
    healthSemaphores,
    sucursalOptions,
    turnOptions,
    filtersSummary,
    refresh
  };
};
