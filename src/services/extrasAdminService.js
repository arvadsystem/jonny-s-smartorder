import { apiFetch } from './api';

const BASE_ENDPOINT = '/api/admin/extras';

const extrasAdminService = {
  listarExtras: async () => apiFetch(`${BASE_ENDPOINT}?incluir_inactivos=1`, 'GET', null, { noCache: true }),
  obtenerExtra: async (id) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'GET', null, { noCache: true }),
  crearExtra: async (payload) => apiFetch(BASE_ENDPOINT, 'POST', payload),
  actualizarExtra: async (id, payload) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', payload),
  cambiarEstadoExtra: async (id, estado) => apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', { estado }),
  listarAlmacenesExtras: async () => apiFetch(`${BASE_ENDPOINT}/catalogos/almacenes`, 'GET', null, { noCache: true }),
  listarInsumos: async () => apiFetch(`${BASE_ENDPOINT}/catalogos/insumos`, 'GET', null, { noCache: true }),
  listarRecetas: async () => apiFetch(`${BASE_ENDPOINT}/catalogos/recetas`, 'GET', null, { noCache: true }),
  obtenerAsignacionesExtra: async (idExtra) => apiFetch(`${BASE_ENDPOINT}/${idExtra}/asignaciones`, 'GET', null, { noCache: true }),
  reemplazarAsignacionesExtra: async (idExtra, idAlmacenes) => apiFetch(`${BASE_ENDPOINT}/${idExtra}/asignaciones`, 'PUT', {
    id_almacenes: Array.isArray(idAlmacenes) ? idAlmacenes : []
  }),
  asignarExtraAlmacen: async (idExtra, idAlmacen) => apiFetch(`${BASE_ENDPOINT}/${idExtra}/asignaciones`, 'POST', {
    id_almacen: idAlmacen
  }),
  inactivarAsignacionExtra: async (idExtra, idAlmacen) => apiFetch(`${BASE_ENDPOINT}/${idExtra}/asignaciones/${idAlmacen}/inactivar`, 'PATCH', {})
};

export default extrasAdminService;
