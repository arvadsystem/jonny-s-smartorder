import { apiFetch } from './api';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const pickAllowedFields = (payload, allowedFields = []) => {
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return Object.fromEntries(
    Object.entries(safePayload).filter(([key, value]) => allowedFields.includes(key) && value !== undefined)
  );
};

const planillasService = {
  listarPlanillas: ({ page = 1, limit = 10, id_sucursal, periodo, search, estado, tipo_periodo, quincena } = {}) =>
    apiFetch(
      `/planillas${buildQuery({ page, limit, id_sucursal, periodo, search, estado, tipo_periodo, quincena })}`,
      'GET',
      null,
      { noCache: true }
    ),

  generarPlanilla: (payload = {}) =>
    apiFetch(
      '/planillas/generar',
      'POST',
      pickAllowedFields(payload, [
        'id_sucursal',
        'periodo',
        'id_estado_planilla',
        'dias_laborados',
        'horas_laboradas',
        'tipo_periodo',
        'quincena'
      ])
    ),

  recalcularPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/recalcular`,
      'POST',
      pickAllowedFields(payload, ['id_sucursal'])
    ),

  listarDetallePlanilla: (
    idPlanilla,
    { page = 1, limit = 10, search, id_sucursal, tipo_periodo, quincena } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/detalle${buildQuery({
        page,
        limit,
        search,
        id_sucursal,
        tipo_periodo,
        quincena
      })}`,
      'GET',
      null,
      { noCache: true }
    ),

  obtenerResumenPlanilla: (idPlanilla, { id_sucursal, tipo_periodo, quincena } = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/resumen${buildQuery({ id_sucursal, tipo_periodo, quincena })}`,
      'GET',
      null,
      { noCache: true }
    ),

  obtenerPlanillaCompleta: (idPlanilla, { id_sucursal, tipo_periodo, quincena } = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/completa${buildQuery({ id_sucursal, tipo_periodo, quincena })}`,
      'GET'
    ),

  listarHorasExtraPlanilla: (
    idPlanilla,
    { page = 1, limit = 10, id_empleado, estado, id_sucursal, tipo_periodo, quincena } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/horas-extra${buildQuery({
        page,
        limit,
        id_empleado,
        estado,
        id_sucursal,
        tipo_periodo,
        quincena
      })}`,
      'GET'
    ),

  registrarHoraExtraPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/horas-extra/registrar`,
      'POST',
      pickAllowedFields(payload, [
        'id_empleado',
        'fecha',
        'horas',
        'observacion',
        'id_sucursal',
        'id_tipo_hora',
        'id_factor_horas_extras',
        'tarifa_base',
        'tipo_periodo',
        'quincena'
      ])
    ),

  compensarHoraExtraPlanilla: (idPlanilla, idHorasExtra, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/horas-extra/${idHorasExtra}/compensar`,
      'POST',
      pickAllowedFields(payload, ['observacion', 'id_sucursal', 'tipo_periodo', 'quincena'])
    ),

  actualizarHoraExtraPlanilla: (idPlanilla, idHorasExtra, payload = {}) => {
    const body = pickAllowedFields(payload, [
      'id_empleado',
      'fecha',
      'horas',
      'observacion',
      'id_sucursal'
    ]);

    return apiFetch(`/planillas/${idPlanilla}/horas-extra/${idHorasExtra}/actualizar`, 'POST', body);
  },

  anularHoraExtraPlanilla: (idPlanilla, idHorasExtra, payload = {}) => {
    const body = pickAllowedFields(payload, ['motivo', 'observacion', 'id_sucursal']);

    return apiFetch(`/planillas/${idPlanilla}/horas-extra/${idHorasExtra}/anular`, 'POST', body);
  },

  actualizarEstadoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/estado`,
      'PUT',
      pickAllowedFields(payload, [
        'id_estado_planilla',
        'id_estado',
        'estado',
        'recalcular',
        'id_sucursal',
        'tipo_periodo',
        'quincena',
        'usuario_accion'
      ])
    ),

  anularPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/anular`,
      'POST',
      pickAllowedFields(payload, ['usuario_accion', 'motivo', 'id_sucursal'])
    ),

  listarEmpleadosActivosSucursal: (idSucursal, { page = 1, limit = 10, search } = {}) =>
    apiFetch(
      `/planillas/sucursales/${idSucursal}/empleados-activos${buildQuery({ page, limit, search })}`,
      'GET'
    ),

  listarAdelantosPendientesSucursal: (
    idSucursal,
    { page = 1, limit = 10, search, periodo } = {}
  ) =>
    apiFetch(
      `/planillas/sucursales/${idSucursal}/adelantos-pendientes${buildQuery({
        page,
        limit,
        search,
        periodo
      })}`,
      'GET'
    ),

  listarAdelantosAplicablesPlanilla: (
    idPlanilla,
    { page = 1, limit = 10, id_detalle, id_sucursal } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos-aplicables${buildQuery({
        page,
        limit,
        id_detalle,
        id_sucursal
      })}`,
      'GET'
    ),

  registrarAdelantoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos/registrar`,
      'POST',
      pickAllowedFields(payload, ['id_empleado', 'fecha', 'monto', 'id_sucursal'])
    ),

  aplicarAdelantoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos/aplicar`,
      'POST',
      pickAllowedFields(payload, [
        'id_adelanto',
        'id_adelanto_salario',
        'monto_aplicar',
        'monto',
        'id_sucursal',
        'tipo_periodo',
        'quincena'
      ])
    ),

  actualizarAdelantoPlanilla: (idPlanilla, idAdelanto, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos/${idAdelanto}/actualizar`,
      'POST',
      pickAllowedFields(payload, ['id_empleado', 'fecha', 'monto', 'observacion', 'motivo', 'id_sucursal'])
    ),

  anularAdelantoPlanilla: (idPlanilla, idAdelanto, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos/${idAdelanto}/anular`,
      'POST',
      pickAllowedFields(payload, ['motivo', 'observacion', 'id_sucursal'])
    ),

  registrarMovimientoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/movimientos`,
      'POST',
      pickAllowedFields(payload, [
        'id_detalle',
        'id_detalle_planilla',
        'tipo',
        'tipo_movimiento',
        'concepto',
        'monto',
        'observacion',
        'id_sucursal',
        'tipo_periodo',
        'quincena'
      ])
    ),

  listarMovimientosPlanilla: (
    idPlanilla,
    { page = 1, limit = 10, id_detalle, id_sucursal, tipo_periodo, quincena } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/movimientos${buildQuery({
        page,
        limit,
        id_detalle,
        id_sucursal,
        tipo_periodo,
        quincena
      })}`,
      'GET'
    ),

  listarMovimientosPlanillaDetalle: (
    idPlanilla,
    idDetalle,
    { page = 1, limit = 10, id_sucursal, tipo_periodo, quincena } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/movimientos/${idDetalle}${buildQuery({
        page,
        limit,
        id_sucursal,
        tipo_periodo,
        quincena
      })}`,
      'GET'
    ),

  anularMovimientoPlanilla: (idMovimiento, payload = {}) =>
    apiFetch(
      `/planillas/movimientos/${idMovimiento}/anular`,
      'POST',
      pickAllowedFields(payload, ['usuario_accion', 'motivo', 'id_planilla', 'id_sucursal'])
    ),

  listarAuditoriaPlanilla: (idPlanilla, { page = 1, limit = 10, id_sucursal } = {}) =>
    apiFetch(`/planillas/${idPlanilla}/auditoria${buildQuery({ page, limit, id_sucursal })}`, 'GET'),

  recalcularDetallePlanilla: (idPlanilla, idDetalle, payload = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/detalle/${idDetalle}/recalcular`,
      'POST',
      pickAllowedFields(payload, ['id_sucursal'])
    )
};

export default planillasService;
