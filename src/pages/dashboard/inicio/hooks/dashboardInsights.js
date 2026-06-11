import {
  inferSecurityIncidents,
  isActive,
  resolveComparisonMeta,
  resolveSucursalId,
  toNumber
} from './dashboardDataUtils';

const normalizeStateText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const resolvePedidoStateKey = (row = {}) => {
  const textCandidates = [
    row?.nombre_estado_pedido,
    row?.estado_pedido,
    row?.estado,
    row?.status
  ];

  for (const candidate of textCandidates) {
    const normalized = normalizeStateText(candidate);
    if (!normalized) continue;
    if (normalized.includes('pend')) return 'pendiente';
    if (normalized.includes('cocina') || normalized.includes('preparacion')) return 'cocina';
    if (normalized.includes('listo')) return 'listo';
  }

  const numericState = Number.parseInt(String(row?.id_estado_pedido ?? row?.id_estado ?? 0), 10);
  if (numericState === 1) return 'pendiente';
  if (numericState === 2) return 'cocina';
  if (numericState === 3) return 'listo';
  return '';
};

const resolveToneByScore = (score = 0) => {
  if (score >= 24) return 'danger';
  if (score >= 10) return 'warning';
  return 'success';
};

export const buildMetrics = ({ payload, scopedPayload }) => {
  const summaryGeneral = payload.dashboardSummary?.general || {};
  const sucursales = scopedPayload.sucursales;
  const pedidosOperacion = scopedPayload.pedidosOperacion;
  const productos = scopedPayload.productos;
  const insumos = scopedPayload.insumos;

  const totalSucursalesFallback = sucursales.length;
  const sucursalesActivasFallback = sucursales.filter((row) => {
    if (row?.isOpen !== undefined) return Boolean(row.isOpen);
    return isActive(row?.estado);
  }).length;

  const pendientesPagoFallback = pedidosOperacion.filter((row) => resolvePedidoStateKey(row) === 'pendiente').length;
  const enCocinaFallback = pedidosOperacion.filter((row) => resolvePedidoStateKey(row) === 'cocina').length;
  const listosEntregaFallback = pedidosOperacion.filter((row) => resolvePedidoStateKey(row) === 'listo').length;

  const catalogItems = [...productos, ...insumos];
  const agotadosFallback = catalogItems.filter((row) => toNumber(row?.cantidad, 0) <= 0).length;
  const stockBajoFallback = catalogItems.filter((row) => {
    const cantidad = toNumber(row?.cantidad, 0);
    const minimo = toNumber(row?.stock_minimo, 0);
    return cantidad > 0 && cantidad <= minimo;
  }).length;
  const catalogoActivoFallback = catalogItems.filter((row) => {
    if (row?.estado === undefined) return true;
    return isActive(row?.estado);
  }).length;

  const seguridadIncidentes = inferSecurityIncidents(payload.securitySummary);
  const totalSucursales = toNumber(summaryGeneral?.sucursales?.total, totalSucursalesFallback);
  const sucursalesActivas = toNumber(summaryGeneral?.sucursales?.activas, sucursalesActivasFallback);
  const pendientesPago = toNumber(summaryGeneral?.pedidos?.pendientesPago, pendientesPagoFallback);
  const enCocina = toNumber(summaryGeneral?.pedidos?.enCocina, enCocinaFallback);
  const listosEntrega = toNumber(summaryGeneral?.pedidos?.listosEntrega, listosEntregaFallback);
  const agotados = toNumber(summaryGeneral?.inventario?.agotados, agotadosFallback);
  const stockBajo = toNumber(summaryGeneral?.inventario?.stockBajo, stockBajoFallback);
  const catalogoActivo = toNumber(summaryGeneral?.inventario?.catalogoActivo, catalogoActivoFallback);
  const totalPedidosOperacion = toNumber(
    summaryGeneral?.pedidos?.totalOperacion,
    pendientesPago + enCocina + listosEntrega
  );

  return {
    totalSucursales,
    sucursalesActivas,
    pendientesPago,
    enCocina,
    listosEntrega,
    stockBajo,
    agotados,
    catalogoActivo,
    seguridadIncidentes,
    totalPedidosOperacion
  };
};

export const buildAlerts = ({ metrics, can, PERMISSIONS }) => {
  const rows = [];

  if (metrics.agotados > 0) {
    rows.push({
      id: 'stock-agotado',
      level: 'critical',
      score: 100 + metrics.agotados,
      text: `${metrics.agotados} ítems sin stock. Riesgo directo de venta perdida.`,
      recommendation: 'Prioriza reposición o despublica los ítems críticos para evitar quiebres.',
      detailTo: can(PERMISSIONS.INVENTARIO_VER) ? '/dashboard/inventario?tab=alertas' : '',
      detailTitle: 'Abrir alertas de inventario'
    });
  }

  if (metrics.stockBajo > 0) {
    rows.push({
      id: 'stock-bajo',
      level: 'warning',
      score: 70 + metrics.stockBajo,
      text: `${metrics.stockBajo} ítems en stock bajo. Reponer antes del pico horario.`,
      recommendation: 'Valida existencia en almacén y traslada stock antes de la siguiente franja fuerte.',
      detailTo: can(PERMISSIONS.INVENTARIO_VER) ? '/dashboard/inventario?tab=alertas' : '',
      detailTitle: 'Abrir alertas de inventario'
    });
  }

  if (metrics.pendientesPago > 10) {
    rows.push({
      id: 'pendientes-pago',
      level: 'warning',
      score: 60 + metrics.pendientesPago,
      text: `${metrics.pendientesPago} pedidos pendientes por pagar. Riesgo de cuello en caja.`,
      recommendation: 'Revisa validaciones y acelera confirmaciones antes de saturar cocina.',
      detailTo: can(PERMISSIONS.VENTAS_VER) ? '/dashboard/ventas?tab=pedidos' : '',
      detailTitle: 'Abrir pedidos en ventas'
    });
  }

  if (metrics.seguridadIncidentes > 0) {
    rows.push({
      id: 'seguridad',
      level: 'critical',
      score: 95 + metrics.seguridadIncidentes,
      text: `${metrics.seguridadIncidentes} alertas de seguridad detectadas.`,
      recommendation: 'Revisa actividad inusual antes de aprobar cambios sensibles en operación.'
    });
  }

  if (!rows.length) {
    rows.push({
      id: 'operacion-estable',
      level: 'ok',
      score: 10,
      text: 'Operación estable. Sin alertas críticas detectadas.',
      recommendation: 'Mantén monitoreo de ventas e inventario para anticipar la siguiente hora pico.'
    });
  }

  return rows.sort((left, right) => (right.score || 0) - (left.score || 0));
};

export const buildExecutiveInsights = ({ metrics, financial }) => {
  const rows = [];
  const serviceLevel = metrics.totalPedidosOperacion > 0
    ? Math.round((metrics.listosEntrega / Math.max(1, metrics.totalPedidosOperacion)) * 100)
    : 100;

  rows.push({
    id: 'salud-operativa',
    title: 'Salud operativa',
    value: `${Math.max(0, 100 - (metrics.agotados * 4 + metrics.stockBajo * 2 + metrics.pendientesPago))}%`,
    tone: metrics.agotados > 0 || metrics.pendientesPago > 10 ? 'warning' : 'success',
    description: 'Combina presión de inventario, cola pendiente y estabilidad visible del turno.'
  });

  rows.push({
    id: 'cumplimiento-pedidos',
    title: 'Cumplimiento del turno',
    value: `${serviceLevel}%`,
    tone: serviceLevel >= 70 ? 'success' : serviceLevel >= 40 ? 'warning' : 'danger',
    description: `${metrics.listosEntrega} pedidos listos frente a ${metrics.totalPedidosOperacion} en operación.`
  });

  rows.push({
    id: 'tendencia-ventas',
    title: 'Tendencia de ventas',
    value:
      financial.deltaDirection === 'up'
        ? `+${financial.deltaPercent.toFixed(1)}%`
        : financial.deltaDirection === 'down'
          ? `${financial.deltaPercent.toFixed(1)}%`
          : '0.0%',
    tone: financial.deltaDirection === 'down' ? 'warning' : 'accent',
    description: financial.comparisonLabel
      ? `Comparado contra ${financial.comparisonLabel}.`
      : 'Sin rango comparativo consolidado para ventas.'
  });

  return rows;
};

export const buildHealthSemaphores = ({ metrics, financial }) => [
  {
    id: 'ventas',
    label: 'Ventas',
    state: financial.deltaDirection === 'down' ? 'warning' : 'success',
    detail: financial.comparisonLabel ? `${financial.deltaPercent.toFixed(1)}% vs periodo previo` : 'Sin comparativo'
  },
  {
    id: 'pedidos',
    label: 'Flujo de pedidos',
    state: metrics.pendientesPago > 10 || metrics.enCocina > metrics.listosEntrega + 8 ? 'danger' : 'success',
    detail: `${metrics.pendientesPago} pendientes, ${metrics.enCocina} en cocina`
  },
  {
    id: 'inventario',
    label: 'Inventario',
    state: metrics.agotados > 0 ? 'danger' : metrics.stockBajo > 0 ? 'warning' : 'success',
    detail: `${metrics.agotados} sin stock y ${metrics.stockBajo} en observación`
  }
];

export const buildBranchRanking = ({ sucursales = [], pedidosOperacion = [], selectedSucursal = 'all' }) => {
  const branchMap = new Map();

  sucursales.forEach((row) => {
    const id = resolveSucursalId(row);
    if (!id) return;
    branchMap.set(id, {
      id,
      label: row?.nombre_sucursal || row?.nombre || `Sucursal #${id}`,
      active: row?.isOpen !== undefined ? Boolean(row.isOpen) : isActive(row?.estado),
      pedidos: 0
    });
  });

  pedidosOperacion.forEach((row) => {
    const id = resolveSucursalId(row);
    if (!id) return;
    if (!branchMap.has(id)) {
      branchMap.set(id, {
        id,
        label: row?.nombre_sucursal || row?.nombre || `Sucursal #${id}`,
        active: true,
        pedidos: 0
      });
    }
    branchMap.get(id).pedidos += 1;
  });

  const rows = Array.from(branchMap.values())
    .filter((row) => selectedSucursal === 'all' || row.id === String(selectedSucursal))
    .map((row) => {
      const score = row.pedidos * 3 + (row.active ? 0 : 20);
      return {
        ...row,
        score,
        tone: resolveToneByScore(score),
        status: row.active ? (score >= 24 ? 'Crítico' : score >= 10 ? 'Atención' : 'Estable') : 'Inactiva'
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  return rows;
};

export const buildFinancialView = ({ can, PERMISSIONS, loadingFinancial, financialError, financialPayload, financialWindow }) => {
  const { summary, hasSummary } = financialPayload;
  const financialSummary = summary || {};
  const comparison = financialPayload?.comparisonSummary || null;
  const comparisonMeta = resolveComparisonMeta(
    financialSummary?.totalVendido ?? financialSummary?.monto_total ?? financialSummary?.total_ventas,
    comparison?.totalVendido ?? comparison?.monto_total ?? comparison?.total_ventas
  );

  return {
    visible: can(PERMISSIONS.VENTAS_VER),
    loading: loadingFinancial,
    error: financialError,
    hasSummary,
    rangeLabel: financialWindow.rangeLabel,
    summaryLabel: financialWindow.summaryLabel,
    comparisonLabel: financialPayload?.comparisonWindow?.summaryLabel || '',
    totalVendido: toNumber(financialSummary?.totalVendido ?? financialSummary?.monto_total ?? financialSummary?.total_ventas, 0),
    ventas: Number.parseInt(String(financialSummary?.ventas ?? financialSummary?.totalVentas ?? 0), 10) || 0,
    ticketPromedio: toNumber(financialSummary?.ticketPromedio ?? financialSummary?.ticket_promedio, 0),
    completadas: Number.parseInt(String(financialSummary?.completadas ?? 0), 10) || 0,
    pendientes: Number.parseInt(String(financialSummary?.pendientes ?? 0), 10) || 0,
    comparisonTotal: toNumber(comparison?.totalVendido ?? comparison?.monto_total ?? comparison?.total_ventas, 0),
    deltaTotal: comparisonMeta.delta,
    deltaPercent: comparisonMeta.percent,
    deltaDirection: comparisonMeta.direction
  };
};
