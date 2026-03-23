import { apiFetch } from './api';

const BASE_ENDPOINT = '/api/admin/combos';

const toRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

const combosAdminService = {
  listarCombosAdmin: async () => apiFetch(BASE_ENDPOINT, 'GET', null, { noCache: true }),

  obtenerComboAdmin: async (idCombo) =>
    apiFetch(`${BASE_ENDPOINT}/${idCombo}`, 'GET', null, { noCache: true }),

  crearComboAdmin: async (payload) => apiFetch(BASE_ENDPOINT, 'POST', payload),

  actualizarComboAdmin: async (idCombo, payload) =>
    apiFetch(`${BASE_ENDPOINT}/${idCombo}`, 'PUT', payload),

  cambiarEstadoComboAdmin: async (idCombo, payload) =>
    apiFetch(`${BASE_ENDPOINT}/${idCombo}/estado`, 'PATCH', payload),

  // Carga recetas para el detalle de combo.
  // Fallback: si el endpoint dedicado viene vacio/falla, usa el listado admin de recetas.
  listarRecetasCatalogoCombos: async () => {
    try {
      const response = await apiFetch(`${BASE_ENDPOINT}/catalogos/recetas`, 'GET', null, { noCache: true });
      const rows = toRows(response);
      if (rows.length > 0) return rows;
    } catch {
      // El fallback se maneja abajo para no bloquear el formulario de combos.
    }

    return apiFetch('/api/admin/recetas', 'GET', null, { noCache: true });
  },

  agregarDetalleCombo: async (idCombo, payload) =>
    apiFetch(`${BASE_ENDPOINT}/${idCombo}/detalle`, 'POST', payload),

  desactivarDetalleCombo: async (idCombo, idDetalleCombo) =>
    apiFetch(`${BASE_ENDPOINT}/${idCombo}/detalle/${idDetalleCombo}`, 'DELETE'),

  registrarArchivoCombo: async (payload) => {
    const hasPublicUrl = String(payload?.url_publica || '').trim().length > 0;
    const hasBinaryPayload =
      Boolean(payload?.data_url) ||
      Boolean(payload?.dataUrl) ||
      Boolean(payload?.base64) ||
      Boolean(payload?.archivo);

    // Flujo de combos: cuando viene URL publica, se usa endpoint URL-based de menu_pos.
    if (hasPublicUrl && !hasBinaryPayload) {
      return apiFetch('/menu-pos/archivos/upload', 'POST', payload);
    }

    try {
      return await apiFetch('/archivos', 'POST', payload);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('la imagen es obligatoria')) {
        return apiFetch('/menu-pos/archivos/upload', 'POST', payload);
      }
      throw error;
    }
  }
};

export default combosAdminService;
