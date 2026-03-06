import { apiFetch } from './api';

// Endpoint base del módulo administrativo de recetas.
const BASE_ENDPOINT = '/api/admin/recetas';

const recetasAdminService = {
  // Lista todas las recetas administrativas.
  listarRecetasAdmin: async () => apiFetch(BASE_ENDPOINT, 'GET'),

  // Obtiene el detalle de una receta por ID.
  obtenerRecetaAdmin: async (id) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'GET'),

  // Crea una receta nueva.
  crearRecetaAdmin: async (data) => apiFetch(BASE_ENDPOINT, 'POST', data),

  // Actualiza una receta existente por ID.
  actualizarRecetaAdmin: async (id, data) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', data),

  // Cambia el estado de una receta por ID.
  cambiarEstadoRecetaAdmin: async (id, data) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', data)
};

export default recetasAdminService;
