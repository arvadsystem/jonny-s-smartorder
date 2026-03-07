import { apiFetch } from './api';

// Endpoint base del módulo administrativo de recetas.
const BASE_ENDPOINT = '/api/admin/recetas';
const withNoCacheParam = (endpoint) => `${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`;

const recetasAdminService = {
  // Lista todas las recetas administrativas.
  listarRecetasAdmin: async () => apiFetch(withNoCacheParam(BASE_ENDPOINT), 'GET'),

  // Obtiene el detalle de una receta por ID.
  obtenerRecetaAdmin: async (id) => apiFetch(withNoCacheParam(`${BASE_ENDPOINT}/${id}`), 'GET'),

  // Crea una receta nueva.
  crearRecetaAdmin: async (data) => apiFetch(BASE_ENDPOINT, 'POST', data),

  // Actualiza una receta existente por ID.
  actualizarRecetaAdmin: async (id, data) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', data),

  // Registra un archivo para receta y retorna su id_archivo.
  registrarArchivoReceta: async (data) => {
    try {
      return await apiFetch('/archivos', 'POST', data);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('la imagen es obligatoria')) {
        // Fallback para entornos donde /archivos solo acepta base64 y el alta por URL vive en menu-pos.
        return apiFetch('/menu-pos/archivos/upload', 'POST', data);
      }
      throw error;
    }
  },

  // Cambia el estado de una receta por ID.
  cambiarEstadoRecetaAdmin: async (id, data) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', data)
};

export default recetasAdminService;
