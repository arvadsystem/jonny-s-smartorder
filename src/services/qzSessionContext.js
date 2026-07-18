const normalizePositiveInteger = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const normalizeHost = (value) => String(value || 'localhost').trim().toLowerCase();

const normalizePort = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : 8181;
};

let authenticatedContext = {
  idUsuario: null,
  idSucursal: null,
};

const authenticatedContextListeners = new Set();

export const getQzAuthenticatedContext = () => ({ ...authenticatedContext });

export const getQzAuthenticatedIdentityKey = (context = authenticatedContext) => {
  const idUsuario = normalizePositiveInteger(context?.idUsuario);
  const idSucursal = normalizePositiveInteger(context?.idSucursal);

  return idUsuario ? `${idUsuario}:${idSucursal || 'none'}` : null;
};

export const setQzAuthenticatedContext = async ({
  idUsuario,
  idSucursal,
  reason = 'auth-context-changed',
} = {}) => {
  const nextContext = {
    idUsuario: normalizePositiveInteger(idUsuario),
    idSucursal: normalizePositiveInteger(idSucursal),
  };

  const previousIdentityKey = getQzAuthenticatedIdentityKey(authenticatedContext);
  const nextIdentityKey = getQzAuthenticatedIdentityKey(nextContext);

  if (previousIdentityKey === nextIdentityKey) {
    return { changed: false };
  }

  const previousContext = authenticatedContext;
  authenticatedContext = nextContext;

  const listenerResults = [...authenticatedContextListeners].map((listener) => {
    try {
      return Promise.resolve(listener({
        previousContext: { ...previousContext },
        currentContext: { ...nextContext },
        reason,
      }));
    } catch (error) {
      return Promise.reject(error);
    }
  });

  await Promise.allSettled(listenerResults);
  return { changed: true };
};

export const subscribeQzAuthenticatedContext = (listener) => {
  if (typeof listener !== 'function') {
    throw new TypeError('El listener de contexto QZ debe ser una función.');
  }

  authenticatedContextListeners.add(listener);
  return () => authenticatedContextListeners.delete(listener);
};

export const createQzContextKey = ({ idUsuario, idSucursal, host, port }) => {
  const normalizedUserId = normalizePositiveInteger(idUsuario);
  const normalizedSucursalId = normalizePositiveInteger(idSucursal);

  if (!normalizedUserId) {
    throw new TypeError('id_usuario es obligatorio para crear el contexto QZ.');
  }

  if (!normalizedSucursalId) {
    throw new TypeError('id_sucursal es obligatorio para crear el contexto QZ.');
  }

  return `${normalizedUserId}:${normalizedSucursalId}:${normalizeHost(host)}:${normalizePort(port)}`;
};

export const resolveQzApiErrorCode = (error, operation = 'certificate') => {
  const status = Number(error?.status);
  const backendCode = String(error?.code || '').trim().toUpperCase();

  if (status === 401) return 'QZ_SESSION_UNAUTHORIZED';
  if (status === 403 && (backendCode === 'CSRF' || backendCode === 'QZ_CSRF_INVALID')) {
    return 'QZ_CSRF_INVALID';
  }
  if (status === 403 && backendCode === 'QZ_SUCURSAL_FORBIDDEN') {
    return 'QZ_SUCURSAL_FORBIDDEN';
  }
  if (status === 403) return 'QZ_PERMISSION_FORBIDDEN';
  if (status === 503) return 'QZ_CERTIFICATE_UNAVAILABLE';

  return operation === 'sign' ? 'QZ_SIGNATURE_ERROR' : 'QZ_CERTIFICATE_ERROR';
};
