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

const planillasService = {
  listarPlanillas: ({ page = 1, limit = 10, id_sucursal, periodo, search, estado } = {}) =>
    apiFetch(
      `/planillas${buildQuery({ page, limit, id_sucursal, periodo, search, estado })}`,
      'GET'
    ),

  generarPlanilla: (payload = {}) =>
    apiFetch('/planillas/generar', 'POST', payload),

  recalcularPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/recalcular`, 'POST', payload),

  listarDetallePlanilla: (idPlanilla, { page = 1, limit = 10, search } = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/detalle${buildQuery({ page, limit, search })}`,
      'GET'
    ),

  obtenerResumenPlanilla: (idPlanilla) =>
    apiFetch(`/planillas/${idPlanilla}/resumen`, 'GET'),

  obtenerPlanillaCompleta: (idPlanilla) =>
    apiFetch(`/planillas/${idPlanilla}/completa`, 'GET'),

  actualizarEstadoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/estado`, 'PUT', payload),

  anularPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/anular`, 'POST', payload),

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
    { page = 1, limit = 10, id_detalle } = {}
  ) =>
    apiFetch(
      `/planillas/${idPlanilla}/adelantos-aplicables${buildQuery({ page, limit, id_detalle })}`,
      'GET'
    ),

  aplicarAdelantoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/adelantos/aplicar`, 'POST', payload),

  registrarMovimientoPlanilla: (idPlanilla, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/movimientos`, 'POST', payload),

  listarMovimientosPlanilla: (idPlanilla, { page = 1, limit = 10, id_detalle } = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/movimientos${buildQuery({ page, limit, id_detalle })}`,
      'GET'
    ),

  listarMovimientosPlanillaDetalle: (idPlanilla, idDetalle, { page = 1, limit = 10 } = {}) =>
    apiFetch(
      `/planillas/${idPlanilla}/movimientos/${idDetalle}${buildQuery({ page, limit })}`,
      'GET'
    ),

  anularMovimientoPlanilla: (idMovimiento, payload = {}) =>
    apiFetch(`/planillas/movimientos/${idMovimiento}/anular`, 'POST', payload),

  listarAuditoriaPlanilla: (idPlanilla, { page = 1, limit = 10 } = {}) =>
    apiFetch(`/planillas/${idPlanilla}/auditoria${buildQuery({ page, limit })}`, 'GET'),

  recalcularDetallePlanilla: (idPlanilla, idDetalle, payload = {}) =>
    apiFetch(`/planillas/${idPlanilla}/detalle/${idDetalle}/recalcular`, 'POST', payload)
};

export default planillasService;
