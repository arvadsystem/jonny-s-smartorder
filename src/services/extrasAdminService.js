import { apiFetch } from './api';

const BASE_ENDPOINT = '/api/admin/extras';

const extrasAdminService = {
  listarExtras: async () => apiFetch(BASE_ENDPOINT, 'GET', null, { noCache: true }),
  obtenerExtra: async (id) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'GET', null, { noCache: true }),
  crearExtra: async (payload) => apiFetch(BASE_ENDPOINT, 'POST', payload),
  actualizarExtra: async (id, payload) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', payload),
  cambiarEstadoExtra: async (id, estado) => apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', { estado }),
  listarInsumos: async () => apiFetch(`${BASE_ENDPOINT}/catalogos/insumos`, 'GET', null, { noCache: true }),
  listarRecetas: async () => apiFetch(`${BASE_ENDPOINT}/catalogos/recetas`, 'GET', null, { noCache: true })
};

export default extrasAdminService;
