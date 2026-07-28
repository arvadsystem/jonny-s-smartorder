const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const extractApiMessage = (error, defaultMessage = 'Ocurrio un error inesperado.') => {
  if (error?.data?.message && typeof error.data.message === 'string') {
    return error.data.message;
  }

  if (error?.response?.data?.error?.publicMessage) {
    return String(error.response.data.error.publicMessage);
  }

  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }

  if (error?.message) {
    return String(error.message);
  }

  return defaultMessage;
};

export const normalizeEnvelopeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const normalizeEnvelopeMeta = (payload, fallbackLimit = 20) => ({
  total: toNumber(payload?.total, 0),
  page: toNumber(payload?.page, 1) || 1,
  limit: toNumber(payload?.limit, fallbackLimit) || fallbackLimit
});

export const normalizeCliente = (cliente) => ({
  id_cliente: toNumber(cliente?.id_cliente, 0),
  id_usuario_cliente: toNumber(cliente?.id_usuario_cliente, 0) || null,
  nombre_usuario: String(cliente?.nombre_usuario ?? '').trim(),
  nombre: String(cliente?.nombre_principal ?? cliente?.nombre_cliente ?? '').trim() || `Cliente #${cliente?.id_cliente ?? ''}`,
  correo: String(cliente?.correo ?? '').trim(),
  telefono: String(cliente?.telefono ?? '').trim(),
  documento: String(cliente?.documento ?? '').trim(),
  puntos_disponibles: toNumber(cliente?.puntos_disponibles, 0),
  puntos_acumulados_total: toNumber(cliente?.puntos_acumulados_total, 0),
  puntos_canjeados_total: toNumber(cliente?.puntos_canjeados_total, 0),
  fecha_ultima_actividad: cliente?.fecha_ultima_actividad ?? null,
  id_sucursal_ultima_actividad: toNumber(cliente?.id_sucursal_ultima_actividad, 0) || null,
  nombre_sucursal_ultima_actividad: String(cliente?.nombre_sucursal_ultima_actividad ?? '').trim(),
  identificador: String(cliente?.documento ?? cliente?.correo ?? cliente?.telefono ?? '').trim(),
  estado: cliente?.estado !== undefined ? Boolean(cliente.estado) : true
});

export const normalizePanelData = (payload) => {
  const data = payload?.data ?? payload ?? {};
  const resumen = data?.resumen ?? {};

  return {
    sucursal: toNumber(data?.sucursal, 0) || null,
    configuracion_activa: data?.configuracion_activa
      ? {
          id_configuracion: toNumber(data.configuracion_activa.id_configuracion, 0) || null,
          lempiras_por_punto: toNumber(data.configuracion_activa.lempiras_por_punto, 0),
          vigente_desde: data.configuracion_activa.vigente_desde ?? null,
          vigente_hasta: data.configuracion_activa.vigente_hasta ?? null
        }
      : null,
    resumen: {
      clientes_con_puntos: toNumber(resumen?.clientes_con_puntos, 0),
      puntos_disponibles_totales: toNumber(resumen?.puntos_disponibles_totales, 0),
      canjes_hoy: toNumber(resumen?.canjes_hoy, 0),
      canjes_mes: toNumber(resumen?.canjes_mes, 0)
    }
  };
};

export const normalizeMovimiento = (movimiento) => ({
  id_movimiento: toNumber(movimiento?.id_movimiento, 0),
  id_sucursal: toNumber(movimiento?.id_sucursal, 0) || null,
  nombre_sucursal: String(movimiento?.nombre_sucursal ?? '').trim(),
  puntos_delta: toNumber(movimiento?.puntos_delta, 0),
  saldo_anterior: toNumber(movimiento?.saldo_anterior, 0),
  saldo_nuevo: toNumber(movimiento?.saldo_nuevo, 0),
  id_factura: toNumber(movimiento?.id_factura, 0) || null,
  id_pedido: toNumber(movimiento?.id_pedido, 0) || null,
  id_canje: toNumber(movimiento?.id_canje, 0) || null,
  observacion: String(movimiento?.observacion ?? '').trim(),
  fecha_creacion: movimiento?.fecha_creacion ?? null,
  tipo_codigo: String(movimiento?.tipo_codigo ?? '').trim(),
  tipo_nombre: String(movimiento?.tipo_nombre ?? '').trim(),
  origen_codigo: String(movimiento?.origen_codigo ?? '').trim(),
  origen_nombre: String(movimiento?.origen_nombre ?? '').trim(),
  usuario_ejecutor: String(movimiento?.usuario_ejecutor ?? '').trim()
});

export const normalizeCanje = (canje) => ({
  id_canje: toNumber(canje?.id_canje, 0),
  id_cliente: toNumber(canje?.id_cliente, 0) || null,
  id_sucursal: toNumber(canje?.id_sucursal, 0) || null,
  nombre_sucursal: String(canje?.nombre_sucursal ?? '').trim(),
  id_estado_canje: toNumber(canje?.id_estado_canje, 0) || null,
  estado_codigo: String(canje?.estado_codigo ?? '').trim(),
  estado_nombre: String(canje?.estado_nombre ?? '').trim(),
  total_puntos: toNumber(canje?.total_puntos, 0),
  observacion: String(canje?.observacion ?? '').trim(),
  usuario_ejecutor: String(canje?.usuario_ejecutor ?? '').trim(),
  fecha_creacion: canje?.fecha_creacion ?? null,
  fecha_entrega: canje?.fecha_entrega ?? null,
  fecha_anulacion: canje?.fecha_anulacion ?? null,
  cliente_nombre: String(canje?.cliente_nombre ?? '').trim() || `Cliente #${canje?.id_cliente ?? ''}`,
  items: Array.isArray(canje?.items)
    ? canje.items.map((item) => ({
        id_detalle_canje: toNumber(item?.id_detalle_canje, 0) || null,
        id_producto: toNumber(item?.id_producto, 0) || null,
        nombre_producto: String(item?.nombre_producto ?? '').trim(),
        cantidad: toNumber(item?.cantidad, 0),
        puntos_unitarios: toNumber(item?.puntos_unitarios, 0),
        subtotal_puntos: toNumber(item?.subtotal_puntos, 0),
        precio_referencia: toNumber(item?.precio_referencia, 0),
        fecha_creacion: item?.fecha_creacion ?? null
      }))
    : []
});

// La tasa (lempiras_por_punto) es SIEMPRE obligatoria (> 0) para poder
// guardar, sin importar el estado del switch: tambien se usa para calcular
// canjes, y el backend exige una tasa valida para toda configuracion
// guardada (bloqueante: no se debe poder apagar el switch y guardar sin
// equivalencia, dejando la sucursal sin una tasa valida para canjes).
export const computeConfiguracionSubmitState = ({ lempiras, saving = false }) => {
  const lempirasValue = Number(lempiras);
  const lempirasValida = Number.isFinite(lempirasValue) && lempirasValue > 0;
  const canSubmit = !saving && lempirasValida;
  return { lempirasValue, lempirasValida, canSubmit };
};

export const buildSaveConfiguracionPayload = ({
  idSucursal,
  lempiras,
  acumulacionHabilitada,
  productosCanjeables = []
}) => {
  const { lempirasValue, lempirasValida } = computeConfiguracionSubmitState({ lempiras });
  return {
    id_sucursal: idSucursal || undefined,
    lempiras_por_punto: lempirasValida ? lempirasValue : undefined,
    acumulacion_habilitada: Boolean(acumulacionHabilitada),
    productos_canjeables: productosCanjeables
  };
};

export const normalizeConfiguracion = (payload) => {
  const data = payload?.data ?? payload ?? {};
  const configuracion = data?.configuracion ?? null;
  const productos = Array.isArray(data?.productos_canjeables) ? data.productos_canjeables : [];

  return {
    id_sucursal: toNumber(data?.id_sucursal, 0) || null,
    configuracion: configuracion
      ? {
          id_configuracion: toNumber(configuracion?.id_configuracion, 0) || null,
          lempiras_por_punto: toNumber(configuracion?.lempiras_por_punto, 0),
          acumulacion_habilitada: Boolean(configuracion?.acumulacion_habilitada),
          vigente_desde: configuracion?.vigente_desde ?? null,
          vigente_hasta: configuracion?.vigente_hasta ?? null,
          id_usuario_creador: toNumber(configuracion?.id_usuario_creador, 0) || null
        }
      : null,
    productos_canjeables: productos.map((producto) => ({
      id_registro: toNumber(producto?.id_registro, 0) || null,
      id_sucursal: toNumber(producto?.id_sucursal, 0) || null,
      id_producto: toNumber(producto?.id_producto, 0) || null,
      nombre_producto: String(producto?.nombre_producto ?? '').trim(),
      descripcion_producto: String(producto?.descripcion_producto ?? '').trim(),
      id_archivo_imagen_principal: toNumber(producto?.id_archivo_imagen_principal, 0) || null,
      imagen_principal_url: producto?.imagen_principal_url ? String(producto.imagen_principal_url).trim() || null : null,
      precio: toNumber(producto?.precio, 0),
      cantidad: toNumber(producto?.cantidad, 0),
      stock_minimo: toNumber(producto?.stock_minimo, 0),
      stock_disponible: toNumber(producto?.stock_disponible, 0),
      estado: producto?.estado !== undefined ? Boolean(producto.estado) : true,
      puntos_requeridos_override:
        producto?.puntos_requeridos_override === null || producto?.puntos_requeridos_override === undefined
          ? null
          : toNumber(producto?.puntos_requeridos_override, 0),
      puntos_requeridos_efectivos: toNumber(producto?.puntos_requeridos_efectivos, 0),
      id_almacen: toNumber(producto?.id_almacen, 0) || null,
      nombre_almacen: String(producto?.nombre_almacen ?? '').trim(),
      asignacion_local_estado: String(producto?.asignacion_local_estado ?? '').trim() || 'SIN_ASIGNACION'
    }))
  };
};

export const normalizeCanjeableResponse = (payload) => ({
  items: normalizeEnvelopeRows(payload).map((item) => ({
    id_producto: toNumber(item?.id_producto, 0),
    nombre_producto: String(item?.nombre_producto ?? '').trim(),
    descripcion_producto: String(item?.descripcion_producto ?? '').trim(),
    id_archivo_imagen_principal: toNumber(item?.id_archivo_imagen_principal, 0) || null,
    imagen_principal_url: item?.imagen_principal_url ? String(item.imagen_principal_url).trim() || null : null,
    precio: toNumber(item?.precio, 0),
    id_sucursal: toNumber(item?.id_sucursal, 0) || null,
    id_almacen: toNumber(item?.id_almacen, 0) || null,
    nombre_almacen: String(item?.nombre_almacen ?? '').trim(),
    cantidad: toNumber(item?.cantidad, 0),
    stock_minimo: toNumber(item?.stock_minimo, 0),
    puntos_requeridos_override:
      item?.puntos_requeridos_override === null || item?.puntos_requeridos_override === undefined
        ? null
        : toNumber(item?.puntos_requeridos_override, 0),
    stock_disponible: toNumber(item?.stock_disponible, 0),
    puntos_requeridos: toNumber(item?.puntos_requeridos, 0)
  })),
  message: String(payload?.message ?? '').trim(),
  saldoCliente: {
    id_cliente: toNumber(payload?.saldo_cliente?.id_cliente, 0) || null,
    puntos_disponibles: toNumber(payload?.saldo_cliente?.puntos_disponibles, 0)
  }
});

export const normalizeClienteDetalle = (payload) => {
  const data = payload?.data ?? payload ?? {};
  return {
    cliente: normalizeCliente(data?.cliente ?? {}),
    resumen: {
      puntos_disponibles: toNumber(data?.resumen?.puntos_disponibles, 0),
      puntos_acumulados_total: toNumber(data?.resumen?.puntos_acumulados_total, 0),
      puntos_canjeados_total: toNumber(data?.resumen?.puntos_canjeados_total, 0)
    },
    ultimos_canjes: Array.isArray(data?.ultimos_canjes) ? data.ultimos_canjes.map(normalizeCanje) : [],
    ultimos_movimientos: Array.isArray(data?.ultimos_movimientos) ? data.ultimos_movimientos.map(normalizeMovimiento) : []
  };
};

export const formatFechaHora = (fechaStr) => {
  if (!fechaStr) return '-';
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatPoints = (value) =>
  Number(value || 0).toLocaleString('es-HN', { maximumFractionDigits: 0 });

export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

// Logica pura del carrito de canje (GenerarCanjeModal la usa directamente,
// no hay una segunda implementacion): un producto con stock_disponible=0
// nunca debe poder agregarse. Number(0 || 0) sigue siendo 0 (no se usa
// "|| Infinity" como fallback, eso permitiria cantidades sin limite).
export const computeCanjeCartAfterAdd = (carrito, producto) => {
  const items = Array.isArray(carrito) ? carrito : [];
  const maxStock = Number(producto?.stock_disponible || 0);
  if (maxStock <= 0) return items;

  const idProducto = producto?.id_producto;
  const current = items.find((item) => item.id_producto === idProducto);
  if (current) {
    const nextCantidad = Math.min(current.cantidad + 1, maxStock);
    if (nextCantidad === current.cantidad) return items;
    return items.map((item) => (item.id_producto === idProducto ? { ...item, cantidad: nextCantidad } : item));
  }

  return [...items, { ...producto, cantidad: 1 }];
};

// Regla unica de "Confirmar canje deshabilitado": la misma funcion decide
// tanto el estado del boton como la advertencia de stock excedido, para no
// duplicar el criterio de "algun producto excede su stock" en dos lugares.
export const computeCanjeConfirmDisabled = ({
  saving = false,
  loadingCanjeables = false,
  sucursalMissing = false,
  carrito = [],
  saldoInsuficiente = false
}) => {
  const items = Array.isArray(carrito) ? carrito : [];
  const algunProductoExcedeStock = items.some(
    (item) => Number(item.stock_disponible || 0) < Number(item.cantidad || 0)
  );

  return {
    algunProductoExcedeStock,
    disabled: Boolean(
      saving ||
        loadingCanjeables ||
        sucursalMissing ||
        items.length === 0 ||
        saldoInsuficiente ||
        algunProductoExcedeStock
    )
  };
};

// Controlador minimo de "solo la solicitud mas reciente puede aplicar su
// resultado", usado por loadClientes (useFidelizacion.js) para evitar que
// una respuesta lenta de una pagina vieja sobrescriba una pagina mas
// reciente que ya respondio. Es una funcion pura (sin React) para poder
// probarla directamente con promesas diferidas, sin necesidad de un arnes
// para montar hooks.
export const createLatestRequestTracker = () => {
  let latestId = 0;
  return {
    start: () => {
      latestId += 1;
      return latestId;
    },
    isLatest: (id) => id === latestId
  };
};
