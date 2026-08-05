import { supabase } from '../../../../lib/supabaseClient';

const FAST_TIMEOUT_MS = 2200;
const FAST_LIMITS = Object.freeze({
  sucursales: 200,
  productos: 1200,
  insumos: 1200
});

const GENERAL_TABLE_CANDIDATES = Object.freeze({
  sucursales: ['sucursales'],
  productos: ['productos'],
  insumos: ['insumos']
});

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
  }
};
