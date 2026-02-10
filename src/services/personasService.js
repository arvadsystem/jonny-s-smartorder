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
  apiFetch(`/personas/${id}`, 'PUT', {
    campo,
    valor
  }),


  eliminarPersona: (id) =>
    apiFetch(`/personas/${id}`, 'DELETE'),

};
