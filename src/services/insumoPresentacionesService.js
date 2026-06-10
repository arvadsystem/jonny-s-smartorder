import { apiFetch } from './api';

const BASE_ENDPOINT = '/api/admin/insumos';

export const insumoPresentacionesService = {
  listar: (idInsumo) =>
    apiFetch(`${BASE_ENDPOINT}/${idInsumo}/presentaciones`, 'GET', null, { noCache: true }),

  crear: (idInsumo, data) =>
    apiFetch(`${BASE_ENDPOINT}/${idInsumo}/presentaciones`, 'POST', data),

  actualizar: (idInsumo, idPresentacion, data) =>
    apiFetch(`${BASE_ENDPOINT}/${idInsumo}/presentaciones/${idPresentacion}`, 'PUT', data),

  cambiarEstado: (idInsumo, idPresentacion, estado) =>
    apiFetch(`${BASE_ENDPOINT}/${idInsumo}/presentaciones/${idPresentacion}/estado`, 'PATCH', { estado })
};
