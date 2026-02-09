import { apiFetch } from './api';

export const personaService = {

  // ==============================
  // PERSONAS
  // ==============================

  getPersonasDetalle: () => apiFetch('/personas-detalle', 'GET'),
  getTelefonos: () => apiFetch('/telefonos', 'GET'),
  getDirecciones: () => apiFetch('/direcciones', 'GET'),
  getCorreos: () => apiFetch('/correos', 'GET'),

  crearPersona: (data) => apiFetch('/personas', 'POST', data),

  actualizarPersonaCampo: (id, campo, valor) =>
    apiFetch('/personas', 'PUT', {
      campo,
      valor,
      id_campo: 'id_persona',
      id_valor: id
    }),

  eliminarPersona: (id) =>
    apiFetch('/personas', 'DELETE', {
      columna_id: 'id_persona',
      valor_id: id
    }),

};
