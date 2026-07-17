import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import authService from '../services/authService';
import { perfilService } from '../services/perfilService';
import { setQzAuthenticatedContext } from '../services/qzSessionContext.js';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

const AUTH_SESSION_HINT_KEY = 'smartorder_auth_session_hint';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 2500;
const PERFIL_ENRICH_TIMEOUT_MS = 2500;
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

const shouldBlockRouteDuringBootstrap = () => {
  if (typeof window === 'undefined') return true;
  const pathname = String(window.location?.pathname || '/');
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/perfil') ||
    pathname.startsWith('/cambiar-password')
  );
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
  if (usuario?.must_change_password) return usuario;

  try {
    const perfilData = await perfilService.getPerfil({ timeoutMs: PERFIL_ENRICH_TIMEOUT_MS });
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

const syncQzAuthenticatedContext = (usuario, reason) =>
  setQzAuthenticatedContext({
    idUsuario: usuario?.id_usuario,
    idSucursal: usuario?.id_sucursal,
    reason,
  });

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
  const authenticatedUserId = user?.id_usuario ?? null;
  const authenticatedSucursalId = user?.id_sucursal ?? null;

  const isCurrentRequest = useCallback(
    (requestId) => mountedRef.current && requestIdRef.current === requestId,
    []
  );

  const runBootstrap = useCallback(
    async ({ force = false } = {}) => {
      if (!force && !hasSessionHint()) {
        await syncQzAuthenticatedContext(null, 'bootstrap-without-session');
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
        await syncQzAuthenticatedContext(baseUser, 'bootstrap-authenticated');
        if (!isCurrentRequest(requestId)) return;
        setUser(baseUser);
        setSessionHint(Boolean(baseUser));
        setBootstrapState(BOOTSTRAP_STATES.ready);

        if (baseUser) {
          void (async () => {
            const nextUser = await enrichUserWithPerfil(baseUser);
            if (!isCurrentRequest(requestId)) return;

            setUser((current) => {
              if (!current || typeof current !== 'object') return current;
              if (String(current.id_usuario ?? '') !== String(baseUser.id_usuario ?? '')) return current;
              return nextUser;
            });
          })();
        }
      } catch (error) {
        if (!isCurrentRequest(requestId)) return;

        if (isUnauthorizedError(error)) {
          await syncQzAuthenticatedContext(null, 'bootstrap-unauthorized');
          if (!isCurrentRequest(requestId)) return;
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

        await syncQzAuthenticatedContext(null, 'bootstrap-failed');
        if (!isCurrentRequest(requestId)) return;
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
      void syncQzAuthenticatedContext(null, 'auth-logout-event');
      setUser(null);
      setSessionHint(false);
      setBootstrapError('');
      setBootstrapState(BOOTSTRAP_STATES.unauthorized);
    };

    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  useEffect(() => {
    void setQzAuthenticatedContext({
      idUsuario: authenticatedUserId,
      idSucursal: authenticatedSucursalId,
      reason: 'authenticated-user-or-sucursal-changed',
    });
  }, [authenticatedSucursalId, authenticatedUserId]);

  const retryBootstrap = useCallback(() => {
    void runBootstrap({ force: true });
  }, [runBootstrap]);

  const updateCurrentUser = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;

    setUser((current) => {
      if (!current || typeof current !== 'object') return current;
      return {
        ...current,
        ...patch
      };
    });
  }, []);

  const login = async (authPayload) => {
    const baseUser = normalizeAuthPayloadUser(authPayload);
    setSessionHint(Boolean(baseUser));
    setBootstrapError('');
    await syncQzAuthenticatedContext(baseUser, 'login-authenticated');

    if (!baseUser || typeof baseUser !== 'object') {
      setUser(baseUser);
      setBootstrapState(BOOTSTRAP_STATES.ready);
      return baseUser;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setBootstrapState(BOOTSTRAP_STATES.checking);

    try {
      const sessionData = await authService.me({ timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS });
      if (!isCurrentRequest(requestId)) return baseUser;

      const hydratedUser = normalizeAuthPayloadUser(sessionData) || baseUser;
      await syncQzAuthenticatedContext(hydratedUser, 'login-hydrated');
      if (!isCurrentRequest(requestId)) return baseUser;
      setUser(hydratedUser);
      setSessionHint(Boolean(hydratedUser));
      setBootstrapState(BOOTSTRAP_STATES.ready);

      void (async () => {
        const nextUser = await enrichUserWithPerfil(hydratedUser);

        setUser((current) => {
          if (!current || typeof current !== 'object') return current;
          if (String(current.id_usuario ?? '') !== String(hydratedUser.id_usuario ?? '')) return current;
          return nextUser;
        });
      })();

      return hydratedUser;
    } catch {
      if (!isCurrentRequest(requestId)) return baseUser;

      await syncQzAuthenticatedContext(baseUser, 'login-hydration-failed');
      if (!isCurrentRequest(requestId)) return baseUser;
      setUser(baseUser);
      setBootstrapState(BOOTSTRAP_STATES.ready);

      void (async () => {
        const nextUser = await enrichUserWithPerfil(baseUser);

        setUser((current) => {
          if (!current || typeof current !== 'object') return current;
          if (String(current.id_usuario ?? '') !== String(baseUser.id_usuario ?? '')) return current;
          return nextUser;
        });
      })();

      return baseUser;
    }
  };

  const logout = async () => {
    await syncQzAuthenticatedContext(null, 'logout');
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
  const blockDuringBootstrap = loading && shouldBlockRouteDuringBootstrap();

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateCurrentUser,
        loading,
        bootstrapState,
        bootstrapError,
        retryBootstrap
      }}
    >
      {blockDuringBootstrap ? <AuthBootstrapScreen /> : children}
    </AuthContext.Provider>
  );
};

