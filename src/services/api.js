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
const DEV_DIRECT_API_URL = import.meta.env.VITE_DEV_DIRECT_API_URL || 'http://localhost:3001';
const AUTH_ENDPOINTS_WITH_DEV_FALLBACK = new Set(['/login', '/api/public/login']);
const CLIENT_CSRF_STORAGE_KEY = 'smartorder_client_csrf_token';
const CSRF_TOKEN_RE = /^[a-f0-9]{64}$/i;

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

const extractErrorCode = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const raw = payload.code ?? payload.codigo ?? payload.error_code;
  return String(raw ?? '').trim().toUpperCase();
};

const safeUiErrorMessage = (rawMessage, fallback) => {
  const text = String(rawMessage || '').trim();
  if (!text) return fallback;
  if (looksTechnicalMessage(text)) return fallback;
  return text;
};

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;

  const matches = document.cookie
    .split('; ')
    .filter((row) => row.startsWith(`${name}=`));

  if (matches.length === 0) return null;

  // Preferimos la ultima coincidencia para evitar tomar cookies viejas
  // mas especificas por path/domain que no aplican al endpoint actual.
  const selected = matches[matches.length - 1];
  const value = selected.split('=').slice(1).join('=');

  const unquoted = value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
};

const normalizeCsrfToken = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return CSRF_TOKEN_RE.test(raw) ? raw.toLowerCase() : '';
};

const readStoredCsrfToken = () => {
  if (typeof window === 'undefined') return '';

  try {
    return normalizeCsrfToken(window.sessionStorage.getItem(CLIENT_CSRF_STORAGE_KEY));
  } catch {
    return '';
  }
};

const writeStoredCsrfToken = (token) => {
  const normalized = normalizeCsrfToken(token);
  if (!normalized || typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(CLIENT_CSRF_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures and keep request flow running.
  }
};

const clearStoredCsrfToken = () => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(CLIENT_CSRF_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep logout flow running.
  }
};

const extractCsrfTokenFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = [
    payload.csrfToken,
    payload.csrf_token,
    payload?.data?.csrfToken,
    payload?.data?.csrf_token
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCsrfToken(candidate);
    if (normalized) return normalized;
  }

  return '';
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
    // QA/produccion puede usar frontend y backend en subdominios distintos.
    // En ese caso el cookie CSRF puede viajar al backend pero no ser legible desde `document.cookie`.
    // Priorizamos el token emitido por login/me y guardado en sessionStorage.
    const csrf = readStoredCsrfToken() || normalizeCsrfToken(getCookie('csrf_token'));
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
  let firstError = null;
  try {
    response = await fetch(`${API_URL}${resolvedEndpoint}`, requestOptions);
  } catch (error) {
    firstError = error;
    const shouldTryDirectBackend =
      import.meta.env.DEV &&
      !API_URL &&
      AUTH_ENDPOINTS_WITH_DEV_FALLBACK.has(String(endpoint || '').split('?')[0]) &&
      config?.disableDevDirectFallback !== true;

    if (shouldTryDirectBackend) {
      response = await fetch(`${DEV_DIRECT_API_URL}${resolvedEndpoint}`, requestOptions).catch(() => null);
    }

    if (!response) {
      const aborted = error?.name === 'AbortError';
      const message = aborted
        ? `Tiempo de espera agotado (${timeoutMs}ms) al conectar con el servidor.`
        : 'No se pudo establecer comunicacion con el servidor.';
      throw new ApiError(message, {
        status: aborted ? 408 : 0,
        code: aborted ? 'REQUEST_TIMEOUT' : 'FETCH_ERROR',
        data: firstError || error
      });
    }
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
      clearStoredCsrfToken();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    throw new ApiError(msg, { status: 401, code: 'UNAUTHORIZED', data: errorData });
  }

  // 403 -> permissions or CSRF
  if (response.status === 403) {
    const errorData = await readBody(response);
    const rawMessage = extractErrorMessage(errorData);
    const msg = safeUiErrorMessage(rawMessage, 'Acceso denegado');
    const backendCode = extractErrorCode(errorData);
    const looksLikeCsrfMessage = /csrf|token/i.test(String(rawMessage || msg || ''));
    const isCsrf =
      backendCode === 'CSRF'
      || (!backendCode && !SAFE_METHODS.has(upperMethod) && looksLikeCsrfMessage);

    throw new ApiError(
      isCsrf ? (msg || 'Accion bloqueada (CSRF)') : msg,
      {
        status: 403,
        code: isCsrf ? 'CSRF' : (backendCode || 'FORBIDDEN'),
        data: errorData
      }
    );
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
  const payload = await readBody(response);
  const responseCsrfToken = extractCsrfTokenFromPayload(payload);
  if (responseCsrfToken) {
    writeStoredCsrfToken(responseCsrfToken);
  } else if (String(endpoint || '').split('?')[0] === '/logout') {
    clearStoredCsrfToken();
  }

  return payload;
};

