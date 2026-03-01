const FALLBACK_STATUS = {
  completed: 'Completada',
  pending: 'Pendiente'
};

export const parseBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

export const formatCurrency = (value) => `L ${roundMoney(value).toFixed(2)}`;

export const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';

  const source = String(value);
  const normalized = source.includes('T') ? source : source.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return source.slice(0, 10);

  return date.toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatTimeLabel = (value) => {
  if (!value) return '--:--';

  const source = String(value);
  const normalized = source.includes('T') ? source : source.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return source.slice(11, 16) || '--:--';
  }

  return date.toLocaleTimeString('es-HN', {
    hour: '2-digit',
    minute: '2-digit'
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

export const normalizeCategoriaRecord = (row) => ({
  ...row,
  id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
  nombre_departamento: String(row?.nombre_departamento ?? 'General'),
  estado: parseBoolean(row?.estado)
});

export const buildCategoriasMap = (categorias) =>
  new Map(
    (Array.isArray(categorias) ? categorias : []).map((categoria) => [
      Number(categoria.id_tipo_departamento),
      categoria
    ])
  );

export const normalizeProductoRecord = (row, categoriasMap = new Map()) => {
  const idTipoDepartamento =
    row?.id_tipo_departamento === null || row?.id_tipo_departamento === undefined
      ? null
      : Number(row.id_tipo_departamento);
  const categoria = idTipoDepartamento ? categoriasMap.get(idTipoDepartamento) : null;

  return {
    ...row,
    id_producto: Number(row?.id_producto ?? 0) || null,
    id_tipo_departamento: idTipoDepartamento,
    nombre_producto: String(row?.nombre_producto ?? 'Producto'),
    descripcion_producto: String(row?.descripcion_producto ?? ''),
    precio: roundMoney(row?.precio),
    cantidad: Number(row?.cantidad ?? 0) || 0,
    estado: parseBoolean(row?.estado),
    categoria_label: categoria?.nombre_departamento || 'General'
  };
};

export const normalizeClienteOption = (row) => ({
  ...row,
  id_cliente: Number(row?.id_cliente ?? 0) || null,
  value: String(row?.id_cliente ?? ''),
  label: String(row?.nombre_cliente ?? 'Consumidor final'),
  nombre_cliente: String(row?.nombre_cliente ?? 'Consumidor final'),
  es_consumidor_final: Boolean(row?.es_consumidor_final)
});

const inferStatusKey = (row) => (row?.id_factura ? 'completed' : 'pending');

export const normalizeVentaRecord = (row) => {
  const statusKey = inferStatusKey(row);

  return {
    ...row,
    id_pedido: Number(row?.id_pedido ?? 0) || null,
    id_factura: Number(row?.id_factura ?? 0) || null,
    id_sucursal: Number(row?.id_sucursal ?? 0) || null,
    id_cliente: Number(row?.id_cliente ?? 0) || null,
    id_usuario: Number(row?.id_usuario ?? 0) || null,
    total: roundMoney(row?.total),
    sub_total: roundMoney(row?.sub_total),
    isv: roundMoney(row?.isv),
    cambio: roundMoney(row?.cambio),
    efectivo_entregado: roundMoney(row?.efectivo_entregado),
    descuento_total: roundMoney(row?.descuento_total),
    total_items: Number(row?.total_items ?? 0) || 0,
    cliente_nombre: String(row?.cliente_nombre ?? 'Consumidor final'),
    nombre_sucursal: String(row?.nombre_sucursal ?? 'Sucursal no definida'),
    nombre_usuario: String(row?.nombre_usuario ?? 'Sin usuario'),
    metodo_pago: String(row?.metodo_pago ?? 'efectivo'),
    numero_venta: String(
      row?.numero_venta || `VTA-${String(row?.id_pedido ?? 0).padStart(5, '0')}`
    ),
    statusKey,
    statusLabel: String(row?.estado_pedido ?? FALLBACK_STATUS[statusKey]),
    fecha_label: formatDateLabel(row?.fecha_hora_pedido),
    hora_label: formatTimeLabel(row?.fecha_hora_pedido),
    fecha_hora_label: formatDateTimeLabel(row?.fecha_hora_pedido)
  };
};

export const normalizeVentaDetail = (row) => {
  const base = normalizeVentaRecord(row);
  const items = Array.isArray(row?.items)
    ? row.items.map((item) => ({
        ...item,
        id_detalle: Number(item?.id_detalle ?? 0) || null,
        id_producto: Number(item?.id_producto ?? 0) || null,
        cantidad: Number(item?.cantidad ?? 0) || 0,
        precio_unitario: roundMoney(item?.precio_unitario),
        sub_total: roundMoney(item?.sub_total),
        total_linea: roundMoney(item?.total_linea),
        descuento: roundMoney(item?.descuento),
        nombre_producto: String(item?.nombre_producto ?? 'Producto')
      }))
    : [];

  return {
    ...base,
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
    isv: venta.isv,
    total: venta.total,
    items: venta.items?.map((item) => ({
      producto: item.nombre_producto,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.sub_total,
      total: item.total_linea
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
