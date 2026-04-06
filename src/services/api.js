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
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

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

const createRequestSignal = (config = {}) => {
  const timeoutRaw = Number.parseInt(String(config?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS), 10);
  const timeoutMs = Number.isInteger(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : DEFAULT_REQUEST_TIMEOUT_MS;

  const externalSignal = config?.signal ?? null;
  const controller = new AbortController();
  const timerId = setTimeout(() => {
    try {
      controller.abort(new DOMException('Request timed out', 'AbortError'));
    } catch {
      controller.abort();
    }
  }, timeoutMs);

  let unsubscribeExternal = null;
  if (externalSignal && typeof externalSignal.addEventListener === 'function') {
    const onExternalAbort = () => {
      try {
        controller.abort(externalSignal.reason);
      } catch {
        controller.abort();
      }
    };

    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      unsubscribeExternal = () => externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  const cleanup = () => {
    clearTimeout(timerId);
    if (unsubscribeExternal) unsubscribeExternal();
  };

  return { signal: controller.signal, cleanup, timeoutMs };
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

  const { signal, cleanup, timeoutMs } = createRequestSignal(config);
  requestOptions.signal = signal;

  let response;
  try {
    response = await fetch(`${API_URL}${resolvedEndpoint}`, requestOptions);
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    const message = aborted
      ? `Tiempo de espera agotado (${timeoutMs}ms) al conectar con el servidor.`
      : 'No se pudo establecer comunicacion con el servidor.';
    throw new ApiError(message, {
      status: aborted ? 408 : 0,
      code: aborted ? 'REQUEST_TIMEOUT' : 'FETCH_ERROR',
      data: error
    });
  } finally {
    cleanup();
  }

  // 401 -> not authenticated
  if (response.status === 401) {
    const errorData = await readBody(response);
    const msg =
      (errorData && typeof errorData === 'object' && (errorData.message || errorData.mensaje)) ||
      (typeof errorData === 'string' ? errorData : '') ||
      'No autorizado';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    throw new ApiError(msg, { status: 401, code: 'UNAUTHORIZED', data: errorData });
  }

  // 403 -> permissions or CSRF
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

    throw new ApiError(msg || 'Accion bloqueada (CSRF)', { status: 403, code: 'CSRF', data: errorData });
  }

  // Other HTTP errors.
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

