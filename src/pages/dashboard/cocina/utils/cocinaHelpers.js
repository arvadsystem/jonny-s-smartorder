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
  },
  {
    key: 'LISTOS_PARA_ENTREGA',
    statusCode: 'LISTO_PARA_ENTREGA',
    title: 'Listos para entrega',
    actionLabel: 'Entregar',
    actionStatus: 'COMPLETADO',
    buttonClass: 'is-deliver',
    badgeClass: 'is-ready',
    icon: 'bi bi-box-seam-fill'
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
  EN_PREPARACION: 'En preparacion',
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

const inferModifications = (item, fallbackText = '') => {
  const itemObservation = String(item?.observacion || '').trim();
  if (itemObservation) {
    return splitObservationSegments(itemObservation);
  }

  if (Array.isArray(item?.modificaciones) && item.modificaciones.length > 0) {
    return item.modificaciones.filter(Boolean).map((entry) => String(entry));
  }

  return splitObservationSegments(fallbackText);
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

  return {
    ...row,
    id_pedido: Number(row?.id_pedido ?? 0) || null,
    id_sucursal: Number(row?.id_sucursal ?? 0) || null,
    id_estado_pedido: Number(row?.id_estado_pedido ?? 0) || null,
    total: roundMoney(row?.total),
    total_items: Number(row?.total_items ?? 0) || 0,
    numero_ticket: String(row?.numero_ticket ?? ''),
    nombre_sucursal: String(row?.nombre_sucursal ?? 'Sucursal no definida'),
    cliente_nombre: String(row?.cliente_nombre ?? 'Consumidor final'),
    estado_codigo: estadoCodigo,
    columna_kds: columnaKds,
    tipo_servicio: String(row?.tipo_servicio ?? 'LOCAL'),
    descripcion_pedido: row?.descripcion_pedido || null,
    descripcion_envio: row?.descripcion_envio || null,
    // Campos de expiración provenientes del backend
    minutos_en_espera: row?.minutos_en_espera != null ? Number(row.minutos_en_espera) : null,
    esta_proximo_a_expirar: Boolean(row?.esta_proximo_a_expirar),
    items: (Array.isArray(row?.items) ? row.items : []).map((item) => ({
      ...item,
      id_detalle: Number(item?.id_detalle ?? 0) || null,
      id_producto: Number(item?.id_producto ?? 0) || null,
      id_combo: Number(item?.id_combo ?? 0) || null,
      id_receta: Number(item?.id_receta ?? 0) || null,
      cantidad: Number(item?.cantidad ?? 0) || 0,
      nombre_item: String(item?.nombre_item ?? 'Item de cocina'),
      observacion: String(item?.observacion ?? '').trim() || null,
      modificaciones: inferModifications(item, row?.descripcion_pedido)
    }))
  };
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
    list.sort((a, b) => {
      const left = parseDate(a?.fecha_hora_facturacion || a?.fecha_hora_pedido)?.getTime() || 0;
      const right = parseDate(b?.fecha_hora_facturacion || b?.fecha_hora_pedido)?.getTime() || 0;
      return left - right;
    });
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

export const applyKitchenTransition = (orders, idPedido, nextStatus) => {
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
        columna_kds: nextColumn
      }
    ];
  });
};
