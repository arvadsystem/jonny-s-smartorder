export const isActive = (value) => value === true || value === 1 || value === '1' || value === 'true';

export const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  return [];
};

export const inferSecurityIncidents = (summaryPayload) => {
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

export const resolvePedidoDate = (row = {}) => {
  const candidates = [
    row?.fecha_hora_pedido,
    row?.fecha_pedido,
    row?.fecha_creacion,
    row?.created_at,
    row?.createdAt,
    row?.fecha,
    row?.updated_at
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

export const resolveSucursalId = (row = {}) => {
  const candidates = [
    row?.id_sucursal,
    row?.sucursal_id,
    row?.idSucursal,
    row?.sucursal?.id_sucursal,
    row?.sede?.id_sucursal
  ];

  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue;
    return String(value);
  }

  return '';
};

export const hasSucursalDimension = (rows = []) =>
  (Array.isArray(rows) ? rows : []).some((row) => Boolean(resolveSucursalId(row)));

export const filterRowsBySucursal = (rows = [], sucursalFilter = 'all') => {
  const source = Array.isArray(rows) ? rows : [];
  if (sucursalFilter === 'all') return source;
  if (!hasSucursalDimension(source)) return source;
  return source.filter((row) => resolveSucursalId(row) === String(sucursalFilter));
};

export const resolveTurnBucket = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const hour = date.getHours();
  if (hour < 12) return 'manana';
  if (hour < 18) return 'tarde';
  return 'noche';
};

export const filterPedidosByTurn = (rows = [], turnFilter = 'all') => {
  const source = Array.isArray(rows) ? rows : [];
  if (turnFilter === 'all') return source;
  return source.filter((row) => resolveTurnBucket(resolvePedidoDate(row)) === turnFilter);
};

export const dedupeOptions = (rows = []) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.value ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildFallbackOrdersFlow = () => [
  { hour: '08:00', pedidos: 0 },
  { hour: '10:00', pedidos: 0 },
  { hour: '12:00', pedidos: 0 },
  { hour: '14:00', pedidos: 0 },
  { hour: '16:00', pedidos: 0 },
  { hour: '18:00', pedidos: 0 },
  { hour: '20:00', pedidos: 0 }
];

export const buildOrdersFlowDataset = (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  const countsByHour = new Map();

  source.forEach((row) => {
    const parsed = resolvePedidoDate(row);
    if (!parsed) return;
    const hourLabel = `${String(parsed.getHours()).padStart(2, '0')}:00`;
    countsByHour.set(hourLabel, (countsByHour.get(hourLabel) || 0) + 1);
  });

  if (countsByHour.size === 0) {
    return {
      rows: buildFallbackOrdersFlow(),
      usesFallback: true
    };
  }

  return {
    rows: Array.from(countsByHour.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([hour, pedidos]) => ({ hour, pedidos })),
    usesFallback: false
  };
};

export const resolveFinancialShape = (payload) => {
  const summary = payload?.summary || payload || {};
  const hasSummary =
    summary &&
    typeof summary === 'object' &&
    ['totalVendido', 'monto_total', 'total_ventas', 'ventas', 'ticketPromedio', 'ticket_promedio'].some(
      (key) => summary[key] !== undefined && summary[key] !== null
    );

  return {
    summary,
    hasSummary
  };
};

export const resolveComparisonMeta = (currentValue, previousValue) => {
  const current = toNumber(currentValue, 0);
  const previous = toNumber(previousValue, 0);
  const delta = current - previous;
  const percent = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;

  return {
    delta,
    percent,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  };
};

export const buildSummaryCacheKey = (params = {}) =>
  JSON.stringify(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
  );

export const createTimedCache = () => new Map();

export const getTimedCacheValue = (cache, key, ttlMs) => {
  if (!cache.has(key)) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

export const setTimedCacheValue = (cache, key, value) => {
  cache.set(key, { at: Date.now(), value });
};
