import { supabase } from '../../../../lib/supabaseClient';

const FAST_TIMEOUT_MS = 2200;
const FAST_LIMITS = Object.freeze({
  sucursales: 200,
  pedidosOperacion: 600,
  productos: 1200,
  insumos: 1200
});

const GENERAL_TABLE_CANDIDATES = Object.freeze({
  sucursales: ['sucursales'],
  pedidosOperacion: ['pedidos_menu', 'ventas_pedidos_menu'],
  productos: ['productos'],
  insumos: ['insumos']
});

const FINANCIAL_TABLE_CANDIDATES = Object.freeze(['ventas', 'ventas_resumen']);

const isFastPathEnabled = () => String(import.meta.env.VITE_ENABLE_DASHBOARD_SUPABASE_FAST_PATH || '').trim() === 'true';

const hasSupabaseConfig = () =>
  Boolean(
    isFastPathEnabled()
    && import.meta.env.VITE_SUPABASE_URL
    && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

const withTimeout = (promise, timeoutMs = FAST_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SUPABASE_FAST_TIMEOUT')), timeoutMs);
    })
  ]);

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

const runCandidateQuery = async (tables = [], buildQuery) => {
  for (const table of tables) {
    try {
      const query = buildQuery(table);
      const result = await withTimeout(query);
      if (result?.error) continue;
      return {
        rows: normalizeRows(result?.data),
        table
      };
    } catch {
      // AM: fallback silencioso para no exponer errores tecnicos del Data API.
    }
  }

  return {
    rows: [],
    table: ''
  };
};

const maybeApplySucursalFilter = (query, sucursalFilter = 'all') => {
  if (sucursalFilter === 'all') return query;
  return query.eq('id_sucursal', sucursalFilter);
};

const getGeneralRows = async (sourceKey, { sucursalFilter = 'all' } = {}) => {
  const tables = GENERAL_TABLE_CANDIDATES[sourceKey] || [];
  const limit = FAST_LIMITS[sourceKey] || 500;
  const shouldApplySucursalFilter = sourceKey !== 'sucursales';
  return runCandidateQuery(tables, (table) =>
    shouldApplySucursalFilter
      ? maybeApplySucursalFilter(supabase.from(table).select('*').limit(limit), sucursalFilter)
      : supabase.from(table).select('*').limit(limit)
  );
};

const getFinancialRows = async ({ fechaDesde, fechaHasta, sucursalFilter = 'all' }) => {
  const dateColumns = ['fecha_venta', 'fecha', 'created_at', 'fecha_creacion'];

  for (const table of FINANCIAL_TABLE_CANDIDATES) {
    for (const dateColumn of dateColumns) {
      try {
        const query = maybeApplySucursalFilter(
          supabase
          .from(table)
          .select('*')
          .gte(dateColumn, `${fechaDesde}T00:00:00`)
          .lte(dateColumn, `${fechaHasta}T23:59:59`)
          .limit(1200),
          sucursalFilter
        );

        const result = await withTimeout(query);
        if (result?.error) continue;

        return {
          rows: normalizeRows(result?.data),
          table
        };
      } catch {
        // AM: si la tabla o columna no existe para anon, cae al backend sin interrumpir.
      }
    }
  }

  return {
    rows: [],
    table: ''
  };
};

const sumByCandidates = (row, candidates = []) => {
  for (const candidate of candidates) {
    const value = Number.parseFloat(String(row?.[candidate] ?? ''));
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

const isCompletedVenta = (row = {}) => {
  const statusCandidates = [
    row?.estado,
    row?.estado_venta,
    row?.status,
    row?.id_estado_venta,
    row?.id_estado
  ];

  return statusCandidates.some((value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['completada', 'completado', 'cerrada', 'cerrado', 'pagada', 'finalizada', '3', '4'].includes(normalized);
  });
};

const buildFinancialSummary = (rows = []) => {
  const source = normalizeRows(rows);
  const completadas = source.filter(isCompletedVenta).length;
  const pendientes = Math.max(0, source.length - completadas);
  const totalVendido = source.reduce(
    (acc, row) => acc + sumByCandidates(row, ['monto_total', 'total_venta', 'total', 'subtotal']),
    0
  );
  const ventas = source.length;
  const ticketPromedio = ventas > 0 ? totalVendido / ventas : 0;

  return {
    summary: {
      totalVendido,
      ventas,
      ticketPromedio,
      completadas,
      pendientes
    },
    hasSummary: ventas > 0 || totalVendido > 0
  };
};

export const dashboardSupabaseService = {
  async getGeneralSnapshot({ shouldLoad = {}, sucursalFilter = 'all' } = {}) {
    if (!hasSupabaseConfig()) return null;

    const entries = await Promise.allSettled(
      Object.entries(shouldLoad).map(async ([key, enabled]) => {
        if (!enabled) return [key, { rows: [], source: 'skipped' }];
        const result = await getGeneralRows(key, { sucursalFilter });
        return [key, { rows: result.rows, source: result.table ? `supabase:${result.table}` : '' }];
      })
    );

    const snapshot = {};
    let usedFastPath = false;

    entries.forEach((entry) => {
      if (entry.status !== 'fulfilled') return;
      const [key, value] = entry.value;
      snapshot[key] = value;
      if (value?.source?.startsWith('supabase:') && value.rows.length >= 0) {
        usedFastPath = true;
      }
    });

    return {
      snapshot,
      usedFastPath
    };
  },

  async getFinancialSummary({ fechaDesde, fechaHasta, sucursalFilter = 'all' } = {}) {
    if (!hasSupabaseConfig() || !fechaDesde || !fechaHasta) return null;

    const result = await getFinancialRows({ fechaDesde, fechaHasta, sucursalFilter });
    if (!result.table) return null;

    return {
      ...buildFinancialSummary(result.rows),
      source: `supabase:${result.table}`
    };
  }
};
