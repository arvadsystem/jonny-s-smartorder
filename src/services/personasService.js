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
  const buildHttpError = (fallbackMessage) => {
    const error = new Error(getErrorMessage(payload, fallbackMessage));
    error.status = response.status;
    error.payload = payload;
    return error;
  };

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    throw buildHttpError('No autorizado');
  }

  if (response.status === 403) {
    throw buildHttpError('Acceso denegado');
  }

  if (!response.ok) {
    throw buildHttpError(`Error HTTP: ${response.status}`);
  }

  if (response.status === 204) return null;
  return payload;
};

const PHOTO_ROUTE_RETRYABLE_STATUS = new Set([404, 405, 415]);
const PHOTO_CONTRACT_RETRYABLE_STATUS = new Set([400, 404, 405, 415, 422]);

const isRetryablePhotoRouteError = (error) =>
  PHOTO_ROUTE_RETRYABLE_STATUS.has(Number(error?.status));

const isRetryablePhotoContractError = (error) =>
  PHOTO_CONTRACT_RETRYABLE_STATUS.has(Number(error?.status));

const buildEmployeePhotoEndpointMissingError = (baseError = null) => {
  const error = new Error(
    'No se encontro un endpoint backend para foto de empleados. Configure /empleados/v2/photo/:id o equivalente.'
  );
  error.code = 'EMPLEADOS_FOTO_ENDPOINT_MISSING';
  if (baseError?.status) error.status = baseError.status;
  if (baseError?.data) error.data = baseError.data;
  return error;
};

const runEndpointFallbacks = async (attempts = [], canRetry = isRetryablePhotoRouteError) => {
  let lastError = null;

  for (const attempt of attempts) {
    if (!attempt || !attempt.endpoint) continue;
    const method = String(attempt.method || 'GET').toUpperCase();

    try {
      if (Object.prototype.hasOwnProperty.call(attempt, 'body')) {
        return await apiFetch(attempt.endpoint, method, attempt.body);
      }
      return await apiFetch(attempt.endpoint, method);
    } catch (error) {
      if (!canRetry(error)) throw error;
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error('No se encontro un endpoint disponible para la operacion solicitada.');
};

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeOptionalImageValue = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const resolveImagePayloadValue = (payload = {}) => {
  if (!isPlainObject(payload)) return null;
  if (Object.prototype.hasOwnProperty.call(payload, 'foto_perfil')) {
    return normalizeOptionalImageValue(payload.foto_perfil);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'foto')) {
    return normalizeOptionalImageValue(payload.foto);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'imagen')) {
    return normalizeOptionalImageValue(payload.imagen);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'imagen_perfil')) {
    return normalizeOptionalImageValue(payload.imagen_perfil);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'url_imagen')) {
    return normalizeOptionalImageValue(payload.url_imagen);
  }
  return null;
};

const resolveEmpleadosBatchRequest = (payload = {}) => {
  if (!isPlainObject(payload)) return { empleados: [], ids: [] };

  const sourceRows = Array.isArray(payload.empleados)
    ? payload.empleados
    : (Array.isArray(payload.items) ? payload.items : []);

  const empleados = sourceRows
    .map((row) => {
      if (!isPlainObject(row)) return null;
      const id = toPositiveInteger(row.id_empleado ?? row.id ?? row.empleado_id);
      if (!id) return null;

      const storagePath = normalizeOptionalImageValue(
        row.storage_path
        ?? row.path
        ?? row.foto_storage_path
        ?? row.imagen_storage_path
      );

      return storagePath ? { id_empleado: id, storage_path: storagePath } : { id_empleado: id };
    })
    .filter(Boolean);

  const directIdsSource = Array.isArray(payload.ids_empleado)
    ? payload.ids_empleado
    : (Array.isArray(payload.ids) ? payload.ids : []);

  const idsFromPayload = directIdsSource
    .map((item) => toPositiveInteger(item))
    .filter(Boolean);

  const idsFromRows = empleados.map((row) => row.id_empleado);
  const ids = [...new Set([...idsFromRows, ...idsFromPayload])];

  return { empleados, ids };
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
  getEmpleados: async ({ page = 1, limit = 10, nombre, search, q, estado, id_sucursal, signal } = {}) => {
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
    const requestGet = (endpoint) =>
      signal
        ? fetchGetWithSignal(endpoint, signal)
        : apiFetch(endpoint, 'GET');

    try {
      return await requestGet(`/empleados?${query}`);
    } catch (error) {
      if (error?.status === 404) {
        return requestGet(`/empleados-detalle?${query}`);
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

  updateEmpleadoFotoV2: async (id, payload = {}) => {
    const empleadoId = toPositiveInteger(id);
    if (!empleadoId) throw new Error('Id de empleado invalido');

    const imageValue = resolveImagePayloadValue(payload);

    const attempts = [
      {
        endpoint: `/empleados/v2/photo/${empleadoId}`,
        method: 'PUT',
        body: { foto_perfil: imageValue }
      },
      {
        endpoint: `/empleados/photo/${empleadoId}`,
        method: 'PUT',
        body: { foto_perfil: imageValue }
      },
      {
        endpoint: `/empleados/${empleadoId}/photo`,
        method: 'PUT',
        body: { foto_perfil: imageValue }
      },
      {
        endpoint: `/empleados/${empleadoId}/foto`,
        method: 'PUT',
        body: { foto: imageValue }
      },
      {
        endpoint: `/empleados/${empleadoId}/imagen`,
        method: 'PUT',
        body: { imagen: imageValue }
      },
      {
        endpoint: `/empleados/v2/foto/${empleadoId}`,
        method: 'PUT',
        body: { foto: imageValue }
      }
    ];

    try {
      return await runEndpointFallbacks(attempts, isRetryablePhotoRouteError);
    } catch (error) {
      if (isRetryablePhotoRouteError(error)) {
        throw buildEmployeePhotoEndpointMissingError(error);
      }
      throw error;
    }
  },

  deleteEmpleadoFotoV2: async (id) => {
    const empleadoId = toPositiveInteger(id);
    if (!empleadoId) throw new Error('Id de empleado invalido');

    const attempts = [
      { endpoint: `/empleados/v2/photo/${empleadoId}`, method: 'DELETE' },
      { endpoint: `/empleados/photo/${empleadoId}`, method: 'DELETE' },
      { endpoint: `/empleados/${empleadoId}/photo`, method: 'DELETE' },
      { endpoint: `/empleados/${empleadoId}/foto`, method: 'DELETE' },
      { endpoint: `/empleados/${empleadoId}/imagen`, method: 'DELETE' },
      { endpoint: `/empleados/v2/foto/${empleadoId}`, method: 'DELETE' }
    ];

    try {
      return await runEndpointFallbacks(attempts, isRetryablePhotoRouteError);
    } catch (error) {
      if (isRetryablePhotoRouteError(error)) {
        throw buildEmployeePhotoEndpointMissingError(error);
      }
      throw error;
    }
  },

  getEmpleadoFotoFirmadaV2: async (id, options = {}) => {
    const empleadoId = toPositiveInteger(id);
    if (!empleadoId) throw new Error('Id de empleado invalido');

    const storagePath = normalizeOptionalImageValue(
      options?.storage_path
      ?? options?.path
      ?? options?.foto_storage_path
      ?? options?.imagen_storage_path
    );

    const postBody = storagePath
      ? { id_empleado: empleadoId, storage_path: storagePath }
      : { id_empleado: empleadoId };

    const attempts = [
      { endpoint: `/empleados/v2/photo/${empleadoId}/signed-url`, method: 'GET' },
      { endpoint: `/empleados/${empleadoId}/photo/signed-url`, method: 'GET' },
      { endpoint: `/empleados/${empleadoId}/foto/signed-url`, method: 'GET' },
      { endpoint: `/empleados/${empleadoId}/imagen/signed-url`, method: 'GET' },
      { endpoint: '/empleados/v2/photo/signed-url', method: 'POST', body: postBody },
      { endpoint: '/empleados/photo/signed-url', method: 'POST', body: postBody },
      { endpoint: '/empleados/foto/signed-url', method: 'POST', body: postBody },
      { endpoint: '/empleados/imagen/signed-url', method: 'POST', body: postBody }
    ];

    return runEndpointFallbacks(attempts, isRetryablePhotoContractError);
  },

  getEmpleadosFotosFirmadasV2: async (payload = {}) => {
    const { empleados, ids } = resolveEmpleadosBatchRequest(payload);

    if (!empleados.length && !ids.length) return {};

    const bodyCandidates = [];
    if (empleados.length) bodyCandidates.push({ empleados });
    if (ids.length) bodyCandidates.push({ ids_empleado: ids });
    if (ids.length) bodyCandidates.push({ ids });

    const endpointCandidates = [
      '/empleados/v2/photo/signed-urls',
      '/empleados/photo/signed-urls',
      '/empleados/fotos/signed-urls',
      '/empleados/imagenes/signed-urls',
      '/empleados/v2/fotos/signed-urls'
    ];

    const attempts = [];
    endpointCandidates.forEach((endpoint) => {
      bodyCandidates.forEach((body) => {
        attempts.push({ endpoint, method: 'POST', body });
      });
    });

    return runEndpointFallbacks(attempts, isRetryablePhotoContractError);
  },

  // ==============================
  // CLIENTES (SUBMODULO PERSONAS)
  // ==============================
  getClientes: async ({ page = 1, limit = 10, nombre, search, q, estado, id_sucursal, signal } = {}) => {
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
    const requestGet = (endpoint) =>
      signal
        ? fetchGetWithSignal(endpoint, signal)
        : apiFetch(endpoint, 'GET', null, { noCache: true });

    try {
      return await requestGet(`/clientes?${query}`);
    } catch (error) {
      if (error?.status === 404) {
        return requestGet(`/clientes-detalle?${query}`);
      }
      throw error;
    }
  },

  createCliente: (data) => {
    const payload = pickAllowedFields(data, [
      'fecha_ingreso',
      'puntos',
      'id_tipo_cliente',
      'id_persona',
      'id_empresa_cliente',
      'id_empresa',
      'id_sucursal',
      'estado'
    ]);
    if (
      payload.id_empresa_cliente === undefined
      && payload.id_empresa !== undefined
      && payload.id_empresa !== null
      && String(payload.id_empresa).trim() !== ''
    ) {
      payload.id_empresa_cliente = payload.id_empresa;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'id_empresa')) {
      delete payload.id_empresa;
    }
    return apiFetch('/clientes', 'POST', payload);
  },

  createClienteAtomico: (payload = {}) => {
    const requestPayload = isPlainObject(payload) ? { ...payload } : {};
    const clientePayload = isPlainObject(requestPayload.cliente)
      ? { ...requestPayload.cliente }
      : null;

    if (clientePayload) {
      if (
        clientePayload.id_empresa_cliente === undefined
        && clientePayload.id_empresa !== undefined
        && clientePayload.id_empresa !== null
        && String(clientePayload.id_empresa).trim() !== ''
      ) {
        clientePayload.id_empresa_cliente = clientePayload.id_empresa;
      }
      if (Object.prototype.hasOwnProperty.call(clientePayload, 'id_empresa')) {
        delete clientePayload.id_empresa;
      }
      requestPayload.cliente = clientePayload;
    }

    return apiFetch('/clientes/atomico', 'POST', {
      ...requestPayload,
      rbac_context: 'clientes'
    });
  },

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
    if (
      payload.id_empresa_cliente === undefined
      && payload.id_empresa !== undefined
      && payload.id_empresa !== null
      && String(payload.id_empresa).trim() !== ''
    ) {
      payload.id_empresa_cliente = payload.id_empresa;
    }
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

