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

const readBody = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

export const apiFetch = async (endpoint, method = 'GET', body = null) => {
  const upperMethod = method.toUpperCase();

  const headers = {
    'Content-Type': 'application/json'
  };

  // CSRF: para métodos que cambian estado
  if (!SAFE_METHODS.has(upperMethod)) {
    const csrf = getCookie('csrf_token');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const options = {
    method: upperMethod,
    headers,
    credentials: 'include' // ✅ envía cookies (HttpOnly JWT)
  };

  if (body !== null && body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);

  if (response.status === 401) {
    const errorData = await readBody(response);
    const msg =
      (errorData && typeof errorData === 'object' && (errorData.message || errorData.mensaje)) ||
      (typeof errorData === 'string' ? errorData : '') ||
      'No autorizado';

    // Redirige al login si la sesión expiró
    window.location.href = '/';
    throw new ApiError(msg, { status: 401, code: 'UNAUTHORIZED', data: errorData });
  }

  if (response.status === 403) {
    const errorData = await readBody(response);
    const msg =
      (errorData && typeof errorData === 'object' && (errorData.message || errorData.mensaje)) ||
      (typeof errorData === 'string' ? errorData : '') ||
      'Acción bloqueada (CSRF)';

    throw new ApiError(msg, { status: 403, code: 'CSRF', data: errorData });
  }

  if (!response.ok) {
    const errorData = await readBody(response);
    const msg =
      (errorData && typeof errorData === 'object' && (errorData.message || errorData.mensaje)) ||
      (typeof errorData === 'string' ? errorData : '') ||
      `Error HTTP: ${response.status}`;

    throw new ApiError(msg, { status: response.status, code: 'HTTP_ERROR', data: errorData });
  }

  if (response.status === 204) return null;

  return await readBody(response);
};

