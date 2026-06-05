import {
  formatCurrency,
  roundMoney
} from '../../../../modules/ventas/utils/ventasMoneyUtils';

const FALLBACK_STATUS = {
  completed: 'Completada',
  pending: 'Pendiente'
};
const COMPLETED_STATUS_KEYS = new Set([
  'venta_directa',
  'completada',
  'completado',
  'finalizada',
  'finalizado',
  'pagada',
  'pagado',
  'cerrada',
  'cerrado',
  'lista',
  'listo'
]);

export const parseBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export {
  formatCurrency,
  roundMoney
};

const normalizeTextKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

export const getLineDiscountPercent = (line) => {
  if (!line || typeof line !== 'object') return null;

  const explicitPercent = Number(
    line.descuento_porcentaje_linea ??
    line.porcentaje_descuento_linea ??
    line.porcentaje_descuento ??
    line.descuento_porcentaje
  );
  if (Number.isFinite(explicitPercent) && explicitPercent > 0) {
    return Math.min(100, explicitPercent);
  }

  const discount = Number(line.descuento_linea ?? line.descuento ?? 0);
  if (!Number.isFinite(discount) || discount <= 0) return null;

  const grossSubtotal = Number(
    line.subtotal_bruto_linea ??
    line.subtotal_linea ??
    line.sub_total ??
    0
  ) || (Number(line.precio_unitario || 0) * Number(line.cantidad || 0));
  if (!Number.isFinite(grossSubtotal) || grossSubtotal <= 0) return null;

  return Math.min(100, (discount / grossSubtotal) * 100);
};

export const formatDiscountPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent <= 0) return '--';
  const rounded = Number(percent.toFixed(2));
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}%`;
};

export const resolveVentaReversionStatus = (venta) => {
  const reversedAmount = roundMoney(venta?.monto_reversado_total);
  if (reversedAmount <= 0) return { key: '', label: '' };

  const total = roundMoney(venta?.total);
  const isTotal = total > 0 && reversedAmount >= roundMoney(total - 0.01);
  return {
    key: isTotal ? 'reversed' : 'partially_reversed',
    label: isTotal ? 'Reversada' : 'Parcialmente reversada'
  };
};

const HN_TIMEZONE = 'America/Tegucigalpa';
const SQL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const parseSqlDateTimeText = (value) => {
  const source = String(value || '').trim();
  const match = source.match(SQL_DATE_TIME_RE);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0)
  };
};

const hasTimezoneInfo = (value) => /Z$|[+-]\d{2}:\d{2}$/.test(String(value || '').trim());

export const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';

  const source = String(value).trim();
  if (!hasTimezoneInfo(source)) {
    const parsed = parseSqlDateTimeText(source);
    if (parsed) {
      return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
    }
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return source.slice(0, 10);

  return date.toLocaleDateString('es-HN', {
    timeZone: HN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatTimeLabel = (value) => {
  if (!value) return '--:--';

  const source = String(value).trim();
  if (!hasTimezoneInfo(source)) {
    const parsed = parseSqlDateTimeText(source);
    if (parsed) {
      return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
    }
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return source.slice(11, 16) || '--:--';

  return date.toLocaleTimeString('es-HN', {
    timeZone: HN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const formatDateTimeLabel = (value) => `${formatDateLabel(value)} · ${formatTimeLabel(value)}`;

export const extractApiMessage = (error, fallbackMessage) => {
  if (error?.data && typeof error.data === 'object') {
    if (error.data.message) return error.data.message;
    if (error.data.mensaje) return error.data.mensaje;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

export const resolveVentasApiErrorMessage = (error, fallbackMessage = 'No se pudo completar la operación.') => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const message = extractApiMessage(error, fallbackMessage);
  if (!code || message.includes(code)) return message;
  return `${message} (${code})`;
};

export const normalizeCategoriaRecord = (row) => ({
  ...row,
  id_categoria_producto: Number(row?.id_categoria_producto ?? row?.id_categoria ?? 0) || null,
  nombre_categoria: String(row?.nombre_categoria ?? row?.nombre_departamento ?? 'Sin categoría'),
  estado: parseBoolean(row?.estado ?? true)
});

export const buildCategoriasMap = (categorias) =>
  new Map(
    (Array.isArray(categorias) ? categorias : []).map((categoria) => [
      Number(categoria.id_categoria_producto),
      categoria
    ])
  );

export const normalizeProductoRecord = (row, categoriasMap = new Map()) => {
  const idCategoria =
    row?.id_categoria_producto === null || row?.id_categoria_producto === undefined
      ? null
      : Number(row.id_categoria_producto);
  const categoria = idCategoria ? categoriasMap.get(idCategoria) : null;

  return {
    ...row,
    id_producto: Number(row?.id_producto ?? 0) || null,
    id_categoria_producto: idCategoria,
    id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
    nombre_producto: String(row?.nombre_producto ?? 'Producto'),
    descripcion_producto: String(row?.descripcion_producto ?? ''),
    precio: roundMoney(row?.precio),
    cantidad: Number(row?.cantidad ?? 0) || 0,
    estado: parseBoolean(row?.estado),
    categoria_label: categoria?.nombre_categoria || 'Sin categoría'
  };
};

export const normalizeComboRecord = (row) => ({
  ...row,
  id_combo: Number(row?.id_combo ?? 0) || null,
  id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
  descripcion: String(row?.descripcion ?? 'Combo'),
  precio: roundMoney(row?.precio),
  estado: parseBoolean(row?.estado),
  requiere_complementos: Boolean(row?.requiere_complementos),
  tipo_complemento: String(row?.tipo_complemento ?? ''),
  minimo_complementos: Number(row?.minimo_complementos ?? 0) || 0,
  maximo_complementos: Number(row?.maximo_complementos ?? 0) || 0,
  complementos_disponibles: (Array.isArray(row?.complementos_disponibles) ? row.complementos_disponibles : [])
    .map((entry) => ({
      id_complemento: Number(entry?.id_complemento ?? 0) || null,
      nombre: String(entry?.nombre ?? 'Complemento').trim(),
      disponible: entry?.disponible !== false
    }))
    .filter((entry) => entry.id_complemento)
});

export const normalizeRecetaRecord = (row) => ({
  ...row,
  id_receta: Number(row?.id_receta ?? 0) || null,
  id_producto_base: Number(row?.id_producto_base ?? 0) || null,
  id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
  nombre_receta: String(row?.nombre_receta ?? 'Receta'),
  nombre_producto_base: String(row?.nombre_producto_base ?? ''),
  precio: roundMoney(row?.precio),
  estado: parseBoolean(row?.estado),
  requiere_complementos: Boolean(row?.requiere_complementos),
  tipo_complemento: String(row?.tipo_complemento ?? ''),
  minimo_complementos: Number(row?.minimo_complementos ?? 0) || 0,
  maximo_complementos: Number(row?.maximo_complementos ?? 0) || 0,
  complementos_disponibles: (Array.isArray(row?.complementos_disponibles) ? row.complementos_disponibles : [])
    .map((entry) => ({
      id_complemento: Number(entry?.id_complemento ?? 0) || null,
      nombre: String(entry?.nombre ?? 'Complemento').trim(),
      disponible: entry?.disponible !== false
    }))
    .filter((entry) => entry.id_complemento)
});

export const normalizeClienteOption = (row) => ({
  ...row,
  id_cliente: Number(row?.id_cliente ?? 0) || null,
  value: String(row?.id_cliente ?? ''),
  label: String(row?.nombre_cliente ?? 'Consumidor final'),
  nombre_cliente: String(row?.nombre_cliente ?? 'Consumidor final'),
  es_consumidor_final: Boolean(row?.es_consumidor_final)
});

const inferStatusKey = (row) => {
  if (!row?.id_pedido) return 'completed';
  const statusKey = normalizeTextKey(row?.estado_pedido);
  return COMPLETED_STATUS_KEYS.has(statusKey) ? 'completed' : 'pending';
};

export const normalizeVentaRecord = (row) => {
  const statusKey = inferStatusKey(row);
  const reversionStatus = resolveVentaReversionStatus(row);

  return {
    ...row,
    id_pedido: Number(row?.id_pedido ?? 0) || null,
    id_factura: Number(row?.id_factura ?? 0) || null,
    id_sucursal: Number(row?.id_sucursal ?? 0) || null,
    id_cliente: Number(row?.id_cliente ?? 0) || null,
    id_usuario: Number(row?.id_usuario ?? 0) || null,
    id_sesion_caja: Number(row?.id_sesion_caja ?? 0) || null,
    caja_sesion_estado_codigo: String(row?.caja_sesion_estado_codigo ?? '').trim(),
    caja_sesion_estado_nombre: String(row?.caja_sesion_estado_nombre ?? '').trim(),
    caja_sesion_fecha_cierre: row?.caja_sesion_fecha_cierre ?? null,
    caja_sesion_abierta: row?.caja_sesion_abierta === undefined || row?.caja_sesion_abierta === null
      ? undefined
      : parseBoolean(row.caja_sesion_abierta),
    total: roundMoney(row?.total),
    sub_total: roundMoney(row?.sub_total),
    subtotal_bruto: roundMoney(row?.subtotal_bruto),
    isv: roundMoney(row?.isv),
    cambio: roundMoney(row?.cambio),
    efectivo_entregado: roundMoney(row?.efectivo_entregado),
    descuento_total: roundMoney(row?.descuento_total),
    descuento_lineas: roundMoney(row?.descuento_lineas),
    descuento_global: roundMoney(row?.descuento_global),
    monto_reversado_total: roundMoney(row?.monto_reversado_total),
    reversiones_count: Number(row?.reversiones_count ?? 0) || 0,
    total_items: Number(row?.total_items ?? 0) || 0,
    cliente_nombre: String(row?.cliente_nombre ?? 'Consumidor final'),
    nombre_sucursal: String(row?.nombre_sucursal ?? 'Sucursal no definida'),
    nombre_usuario: String(row?.nombre_usuario ?? 'Sin usuario'),
    metodo_pago: String(row?.metodo_pago ?? 'efectivo'),
    numero_venta: String(
      row?.numero_venta || `VTA-${String(row?.id_factura ?? 0).padStart(5, '0')}`
    ),
    statusKey,
    statusLabel: String(row?.estado_pedido ?? FALLBACK_STATUS[statusKey]),
    reversionStatusKey: reversionStatus.key,
    reversionStatusLabel: reversionStatus.label,
    displayStatusKey: reversionStatus.key || statusKey,
    displayStatusLabel: reversionStatus.label || String(row?.estado_pedido ?? FALLBACK_STATUS[statusKey]),
    fecha_label: formatDateLabel(row?.fecha_hora_pedido),
    hora_label: formatTimeLabel(row?.fecha_hora_pedido),
    fecha_hora_label: formatDateTimeLabel(row?.fecha_hora_pedido)
  };
};

export const resolveVentaReversionBlockReason = (venta) => {
  if (!venta || typeof venta !== 'object') return '';

  const hasSessionOpenFlag = Object.prototype.hasOwnProperty.call(venta, 'caja_sesion_abierta');
  const sessionCode = String(venta?.caja_sesion_estado_codigo || '').trim().toUpperCase();
  const sessionClosedAt = venta?.caja_sesion_fecha_cierre || null;

  if (!venta.id_sesion_caja) {
    return 'La venta no tiene una sesión de caja válida para reversión.';
  }

  if ((hasSessionOpenFlag && venta.caja_sesion_abierta === false) || sessionClosedAt || (sessionCode && sessionCode !== 'ABIERTA')) {
    return 'No se puede reversar porque la caja ya fue cerrada.';
  }

  return '';
};

export const normalizeVentaDetail = (row) => {
  const base = normalizeVentaRecord(row);
  const reversiones = (Array.isArray(row?.reversiones) ? row.reversiones : []).map((reversion) => ({
    ...reversion,
    id_reversion: Number(reversion?.id_reversion ?? 0) || null,
    codigo_reversion: String(reversion?.codigo_reversion ?? ''),
    tipo_reversion: String(reversion?.tipo_reversion ?? ''),
    motivo: String(reversion?.motivo ?? ''),
    observacion: String(reversion?.observacion ?? '').trim(),
    monto_reversado: roundMoney(reversion?.monto_reversado),
    fecha_operacion: reversion?.fecha_operacion ?? null,
    creada_en: reversion?.creada_en ?? null,
    usuario: String(reversion?.usuario ?? 'Sin usuario'),
    lineas: (Array.isArray(reversion?.lineas) ? reversion.lineas : []).map((linea) => ({
      ...linea,
      id_detalle_factura: Number(linea?.id_detalle_factura ?? 0) || null,
      tipo_item: String(linea?.tipo_item ?? 'ITEM'),
      nombre_item: String(linea?.nombre_item ?? 'Item'),
      cantidad_revertida: Number(linea?.cantidad_revertida ?? 0) || 0,
      precio_unitario_original: roundMoney(linea?.precio_unitario_original),
      subtotal_revertido: roundMoney(linea?.subtotal_revertido),
      descuento_revertido: roundMoney(linea?.descuento_revertido),
      total_revertido: roundMoney(linea?.total_revertido),
      devuelve_inventario: Boolean(linea?.devuelve_inventario)
    }))
  }));
  const reversedQtyByDetail = reversiones.reduce((map, reversion) => {
    reversion.lineas.forEach((linea) => {
      const idDetalle = Number(linea?.id_detalle_factura || 0);
      if (!idDetalle) return;
      map.set(idDetalle, (map.get(idDetalle) || 0) + Number(linea?.cantidad_revertida || 0));
    });
    return map;
  }, new Map());
  const items = Array.isArray(row?.items)
    ? row.items.map((item) => ({
      ...item,
      id_detalle: Number(item?.id_detalle ?? 0) || null,
      id_producto: Number(item?.id_producto ?? 0) || null,
      id_combo: Number(item?.id_combo ?? 0) || null,
      id_receta: Number(item?.id_receta ?? 0) || null,
      tipo_item: String(item?.tipo_item ?? 'PRODUCTO'),
      cantidad: Number(item?.cantidad ?? 0) || 0,
      precio_unitario: roundMoney(item?.precio_unitario),
      sub_total: roundMoney(item?.sub_total),
      total_linea: roundMoney(item?.total_linea),
      descuento: roundMoney(item?.descuento),
      descuento_linea: roundMoney(item?.descuento_linea),
      descuento_global: roundMoney(item?.descuento_global),
      descuento_porcentaje_linea: getLineDiscountPercent(item),
      nombre_item: String(item?.nombre_item ?? item?.nombre_producto ?? 'Item'),
      nombre_producto: String(item?.nombre_producto ?? item?.nombre_item ?? 'Item'),
      cantidad_revertida: reversedQtyByDetail.get(Number(item?.id_detalle ?? 0)) || 0,
      observacion: String(item?.observacion ?? '').trim()
    }))
    : [];
  const resolvedReversedTotal = roundMoney(
    reversiones.reduce((acc, item) => acc + Number(item?.monto_reversado || 0), 0)
  ) || base.monto_reversado_total;
  const reversionStatus = resolveVentaReversionStatus({
    ...base,
    monto_reversado_total: resolvedReversedTotal
  });

  return {
    ...base,
    reversiones,
    monto_reversado_total: resolvedReversedTotal,
    reversiones_count: reversiones.length || base.reversiones_count,
    reversionStatusKey: reversionStatus.key,
    reversionStatusLabel: reversionStatus.label,
    displayStatusKey: reversionStatus.key || base.statusKey,
    displayStatusLabel: reversionStatus.label || base.statusLabel,
    items,
    total_items: items.reduce((acc, item) => acc + Number(item?.cantidad ?? 0), 0) || base.total_items
  };
};

export const buildVentaStats = (ventas) => {
  const rows = Array.isArray(ventas) ? ventas : [];
  const totalVentas = rows.length;
  const totalFacturado = roundMoney(rows.reduce((acc, item) => acc + roundMoney(item?.total), 0));
  const completadas = rows.filter((item) => item?.statusKey === 'completed').length;
  const pendientes = totalVentas - completadas;

  return {
    totalVentas,
    totalFacturado,
    ticketPromedio: totalVentas > 0 ? roundMoney(totalFacturado / totalVentas) : 0,
    completadas,
    pendientes
  };
};

export const matchesVenta = (venta, search) => {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    venta?.numero_venta,
    venta?.cliente_nombre,
    venta?.nombre_sucursal,
    venta?.nombre_usuario,
    venta?.statusLabel,
    venta?.metodo_pago
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
};

export const matchesStatus = (venta, status) => {
  if (!status || status === 'todos') return true;
  return venta?.statusKey === status;
};

export const downloadVentaDetail = (venta) => {
  if (typeof window === 'undefined' || !venta) return;

  const payload = {
    numero_venta: venta.numero_venta,
    fecha: venta.fecha_label,
    hora: venta.hora_label,
    cliente: venta.cliente_nombre,
    sucursal: venta.nombre_sucursal,
    atendido_por: venta.nombre_usuario,
    metodo_pago: venta.metodo_pago,
    subtotal: venta.sub_total,
    descuento_total: venta.descuento_total,
    total: venta.total,
    reversiones: venta.reversiones?.map((reversion) => ({
      codigo_reversion: reversion.codigo_reversion,
      tipo_reversion: reversion.tipo_reversion,
      motivo: reversion.motivo,
      monto_reversado: reversion.monto_reversado,
      lineas: reversion.lineas
    })),
    items: venta.items?.map((item) => ({
      producto: item.nombre_item || item.nombre_producto,
      tipo_item: item.tipo_item,
      cantidad: item.cantidad,
      cantidad_revertida: item.cantidad_revertida || 0,
      precio_unitario: item.precio_unitario,
      subtotal: item.sub_total,
      descuento: item.descuento,
      descuento_porcentaje_linea: getLineDiscountPercent(item),
      total: item.total_linea,
      observacion: item.observacion || null
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${venta.numero_venta || 'venta'}.json`;
  link.click();
  window.URL.revokeObjectURL(url);
};

