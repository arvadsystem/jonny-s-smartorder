export const BOARD_COLUMNS = Object.freeze([
  {
    key: 'PENDIENTES',
    statusCode: 'EN_COCINA',
    title: 'Pendientes',
    actionLabel: 'Empezar',
    actionStatus: 'EN_PREPARACION',
    buttonClass: 'is-start',
    badgeClass: 'is-pending',
    icon: 'bi bi-play-fill'
  },
  {
    key: 'EN_PREPARACION',
    statusCode: 'EN_PREPARACION',
    title: 'En preparación',
    actionLabel: 'Listo',
    actionStatus: 'LISTO_PARA_ENTREGA',
    buttonClass: 'is-ready',
    badgeClass: 'is-prep',
    icon: 'bi bi-check-circle-fill'
  }
]);

const COLUMN_META_MAP = new Map(BOARD_COLUMNS.map((column) => [column.key, column]));
const ORDER_STATUS_TO_COLUMN = Object.freeze({
  EN_COCINA: 'PENDIENTES',
  EN_PREPARACION: 'EN_PREPARACION',
  LISTO_PARA_ENTREGA: 'LISTOS_PARA_ENTREGA'
});
const STATUS_LABEL_BY_CODE = Object.freeze({
  EN_COCINA: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTO_PARA_ENTREGA: 'Listo para entrega',
  COMPLETADO: 'Completado'
});

const normalizeTextKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const parseDate = (value) => {
  if (!value) return null;
  const source = String(value);
  const date = new Date(source.includes('T') ? source : source.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resolveKitchenBaseDate = (order) =>
  // AM: Base temporal coherente para KDS: prioriza kds_started_at.
  parseDate(
    order?.kds_started_at ||
      order?.visible_en_cocina_at ||
      order?.fecha_hora_facturacion ||
      order?.fecha_hora_pedido ||
      order?.created_at
  );

const parseOrderDateMs = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const getKitchenOrderSortMs = (pedido) => {
  const isPreparation =
    String(pedido?.estado_codigo || '').trim().toUpperCase() === 'EN_PREPARACION' ||
    String(pedido?.columna_kds || '').trim().toUpperCase() === 'EN_PREPARACION';
  const candidates = isPreparation
    ? [
        pedido?.en_preparacion_at,
        pedido?.visible_en_cocina_at,
        pedido?.fecha_hora_facturacion,
        pedido?.fecha_hora_pedido
      ]
    : [
        pedido?.visible_en_cocina_at,
        pedido?.fecha_hora_facturacion,
        pedido?.fecha_hora_pedido
      ];

  for (const value of candidates) {
    const parsed = parseOrderDateMs(value);
    if (parsed !== null) return parsed;
  }

  return Number.MAX_SAFE_INTEGER;
};

export const compareKitchenOrders = (a, b) => {
  const timeA = getKitchenOrderSortMs(a);
  const timeB = getKitchenOrderSortMs(b);

  if (timeA !== timeB) return timeA - timeB;

  const idA = Number(a?.id_pedido ?? 0) || 0;
  const idB = Number(b?.id_pedido ?? 0) || 0;

  return idA - idB;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const splitObservationSegments = (value) => {
  const source = String(value || '').trim();
  if (!source) return [];

  const separator = source.includes('|') ? '|' : ',';
  return source
    .split(separator)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const inferModifications = (item) => {
  if (Array.isArray(item?.modificaciones) && item.modificaciones.length > 0) {
    return item.modificaciones
      .filter(Boolean)
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .filter((entry) => !isTechnicalOrderNote(entry));
  }

  const itemObservation = String(item?.observacion || '').trim();
  if (itemObservation) return [];

  return [];
};

const itemNameKey = (value) => normalizeTextKey(value).replace(/_/g, ' ');

const isTechnicalOrderNote = (note) => {
  const source = String(note || '').trim().toLowerCase();
  if (!source) return false;
  return (
    source.startsWith('[public-menu]') ||
    source.includes('[public-menu]') ||
    source.startsWith('[menu-publico]') ||
    source.includes('[menu-publico]') ||
    source.startsWith('idem:') ||
    source.startsWith('idempotency:') ||
    source.startsWith('idempotencia:') ||
    source.startsWith('tel:') ||
    source.startsWith('telefono:') ||
    source.includes('schema_version') ||
    source.includes('menu_publico_linea_v1') ||
    source.includes('pubcfg:v1') ||
    /(?:^|[\s|,;])salsas=/.test(source) ||
    /(?:^|[\s|,;])extras=/.test(source)
  );
};

const buildKitchenTicketLabel = (row) => {
  const codigo = String(row?.codigo_venta || row?.numero_ticket || '').trim();
  if (codigo) return codigo;

  const idPedido = Number(row?.id_pedido ?? 0);
  return Number.isSafeInteger(idPedido) && idPedido > 0
    ? `VTA-${String(idPedido).padStart(5, '0')}`
    : 'VTA-S/N';
};

const extractPedidoGeneralNotes = (descripcionPedido, items = []) => {
  const baseNotes = splitObservationSegments(descripcionPedido)
    .filter((note) => !isTechnicalOrderNote(note));
  if (!baseNotes.length) return [];

  const itemKeys = (Array.isArray(items) ? items : [])
    .map((item) => itemNameKey(item?.nombre_item))
    .filter(Boolean);

  return baseNotes.filter((note) => {
    const noteKey = itemNameKey(note);
    if (!noteKey) return false;
    if (!noteKey.includes(':')) return true;
    const prefix = noteKey.split(':')[0].trim();
    if (!prefix) return true;
    return !itemKeys.some((key) => prefix.includes(key) || key.includes(prefix));
  });
};

export const formatCurrency = (value) => `L ${roundMoney(value).toFixed(2)}`;

export const formatDateTimeLabel = (value) => {
  const date = parseDate(value);
  if (!date) return 'Sin fecha';

  return date.toLocaleString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatTimerLabel = (value, now = Date.now()) => {
  const startDate = parseDate(value);
  if (!startDate) return '--:--';

  const Math = globalThis.Math;
  const elapsedMs = Math.max(0, now - startDate.getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
};

export const resolveExpectedMinutesByActiveCount = (activeCount) =>
  Number(activeCount) > 15 ? 40 : 20;

const formatMinSec = (totalMs) => {
  const safeMs = Math.max(0, Number(totalMs) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const buildKitchenCountdown = ({ baseDateValue, expectedMinutes, now = Date.now() }) => {
  const baseDate = parseDate(baseDateValue);
  const baseMs = baseDate?.getTime() || Number(now);
  const expectedMs = Math.max(1, Number(expectedMinutes) || 20) * 60 * 1000;
  const elapsedMs = Math.max(0, Number(now) - baseMs);
  const remainingMs = expectedMs - elapsedMs;
  const isDelayed = remainingMs <= 0;
  const delayedMs = Math.max(0, elapsedMs - expectedMs);

  return {
    remainingMs,
    delayedMs,
    isDelayed,
    remainingLabel: isDelayed ? '00:00' : formatMinSec(remainingMs),
    delayedLabel: isDelayed ? `Retrasado +${formatMinSec(delayedMs)}` : ''
  };
};

export const formatServiceLabel = (value) => {
  if (value === 'PARA_LLEVAR') return 'Para llevar';
  if (value === 'DELIVERY') return 'Delivery';
  return 'Local';
};

const normalizeUpper = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

export const resolveOrderColumnKey = (order) => {
  const rawColumn = normalizeUpper(order?.columna_kds);
  if (COLUMN_META_MAP.has(rawColumn)) return rawColumn;

  const statusCode = normalizeUpper(order?.estado_codigo);
  return ORDER_STATUS_TO_COLUMN[statusCode] || 'PENDIENTES';
};

export const formatKitchenStatusLabel = (order) => {
  const statusCode = normalizeUpper(order?.estado_codigo);
  return STATUS_LABEL_BY_CODE[statusCode] || 'Pendiente';
};

export const normalizeKitchenOrder = (row) => {
  const estadoCodigo = normalizeUpper(row?.estado_codigo || 'EN_COCINA');
  const columnaKds = resolveOrderColumnKey({
    columna_kds: row?.columna_kds,
    estado_codigo: estadoCodigo
  });
  const items = (Array.isArray(row?.items) ? row.items : [])
    .map((item) => {
      const operationalInstruction = normalizeUpper(item?.instruccion_operativa);
      return {
        ...item,
        id_detalle: Number(item?.id_detalle ?? 0) || null,
        id_producto: Number(item?.id_producto ?? 0) || null,
        id_receta: Number(item?.id_receta ?? 0) || null,
        cantidad: Number(item?.cantidad ?? 0) || 0,
        nombre_item: String(item?.nombre_item ?? 'Item de cocina'),
        observacion: String(item?.observacion ?? '').trim() || null,
        modificaciones: inferModifications(item),
        instruccion_operativa: operationalInstruction === 'ENTREGAR_JUNTO_CON_EL_PEDIDO'
          ? operationalInstruction
          : 'PREPARAR'
      };
    });

  return {
    ...row,
    id_pedido: Number(row?.id_pedido ?? 0) || null,
    id_sucursal: Number(row?.id_sucursal ?? 0) || null,
    id_estado_pedido: Number(row?.id_estado_pedido ?? 0) || null,
    total: roundMoney(row?.total),
    inventario_alertas_total: Number(row?.inventario_alertas_total ?? 0) || 0,
    inventario_alertas_pendientes: Number(row?.inventario_alertas_pendientes ?? 0) || 0,
    total_items: Number(row?.total_items ?? 0) || 0,
    numero_ticket: buildKitchenTicketLabel(row),
    codigo_venta: String(row?.codigo_venta ?? '').trim() || null,
    nombre_sucursal: String(row?.nombre_sucursal ?? 'Sucursal no definida'),
    cliente_nombre: String(row?.cliente_nombre ?? 'Consumidor final'),
    estado_codigo: estadoCodigo,
    columna_kds: columnaKds,
    tipo_servicio: String(row?.tipo_servicio ?? 'LOCAL'),
    descripcion_pedido: row?.descripcion_pedido || null,
    descripcion_envio: row?.descripcion_envio || null,
    kds_started_at: row?.kds_started_at || null,
    kds_expected_minutes: Number(row?.kds_expected_minutes ?? 0) || null,
    kds_expected_rule: row?.kds_expected_rule || null,
    visible_en_cocina_at: row?.visible_en_cocina_at || row?.fecha_hora_facturacion || row?.fecha_hora_pedido || null,
    en_preparacion_at: row?.en_preparacion_at || null,
    minutos_en_espera: row?.minutos_en_espera != null ? Number(row.minutos_en_espera) : null,
    esta_proximo_a_expirar: Boolean(row?.esta_proximo_a_expirar),
    nota_general_pedido: extractPedidoGeneralNotes(row?.descripcion_pedido, items),
    items
  };
};

export const groupKitchenItems = (items = []) => {
  const groups = { preparar: [], entregarJunto: [] };
  for (const item of Array.isArray(items) ? items : []) {
    if (String(item?.instruccion_operativa || '').trim().toUpperCase() === 'ENTREGAR_JUNTO_CON_EL_PEDIDO') {
      groups.entregarJunto.push(item);
    } else {
      groups.preparar.push(item);
    }
  }
  return groups;
};

export const buildCocinaStats = (orders) => {
  const rows = Array.isArray(orders) ? orders : [];
  return {
    pendientes: rows.filter((item) => resolveOrderColumnKey(item) === 'PENDIENTES').length,
    enPreparacion: rows.filter((item) => resolveOrderColumnKey(item) === 'EN_PREPARACION').length,
    listos: rows.filter((item) => resolveOrderColumnKey(item) === 'LISTOS_PARA_ENTREGA').length
  };
};

export const buildSparklinePoints = (series, width = 120, height = 44, padding = 4) => {
  if (!Array.isArray(series) || series.length < 2) return '';
  const values = series.map((value) => Number(value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const safeWidth = Math.max(width - padding * 2, 1);
  const safeHeight = Math.max(height - padding * 2, 1);

  return values
    .map((value, index) => {
      const x = padding + (safeWidth * index) / (values.length - 1);
      const y = padding + safeHeight - ((value - min) / range) * safeHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

export const buildCocinaSeries = (stats) => ({
  pendientes: [stats.pendientes, Math.max(stats.pendientes - 1, 0), stats.pendientes + 1, stats.pendientes],
  enPreparacion: [stats.enPreparacion + 1, stats.enPreparacion, stats.enPreparacion + 1, stats.enPreparacion],
  listos: [stats.listos, stats.listos + 1, Math.max(stats.listos - 1, 0), stats.listos]
});

export const groupOrdersByColumn = (orders) => {
  const grouped = {
    PENDIENTES: [],
    EN_PREPARACION: [],
    LISTOS_PARA_ENTREGA: []
  };

  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const key = resolveOrderColumnKey(order);
    grouped[key].push({ ...order, columna_kds: key });
  });

  Object.values(grouped).forEach((list) => {
    list.sort(compareKitchenOrders);
  });

  return grouped;
};

export const getColumnMeta = (columnKey) =>
  COLUMN_META_MAP.get(columnKey) || COLUMN_META_MAP.get('PENDIENTES');

export const getOrderAction = (order) => {
  const column = getColumnMeta(resolveOrderColumnKey(order));
  return {
    label: column.actionLabel,
    nextStatus: column.actionStatus,
    buttonClass: column.buttonClass,
    icon: column.icon
  };
};

export const matchesKitchenOrder = (order, search) => {
  const needle = normalizeTextKey(search).replace(/_/g, ' ');
  if (!needle) return true;

  const haystack = [
    order?.numero_ticket,
    order?.cliente_nombre,
    order?.nombre_sucursal,
    order?.tipo_servicio,
    order?.descripcion_pedido,
    ...(Array.isArray(order?.items)
      ? order.items.flatMap((item) => [
          item?.nombre_item,
          item?.observacion,
          ...(Array.isArray(item?.modificaciones) ? item.modificaciones : [])
        ])
      : [])
  ]
    .filter(Boolean)
    .join(' ');

  return normalizeTextKey(haystack).replace(/_/g, ' ').includes(needle);
};

export const filterActiveSucursales = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.estado === true || row?.estado === 'true' || row?.estado === 1 || row?.estado === '1')
    .sort((a, b) =>
      String(a?.nombre_sucursal ?? '').localeCompare(String(b?.nombre_sucursal ?? ''), 'es', {
        sensitivity: 'base'
      })
    );

export const applyKitchenTransition = (orders, idPedido, nextStatus, transitionData = {}) => {
  const nextColumn =
    nextStatus === 'EN_PREPARACION'
      ? 'EN_PREPARACION'
      : nextStatus === 'LISTO_PARA_ENTREGA'
        ? 'LISTOS_PARA_ENTREGA'
        : null;

  return (Array.isArray(orders) ? orders : []).flatMap((order) => {
    if (Number(order?.id_pedido ?? 0) !== Number(idPedido ?? 0)) {
      return [order];
    }

    if (nextStatus === 'COMPLETADO') {
      return [];
    }

    return [
      {
        ...order,
        estado_codigo: nextStatus,
        columna_kds: nextColumn,
        en_preparacion_at:
          nextStatus === 'EN_PREPARACION'
            ? transitionData?.en_preparacion_at || order?.en_preparacion_at || null
            : order?.en_preparacion_at || null
      }
    ];
  });
};

