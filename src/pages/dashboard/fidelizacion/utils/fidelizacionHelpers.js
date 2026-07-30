const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const extractApiMessage = (error, defaultMessage = 'Ocurrio un error inesperado.') => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const mapped = {
    FIDELIZACION_SCHEMA_PENDIENTE: 'La configuración de Fidelización requerida aún no está disponible.',
    FIDELIZACION_CANJE_SESSION_REQUIRED: 'No hay una sesión de caja abierta disponible para registrar el canje.',
    FIDELIZACION_CANJE_SESSION_AMBIGUOUS: 'Tienes varias sesiones de caja abiertas y no se puede determinar cuál utilizar.',
    FIDELIZACION_CANJE_SESSION_SELECTION_REQUIRED: 'Selecciona la sesión de caja donde se registrará el canje.',
    FIDELIZACION_CANJE_SESSION_INVALID: 'La sesión de caja seleccionada no es válida o ya no está abierta.'
  };
  if (mapped[code]) return mapped[code];
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

// ---------------------------------------------------------------------------
// Equivalencia de la tasa: significado, previsualizacion y confirmacion
// ---------------------------------------------------------------------------
// lempiras_por_punto = CUANTOS LEMPIRAS hacen falta para ganar 1 punto.
// El backend calcula puntos = floor(total_factura / lempiras_por_punto).
//
// Defecto confirmado en QA: el campo se llamaba "Equivalencia de puntos" y no
// explicaba el sentido de la cifra. Un usuario lo interpreto al reves y guardo
// 0.01; una compra de L 1,130.00 acumulo 113,000 puntos. La formula era
// correcta: lo ambiguo era la interfaz. Por eso se agregan previsualizacion,
// advertencia y confirmacion explicita, sin cambiar la formula.

// Misma formula que el backend (modules/fidelizacion/domain/pointsCalculator.js).
// Unica implementacion en el frontend: la usan la previsualizacion, la
// advertencia y el texto de la casilla de confirmacion.
export const calculatePointsPreview = ({ amount, lempirasPorPunto }) => {
  const total = Number(amount);
  const rate = Number(lempirasPorPunto);

  if (!Number.isFinite(total) || total < 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  return Math.floor(total / rate);
};

// Monto de ejemplo del caso real de QA (VTA-00004), usado en la advertencia y
// en el texto de la confirmacion.
export const RATE_CONFIRMATION_EXAMPLE_AMOUNT = 1130;

// Montos de la tabla "Ejemplo de acumulacion" del modal.
export const RATE_PREVIEW_AMOUNTS = [100, 1000, RATE_CONFIRMATION_EXAMPLE_AMOUNT];

// Una tasa menor a 1 genera mas de 1 punto por lempira gastado: es tecnicamente
// valida (puede ser una decision administrativa) pero se advierte de forma
// destacada porque es justo el error que ocurrio en QA.
export const isSensitiveLempirasRate = (lempiras) => {
  const rate = Number(lempiras);
  return Number.isFinite(rate) && rate > 0 && rate < 1;
};

// Comparacion NUMERICA (no textual), igual que isSameLempirasPorPuntoRate en el
// backend: 100, "100" y "100.00" son la misma tasa y no deben volver a pedir
// confirmacion cuando el administrador solo edita productos o el switch.
export const isSameLempirasRate = (a, b) => {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return left === right;
};

// Exige confirmacion cuando es la primera configuracion (no hay tasa previa) o
// cuando la tasa escrita difiere de la vigente.
export const requiresRateConfirmation = ({ previousLempirasPorPunto, lempiras }) => {
  const next = Number(lempiras);
  if (!Number.isFinite(next) || next <= 0) return false;

  const previous = Number(previousLempirasPorPunto);
  if (!Number.isFinite(previous) || previous <= 0) return true;

  return !isSameLempirasRate(previous, next);
};

// Estado completo del boton "Guardar reglas": conserva la regla previa (tasa
// valida > 0 y no estar guardando) y le suma la confirmacion obligatoria.
// Se deja computeConfiguracionSubmitState intacta -otras pruebas y llamadas
// dependen de su contrato- y se compone aqui.
export const computeConfiguracionSaveState = ({
  lempiras,
  saving = false,
  previousLempirasPorPunto = null,
  rateConfirmed = false
}) => {
  const base = computeConfiguracionSubmitState({ lempiras, saving });
  const confirmationRequired = requiresRateConfirmation({ previousLempirasPorPunto, lempiras });
  const confirmationSatisfied = !confirmationRequired || rateConfirmed === true;

  return {
    ...base,
    confirmationRequired,
    confirmationSatisfied,
    canSubmit: base.canSubmit && confirmationSatisfied
  };
};

export const buildSaveConfiguracionPayload = ({
  idSucursal,
  lempiras,
  acumulacionHabilitada,
  productosCanjeables = [],
  // Solo se envia confirmar_equivalencia cuando el usuario marco de verdad la
  // casilla. Nunca se manda `false` ni un valor "parecido a verdadero": el
  // backend exige el booleano true estricto.
  rateConfirmed = false
}) => {
  const { lempirasValue, lempirasValida } = computeConfiguracionSubmitState({ lempiras });
  const payload = {
    id_sucursal: idSucursal || undefined,
    lempiras_por_punto: lempirasValida ? lempirasValue : undefined,
    acumulacion_habilitada: Boolean(acumulacionHabilitada),
    productos_canjeables: productosCanjeables
  };

  if (rateConfirmed === true) {
    payload.confirmar_equivalencia = true;
  }

  return payload;
};

// ---------------------------------------------------------------------------
// Costo en puntos de un producto canjeable: automatico vs personalizado
// ---------------------------------------------------------------------------
// Defecto confirmado en QA: el campo administrativo se llamaba "Override
// puntos" (palabra tecnica, sin significado claro en la interfaz) y no
// mostraba el costo automatico de referencia, dificultando saber si el valor
// escrito era razonable. El backend ya resuelve correctamente
// puntos_requeridos_override ?? computeRedemptionPoints(precio, tasa)
// (services/fidelizacionService.js) y sigue siendo la fuente de verdad: este
// modulo solo aclara la interfaz y valida ANTES de enviar, nunca reemplaza la
// validacion/recalculo del backend.

// Misma formula que el backend (computeRedemptionPoints): puntos = techo del
// precio entre la tasa. A diferencia de calculatePointsPreview (acumulacion,
// que usa floor), el costo de canje SIEMPRE redondea hacia arriba: nunca se
// le puede pedir al cliente menos puntos de los que el precio realmente vale.
// Devuelve null cuando el precio o la tasa no son numeros finitos > 0 (nunca
// 0, que si es un "costo" real y se confundiria con "sin resultado").
export const calculateRedemptionPointsPreview = ({ precio, lempirasPorPunto }) => {
  const price = Number(precio);
  const rate = Number(lempirasPorPunto);

  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Math.ceil(price / rate);
};

// Sentinela para "valor invalido", distinto de `null` (que significa
// "automatico"). No se usa NaN como sentinela: NaN !== NaN complica las
// comparaciones directas (assert.equal) en quien consuma este helper.
export const REDEMPTION_POINTS_OVERRIDE_INVALID = 'INVALID';

// Normaliza el costo en puntos personalizado que escribe el administrador.
// Contrato (auditoria de QA, seccion 13):
//   vacio (string vacio, null, undefined)  -> null (automatico)
//   entero positivo (numero o cadena pura) -> ese numero
//   cualquier otro valor                   -> REDEMPTION_POINTS_OVERRIDE_INVALID
// Nunca acepta decimales, texto parcialmente numerico, arreglos, objetos,
// cero, negativos, Infinity ni NaN. Se usa tanto para la validacion en vivo
// del input como para construir el payload final (nunca solo atributos HTML
// min/step, que un navegador puede no aplicar de forma estricta).
export const normalizeRedemptionPointsOverride = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return REDEMPTION_POINTS_OVERRIDE_INVALID;

  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return REDEMPTION_POINTS_OVERRIDE_INVALID;

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return REDEMPTION_POINTS_OVERRIDE_INVALID;

  return parsed;
};

// Un producto (checked=true) tiene un costo invalido cuando escribio algo que
// no es ni "vacio" (automatico) ni un entero positivo valido. Usado para
// bloquear "Guardar reglas" y para mostrar el mensaje de ayuda junto al campo.
export const isRedemptionPointsOverrideInvalid = (value) =>
  normalizeRedemptionPointsOverride(value) === REDEMPTION_POINTS_OVERRIDE_INVALID;

// Construye la entrada de un producto canjeable para el payload de
// saveConfiguracion. Devuelve null cuando id_producto o el costo
// personalizado no son validos (el llamador debe tratar null como "no
// generar payload valido para este producto" -en la practica nunca ocurre en
// un submit real porque el boton ya esta deshabilitado, pero la validacion
// vive aqui, no solo en el estado deshabilitado del boton).
//
// Automatico -> { id_producto } (nunca se envia puntos_requeridos_override,
// ni siquiera como null: el contrato actual del backend es "campo ausente =
// automatico", ver routers/fidelizacion.js).
// Personalizado -> { id_producto, puntos_requeridos_override } con un NUMBER,
// nunca un string ni un decimal.
export const buildCanjeableProductoPayload = ({ idProducto, puntosRequeridosOverride }) => {
  const id = Number(idProducto);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const normalized = normalizeRedemptionPointsOverride(puntosRequeridosOverride);
  if (normalized === REDEMPTION_POINTS_OVERRIDE_INVALID) return null;

  const payload = { id_producto: id };
  if (normalized !== null) {
    payload.puntos_requeridos_override = normalized;
  }
  return payload;
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
  const rawValue = String(fechaStr).trim();
  const normalizedUtcLabel = rawValue.replace(/\s+UTC$/i, 'Z');
  const normalizedSeparator = normalizedUtcLabel.replace(
    /^(\d{4}-\d{2}-\d{2})\s(?=\d{2}:\d{2})/,
    '$1T'
  );
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedSeparator);
  const isTimestampWithoutZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalizedSeparator)
    && !hasExplicitZone;
  const normalizedFraction = normalizedSeparator.replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(isTimestampWithoutZone ? `${normalizedFraction}Z` : normalizedFraction);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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

// Usado por el efecto de GenerarCanjeModal.jsx que dispara la carga del
// catalogo de canjeables sin poder await-earla (no es async): ese efecto no
// consumia el rechazo de onLoadCanjeables, y como useFidelizacion.loadCanjeables
// SIEMPRE relanza el error de la solicitud vigente (ademas de mostrar el toast
// y actualizar el estado), una respuesta con error de red/HTTP producia un
// Unhandled Promise Rejection. Esta funcion ejecuta promiseFactory y descarta
// cualquier error (sync o async): no oculta nada al usuario, porque
// useFidelizacion ya se encargo del toast/estado antes de relanzar.
export const consumeHandledAsyncError = async (promiseFactory) => {
  try {
    await promiseFactory();
  } catch {
    // Rechazo ya manejado (toast + estado) por quien lo relanzo; se descarta
    // aqui solo para que la promesa nunca quede sin consumir.
  }
};
