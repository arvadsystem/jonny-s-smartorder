import { apiFetch } from './api';
import { API_URL } from '../utils/constants';
const CLIENTES_ATOMIC_ROUTE_BLOCK_FLAG = 'clientes_atomic_route_blocked_v1';

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

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 't', 'si', 'activo'].includes(normalized)) return true;
  if (['false', '0', 'f', 'no', 'inactivo'].includes(normalized)) return false;
  return null;
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

const shouldTryNextEndpoint = (error) => {
  const status = Number(error?.status);
  const message = String(error?.message || error?.payload?.message || error?.payload?.mensaje || "").toLowerCase();
  if ([400, 404, 405, 422].includes(status)) return true;
  if (message.includes("id") && message.includes("entero positivo")) return true;
  if (message.includes("id_cargo")) return true;
  return false;
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

const readClientesAtomicRouteBlocked = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(CLIENTES_ATOMIC_ROUTE_BLOCK_FLAG) === '1';
  } catch {
    return false;
  }
};

const persistClientesAtomicRouteBlocked = (blocked) => {
  if (typeof window === 'undefined') return;
  try {
    if (blocked) {
      window.sessionStorage.setItem(CLIENTES_ATOMIC_ROUTE_BLOCK_FLAG, '1');
      return;
    }
    window.sessionStorage.removeItem(CLIENTES_ATOMIC_ROUTE_BLOCK_FLAG);
  } catch {
    // ignore storage failures
  }
};

let clientesAtomicRouteBlocked = readClientesAtomicRouteBlocked();

export const personaService = {

  // ==============================
  // PERSONAS
  // ==============================

  getPersonas: async (pageOrOptions = 1, limitArg = 10, searchArg = '', requestOptions = {}) => {
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
    const hasEstadoFilter = estado !== undefined && estado !== null;
    if (hasEstadoFilter) params.set('estado', String(estado));
    if (suggest) params.set('suggest', '1');
    const endpoint = `/personas?${params.toString()}`;
    if (!hasEstadoFilter) {
      if (signal) return fetchGetWithSignal(endpoint, signal);
      return apiFetch(endpoint, 'GET');
    }

    const paramsWithoutEstado = new URLSearchParams(params);
    paramsWithoutEstado.delete('estado');
    const fallbackEndpoint = `/personas?${paramsWithoutEstado.toString()}`;

    try {
      if (signal) return await fetchGetWithSignal(endpoint, signal);
      return await apiFetch(endpoint, 'GET');
    } catch (error) {
      const status = Number(error?.status);
      const message = String(error?.message || '').toLowerCase();
      const errorPayload = (error?.data && typeof error.data === 'object')
        ? error.data
        : (error?.payload && typeof error.payload === 'object' ? error.payload : null);
      const payloadMessage = String(errorPayload?.message || errorPayload?.mensaje || '').toLowerCase();
      const shouldRetryWithoutEstado =
        status === 400
        && (message.includes('estado') || payloadMessage.includes('estado') || payloadMessage.includes('no soporta'));

      if (!shouldRetryWithoutEstado) throw error;
      if (signal) return fetchGetWithSignal(fallbackEndpoint, signal);
      return apiFetch(fallbackEndpoint, 'GET');
    }
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

  getPersonaById: (id) =>
    apiFetch(`/personas/${id}`, 'GET'),


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
      'id_cargo',
      'cargo',
      'nombre_referencia',
      'telefono_referencia'
    ])),

  createEmpleadoAtomico: (payload = {}) =>
    apiFetch('/empleados/atomico', 'POST', {
      ...(isPlainObject(payload) ? payload : {}),
      rbac_context: 'empleados'
    }),

  createEmpleadoFull: async (payload = {}) => {
    const requestPayload = {
      ...(isPlainObject(payload) ? payload : {}),
      rbac_context: 'empleados'
    };
    try {
      return await apiFetch('/empleados/full-create', 'POST', requestPayload);
    } catch (error) {
      if ([404, 405].includes(Number(error?.status))) {
        return apiFetch('/empleados/atomico', 'POST', requestPayload);
      }
      throw error;
    }
  },

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

  getCargosEmpleados: async ({ estado, search, q, signal, page, limit } = {}) => {
    const buildSuffix = ({ withPaging = true, forcedPage = null, forcedLimit = null } = {}) => {
      const params = new URLSearchParams();
      const normalizedSearch = typeof search === 'string' && search.trim()
        ? search.trim()
        : (typeof q === 'string' && q.trim() ? q.trim() : '');
      if (normalizedSearch) params.set('q', normalizedSearch);
      if (estado !== undefined && estado !== null) params.set('estado', String(estado));
      if (withPaging) {
        const safePage = Number.parseInt(String(forcedPage ?? page ?? ''), 10);
        const safeLimit = Number.parseInt(String(forcedLimit ?? limit ?? ''), 10);
        params.set('page', String(Number.isInteger(safePage) && safePage > 0 ? safePage : 1));
        params.set('limit', String(Number.isInteger(safeLimit) && safeLimit > 0 ? safeLimit : 500));
      }
      const query = params.toString();
      return query ? `?${query}` : '';
    };

    const request = (endpoint) => (
      signal
        ? fetchGetWithSignal(endpoint, signal)
        : apiFetch(endpoint, 'GET')
    );

    const endpoints = [
      '/empleados/cargos',
      '/catalogos/cargos-empleados',
      '/cargos-empleados'
    ];

    const rowsFromPayload = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (!payload || typeof payload !== 'object') return [];
      if (Array.isArray(payload.data)) return payload.data;
      if (Array.isArray(payload.items)) return payload.items;
      if (Array.isArray(payload.rows)) return payload.rows;
      if (Array.isArray(payload.cargos)) return payload.cargos;
      if (Array.isArray(payload.cargos_empleados)) return payload.cargos_empleados;
      if (Array.isArray(payload.catalogo)) return payload.catalogo;
      return [];
    };

    let lastError = null;
    const merged = [];
    const seen = new Set();

    const collectRowsFromEndpoint = async (endpoint) => {
      let payload = null;
      try {
        payload = await request(`${endpoint}${buildSuffix({ withPaging: true })}`);
      } catch (errorPaging) {
        if (!shouldTryNextEndpoint(errorPaging)) throw errorPaging;
        payload = await request(`${endpoint}${buildSuffix({ withPaging: false })}`);
      }

      const baseRows = rowsFromPayload(payload);
      const baseTotal = Number(payload?.total ?? payload?.totalItems ?? payload?.count ?? 0) || 0;
      const baseLimit = Number(payload?.limit ?? 0) || 0;
      const shouldPaginate =
        baseTotal > baseRows.length &&
        baseRows.length > 0 &&
        (baseLimit > 0 || baseRows.length <= 50);

      if (!shouldPaginate) return baseRows;

      const resolvedLimit = baseLimit > 0 ? baseLimit : baseRows.length;
      if (!resolvedLimit) return baseRows;
      const totalPages = Math.max(1, Math.ceil(baseTotal / resolvedLimit));
      if (totalPages <= 1) return baseRows;

      const pagedRows = [...baseRows];
      for (let pageIndex = 2; pageIndex <= totalPages; pageIndex += 1) {
        try {
          const pagePayload = await request(
            `${endpoint}${buildSuffix({ withPaging: true, forcedPage: pageIndex, forcedLimit: resolvedLimit })}`
          );
          const extraRows = rowsFromPayload(pagePayload);
          if (!extraRows.length) break;
          pagedRows.push(...extraRows);
        } catch (pageError) {
          if (!shouldTryNextEndpoint(pageError)) throw pageError;
          break;
        }
      }
      return pagedRows;
    };

    for (const endpoint of endpoints) {
      try {
        const rows = await collectRowsFromEndpoint(endpoint);
        rows.forEach((row) => {
          const id = row?.id_cargo ?? row?.id ?? row?.cargo_id ?? row?.idCargo ?? null;
          const label = String(row?.nombre_cargo ?? row?.nombre ?? row?.cargo ?? '').trim();
          const key = id ? `id:${id}` : `label:${label.toLowerCase()}`;
          if (!label || seen.has(key)) return;
          seen.add(key);
          merged.push(row);
        });
      } catch (error) {
        lastError = error;
        if (!shouldTryNextEndpoint(error)) throw error;
      }
    }

    if (merged.length) {
      return { data: merged, cargos: merged, total: merged.length, page: 1, limit: merged.length };
    }

    throw lastError || new Error('No se pudo cargar el catalogo de cargos.');
  },

  createCargoEmpleado: async (payload = {}) => {
    const body = pickAllowedFields(payload, ['nombre_cargo', 'descripcion', 'estado']);
    if (!String(body?.nombre_cargo || '').trim()) {
      throw new Error('El nombre del cargo es obligatorio.');
    }

    const endpoints = [
      '/empleados/cargos',
      '/catalogos/cargos-empleados',
      '/cargos-empleados'
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await apiFetch(endpoint, 'POST', body);
      } catch (error) {
        lastError = error;
        if (!shouldTryNextEndpoint(error)) throw error;
      }
    }
    throw lastError || new Error('No se pudo crear el cargo.');
  },

  updateCargoEmpleado: async (idCargo, payload = {}) => {
    const id = Number.parseInt(String(idCargo ?? ''), 10);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Id de cargo invalido.');

    const body = pickAllowedFields(payload, ['nombre_cargo', 'descripcion', 'estado']);
    if (!Object.keys(body).length) return { error: false, message: 'Sin cambios para actualizar' };

    const endpoints = [
      `/empleados/cargos/${id}`,
      `/catalogos/cargos-empleados/${id}`,
      `/cargos-empleados/${id}`
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await apiFetch(endpoint, 'PUT', body);
      } catch (error) {
        lastError = error;
        if (!shouldTryNextEndpoint(error)) throw error;
      }
    }
    throw lastError || new Error('No se pudo actualizar el cargo.');
  },

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
  getClientes: async ({ page = 1, limit = 10, nombre, search, q, estado, origen, id_sucursal, signal } = {}) => {
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
    if (typeof origen === 'string' && origen.trim()) params.set('origen', origen.trim());
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
      delete clientePayload.id_tipo_cliente;
      delete clientePayload.puntos;
      delete clientePayload.fecha_ingreso;
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

    if (Object.prototype.hasOwnProperty.call(requestPayload, 'strict_base_create')) {
      const strictParsed = parseBooleanFlag(requestPayload.strict_base_create);
      if (strictParsed !== null) {
        requestPayload.strict_base_create = strictParsed;
      }
    }

    return apiFetch('/clientes/atomico', 'POST', {
      ...requestPayload,
      rbac_context: 'clientes'
    });
  },

  createClienteFull: async (payload = {}) => {
    if (clientesAtomicRouteBlocked) {
      const blockedError = new Error('Rutas atomicas de clientes bloqueadas para esta sesion.');
      blockedError.status = 403;
      blockedError.code = 'CLIENTES_ATOMIC_ROUTE_BLOCKED';
      throw blockedError;
    }

    const requestPayload = isPlainObject(payload) ? { ...payload } : {};
    const clientePayload = isPlainObject(requestPayload.cliente)
      ? { ...requestPayload.cliente }
      : null;

    if (clientePayload) {
      delete clientePayload.id_tipo_cliente;
      delete clientePayload.puntos;
      delete clientePayload.fecha_ingreso;
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

    if (Object.prototype.hasOwnProperty.call(requestPayload, 'strict_base_create')) {
      const strictParsed = parseBooleanFlag(requestPayload.strict_base_create);
      if (strictParsed !== null) {
        requestPayload.strict_base_create = strictParsed;
      }
    }

    requestPayload.rbac_context = 'clientes';
    try {
      return await apiFetch('/clientes/full-create', 'POST', requestPayload);
    } catch (error) {
      const status = Number(error?.status);
      const code = String(error?.code || '').trim().toUpperCase();
      const canFallbackToAtomico =
        [403, 404, 405].includes(status)
        && code !== 'CSRF';

      if (canFallbackToAtomico) {
        try {
          return await apiFetch('/clientes/atomico', 'POST', requestPayload);
        } catch (atomicoError) {
          const atomicoStatus = Number(atomicoError?.status);
          const atomicoCode = String(atomicoError?.code || '').trim().toUpperCase();
          const shouldBlockAtomicRoutes =
            atomicoStatus === 403
            && atomicoCode !== 'CSRF';

          if (shouldBlockAtomicRoutes) {
            clientesAtomicRouteBlocked = true;
            persistClientesAtomicRouteBlocked(true);
          }
          throw atomicoError;
        }
      }
      throw error;
    }
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

  getUsuariosV2: ({ page = 1, limit = 10, q = '', search = '', nombre = '', estado } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    const normalizedSearch = typeof q === 'string' && q.trim()
      ? q.trim()
      : (typeof search === 'string' && search.trim()
        ? search.trim()
        : (typeof nombre === 'string' ? nombre.trim() : ''));
    if (normalizedSearch) params.set('q', normalizedSearch);
    if (estado !== undefined && estado !== null) params.set('estado', String(estado));
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

