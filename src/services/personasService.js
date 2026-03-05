import { apiFetch } from './api';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toCleanString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const buildPersonaPayload = (data = {}) => {
  if (!isPlainObject(data)) return {};

  return {
    nombre: toCleanString(data.nombre),
    apellido: toCleanString(data.apellido),
    fecha_nacimiento: toCleanString(data.fecha_nacimiento),
    genero: toCleanString(data.genero),
    dni: toCleanString(data.dni),
    rtn: toCleanString(data.rtn),
    texto_direccion: toCleanString(data.texto_direccion ?? data.direccion),
    texto_telefono: toCleanString(data.texto_telefono ?? data.telefono),
    texto_correo: toCleanString(data.texto_correo ?? data.direccion_correo ?? data.correo),
  };
};

const resolvePersonasListArgs = (pageOrOptions = 1, limitArg = 10, searchArg = '') => {
  if (isPlainObject(pageOrOptions)) {
    const { page = 1, limit = 10, search = '' } = pageOrOptions;
    return { page, limit, search };
  }

  return {
    page: pageOrOptions ?? 1,
    limit: limitArg ?? 10,
    search: searchArg ?? ''
  };
};

export const personaService = {

  // ==============================
  // PERSONAS
  // ==============================

  getPersonas: (pageOrOptions = 1, limitArg = 10, searchArg = '') => {
    const { page, limit, search } = resolvePersonasListArgs(pageOrOptions, limitArg, searchArg);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof search === 'string' && search.trim()) params.set('search', search.trim());
    return apiFetch(`/personas?${params.toString()}`, 'GET');
  },

  // Alias por compatibilidad con modulos existentes
  getPersonasDetalle: (pageOrOptions = 1, limitArg = 10, searchArg = '') =>
    personaService.getPersonas(pageOrOptions, limitArg, searchArg),


  getTelefonos: () => apiFetch('/telefonos', 'GET'),
  getDirecciones: () => apiFetch('/direcciones', 'GET'),
  getCorreos: () => apiFetch('/correos', 'GET'),

  createPersona: (data) => apiFetch('/personas', 'POST', buildPersonaPayload(data)),

  // Alias por compatibilidad con modulos existentes
  crearPersona: (data) => apiFetch('/personas', 'POST', buildPersonaPayload(data)),

  updatePersona: (id, data) =>
    apiFetch(`/personas/${id}`, 'PUT', buildPersonaPayload(data)),

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

  // ==============================
  // USUARIOS (SUBMODULO PERSONAS)
  // ==============================
  getRolesUsuariosV2: () =>
    apiFetch('/usuarios/v2/roles', 'GET'),

  getUsuariosV2: ({ page = 1, limit = 10, q = '' } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof q === 'string' && q.trim()) params.set('q', q.trim());
    return apiFetch(`/usuarios/v2/list?${params.toString()}`, 'GET');
  },

  createUsuarioV2: (payload) =>
    apiFetch('/usuarios/v2/create', 'POST', payload),

  updateUsuarioV2: (id, payload) =>
    apiFetch(`/usuarios/v2/update/${id}`, 'PUT', payload),

  updateUsuarioFotoV2: (id, payload) =>
    apiFetch(`/usuarios/v2/photo/${id}`, 'PUT', payload),

  deleteUsuarioV2: (id) =>
    apiFetch(`/usuarios/v2/delete/${id}`, 'DELETE'),

  changePasswordUsuarioV2: (payload) =>
    apiFetch('/usuarios/v2/change-password', 'POST', payload),

  generateUsuarioCredencialesV2: (payload) =>
    apiFetch('/usuarios/v2/generate', 'POST', payload),

  resetPasswordUsuarioV2: (id) =>
    apiFetch(`/usuarios/v2/reset-password/${id}`, 'POST'),
};

