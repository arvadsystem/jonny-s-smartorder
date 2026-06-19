import { apiFetch } from './api';

export const parametrosService = {
  /**
   * Listar un catálogo específico (ej: tipo_cliente, unidades_medida).
   * @param {string} catalogo Nombre del catálogo en BD.
   * @returns {Promise<any>}
   */
  listarCatalogo: (catalogo) => apiFetch(`/parametros/catalogos/${catalogo}`, 'GET'),

  /**
   * Obtener un parámetro global del sistema por su clave.
   * @param {string} clave
   * @returns {Promise<any>}
   */
  getParametro: (clave) => apiFetch(`/parametros/${clave}`, 'GET'),
};
