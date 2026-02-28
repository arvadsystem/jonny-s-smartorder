import { apiFetch } from './api';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const personaService = {

  // ==============================
  // PERSONAS
  // ==============================

  getPersonasDetalle: (page = 1, limit = 10) =>
  apiFetch(`/personas-detalle?page=${page}&limit=${limit}`, 'GET'),


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

  // ==============================
  // EMPRESAS (SUBMODULO PERSONAS)
  // ==============================
  getEmpresas: ({ page = 1, limit = 10, nombre, estado } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof nombre === 'string' && nombre.trim()) params.set('nombre', nombre.trim());
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    return apiFetch(`/empresas?${params.toString()}`, 'GET');
  },

  getEmpresaById: (id) =>
    apiFetch(`/empresas/${id}`, 'GET'),

  createEmpresa: (data) =>
    apiFetch('/empresas', 'POST', data),

  updateEmpresa: async (id, updates = {}) => {
    if (isPlainObject(updates) && Object.prototype.hasOwnProperty.call(updates, 'campo')) {
      return apiFetch(`/empresas/${id}`, 'PUT', {
        campo: updates.campo,
        valor: updates.valor
      });
    }

    if (!isPlainObject(updates)) {
      throw new Error('El payload de actualizacion debe ser un objeto');
    }

    const fields = Object.entries(updates).filter(([campo, valor]) => campo && valor !== undefined);
    if (!fields.length) return { error: false, message: 'Sin cambios para actualizar' };

    let result = null;
    for (const [campo, valor] of fields) {
      result = await apiFetch(`/empresas/${id}`, 'PUT', { campo, valor });
    }
    return result;
  },

  deleteEmpresa: (id) =>
    apiFetch(`/empresas/${id}`, 'DELETE'),

  // ==============================
  // EMPLEADOS (SUBMODULO PERSONAS)
  // ==============================
  getEmpleados: async ({ page = 1, limit = 10, nombre, estado } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof nombre === 'string' && nombre.trim()) params.set('nombre', nombre.trim());
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    const query = params.toString();

    try {
      return await apiFetch(`/empleados?${query}`, 'GET');
    } catch (error) {
      if (error?.status === 404) {
        return apiFetch(`/empleados-detalle?${query}`, 'GET');
      }
      throw error;
    }
  },

  createEmpleado: (data) =>
    apiFetch('/empleados', 'POST', data),

  updateEmpleado: async (id, updates = {}) => {
    if (isPlainObject(updates) && Object.prototype.hasOwnProperty.call(updates, 'campo')) {
      return apiFetch(`/empleados/${id}`, 'PUT', {
        campo: updates.campo,
        valor: updates.valor
      });
    }

    if (!isPlainObject(updates)) {
      throw new Error('El payload de actualizacion debe ser un objeto');
    }

    const fields = Object.entries(updates).filter(([campo, valor]) => campo && valor !== undefined);
    if (!fields.length) return { error: false, message: 'Sin cambios para actualizar' };

    let result = null;
    for (const [campo, valor] of fields) {
      result = await apiFetch(`/empleados/${id}`, 'PUT', { campo, valor });
    }
    return result;
  },

  deleteEmpleado: (id) =>
    apiFetch(`/empleados/${id}`, 'DELETE'),

  // ==============================
  // CLIENTES (SUBMODULO PERSONAS)
  // ==============================
  getClientes: async ({ page = 1, limit = 10, nombre, estado } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof nombre === 'string' && nombre.trim()) params.set('nombre', nombre.trim());
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    const query = params.toString();

    try {
      return await apiFetch(`/clientes?${query}`, 'GET');
    } catch (error) {
      if (error?.status === 404) {
        return apiFetch(`/clientes-detalle?${query}`, 'GET');
      }
      throw error;
    }
  },

  createCliente: (data) =>
    apiFetch('/clientes', 'POST', data),

  updateCliente: async (id, updates = {}) => {
    if (isPlainObject(updates) && Object.prototype.hasOwnProperty.call(updates, 'campo')) {
      return apiFetch(`/clientes/${id}`, 'PUT', {
        campo: updates.campo,
        valor: updates.valor
      });
    }

    if (!isPlainObject(updates)) {
      throw new Error('El payload de actualizacion debe ser un objeto');
    }

    const fields = Object.entries(updates).filter(([campo, valor]) => campo && valor !== undefined);
    if (!fields.length) return { error: false, message: 'Sin cambios para actualizar' };

    let result = null;
    for (const [campo, valor] of fields) {
      result = await apiFetch(`/clientes/${id}`, 'PUT', { campo, valor });
    }
    return result;
  },

  deleteCliente: (id) =>
    apiFetch(`/clientes/${id}`, 'DELETE'),

};
