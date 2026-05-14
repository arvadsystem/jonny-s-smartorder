import { apiFetch } from './api';

// Endpoint base del módulo administrativo de recetas.
const BASE_ENDPOINT = '/api/admin/recetas';
const MENU_PUBLIC_BUCKET = 'jonnys-assets';

const recetasAdminService = {
  // Lista todas las recetas administrativas.
  listarRecetasAdmin: async () => apiFetch(BASE_ENDPOINT, 'GET', null, { noCache: true }),

  // Obtiene el detalle de una receta por ID.
  obtenerRecetaAdmin: async (id) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'GET', null, { noCache: true }),

  // Catalogo de insumos activos para armar detalle de receta.
  listarInsumosDetalleReceta: async () =>
    apiFetch(`${BASE_ENDPOINT}/catalogos/insumos`, 'GET', null, { noCache: true }),

  // Obtiene los insumos/cantidades que componen una receta.
  obtenerDetalleReceta: async (id) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/detalle`, 'GET', null, { noCache: true }),

  // Reemplaza el detalle de insumos de una receta.
  guardarDetalleReceta: async (id, detalleReceta) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/detalle`, 'PUT', { detalle_receta: detalleReceta }),

  // Crea una receta nueva.
  crearRecetaAdmin: async (data) => apiFetch(BASE_ENDPOINT, 'POST', data),

  // Actualiza una receta existente por ID.
  actualizarRecetaAdmin: async (id, data) => apiFetch(`${BASE_ENDPOINT}/${id}`, 'PUT', data),

  // Registra un archivo para receta y retorna su id_archivo.
  registrarArchivoReceta: async (data) => {
    const hasPublicUrl = String(data?.url_publica || '').trim().length > 0;
    const hasBinaryPayload =
      Boolean(data?.data_url) ||
      Boolean(data?.dataUrl) ||
      Boolean(data?.base64) ||
      Boolean(data?.archivo);

    // Para flujo por URL publica usamos endpoint URL-based de menu_pos.
    // El bucket queda explicito para mantener menu como contenido publico.
    if (hasPublicUrl && !hasBinaryPayload) {
      return apiFetch('/menu-pos/archivos/upload', 'POST', {
        ...data,
        bucket: MENU_PUBLIC_BUCKET
      });
    }

    try {
      return await apiFetch('/archivos', 'POST', data);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('la imagen es obligatoria')) {
        // Fallback para entornos donde /archivos solo acepta base64 y el alta por URL vive en menu-pos.
        return apiFetch('/menu-pos/archivos/upload', 'POST', {
          ...data,
          bucket: MENU_PUBLIC_BUCKET
        });
      }
      throw error;
    }
  },

  // Cambia el estado de una receta por ID.
  cambiarEstadoRecetaAdmin: async (id, data) =>
    apiFetch(`${BASE_ENDPOINT}/${id}/estado`, 'PATCH', data)
};

export default recetasAdminService;
