import { useCallback, useEffect, useMemo, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import cocinaService from '../../../../services/cocinaService';
import sucursalesService from '../../../../services/sucursalesService';
import { inventarioService } from '../../../../services/inventarioService';
import { securityService } from '../../../../services/securityService';
import { PERMISSIONS } from '../../../../utils/permissions';

const isActive = (value) => value === true || value === 1 || value === '1' || value === 'true';

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  return [];
};

const inferSecurityIncidents = (summaryPayload) => {
  const safeObject = summaryPayload && typeof summaryPayload === 'object' ? summaryPayload : {};
  const candidates = [
    safeObject?.riesgos_criticos,
    safeObject?.failed_logins,
    safeObject?.failedLogins,
    safeObject?.incidentes,
    safeObject?.alerts,
    safeObject?.metricas?.failed_logins,
    safeObject?.metricas?.incidentes
  ];
  for (const value of candidates) {
    const parsed = toNumber(value, -1);
    if (parsed >= 0) return parsed;
  }
  return 0;
};

export const useInicioDashboardData = ({ can, isSuperAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [payload, setPayload] = useState({
    sucursales: [],
    pedidosVentas: [],
    pedidosCocina: [],
    productos: [],
    insumos: [],
    securitySummary: {}
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const fetches = {
      sucursales: can(PERMISSIONS.SUCURSALES_VER)
        ? sucursalesService.getAll()
        : Promise.resolve([]),
      pedidosVentas: can(PERMISSIONS.VENTAS_VER)
        ? ventasService.getPedidosMenu()
        : Promise.resolve([]),
      pedidosCocina: can(PERMISSIONS.COCINA_VER)
        ? cocinaService.listPedidos()
        : Promise.resolve([]),
      productos: can(PERMISSIONS.INVENTARIO_PRODUCTOS_VER)
        ? inventarioService.getProductos({ incluirInactivos: true })
        : Promise.resolve([]),
      insumos: can(PERMISSIONS.INVENTARIO_INSUMOS_VER)
        ? inventarioService.getInsumos({ incluirInactivos: true })
        : Promise.resolve([]),
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
      nextPayload[key] = key === 'securitySummary' ? {} : [];
    });

    setPayload({
      sucursales: extractRows(nextPayload.sucursales),
      pedidosVentas: extractRows(nextPayload.pedidosVentas),
      pedidosCocina: extractRows(nextPayload.pedidosCocina),
      productos: extractRows(nextPayload.productos),
      insumos: extractRows(nextPayload.insumos),
      securitySummary:
        nextPayload.securitySummary && typeof nextPayload.securitySummary === 'object'
          ? nextPayload.securitySummary
          : {}
    });

    if (hasFailure) {
      setError('No se pudieron cargar todas las metricas. Se muestran datos parciales.');
    }

    setLastUpdatedAt(new Date());
    setLoading(false);
  }, [can, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const sucursales = payload.sucursales;
    const pedidosVentas = payload.pedidosVentas;
    const pedidosCocina = payload.pedidosCocina;
    const productos = payload.productos;
    const insumos = payload.insumos;

    const totalSucursales = sucursales.length;
    const sucursalesActivas = sucursales.filter((row) => {
      if (row?.isOpen !== undefined) return Boolean(row.isOpen);
      return isActive(row?.estado);
    }).length;

    const pendientesPago = pedidosVentas.filter(
      (row) => Number.parseInt(String(row?.id_estado_pedido ?? 0), 10) === 1
    ).length;
    const enCocina = pedidosCocina.filter(
      (row) => Number.parseInt(String(row?.id_estado_pedido ?? 0), 10) === 2
    ).length;
    const listosEntrega = pedidosCocina.filter(
      (row) => Number.parseInt(String(row?.id_estado_pedido ?? 0), 10) === 3
    ).length;

    const catalogItems = [...productos, ...insumos];
    const agotados = catalogItems.filter((row) => toNumber(row?.cantidad, 0) <= 0).length;
    const stockBajo = catalogItems.filter((row) => {
      const cantidad = toNumber(row?.cantidad, 0);
      const minimo = toNumber(row?.stock_minimo, 0);
      return cantidad > 0 && cantidad <= minimo;
    }).length;
    const catalogoActivo = catalogItems.filter((row) => {
      if (row?.estado === undefined) return true;
      return isActive(row?.estado);
    }).length;

    const seguridadIncidentes = inferSecurityIncidents(payload.securitySummary);

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
      totalPedidosOperacion: pendientesPago + enCocina + listosEntrega
    };
  }, [payload]);

  const alerts = useMemo(() => {
    const rows = [];
    if (metrics.agotados > 0) {
      rows.push({
        id: 'stock-agotado',
        level: 'critical',
        text: `${metrics.agotados} items sin stock. Riesgo directo de venta perdida.`
      });
    }
    if (metrics.stockBajo > 0) {
      rows.push({
        id: 'stock-bajo',
        level: 'warning',
        text: `${metrics.stockBajo} items en stock bajo. Reponer antes del pico horario.`
      });
    }
    if (metrics.pendientesPago > 10) {
      rows.push({
        id: 'pendientes-pago',
        level: 'warning',
        text: `${metrics.pendientesPago} pedidos pendientes por pagar. Riesgo de cuello en caja.`
      });
    }
    if (metrics.seguridadIncidentes > 0) {
      rows.push({
        id: 'seguridad',
        level: 'critical',
        text: `${metrics.seguridadIncidentes} alertas de seguridad detectadas.`
      });
    }
    if (!rows.length) {
      rows.push({
        id: 'operacion-estable',
        level: 'ok',
        text: 'Operacion estable. Sin alertas criticas detectadas.'
      });
    }
    return rows;
  }, [metrics]);

  return {
    loading,
    error,
    lastUpdatedAt,
    metrics,
    alerts,
    refresh: loadData
  };
};

