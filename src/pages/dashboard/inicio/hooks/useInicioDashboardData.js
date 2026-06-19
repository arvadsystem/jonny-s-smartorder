import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import sucursalesService from '../../../../services/sucursalesService';
import { inventarioService } from '../../../../services/inventarioService';
import { securityService } from '../../../../services/securityService';
import { PERMISSIONS } from '../../../../utils/permissions';
import { dashboardSupabaseService } from '../services/dashboardSupabaseService';
import {
  buildFallbackOrdersFlow,
  buildOrdersFlowDataset,
  buildSummaryCacheKey,
  createTimedCache,
  dedupeOptions,
  extractRows,
  filterPedidosByTurn,
  filterRowsBySucursal,
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

const CACHE_TTL_MS = 45 * 1000;

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
    sucursales: [],
    pedidosOperacion: [],
    productos: [],
    insumos: [],
    dashboardSummary: null,
    securitySummary: {}
  });
  const [financialPayload, setFinancialPayload] = useState({});
  const [ordersFlowPayload, setOrdersFlowPayload] = useState({
    rows: [],
    fechaOperacion: ordersFlowDate,
    usesFallback: true
  });
  const [dataSourceMode, setDataSourceMode] = useState('API');
  const generalCacheRef = useRef(null);
  const financialCacheRef = useRef(createTimedCache());
  const ordersFlowCacheRef = useRef(createTimedCache());
  const dashboardSummaryCacheRef = useRef(createTimedCache());

  const financialWindow = useMemo(() => resolveSalesRangeWindow(salesRange), [salesRange]);

  const fetchDashboardSummary = useCallback(async (params = {}, { force = false } = {}) => {
    const key = buildSummaryCacheKey(params);
    if (!force) {
      const cached = getTimedCacheValue(dashboardSummaryCacheRef.current, key, CACHE_TTL_MS);
      if (cached) return cached;
    }

    const response = await ventasService.getDashboardResumen(params).catch(() => null);
    setTimedCacheValue(dashboardSummaryCacheRef.current, key, response);
    return response;
  }, []);

  const loadGeneralData = useCallback(async ({ force = false } = {}) => {
    const generalCacheKey = `general:${sucursalFilter}:${turnFilter}`;
    if (!force && generalCacheRef.current?.key === generalCacheKey) {
      setPayload(generalCacheRef.current.payload);
      setError(generalCacheRef.current.error);
      setDataSourceMode(generalCacheRef.current.dataSourceMode);
      setLastUpdatedAt(generalCacheRef.current.lastUpdatedAt);
      setLoadingGeneral(false);
      return;
    }

    setLoadingGeneral(true);
    setError('');

    const shouldLoad = {
      sucursales: can(PERMISSIONS.SUCURSALES_VER),
      pedidosOperacion: can(PERMISSIONS.VENTAS_VER) || can(PERMISSIONS.COCINA_VER),
      productos: can(PERMISSIONS.INVENTARIO_PRODUCTOS_VER),
      insumos: can(PERMISSIONS.INVENTARIO_INSUMOS_VER)
    };

    const requestSucursalId = sucursalFilter !== 'all' ? sucursalFilter : undefined;
    const inventoryScope = requestSucursalId
      ? { incluirInactivos: true, id_sucursal: requestSucursalId }
      : { incluirInactivos: true };
    const pedidosScope = requestSucursalId ? { id_sucursal: requestSucursalId } : {};
    const supabaseSnapshot = await dashboardSupabaseService.getGeneralSnapshot({ shouldLoad, sucursalFilter });
    const dashboardSummaryResponse =
      shouldLoad.sucursales || shouldLoad.pedidosOperacion || shouldLoad.productos || shouldLoad.insumos
        ? await fetchDashboardSummary(
            {
              ...(requestSucursalId ? { id_sucursal: requestSucursalId } : {}),
              turno: turnFilter
            },
            { force }
          )
        : null;

    const dashboardSummary = dashboardSummaryResponse?.summary || null;
    const hasOrdersSummary = Boolean(dashboardSummary?.general?.pedidos);
    const hasInventorySummary = Boolean(dashboardSummary?.general?.inventario);

    const fetches = {
      dashboardSummary: Promise.resolve(dashboardSummary),
      sucursales:
        shouldLoad.sucursales && !supabaseSnapshot?.snapshot?.sucursales?.source
          ? sucursalesService.getAll()
          : Promise.resolve(supabaseSnapshot?.snapshot?.sucursales?.rows || []),
      pedidosOperacion:
        shouldLoad.pedidosOperacion && !hasOrdersSummary && !supabaseSnapshot?.snapshot?.pedidosOperacion?.source
          ? ventasService.getPedidosMenu(pedidosScope)
          : Promise.resolve(supabaseSnapshot?.snapshot?.pedidosOperacion?.rows || []),
      productos:
        shouldLoad.productos && !hasInventorySummary && !supabaseSnapshot?.snapshot?.productos?.source
          ? inventarioService.getProductos(inventoryScope)
          : Promise.resolve(supabaseSnapshot?.snapshot?.productos?.rows || []),
      insumos:
        shouldLoad.insumos && !hasInventorySummary && !supabaseSnapshot?.snapshot?.insumos?.source
          ? inventarioService.getInsumos(inventoryScope)
          : Promise.resolve(supabaseSnapshot?.snapshot?.insumos?.rows || []),
      securitySummary:
        isSuperAdmin && can(PERMISSIONS.SEGURIDAD_VER)
          ? securityService.getSecuritySummary()
          : Promise.resolve({})
    };

    const entries = Object.entries(fetches);
    const settled = await Promise.allSettled(entries.map(([, request]) => request));
    const nextPayload = {};
    let hasFailure = false;

    entries.forEach(([key], index) => {
      const result = settled[index];
      if (result.status === 'fulfilled') {
        nextPayload[key] = result.value;
        return;
      }

      hasFailure = true;
      nextPayload[key] = key === 'securitySummary' || key === 'dashboardSummary' ? {} : [];
    });

    const normalizedPayload = {
      sucursales: extractRows(nextPayload.sucursales),
      pedidosOperacion: extractRows(nextPayload.pedidosOperacion),
      productos: extractRows(nextPayload.productos),
      insumos: extractRows(nextPayload.insumos),
      dashboardSummary:
        nextPayload.dashboardSummary && typeof nextPayload.dashboardSummary === 'object'
          ? nextPayload.dashboardSummary
          : null,
      securitySummary:
        nextPayload.securitySummary && typeof nextPayload.securitySummary === 'object'
          ? nextPayload.securitySummary
          : {}
    };

    const nextUpdatedAt = new Date();
    const nextMode = dashboardSummary
      ? supabaseSnapshot?.usedFastPath
        ? 'Supabase + API consolidada'
        : 'API consolidada'
      : supabaseSnapshot?.usedFastPath
        ? 'Supabase + API'
        : 'API';
    const nextError = hasFailure
      ? 'No se pudieron cargar todas las métricas operativas. Se muestran datos parciales.'
      : '';

    setPayload(normalizedPayload);
    setDataSourceMode(nextMode);
    setLastUpdatedAt(nextUpdatedAt);
    if (nextError) setError(nextError);

    generalCacheRef.current = {
      key: generalCacheKey,
      payload: normalizedPayload,
      error: nextError,
      dataSourceMode: nextMode,
      lastUpdatedAt: nextUpdatedAt
    };

    setLoadingGeneral(false);
  }, [can, fetchDashboardSummary, isSuperAdmin, sucursalFilter, turnFilter]);

  const loadFinancialData = useCallback(async ({ force = false } = {}) => {
    if (!can(PERMISSIONS.VENTAS_VER)) {
      setFinancialPayload({});
      setFinancialError('');
      setLoadingFinancial(false);
      return;
    }

    const cacheKey = `${financialWindow.fechaDesde}:${financialWindow.fechaHasta}:${sucursalFilter}`;
    if (!force) {
      const cached = getTimedCacheValue(financialCacheRef.current, cacheKey, CACHE_TTL_MS);
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
      const currentSummaryResponse = await fetchDashboardSummary(
        {
          fechaDesde: financialWindow.fechaDesde,
          fechaHasta: financialWindow.fechaHasta,
          ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
        },
        { force }
      );
      const currentSummary = currentSummaryResponse?.summary?.financial;

      if (currentSummary && typeof currentSummary === 'object') {
        const previousWindow = resolvePreviousSalesRangeWindow(financialWindow);
        const previousSummaryResponse = await fetchDashboardSummary(
          {
            fechaDesde: previousWindow.fechaDesde,
            fechaHasta: previousWindow.fechaHasta,
            ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
          },
          { force }
        );
        const nextPayload = {
          summary: currentSummary,
          comparisonSummary: previousSummaryResponse?.summary?.financial || null,
          comparisonWindow: previousWindow
        };
        setFinancialPayload(nextPayload);
        setTimedCacheValue(financialCacheRef.current, cacheKey, {
          payload: nextPayload,
          error: ''
        });
        return;
      }

      const supabaseFinancial = await dashboardSupabaseService.getFinancialSummary({
        fechaDesde: financialWindow.fechaDesde,
        fechaHasta: financialWindow.fechaHasta,
        sucursalFilter
      });

      if (supabaseFinancial?.hasSummary) {
        const nextPayload = { summary: supabaseFinancial.summary, comparisonSummary: null, comparisonWindow: null };
        setFinancialPayload(nextPayload);
        setDataSourceMode((current) =>
          current === 'Supabase + API consolidada' || current === 'API consolidada'
            ? current
            : current === 'Supabase + API'
              ? current
              : 'Supabase'
        );
        setTimedCacheValue(financialCacheRef.current, cacheKey, {
          payload: nextPayload,
          error: ''
        });
        return;
      }

      const response = await ventasService.list({
        page: 1,
        pageSize: 1,
        fechaDesde: financialWindow.fechaDesde,
        fechaHasta: financialWindow.fechaHasta,
        ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
      });

      const nextPayload = response && typeof response === 'object' ? response : {};
      setFinancialPayload(nextPayload);
      setTimedCacheValue(financialCacheRef.current, cacheKey, {
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
      const cached = getTimedCacheValue(ordersFlowCacheRef.current, cacheKey, CACHE_TTL_MS);
      if (cached) {
        setOrdersFlowPayload(cached);
        return;
      }
    }

    try {
      const response = await ventasService.getDashboardFlujoPedidos({
        fechaOperacion: ordersFlowDate,
        ...(sucursalFilter !== 'all' ? { id_sucursal: sucursalFilter } : {})
      });

      const rows = Array.isArray(response?.summary?.rows) ? response.summary.rows : [];
      const nextPayload = {
        rows,
        fechaOperacion: response?.summary?.fechaOperacion || ordersFlowDate,
        usesFallback: rows.length === 0
      };

      setOrdersFlowPayload(nextPayload);
      setTimedCacheValue(ordersFlowCacheRef.current, cacheKey, nextPayload);
    } catch {
      const fallbackRows = buildFallbackOrdersFlow();
      const nextPayload = {
        rows: fallbackRows,
        fechaOperacion: ordersFlowDate,
        usesFallback: true
      };
      setOrdersFlowPayload(nextPayload);
      setTimedCacheValue(ordersFlowCacheRef.current, cacheKey, nextPayload);
    }
  }, [ordersFlowDate, sucursalFilter]);

  const refresh = useCallback(async () => {
    generalCacheRef.current = null;
    financialCacheRef.current.clear();
    ordersFlowCacheRef.current.clear();
    dashboardSummaryCacheRef.current.clear();
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

  const sucursalOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Todas las sucursales' }];
    const dynamic = payload.sucursales.map((row) => ({
      value: String(row?.id_sucursal ?? ''),
      label: row?.nombre_sucursal || row?.nombre || row?.sucursal || `Sucursal #${row?.id_sucursal ?? '--'}`
    }));
    return base.concat(dedupeOptions(dynamic.filter((item) => item.value)));
  }, [payload.sucursales]);

  const turnOptions = useMemo(
    () => [
      { value: 'all', label: 'Todo el día' },
      { value: 'manana', label: 'Turno mañana' },
      { value: 'tarde', label: 'Turno tarde' },
      { value: 'noche', label: 'Turno noche' }
    ],
    []
  );

  const scopedPayload = useMemo(() => {
    const pedidosSucursal = filterRowsBySucursal(payload.pedidosOperacion, sucursalFilter);
    return {
      sucursales: filterRowsBySucursal(payload.sucursales, sucursalFilter),
      pedidosOperacion: filterPedidosByTurn(pedidosSucursal, turnFilter),
      productos: payload.productos,
      insumos: payload.insumos,
      inventorySupportsSucursalFilter: true
    };
  }, [payload, sucursalFilter, turnFilter]);

  const metrics = useMemo(
    () => buildMetrics({ payload, scopedPayload }),
    [payload, scopedPayload]
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

  const charts = useMemo(() => {
    const summaryOrdersFlow = Array.isArray(ordersFlowPayload?.rows) ? ordersFlowPayload.rows : [];
    const ordersFlow = summaryOrdersFlow.length
      ? {
          rows: summaryOrdersFlow,
          usesFallback: Boolean(ordersFlowPayload?.usesFallback)
        }
      : buildOrdersFlowDataset(scopedPayload.pedidosOperacion);

    return {
      inventoryRisk: [
        { id: 'agotados', name: 'Sin stock', value: metrics.agotados, color: '#c94f43' },
        { id: 'stock-bajo', name: 'Bajo stock', value: metrics.stockBajo, color: '#d39b38' }
      ],
      ordersStatus: [
        { name: 'Pendientes', value: metrics.pendientesPago, color: '#b88a4a' },
        { name: 'En cocina', value: metrics.enCocina, color: '#d97b33' },
        { name: 'Listos', value: metrics.listosEntrega, color: '#5f9f72' }
      ],
      ordersFlow: ordersFlow.rows,
      ordersFlowUsesFallback: ordersFlow.usesFallback,
      ordersFlowDate: ordersFlowPayload?.fechaOperacion || ordersFlowDate
    };
  }, [metrics, ordersFlowDate, ordersFlowPayload, scopedPayload.pedidosOperacion]);

  const insights = useMemo(
    () => buildExecutiveInsights({ metrics, financial }),
    [financial, metrics]
  );

  const healthSemaphores = useMemo(
    () => buildHealthSemaphores({ metrics, financial }),
    [financial, metrics]
  );

  const branchRanking = useMemo(
    () =>
      buildBranchRanking({
        sucursales: filterRowsBySucursal(payload.sucursales, sucursalFilter === 'all' ? 'all' : sucursalFilter),
        pedidosOperacion: filterPedidosByTurn(payload.pedidosOperacion, turnFilter),
        selectedSucursal: sucursalFilter
      }),
    [payload.pedidosOperacion, payload.sucursales, sucursalFilter, turnFilter]
  );

  const filtersSummary = useMemo(() => {
    const sucursalLabel =
      sucursalOptions.find((option) => option.value === sucursalFilter)?.label || 'Todas las sucursales';
    const turnoLabel = turnOptions.find((option) => option.value === turnFilter)?.label || 'Todo el día';

    return {
      sucursalLabel,
      turnoLabel,
      inventoryScopeNotice:
        sucursalFilter !== 'all' && !scopedPayload.inventorySupportsSucursalFilter
          ? 'El inventario sigue consolidado porque este catálogo no expone sucursal en la fuente rápida.'
          : ''
    };
  }, [scopedPayload.inventorySupportsSucursalFilter, sucursalFilter, sucursalOptions, turnFilter, turnOptions]);

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
