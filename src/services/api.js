import { API_URL } from '../utils/constants';

class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const appendNoCacheParam = (endpoint) => {
  const safeEndpoint = String(endpoint || '');
  const separator = safeEndpoint.includes('?') ? '&' : '?';
  return `${safeEndpoint}${separator}_ts=${Date.now()}`;
};

const readBody = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const TECHNICAL_ERROR_PATTERNS = [
  /function\s+[\w.]+\s*\(/i,
  /relation\s+["'\w.]+\s+does not exist/i,
  /column\s+["'\w.]+\s+does not exist/i,
  /duplicate key value violates/i,
  /violates (foreign key|unique|check|not-null)/i,
  /syntax error at or near/i,
  /pg_/i,
  /\bat\s+\w.+\(\S+:\d+:\d+\)/i
];

const looksTechnicalMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return false;
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(text));
};

const extractErrorMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'object') return payload.message || payload.mensaje || '';
  if (typeof payload === 'string') return payload;
  return '';
};

const safeUiErrorMessage = (rawMessage, fallback) => {
  const text = String(rawMessage || '').trim();
  if (!text) return fallback;
  if (looksTechnicalMessage(text)) return fallback;
  return text;
};

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  if (!match) return null;

  const value = match.split('=').slice(1).join('=');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const apiFetch = async (endpoint, method = 'GET', body = null, config = {}) => {
  const upperMethod = method.toUpperCase();
  const noCache = Boolean(config?.noCache);
  const resolvedEndpoint = noCache && SAFE_METHODS.has(upperMethod)
    ? appendNoCacheParam(endpoint)
    : endpoint;

  const headers = {
    'Content-Type': 'application/json'
  };

  // CSRF only for methods that change state.
  if (!SAFE_METHODS.has(upperMethod)) {
    const csrf = getCookie('csrf_token');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const requestOptions = {
    method: upperMethod,
    headers,
    credentials: 'include'
  };

  if (body !== null && body !== undefined) {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${resolvedEndpoint}`, requestOptions);

  if (response.status === 401) {
    const errorData = await readBody(response);
    const msg = safeUiErrorMessage(extractErrorMessage(errorData), 'No autorizado');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    throw new ApiError(msg, {
      status: 401,
      code: (errorData && typeof errorData === 'object' && errorData.code) || 'UNAUTHORIZED',
      data: errorData
    });
  }

  if (response.status === 403) {
    const errorData = await readBody(response);
    const msg = safeUiErrorMessage(extractErrorMessage(errorData), 'Acceso denegado');

    if (SAFE_METHODS.has(upperMethod)) {
      throw new ApiError(msg, {
        status: 403,
        code: (errorData && typeof errorData === 'object' && errorData.code) || 'FORBIDDEN',
        data: errorData
      });
    }

    throw new ApiError(msg || 'Accion bloqueada (CSRF)', {
      status: 403,
      code: (errorData && typeof errorData === 'object' && errorData.code) || 'CSRF',
      data: errorData
    });
  }

  if (!response.ok) {
    const errorData = await readBody(response);
    const msg = safeUiErrorMessage(
      extractErrorMessage(errorData),
      `No se pudo completar la solicitud (HTTP ${response.status}).`
    );

    throw new ApiError(msg, {
      status: response.status,
      code: (errorData && typeof errorData === 'object' && errorData.code) || 'HTTP_ERROR',
      data: errorData
    });
  }

  if (response.status === 204) return null;

  return await readBody(response);
};
