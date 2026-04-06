import { apiFetch } from './api';
import { API_URL } from '../utils/constants';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toCleanString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toNullableCleanString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const pickAllowedFields = (payload, allowedFields = []) => {
  if (!isPlainObject(payload)) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([field, value]) => allowedFields.includes(field) && value !== undefined)
  );
};

const applyRbacContextToPayload = (payload, context) => {
  const normalizedContext = toCleanString(context).toLowerCase();
  if (!normalizedContext) return payload;
  return {
    ...(isPlainObject(payload) ? payload : {}),
    rbac_context: normalizedContext
  };
};

const buildPersonaPayload = (data = {}, options = {}) => {
  if (!isPlainObject(data)) return {};
  const { nullableOptionals = false } = options;

  return {
    nombre: toCleanString(data.nombre),
    apellido: toCleanString(data.apellido),
    fecha_nacimiento: toCleanString(data.fecha_nacimiento),
    genero: toCleanString(data.genero),
    dni: toCleanString(data.dni),
    rtn: toCleanString(data.rtn),
    texto_direccion: nullableOptionals
      ? toNullableCleanString(data.texto_direccion ?? data.direccion)
      : toCleanString(data.texto_direccion ?? data.direccion),
    texto_telefono: nullableOptionals
      ? toNullableCleanString(data.texto_telefono ?? data.telefono)
      : toCleanString(data.texto_telefono ?? data.telefono),
    texto_correo: nullableOptionals
      ? toNullableCleanString(data.texto_correo ?? data.direccion_correo ?? data.correo)
      : toCleanString(data.texto_correo ?? data.direccion_correo ?? data.correo),
  };
};

const resolvePersonasListArgs = (
  pageOrOptions = 1,
  limitArg = 10,
  searchArg = '',
  requestOptions = {}
) => {
  if (isPlainObject(pageOrOptions)) {
    const {
      page = 1,
      limit = 10,
      search = '',
      sort = '',
      genero = '',
      estado,
      suggest = false,
      signal
    } = pageOrOptions;
    return {
      page,
      limit,
      search,
      sort,
      genero,
      estado,
      suggest,
      signal: signal ?? requestOptions?.signal ?? null
    };
  }

  return {
    page: pageOrOptions ?? 1,
    limit: limitArg ?? 10,
    search: searchArg ?? '',
    sort: requestOptions?.sort ?? '',
    genero: requestOptions?.genero ?? '',
    estado: requestOptions?.estado,
    suggest: requestOptions?.suggest ?? false,
    signal: requestOptions?.signal ?? null
  };
};

const readResponseBody = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getErrorMessage = (payload, fallback) => {
  const technicalPatterns = [
    /function\s+[\w.]+\s*\(/i,
    /relation\s+["'\w.]+\s+does not exist/i,
    /column\s+["'\w.]+\s+does not exist/i,
    /duplicate key value violates/i,
    /violates (foreign key|unique|check|not-null)/i,
    /syntax error at or near/i,
    /pg_/i
  ];
  const toSafe = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return fallback;
    if (technicalPatterns.some((pattern) => pattern.test(text))) return fallback;
    return text;
  };

  if (payload && typeof payload === 'object') {
    return toSafe(payload.message || payload.mensaje || fallback);
  }
  if (typeof payload === 'string' && payload.trim()) return toSafe(payload);
  return fallback;
};

const fetchGetWithSignal = async (endpoint, signal) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    signal
  });

  const payload = await readResponseBody(response);

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    throw new Error(getErrorMessage(payload, 'No autorizado'));
  }

  if (response.status === 403) {
    throw new Error(getErrorMessage(payload, 'Acceso denegado'));
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Error HTTP: ${response.status}`));
  }

  if (response.status === 204) return null;
  return payload;
};

export const personaService = {

  // ==============================
  // PERSONAS
  // ==============================

  getPersonas: (pageOrOptions = 1, limitArg = 10, searchArg = '', requestOptions = {}) => {
    const { page, limit, search, sort, genero, estado, suggest, signal } = resolvePersonasListArgs(
      pageOrOptions,
      limitArg,
      searchArg,
      requestOptions
    );
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (typeof search === 'string' && search.trim()) params.set('search', search.trim());
    if (typeof sort === 'string' && sort.trim()) params.set('sort', sort.trim());
    if (typeof genero === 'string' && genero.trim() && genero.trim().toLowerCase() !== 'todos') {
      params.set('genero', genero.trim());
    }
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    if (suggest) params.set('suggest', '1');
    const endpoint = `/personas?${params.toString()}`;
    if (signal) return fetchGetWithSignal(endpoint, signal);
    return apiFetch(endpoint, 'GET');
  },

  getPersonaSuggestions: ({
    search = '',
    limit = 8,
    sort = 'relevancia',
    genero = '',
    estado,
    signal
  } = {}) =>
    personaService.getPersonas({
      page: 1,
      limit,
      search,
      sort,
      genero,
      estado,
      suggest: true,
      signal
    }),

  // Alias por compatibilidad con modulos existentes
  getPersonasDetalle: (pageOrOptions = 1, limitArg = 10, searchArg = '') =>
    personaService.getPersonas(pageOrOptions, limitArg, searchArg),


  getTelefonos: () => apiFetch('/telefonos', 'GET'),
  getDirecciones: () => apiFetch('/direcciones', 'GET'),
  getCorreos: () => apiFetch('/correos', 'GET'),

  createPersona: (data, options = {}) =>
    apiFetch(
      '/personas',
      'POST',
      applyRbacContextToPayload(buildPersonaPayload(data), options?.context)
    ),

  // Alias por compatibilidad con modulos existentes
  crearPersona: (data, options = {}) =>
    apiFetch(
      '/personas',
      'POST',
      applyRbacContextToPayload(buildPersonaPayload(data), options?.context)
    ),

  updatePersona: (id, data) =>
    apiFetch(`/personas/${id}`, 'PUT', buildPersonaPayload(data, { nullableOptionals: true })),

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
  getEmpresas: ({ page = 1, limit = 10, nombre, search, estado, signal } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    const normalizedSearch = typeof search === 'string' && search.trim()
      ? search.trim()
      : (typeof nombre === 'string' ? nombre.trim() : '');
    if (normalizedSearch) params.set('nombre', normalizedSearch);
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    const endpoint = `/empresas?${params.toString()}`;
    if (signal) return fetchGetWithSignal(endpoint, signal);
    return apiFetch(endpoint, 'GET');
  },

  getEmpresaById: (id) =>
    apiFetch(`/empresas/${id}`, 'GET'),

  createEmpresa: (data, options = {}) =>
    apiFetch(
      '/empresas',
      'POST',
      applyRbacContextToPayload(
        pickAllowedFields(data, [
          'rtn',
          'nombre_empresa',
          'texto_direccion',
          'texto_telefono',
          'texto_correo',
          'estado'
        ]),
        options?.context
      )
    ),

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

    const payload = pickAllowedFields(updates, [
      'rtn',
      'nombre_empresa',
      'id_telefono',
      'id_direccion',
      'id_correo',
      'texto_direccion',
      'texto_telefono',
      'texto_correo',
      'estado'
    ]);
    if (!Object.keys(payload).length) return { error: false, message: 'Sin cambios para actualizar' };
    return apiFetch(`/empresas/${id}`, 'PUT', payload);
  },

  deleteEmpresa: (id) =>
    apiFetch(`/empresas/${id}`, 'DELETE'),

  // ==============================
  // EMPLEADOS (SUBMODULO PERSONAS)
  // ==============================
  getEmpleados: async ({ page = 1, limit = 10, nombre, search, q, estado, id_sucursal } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    const normalizedSearch = typeof search === 'string' && search.trim()
      ? search.trim()
      : (typeof q === 'string' && q.trim()
        ? q.trim()
        : (typeof nombre === 'string' ? nombre.trim() : ''));
    if (normalizedSearch) params.set('nombre', normalizedSearch);
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    if (id_sucursal !== undefined && id_sucursal !== null && String(id_sucursal).trim() !== '') {
      params.set('id_sucursal', String(id_sucursal).trim());
    }
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
    apiFetch('/empleados', 'POST', pickAllowedFields(data, [
      'fecha_ingreso',
      'salario_base',
      'estado',
      'id_sucursal',
      'id_persona',
      'cargo',
      'nombre_referencia',
      'telefono_referencia'
    ])),

  createEmpleadoAtomico: (payload = {}) =>
    apiFetch('/empleados/atomico', 'POST', {
      ...(isPlainObject(payload) ? payload : {}),
      rbac_context: 'empleados'
    }),

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

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([campo, valor]) => campo && valor !== undefined)
    );
    if (!Object.keys(payload).length) return { error: false, message: 'Sin cambios para actualizar' };

    try {
      // Prefer JSON payload so backend can forward directly to empleados_actualizar(p_id, p_datos::json).
      return await apiFetch(`/empleados/${id}`, 'PUT', payload);
    } catch (error) {
      // Backward compatibility with handlers that still expect { campo, valor }.
      if (!error || ![400, 404, 405, 409, 415, 422].includes(error.status)) throw error;

      let result = null;
      for (const [campo, valor] of Object.entries(payload)) {
        result = await apiFetch(`/empleados/${id}`, 'PUT', { campo, valor });
      }
      return result;
    }
  },

  deleteEmpleado: (id) =>
    apiFetch(`/empleados/${id}`, 'DELETE'),

  // ==============================
  // CLIENTES (SUBMODULO PERSONAS)
  // ==============================
  getClientes: async ({ page = 1, limit = 10, nombre, search, q, estado, id_sucursal } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    const normalizedSearch = typeof search === 'string' && search.trim()
      ? search.trim()
      : (typeof q === 'string' && q.trim()
        ? q.trim()
        : (typeof nombre === 'string' ? nombre.trim() : ''));
    if (normalizedSearch) params.set('nombre', normalizedSearch);
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
    if (id_sucursal !== undefined && id_sucursal !== null && String(id_sucursal).trim() !== '') {
      params.set('id_sucursal', String(id_sucursal).trim());
    }
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
    apiFetch('/clientes', 'POST', pickAllowedFields(data, [
      'fecha_ingreso',
      'puntos',
      'id_tipo_cliente',
      'id_persona',
      'id_empresa',
      'id_sucursal',
      'estado'
    ])),

  createClienteAtomico: (payload = {}) =>
    apiFetch('/clientes/atomico', 'POST', {
      ...(isPlainObject(payload) ? payload : {}),
      rbac_context: 'clientes'
    }),

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

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([campo, valor]) => campo && valor !== undefined)
    );
    if (!Object.keys(payload).length) return { error: false, message: 'Sin cambios para actualizar' };

    return apiFetch(`/clientes/${id}`, 'PUT', payload);
  },

  deleteCliente: (id) =>
    apiFetch(`/clientes/${id}`, 'DELETE'),

  // ==============================
  // USUARIOS (SUBMODULO PERSONAS)
  // ==============================
  getRolesUsuariosV2: () =>
    apiFetch('/usuarios/v2/roles', 'GET'),

  getUsuariosV2: ({ page = 1, limit = 10, q = '', search = '', nombre = '' } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    const normalizedSearch = typeof q === 'string' && q.trim()
      ? q.trim()
      : (typeof search === 'string' && search.trim()
        ? search.trim()
        : (typeof nombre === 'string' ? nombre.trim() : ''));
    if (normalizedSearch) params.set('q', normalizedSearch);
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

