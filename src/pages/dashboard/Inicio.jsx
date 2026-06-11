import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { getFirstAccessibleDashboardPath, PERMISSIONS } from '../../utils/permissions';
import DashboardHeader from './inicio/components/DashboardHeader';
import KpiGrid from './inicio/components/KpiGrid';
import AlertsPanel from './inicio/components/AlertsPanel';
import OperationsSnapshot from './inicio/components/OperationsSnapshot';
import QuickActions from './inicio/components/QuickActions';
import InventoryRiskChart from './inicio/components/InventoryRiskChart';
import OrdersStatusChart from './inicio/components/OrdersStatusChart';
import OrdersFlowChart from './inicio/components/OrdersFlowChart';
import SalesSummaryPanel from './inicio/components/SalesSummaryPanel';
import ExecutiveInsightsPanel from './inicio/components/ExecutiveInsightsPanel';
import { useInicioDashboardData } from './inicio/hooks/useInicioDashboardData';
import './inicio/inicio-dashboard.css';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SALES_RANGE_VALUES = new Set(['day', 'week', 'month']);
const TURN_VALUES = new Set(['all', 'manana', 'tarde', 'noche']);
const VIEW_VALUES = new Set(['operativa', 'ejecutiva']);

const readParam = (searchParams, key, fallback = '') => String(searchParams.get(key) ?? fallback).trim();
const isValidDateParam = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const buildScopedLink = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
};

const Inicio = () => {
  const { user } = useAuth();
  const { can, isSuperAdmin, loading, permisos } = usePermisos();
  const safeCan = typeof can === 'function' ? can : () => false;
  const [searchParams, setSearchParams] = useSearchParams();

  const nombre = user?.nombre_usuario || 'Usuario';
  const canViewDashboard = isSuperAdmin && safeCan(PERMISSIONS.DASHBOARD_VER);
  const fallbackPath = useMemo(
    () => getFirstAccessibleDashboardPath(permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  const [selectedSalesRange, setSelectedSalesRange] = useState(() => {
    const candidate = readParam(searchParams, 'rango', 'day');
    return SALES_RANGE_VALUES.has(candidate) ? candidate : 'day';
  });
  const [selectedSucursalFilter, setSelectedSucursalFilter] = useState(
    () => readParam(searchParams, 'sucursal', 'all') || 'all'
  );
  const [selectedTurnFilter, setSelectedTurnFilter] = useState(() => {
    const candidate = readParam(searchParams, 'turno', 'all');
    return TURN_VALUES.has(candidate) ? candidate : 'all';
  });
  const [selectedOrdersFlowDate, setSelectedOrdersFlowDate] = useState(() => {
    const candidate = readParam(searchParams, 'fecha', formatDateInput(new Date()));
    return isValidDateParam(candidate) ? candidate : formatDateInput(new Date());
  });
  const [selectedOrdersFlowHour, setSelectedOrdersFlowHour] = useState(
    () => readParam(searchParams, 'hora', 'all') || 'all'
  );
  const [selectedViewMode, setSelectedViewMode] = useState(() => {
    const candidate = readParam(searchParams, 'vista', 'operativa');
    return VIEW_VALUES.has(candidate) ? candidate : 'operativa';
  });

  const {
    loading: loadingDashboard,
    error,
    dataSourceMode,
    metrics,
    alerts,
    charts,
    financial,
    insights,
    branchRanking,
    healthSemaphores,
    sucursalOptions,
    turnOptions,
    filtersSummary,
    refresh,
    lastUpdatedAt
  } = useInicioDashboardData({
    can: safeCan,
    isSuperAdmin,
    salesRange: selectedSalesRange,
    sucursalFilter: selectedSucursalFilter,
    turnFilter: selectedTurnFilter,
    ordersFlowDate: selectedOrdersFlowDate
  });

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('rango', selectedSalesRange);
    nextParams.set('sucursal', selectedSucursalFilter);
    nextParams.set('turno', selectedTurnFilter);
    nextParams.set('fecha', selectedOrdersFlowDate);
    nextParams.set('hora', selectedOrdersFlowHour);
    nextParams.set('vista', selectedViewMode);

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    searchParams,
    selectedOrdersFlowDate,
    selectedOrdersFlowHour,
    selectedSalesRange,
    selectedSucursalFilter,
    selectedTurnFilter,
    selectedViewMode,
    setSearchParams
  ]);

  const updateLabel = useMemo(() => {
    if (!lastUpdatedAt) return 'Sin sincronización';
    return lastUpdatedAt.toLocaleTimeString('es-HN');
  }, [lastUpdatedAt]);

  const heroHighlights = useMemo(
    () => [
      { id: 'pedidos', label: 'Pedidos activos', value: metrics.totalPedidosOperacion, tone: 'neutral' },
      { id: 'stock', label: 'Sin stock', value: metrics.agotados, tone: metrics.agotados > 0 ? 'danger' : 'success' },
      {
        id: 'sucursales',
        label: 'Sucursales operativas',
        value: `${metrics.sucursalesActivas}/${metrics.totalSucursales}`,
        tone: 'success'
      },
      {
        id: 'ventas',
        label: 'Ventas del rango',
        value: financial.loading
          ? '...'
          : `L ${Number(financial.totalVendido || 0).toLocaleString('es-HN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`,
        tone: 'accent'
      }
    ],
    [
      financial.loading,
      financial.totalVendido,
      metrics.agotados,
      metrics.sucursalesActivas,
      metrics.totalPedidosOperacion,
      metrics.totalSucursales
    ]
  );

  const kpiLinks = useMemo(
    () => ({
      'kpi-pedidos': safeCan(PERMISSIONS.VENTAS_VER)
        ? buildScopedLink('/dashboard/ventas?tab=pedidos', {
            id_sucursal: selectedSucursalFilter,
            turno: selectedTurnFilter
          })
        : '',
      'kpi-stock': safeCan(PERMISSIONS.INVENTARIO_VER)
        ? buildScopedLink('/dashboard/inventario?tab=alertas', {
            id_sucursal: selectedSucursalFilter
          })
        : '',
      'kpi-sucursales': safeCan(PERMISSIONS.SUCURSALES_VER)
        ? buildScopedLink('/dashboard/sucursales', {
            id_sucursal: selectedSucursalFilter
          })
        : '',
      'kpi-catalogo': safeCan(PERMISSIONS.MENU_VER)
        ? buildScopedLink('/dashboard/menu?tab=publicacion', {
            id_sucursal: selectedSucursalFilter
          })
        : ''
    }),
    [safeCan, selectedSucursalFilter, selectedTurnFilter]
  );

  if (loading) {
    return (
      <div className="p-4 text-center text-muted" role="status" aria-live="polite">
        Cargando permisos del dashboard...
      </div>
    );
  }

  if (!canViewDashboard) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <SinPermiso
        permiso={PERMISSIONS.DASHBOARD_VER}
        detalle="No tienes acceso a ningún módulo visible del sistema."
      />
    );
  }

  return (
    <div className="inicio-dashboard fade-in">
      <DashboardHeader
        nombre={nombre}
        updateLabel={updateLabel}
        dataSourceMode={dataSourceMode}
        loading={loadingDashboard}
        onRefresh={refresh}
        sucursalValue={selectedSucursalFilter}
        onSucursalChange={(value) => startTransition(() => setSelectedSucursalFilter(value))}
        sucursalOptions={sucursalOptions}
        turnoValue={selectedTurnFilter}
        onTurnoChange={(value) => startTransition(() => setSelectedTurnFilter(value))}
        turnOptions={turnOptions}
        filtersSummary={filtersSummary}
        highlights={heroHighlights}
        viewMode={selectedViewMode}
        onViewModeChange={(value) => startTransition(() => setSelectedViewMode(value))}
      />

      {error ? <div className="inicio-inline-message is-error">{error}</div> : null}
      {filtersSummary.inventoryScopeNotice ? (
        <div className="inicio-inline-message">{filtersSummary.inventoryScopeNotice}</div>
      ) : null}

      <KpiGrid metrics={metrics} links={kpiLinks} />

      <SalesSummaryPanel
        financial={financial}
        selectedRange={selectedSalesRange}
        onRangeChange={(value) => startTransition(() => setSelectedSalesRange(value))}
      />

      <ExecutiveInsightsPanel
        insights={insights}
        branchRanking={branchRanking}
        healthSemaphores={healthSemaphores}
        visible={selectedViewMode === 'ejecutiva'}
        financial={financial}
        metrics={metrics}
      />

      <div className="inicio-charts-grid">
        <InventoryRiskChart data={charts.inventoryRisk} />
        <OrdersStatusChart data={charts.ordersStatus} />
      </div>

      <div className="inicio-charts-grid inicio-charts-grid--full">
        <OrdersFlowChart
          data={charts.ordersFlow}
          usesFallback={charts.ordersFlowUsesFallback}
          selectedDate={charts.ordersFlowDate || selectedOrdersFlowDate}
          onDateChange={(value) => startTransition(() => setSelectedOrdersFlowDate(value))}
          selectedHour={selectedOrdersFlowHour}
          onHourChange={(value) => startTransition(() => setSelectedOrdersFlowHour(value))}
        />
      </div>

      <div className="inicio-panels-grid">
        <AlertsPanel alerts={alerts} />
        <OperationsSnapshot metrics={metrics} />
      </div>

      <QuickActions
        can={safeCan}
        permissions={PERMISSIONS}
        sucursalFilter={selectedSucursalFilter}
        turnFilter={selectedTurnFilter}
        selectedDate={selectedOrdersFlowDate}
      />
    </div>
  );
};

export default Inicio;
