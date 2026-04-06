import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import authService from '../services/authService';
import { perfilService } from '../services/perfilService';

export const AuthContext = createContext();

const AUTH_SESSION_HINT_KEY = 'smartorder_auth_session_hint';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
const BOOTSTRAP_STATES = Object.freeze({
  checking: 'checking',
  ready: 'ready',
  reconnecting: 'reconnecting',
  unauthorized: 'unauthorized'
});

const setSessionHint = (active) => {
  if (typeof window === 'undefined') return;

  try {
    if (active) {
      window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
      return;
    }
    window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
  } catch {
    // Ignore storage failures to keep auth flow running.
  }
};

const hasSessionHint = () => {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const normalizePhoto = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeAuthCollection = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => String(row ?? '').trim())
    .filter(Boolean);

const normalizeAuthPayloadUser = (payload) => {
  const sourceUser =
    payload && typeof payload === 'object' && payload.usuario && typeof payload.usuario === 'object'
      ? payload.usuario
      : payload && typeof payload === 'object'
        ? payload
        : null;

  if (!sourceUser || typeof sourceUser !== 'object') return null;

  const roles = normalizeAuthCollection(payload?.roles ?? sourceUser.roles);
  const permisos = normalizeAuthCollection(payload?.permisos ?? sourceUser.permisos);

  return {
    ...sourceUser,
    roles,
    permisos
  };
};

const enrichUserWithPerfil = async (usuario) => {
  if (!usuario || typeof usuario !== 'object') return usuario ?? null;

  try {
    const perfilData = await perfilService.getPerfil();
    const fotoPerfil = normalizePhoto(perfilData?.perfil?.foto_perfil);
    return { ...usuario, foto_perfil: fotoPerfil };
  } catch {
    return usuario;
  }
};

const isUnauthorizedError = (error) => {
  const status = Number.parseInt(String(error?.status ?? ''), 10);
  const code = String(error?.code ?? '').toUpperCase();
  return status === 401 || code === 'UNAUTHORIZED';
};

const isNetworkBootstrapError = (error) => {
  const code = String(error?.code ?? '').toUpperCase();
  const name = String(error?.name ?? '').toUpperCase();
  const message = String(error?.message ?? '').toLowerCase();
  return (
    code === 'FETCH_ERROR' ||
    code === 'REQUEST_TIMEOUT' ||
    name === 'FETCHERROR' ||
    name === 'TYPEERROR' ||
    message.includes('failed to fetch') ||
    message.includes('network')
  );
};

const resolveBootstrapErrorMessage = (error) => {
  if (!error) return 'No se pudo validar la sesion.';
  if (String(error?.code ?? '').toUpperCase() === 'REQUEST_TIMEOUT') {
    return 'Tiempo de espera agotado al validar la sesion.';
  }

  const message = String(error?.message ?? '').trim();
  return message || 'No se pudo validar la sesion.';
};

const AuthBootstrapScreen = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f8f9fa',
      color: '#212529'
    }}
    role="status"
    aria-live="polite"
  >
    <div style={{ textAlign: 'center' }}>
      <div className="spinner-border spinner-border-sm" aria-hidden="true" />
      <div style={{ marginTop: 12, fontSize: 14 }}>Inicializando sesion...</div>
    </div>
  </div>
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [bootstrapState, setBootstrapState] = useState(BOOTSTRAP_STATES.checking);
  const [bootstrapError, setBootstrapError] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const isCurrentRequest = useCallback(
    (requestId) => mountedRef.current && requestIdRef.current === requestId,
    []
  );

  const runBootstrap = useCallback(
    async ({ force = false } = {}) => {
      if (!force && !hasSessionHint()) {
        setBootstrapError('');
        setBootstrapState(BOOTSTRAP_STATES.ready);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setBootstrapError('');
      setBootstrapState(BOOTSTRAP_STATES.checking);

      try {
        const data = await authService.me({ timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS });
        if (!isCurrentRequest(requestId)) return;

        const baseUser = normalizeAuthPayloadUser(data);
        const nextUser = await enrichUserWithPerfil(baseUser);
        if (!isCurrentRequest(requestId)) return;

        setUser(nextUser);
        setSessionHint(Boolean(nextUser));
        setBootstrapState(BOOTSTRAP_STATES.ready);
      } catch (error) {
        if (!isCurrentRequest(requestId)) return;

        if (isUnauthorizedError(error)) {
          setUser(null);
          setSessionHint(false);
          setBootstrapError('');
          setBootstrapState(BOOTSTRAP_STATES.unauthorized);
          return;
        }

        if (isNetworkBootstrapError(error)) {
          setBootstrapError(resolveBootstrapErrorMessage(error));
          setBootstrapState(BOOTSTRAP_STATES.reconnecting);
          return;
        }

        setUser(null);
        setSessionHint(false);
        setBootstrapError(resolveBootstrapErrorMessage(error));
        setBootstrapState(BOOTSTRAP_STATES.unauthorized);
      }
    },
    [isCurrentRequest]
  );

  useEffect(() => {
    mountedRef.current = true;
    void runBootstrap({ force: false });

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [runBootstrap]);

  useEffect(() => {
    const handler = () => {
      requestIdRef.current += 1;
      setUser(null);
      setSessionHint(false);
      setBootstrapError('');
      setBootstrapState(BOOTSTRAP_STATES.unauthorized);
    };

    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const retryBootstrap = useCallback(() => {
    void runBootstrap({ force: true });
  }, [runBootstrap]);

  const login = (authPayload) => {
    const baseUser = normalizeAuthPayloadUser(authPayload);
    setUser(baseUser);
    setSessionHint(Boolean(baseUser));
    setBootstrapError('');
    setBootstrapState(BOOTSTRAP_STATES.ready);

    if (!baseUser || typeof baseUser !== 'object') return;

    void (async () => {
      const nextUser = await enrichUserWithPerfil(baseUser);

      setUser((current) => {
        if (!current || typeof current !== 'object') return current;
        if (String(current.id_usuario ?? '') !== String(baseUser.id_usuario ?? '')) return current;
        return nextUser;
      });
    })();
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the request fails, close local session.
    } finally {
      requestIdRef.current += 1;
      setUser(null);
      setSessionHint(false);
      setBootstrapError('');
      setBootstrapState(BOOTSTRAP_STATES.unauthorized);
    }
  };

  const loading = bootstrapState === BOOTSTRAP_STATES.checking;

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        bootstrapState,
        bootstrapError,
        retryBootstrap
      }}
    >
      {loading ? <AuthBootstrapScreen /> : children}
    </AuthContext.Provider>
  );
};

