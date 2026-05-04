const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
    rol_codigo: String(session.rol_codigo ?? '').trim().toUpperCase()
  };
};

export const normalizeSesion = (row = {}) => ({
  id_sesion_caja: toNumber(row.id_sesion_caja, 0) || null,
  id_caja: toNumber(row.id_caja, 0) || null,
  id_sucursal: toNumber(row.id_sucursal, 0) || null,
  id_usuario_responsable: toNumber(row.id_usuario_responsable, 0) || null,
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
  responsable_usuario: String(row.responsable_usuario ?? '').trim(),
  responsable_nombre: String(row.responsable_nombre ?? '').trim()
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
  usuario_cierre_nombre: String(row.usuario_cierre_nombre ?? '').trim()
});

export const normalizeSesionDetalle = (payload = {}) => {
  const participantes = Array.isArray(payload.participantes) ? payload.participantes : [];
  const cobrosPorUsuario = Array.isArray(payload.cobros_por_usuario) ? payload.cobros_por_usuario : [];
  const arqueos = Array.isArray(payload.arqueos) ? payload.arqueos : [];
  const movimientos = Array.isArray(payload.movimientos) ? payload.movimientos : [];
  const resumen = payload.resumen_operativo ?? {};

  const equipoCaja = participantes.map((row) => ({
    id_participacion_caja: toNumber(row.id_participacion_caja, 0) || null,
    id_usuario: toNumber(row.id_usuario, 0) || null,
    rol_codigo: String(row.rol_codigo ?? '').trim().toUpperCase(),
    rol_participacion: String(row.rol_codigo ?? row.rol_participacion ?? '').trim().toUpperCase(),
    rol_nombre: String(row.rol_nombre ?? '').trim(),
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
    cobros_por_usuario: cobrosPorUsuario.map((row) => ({
      ...row,
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
      monto: toNumber(row.monto, 0),
      tipo_codigo: String(row.tipo_codigo ?? '').trim().toUpperCase(),
      tipo_nombre: String(row.tipo_nombre ?? '').trim()
    })),
    incidencias: [],
    cierre: payload.cierre
      ? {
          ...payload.cierre,
          id_cierre_caja: toNumber(payload.cierre.id_cierre_caja, 0) || null,
          monto_teorico_cierre: toNumber(payload.cierre.monto_teorico_cierre, 0),
          monto_declarado_cierre: toNumber(payload.cierre.monto_declarado_cierre, 0),
          diferencia: toNumber(payload.cierre.diferencia, 0),
          resolucion_codigo: String(payload.cierre.resolucion_codigo ?? '').trim().toUpperCase(),
          resolucion_nombre: String(payload.cierre.resolucion_nombre ?? '').trim()
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
      label: 'Cuadrada',
      className: 'bg-success border-success text-white'
    };
  }

  return {
    label: amount > 0 ? 'Sobrante' : 'Faltante',
    className: amount > 0
      ? 'bg-info border-info text-white'
      : 'bg-danger border-danger text-white'
  };
};

export const resolveClosureStateBadge = (closure) => {
  const difference = toNumber(closure?.diferencia, 0);
  const hasResolution = Boolean(String(closure?.resolucion_nombre || closure?.resolucion_codigo || '').trim());

  if (difference === 0) {
    return {
      key: 'CUADRADO',
      label: 'Cuadrado',
      className: 'bg-success border-success text-white'
    };
  }

  if (hasResolution) {
    return {
      key: 'RESUELTO',
      label: 'Con resolucion',
      className: 'bg-warning border-warning text-dark'
    };
  }

  return {
    key: 'PENDIENTE',
    label: 'Pendiente',
    className: 'bg-danger border-danger text-white'
  };
};
