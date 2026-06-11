import { apiFetch } from './api';

// Endpoint base del módulo administrativo de recetas.
const BASE_ENDPOINT = '/api/admin/recetas';

const recetasAdminService = {
  // Lista todas las recetas administrativas.
  listarRecetasAdmin: async () =>
    apiFetch(`${BASE_ENDPOINT}?incluir_inactivos=1`, 'GET', null, { noCache: true }),

  // Obtiene el detalle de una receta por ID.
  obtenerRecetaAdmin: async (id) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'GET', null, { noCache: true }),

  // Catalogo de insumos activos para armar detalle de receta.
  listarInsumosDetalleReceta: async () =>
    apiFetch(`${BASE_ENDPOINT}/catalogos/insumos`, 'GET', null, { noCache: true }),

  // Obtiene los insumos/cantidades que componen una receta.
  obtenerDetalleReceta: async (id) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/detalle`, 'GET', null, { noCache: true }),

  // Contexto optimizado para edicion (receta + detalle + catalogos del modal).
  obtenerContextoEdicionReceta: async (id) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/contexto-edicion`, 'GET', null, { noCache: true }),

  // Crea una receta nueva.
  crearRecetaAdmin: async (data) => apiFetch(BASE_ENDPOINT, 'POST', data),

  // Actualiza una receta existente por ID.
  actualizarRecetaAdmin: async (id, data) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', data),

  // Registra un archivo para receta y retorna su id_archivo.
  registrarArchivoReceta: async (data) => {
    const hasDataUrl = String(data?.data_url || data?.dataUrl || '').trim().length > 0;
    if (!hasDataUrl) {
      throw new Error('Recetas solo permite imagenes locales subidas desde archivo.');
    }

    return apiFetch('/archivos', 'POST', data);
  },

  // Limpia un archivo temporal de receta usando el endpoint compensatorio existente.
  eliminarArchivoReceta: async (idArchivo) => {
    const parsedId = Number.parseInt(String(idArchivo ?? ''), 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return apiFetch(`/archivos/${parsedId}`, 'DELETE');
  },

  // Cambia el estado de una receta por ID.
  cambiarEstadoRecetaAdmin: async (id, data) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', data)
};

export default recetasAdminService;
