const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const HN_LOCAL_OFFSET = '-06:00';

export const parseCajaDateTimeValue = (value) => {
  if (!value || value instanceof Date) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T00:00:00${HN_LOCAL_OFFSET}`;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    return text.replace(' ', 'T');
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(text)) {
    return `${text.replace(' ', 'T')}${HN_LOCAL_OFFSET}`;
  }
  return value;
};

export const parseCajaUtcTimestamp = parseCajaDateTimeValue;

export const truthy = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export const extractCajasApiMessage = (
  error,
  defaultMessage = 'No se pudo completar la operacion de cierres de caja.'
) => {
  if (error?.data?.message && typeof error.data.message === 'string') {
    return error.data.message;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return defaultMessage;
};

export const formatCajaCurrency = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

export const formatCajaDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(parseCajaDateTimeValue(value));
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCajaDateTimeHN = (value) => {
  if (!value) return '-';
  const date = new Date(parseCajaDateTimeValue(value));
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const resolveMovimientoManualKind = (movimiento = {}) => {
  const code = String(
    movimiento.tipo_codigo || movimiento.codigo || movimiento.tipo || ''
  ).trim().toUpperCase();
  const signo = Number(movimiento.signo);

  if (code === 'APERTURA' || code.includes('APERTURA')) return 'OTRO';
  if (signo === 1 || code.includes('INGRESO') || code.includes('ENTRADA') || code.includes('AJUSTE_POSITIVO')) {
    return 'INGRESO';
  }
  if (signo === -1 || code.includes('EGRESO') || code.includes('RETIRO') || code.includes('SALIDA')) {
    return 'EGRESO';
  }

  return 'OTRO';
};

export const normalizeCajaCatalogos = (payload = {}) => ({
  cajas: Array.isArray(payload.cajas) ? payload.cajas : [],
  estados_sesion: Array.isArray(payload.estados_sesion) ? payload.estados_sesion : [],
  roles_participacion: Array.isArray(payload.roles_participacion) ? payload.roles_participacion : [],
  tipos_movimiento: Array.isArray(payload.tipos_movimiento) ? payload.tipos_movimiento : [],
  metodos_pago: Array.isArray(payload.metodos_pago) ? payload.metodos_pago : [],
  resoluciones_cierre: Array.isArray(payload.resoluciones_cierre) ? payload.resoluciones_cierre : [],
  tipos_arqueo: Array.isArray(payload.tipos_arqueo) ? payload.tipos_arqueo : []
});

export const normalizeSesionActiva = (payload = {}) => {
  if (!payload?.activa || !payload?.session) return null;
  const session = payload.session;

  return {
    id_sesion_caja: toNumber(session.id_sesion_caja, 0) || null,
    id_caja: toNumber(session.id_caja, 0) || null,
    id_sucursal: toNumber(session.id_sucursal, 0) || null,
    id_usuario_responsable: toNumber(session.id_usuario_responsable, 0) || null,
    fecha_apertura: session.fecha_apertura ?? null,
    monto_apertura: toNumber(session.monto_apertura, 0),
    codigo_caja: String(session.codigo_caja ?? '').trim(),
    nombre_caja: String(session.nombre_caja ?? '').trim(),
    nombre_sucursal: String(session.nombre_sucursal ?? '').trim(),
    rol_codigo: String(session.rol_codigo ?? session.rol_participacion ?? '').trim().toUpperCase(),
    rol_participacion: String(session.rol_participacion ?? session.rol_codigo ?? '').trim().toUpperCase(),
    responsable_usuario: String(session.responsable_usuario ?? '').trim(),
    responsable_nombre: String(session.responsable_nombre ?? '').trim()
  };
};

export const normalizeSesion = (row = {}) => ({
  id_sesion_caja: toNumber(row.id_sesion_caja, 0) || null,
  id_caja: toNumber(row.id_caja, 0) || null,
  id_sucursal: toNumber(row.id_sucursal, 0) || null,
  id_usuario_responsable: toNumber(row.id_usuario_responsable, 0) || null,
  id_usuario_apertura: toNumber(row.id_usuario_apertura, 0) || null,
  id_usuario_cierre: toNumber(row.id_usuario_cierre, 0) || null,
  id_estado_sesion_caja: toNumber(row.id_estado_sesion_caja, 0) || null,
  fecha_apertura: row.fecha_apertura ?? null,
  fecha_cierre: row.fecha_cierre ?? null,
  monto_apertura: toNumber(row.monto_apertura, 0),
  ventas_efectivo: toNumber(row.ventas_efectivo, 0),
  ventas_no_efectivo: toNumber(row.ventas_no_efectivo, 0),
  ingresos_manuales: toNumber(row.ingresos_manuales, 0),
  egresos_manuales: toNumber(row.egresos_manuales, 0),
  efectivo_teorico: toNumber(row.efectivo_teorico, 0),
  monto_declarado_cierre: row.monto_declarado_cierre === null || row.monto_declarado_cierre === undefined
    ? null
    : toNumber(row.monto_declarado_cierre, 0),
  diferencia_cierre: row.diferencia_cierre === null || row.diferencia_cierre === undefined
    ? null
    : toNumber(row.diferencia_cierre, 0),
  codigo_caja: String(row.codigo_caja ?? '').trim(),
  nombre_caja: String(row.nombre_caja ?? '').trim(),
  nombre_sucursal: String(row.nombre_sucursal ?? '').trim(),
  estado_codigo: String(row.estado_codigo ?? '').trim().toUpperCase(),
  estado_nombre: String(row.estado_nombre ?? '').trim(),
  resolucion_codigo: String(row.resolucion_codigo ?? '').trim().toUpperCase(),
  resolucion_nombre: String(row.resolucion_nombre ?? '').trim(),
  responsable_usuario: String(row.responsable_usuario ?? '').trim(),
  responsable_nombre: String(row.responsable_nombre ?? '').trim(),
  apertura_usuario: String(row.apertura_usuario ?? '').trim(),
  apertura_nombre: String(row.apertura_nombre ?? '').trim(),
  cierre_usuario: String(row.cierre_usuario ?? '').trim(),
  cierre_nombre: String(row.cierre_nombre ?? '').trim(),
  observacion_apertura: String(row.observacion_apertura ?? '').trim(),
  observacion_cierre: String(row.observacion_cierre ?? '').trim()
});

export const normalizeCierreReporte = (row = {}) => ({
  ...normalizeSesion(row),
  id_cierre_caja: toNumber(row.id_cierre_caja, 0) || null,
  id_resolucion_cierre_caja: toNumber(row.id_resolucion_cierre_caja, 0) || null,
  monto_teorico_cierre: toNumber(row.monto_teorico_cierre, 0),
  monto_declarado_cierre: toNumber(row.monto_declarado_cierre, 0),
  diferencia: toNumber(row.diferencia, 0),
  fecha_cierre: row.fecha_cierre ?? null,
  editable_hasta: row.editable_hasta ?? null,
  editable_en_ventana: truthy(row.editable_en_ventana),
  resolucion_codigo: String(row.resolucion_codigo ?? '').trim().toUpperCase(),
  resolucion_nombre: String(row.resolucion_nombre ?? '').trim(),
  usuario_cierre: String(row.usuario_cierre ?? '').trim(),
  usuario_cierre_nombre: String(row.usuario_cierre_nombre ?? '').trim(),
  recuentos_count: toNumber(row.recuentos_count ?? row.validaciones_count, 0),
  ultimo_recuento_numero: toNumber(row.ultimo_recuento_numero ?? row.ultima_validacion_numero, 0) || null,
  ultima_revision_fecha: row.ultima_revision_fecha ?? row.ultima_validacion_fecha ?? null
});

const normalizeCierreRecuentoMetodo = (row = {}) => ({
  metodo_pago_codigo: String(row.metodo_pago_codigo ?? '').trim().toUpperCase(),
  monto_teorico: row.monto_teorico === null || row.monto_teorico === undefined
    ? null
    : toNumber(row.monto_teorico, 0),
  monto_declarado: toNumber(row.monto_declarado, 0),
  diferencia: row.diferencia === null || row.diferencia === undefined
    ? null
    : toNumber(row.diferencia, 0),
  cantidad_referencias: row.cantidad_referencias === null || row.cantidad_referencias === undefined
    ? null
    : toNumber(row.cantidad_referencias, 0),
  resultado: String(row.resultado ?? '').trim().toUpperCase(),
  requiere_revision: truthy(row.requiere_revision),
  observacion: String(row.observacion ?? '').trim()
});

const normalizeCierreRecuento = (row = {}) => ({
  id_validacion_cierre: toNumber(row.id_validacion_cierre, 0) || null,
  numero_intento: toNumber(row.numero_intento, 0),
  id_cierre_caja: toNumber(row.id_cierre_caja, 0) || null,
  usado_para_cierre: truthy(row.usado_para_cierre),
  id_usuario_valida: toNumber(row.id_usuario_valida, 0) || null,
  usuario_valida_nombre: String(row.usuario_valida_nombre ?? row.usuario_valida ?? '').trim(),
  fecha_validacion: row.fecha_validacion ?? null,
  total_teorico: row.total_teorico === null || row.total_teorico === undefined
    ? null
    : toNumber(row.total_teorico, 0),
  total_declarado: row.total_declarado === null || row.total_declarado === undefined
    ? null
    : toNumber(row.total_declarado, 0),
  diferencia_total: row.diferencia_total === null || row.diferencia_total === undefined
    ? null
    : toNumber(row.diferencia_total, 0),
  hay_diferencia: truthy(row.hay_diferencia),
  observacion_general: String(row.observacion_general ?? '').trim(),
  metodos: (Array.isArray(row.metodos) ? row.metodos : []).map(normalizeCierreRecuentoMetodo)
});

const normalizeCierreNotificacionCorreo = (row = {}) => {
  if (!row || typeof row !== 'object') return null;
  return {
    id_notificacion: toNumber(row.id_notificacion, 0) || null,
    id_cierre_caja: toNumber(row.id_cierre_caja, 0) || null,
    estado: String(row.estado ?? '').trim().toUpperCase(),
    intentos: toNumber(row.intentos, 0),
    proximo_intento: row.proximo_intento ?? null,
    bloqueado_hasta: row.bloqueado_hasta ?? null,
    ultimo_error: String(row.ultimo_error ?? '').trim(),
    email_destino: String(row.email_destino ?? '').trim(),
    message_id: String(row.message_id ?? '').trim(),
    fecha_envio: row.fecha_envio ?? null
  };
};

export const normalizeSesionDetalle = (payload = {}) => {
  const participantes = Array.isArray(payload.participantes) ? payload.participantes : [];
  const cobrosPorUsuario = Array.isArray(payload.cobros_por_usuario) ? payload.cobros_por_usuario : [];
  const arqueos = Array.isArray(payload.arqueos) ? payload.arqueos : [];
  const movimientos = Array.isArray(payload.movimientos) ? payload.movimientos : [];
  const recuentos = Array.isArray(payload.recuentos)
    ? payload.recuentos
    : (Array.isArray(payload.validaciones_cierre) ? payload.validaciones_cierre : []);
  const resumen = payload.resumen_operativo ?? {};

  const equipoCaja = participantes.map((row) => ({
    id_participacion_caja: toNumber(row.id_participacion_caja, 0) || null,
    id_usuario: toNumber(row.id_usuario, 0) || null,
    rol_codigo: String(row.rol_codigo ?? '').trim().toUpperCase(),
    rol_participacion: String(row.rol_codigo ?? row.rol_participacion ?? '').trim().toUpperCase(),
    rol_nombre: String(row.rol_nombre ?? '').trim(),
    roles_globales: Array.isArray(row.roles_globales)
      ? row.roles_globales.map((role) => String(role ?? '').trim().toUpperCase()).filter(Boolean)
      : [],
    nombre_usuario: String(row.nombre_usuario ?? '').trim(),
    nombre_completo: String(row.nombre_completo ?? '').trim(),
    activo: truthy(row.activo),
    observacion: String(row.observacion ?? '').trim(),
    fecha_inicio: row.fecha_inicio ?? null,
    fecha_fin: row.fecha_fin ?? null
  }));

  return {
    sesion: normalizeSesion(payload.sesion ?? {}),
    responsable: payload.responsable
      ? {
          id_usuario: toNumber(payload.responsable.id_usuario, 0) || null,
          nombre_usuario: String(payload.responsable.nombre_usuario ?? '').trim(),
          nombre_completo: String(payload.responsable.nombre_completo ?? '').trim()
        }
      : null,
    participantes: equipoCaja,
    equipo_caja: equipoCaja,
    cobros_por_usuario: cobrosPorUsuario.map((row, index) => ({
      ...row,
      key: [
        row.id_usuario_ejecutor || 'usuario',
        row.rol_participacion_codigo || row.rol_participacion || 'rol',
        row.fecha_inicio || row.primer_cobro || index
      ].join(':'),
      id_usuario_ejecutor: toNumber(row.id_usuario_ejecutor, 0) || null,
      total_cobrado: toNumber(row.total_cobrado, 0),
      cobros_registrados: toNumber(
        row.cobros_registrados ?? row.cantidad_cobros ?? row.total_cobros,
        0
      ),
      total_efectivo: toNumber(row.total_efectivo, 0),
      total_no_efectivo: toNumber(row.total_no_efectivo, 0),
      rol_participacion: String(row.rol_participacion ?? '').trim().toUpperCase() || 'EJECUTOR',
      es_responsable: truthy(row.es_responsable),
      es_auxiliar: truthy(row.es_auxiliar),
      nombre_usuario: String(row.nombre_usuario ?? '').trim(),
      nombre_completo: String(row.nombre_completo ?? '').trim()
    })),
    resumen_operativo: {
      ventas_efectivo: toNumber(resumen.ventas_efectivo, 0),
      ventas_no_efectivo: toNumber(resumen.ventas_no_efectivo, 0),
      ingresos_manuales: toNumber(resumen.ingresos_manuales, 0),
      egresos_manuales: toNumber(resumen.egresos_manuales, 0),
      efectivo_teorico: toNumber(resumen.efectivo_teorico, 0),
      monto_declarado_cierre: resumen.monto_declarado_cierre === null || resumen.monto_declarado_cierre === undefined
        ? null
        : toNumber(resumen.monto_declarado_cierre, 0),
      diferencia_cierre: resumen.diferencia_cierre === null || resumen.diferencia_cierre === undefined
        ? null
        : toNumber(resumen.diferencia_cierre, 0),
      ultimo_arqueo_cierre: resumen.ultimo_arqueo_cierre
        ? {
            id_arqueo_caja: toNumber(resumen.ultimo_arqueo_cierre.id_arqueo_caja, 0) || null,
            monto_contado: toNumber(resumen.ultimo_arqueo_cierre.monto_contado, 0),
            diferencia: toNumber(resumen.ultimo_arqueo_cierre.diferencia, 0),
            fecha_arqueo: resumen.ultimo_arqueo_cierre.fecha_arqueo ?? null
          }
        : null,
      total_responsable: toNumber(resumen.total_responsable, 0),
      total_auxiliares: toNumber(resumen.total_auxiliares, 0),
      total_otros_ejecutores: toNumber(resumen.total_otros_ejecutores, 0),
      monto_teorico: toNumber(resumen.monto_teorico ?? resumen.efectivo_teorico, 0),
      monto_declarado: toNumber(resumen.monto_declarado ?? resumen.monto_declarado_cierre, 0),
      responsabilidad_final_id_usuario: toNumber(resumen.responsabilidad_final_id_usuario, 0) || null
    },
    arqueos: arqueos.map((row) => ({
      ...row,
      id_arqueo_caja: toNumber(row.id_arqueo_caja, 0) || null,
      monto_teorico: toNumber(row.monto_teorico, 0),
      monto_contado: toNumber(row.monto_contado, 0),
      diferencia: toNumber(row.diferencia, 0),
      tipo_codigo: String(row.tipo_codigo ?? '').trim().toUpperCase(),
      tipo_nombre: String(row.tipo_nombre ?? '').trim()
    })),
    movimientos: movimientos.map((row) => ({
      ...row,
      id_movimiento_caja: toNumber(row.id_movimiento_caja, 0) || null,
      id_sesion_caja: toNumber(row.id_sesion_caja, 0) || null,
      id_usuario_ejecutor: toNumber(row.id_usuario_ejecutor, 0) || null,
      monto: toNumber(row.monto, 0),
      signo: row.signo === null || row.signo === undefined ? null : toNumber(row.signo, 0),
      afecta_efectivo: truthy(row.afecta_efectivo),
      tipo_codigo: String(row.tipo_codigo ?? '').trim().toUpperCase(),
      tipo_nombre: String(row.tipo_nombre ?? '').trim(),
      usuario_ejecutor_nombre: String(row.usuario_ejecutor_nombre ?? row.nombre_completo ?? '').trim(),
      usuario_ejecutor_alias: String(row.usuario_ejecutor_alias ?? row.nombre_usuario ?? '').trim(),
      nombre_usuario: String(row.nombre_usuario ?? row.usuario_ejecutor_alias ?? '').trim(),
      rol_participacion_codigo: String(row.rol_participacion_codigo ?? '').trim().toUpperCase(),
      rol_participacion_nombre: String(row.rol_participacion_nombre ?? '').trim(),
      referencia: String(row.referencia ?? '').trim(),
      observacion: String(row.observacion ?? '').trim(),
      fecha_movimiento: row.fecha_movimiento ?? null,
      fecha_creacion: row.fecha_creacion ?? null
    })),
    recuentos: recuentos.map(normalizeCierreRecuento),
    validaciones_cierre: recuentos.map(normalizeCierreRecuento),
    incidencias: [],
    cierre: payload.cierre
      ? {
          ...payload.cierre,
          id_cierre_caja: toNumber(payload.cierre.id_cierre_caja, 0) || null,
          monto_teorico_cierre: toNumber(payload.cierre.monto_teorico_cierre, 0),
          monto_declarado_cierre: toNumber(payload.cierre.monto_declarado_cierre, 0),
          diferencia: toNumber(payload.cierre.diferencia, 0),
          resolucion_codigo: String(payload.cierre.resolucion_codigo ?? '').trim().toUpperCase(),
          resolucion_nombre: String(payload.cierre.resolucion_nombre ?? '').trim(),
          correo_estado: String(payload.cierre.correo_estado ?? payload.cierre.notificacion_correo?.estado ?? '').trim().toUpperCase(),
          notificacion_correo: normalizeCierreNotificacionCorreo(payload.cierre.notificacion_correo)
        }
      : null
  };
};

export const matchesCajaSession = (session, searchTerm) => {
  const raw = String(searchTerm || '').trim().toLowerCase();
  if (!raw) return true;

  const stack = [
    session.codigo_caja,
    session.nombre_caja,
    session.nombre_sucursal,
    session.responsable_nombre,
    session.responsable_usuario,
    session.estado_nombre,
    session.estado_codigo,
    `SES-${String(session.id_sesion_caja || '').padStart(5, '0')}`
  ];

  return stack.some((value) => String(value ?? '').toLowerCase().includes(raw));
};

export const matchesCajaClosure = (closure, searchTerm) => {
  const raw = String(searchTerm || '').trim().toLowerCase();
  if (!raw) return true;

  const stack = [
    closure.codigo_caja,
    closure.nombre_caja,
    closure.nombre_sucursal,
    closure.responsable_nombre,
    closure.responsable_usuario,
    closure.usuario_cierre_nombre,
    closure.usuario_cierre,
    closure.resolucion_nombre,
    closure.resolucion_codigo,
    `CIE-${String(closure.id_cierre_caja || '').padStart(5, '0')}`,
    `SES-${String(closure.id_sesion_caja || '').padStart(5, '0')}`
  ];

  return stack.some((value) => String(value ?? '').toLowerCase().includes(raw));
};

export const buildCierresStats = ({ sesiones = [], sesionActiva = null } = {}) => {
  const totalSesiones = sesiones.length;
  const abiertas = sesiones.filter((session) => session.estado_codigo === 'ABIERTA').length;
  const cerradas = sesiones.filter((session) => session.estado_codigo !== 'ABIERTA').length;
  const efectivoTeoricoVisible = sesiones.reduce(
    (sum, session) => sum + toNumber(session.efectivo_teorico, 0),
    0
  );
  const diferenciaAcumulada = sesiones.reduce(
    (sum, session) => sum + toNumber(session.diferencia_cierre, 0),
    0
  );

  return {
    totalSesiones,
    abiertas,
    cerradas,
    efectivoTeoricoVisible,
    diferenciaAcumulada,
    sesionActivaAbierta: Boolean(sesionActiva?.id_sesion_caja)
  };
};

export const resolveSessionStatusBadge = (session) => {
  const code = String(session?.estado_codigo ?? '').trim().toUpperCase();

  if (code === 'ABIERTA') {
    return {
      label: session?.estado_nombre || 'Abierta',
      className: 'bg-success border-success text-white'
    };
  }

  if (code === 'CERRADA') {
    return {
      label: session?.estado_nombre || 'Cerrada',
      className: 'bg-secondary border-secondary text-white'
    };
  }

  return {
    label: session?.estado_nombre || session?.estado_codigo || 'Sin estado',
    className: 'bg-light border-secondary text-secondary'
  };
};

export const resolveDifferenceBadge = (value) => {
  if (value === null || value === undefined) {
    return {
      label: 'Sin cierre',
      className: 'bg-light border-secondary text-secondary'
    };
  }

  const amount = toNumber(value, 0);
  if (amount === 0) {
    return {
      label: 'Cuadrado',
      className: 'bg-success border-success text-white'
    };
  }

  return {
    label: amount > 0 ? 'Sobrante' : 'Faltante',
    className: amount > 0
      ? 'bg-info-subtle border-info text-info'
      : 'bg-danger border-danger text-white'
  };
};

export const resolveClosureStateBadge = (closure) => {
  if (!closure) {
    return {
      key: 'SIN_CIERRE',
      label: 'Sin cierre',
      className: 'bg-light border-secondary text-secondary',
      severity: 'neutral'
    };
  }

  const rawDifference = closure?.diferencia ?? closure?.diferencia_cierre;
  if (rawDifference === null || rawDifference === undefined) {
    return {
      key: 'SIN_CIERRE',
      label: 'Sin cierre',
      className: 'bg-light border-secondary text-secondary',
      severity: 'neutral'
    };
  }

  const difference = toNumber(rawDifference, 0);
  const resolutionCode = String(closure?.resolucion_codigo || '').trim().toUpperCase();

  if (difference === 0 || resolutionCode === 'CAJA_CUADRA') {
    return {
      key: 'CUADRADO',
      label: 'Cuadrado',
      className: 'bg-success border-success text-white',
      severity: 'success'
    };
  }

  if (resolutionCode === 'DESCUENTO_EMPLEADO') {
    return {
      key: 'RESUELTO',
      label: 'Faltante asignado a empleado',
      className: 'bg-danger border-danger text-white',
      severity: 'critical'
    };
  }

  if (resolutionCode === 'GASTO_EMPRESA') {
    return {
      key: 'RESUELTO',
      label: 'Asumido por empresa',
      className: 'bg-warning border-warning text-dark',
      severity: 'resolved'
    };
  }

  if (resolutionCode === 'PENDIENTE_REVISION') {
    if (difference < 0) {
      return {
        key: 'PENDIENTE',
        label: 'Faltante - pendiente auditoria',
        className: 'bg-danger border-danger text-white',
        severity: 'critical'
      };
    }

    return {
      key: 'PENDIENTE',
      label: difference > 0 ? 'Sobrante - pendiente auditoria' : 'Pendiente auditoria',
      className: difference > 0
        ? 'bg-info-subtle border-info text-info'
        : 'bg-warning border-warning text-dark',
      severity: difference > 0 ? 'info' : 'warning'
    };
  }

  if (difference > 0) {
    return {
      key: 'SOBRANTE',
      label: 'Sobrante',
      className: 'bg-info-subtle border-info text-info',
      severity: 'info'
    };
  }

  return {
    key: 'PENDIENTE',
    label: 'Faltante',
    className: 'bg-danger border-danger text-white',
    severity: 'critical'
  };
};
