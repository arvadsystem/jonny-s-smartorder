import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useInactivityTimer from '../../hooks/useInactivityTimer';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import '../layout/inactivity-timeout-modal.css';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const PROTECTED_PREFIXES = Object.freeze(['/dashboard', '/cambiar-password', '/cliente']);
const INACTIVITY_EXCLUDED_ROLE_CODES = new Set([
  'COCINA',
  'MESERO',
  'AUXILIAR_COCINA',
  'P_COCINA'
]);

const isProtectedPath = (pathname) =>
  PROTECTED_PREFIXES.some((prefix) => String(pathname || '').startsWith(prefix));

const normalizeRoleName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

const hasInactivityExemptRole = (user) => {
  if (!user || typeof user !== 'object') return false;

  const roleCandidates = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.tipo_usuario
  ];

  return roleCandidates
    .map(normalizeRoleName)
    .filter(Boolean)
    .some((roleCode) => INACTIVITY_EXCLUDED_ROLE_CODES.has(roleCode));
};

const GlobalInactivityGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isKeepingAlive, setKeepingAlive] = useState(false);

  const enabled = Boolean(user) && isProtectedPath(location.pathname) && !hasInactivityExemptRole(user);

  const closeSessionLocally = useCallback(() => {
    // HU162: cierre por inactividad solo en cliente (sin request backend)
    window.dispatchEvent(new CustomEvent('auth:logout'));
    navigate('/login', { replace: true });
  }, [navigate]);

  const inactivity = useInactivityTimer({
    enabled,
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningMs: WARNING_BEFORE_MS,
    onTimeout: closeSessionLocally
  });

  const handleKeepAlive = useCallback(async () => {
    if (isKeepingAlive) return;

    setKeepingAlive(true);
    try {
      await authService.me({ noCache: true, timeoutMs: 8000 });
      inactivity.keepAlive();
    } catch {
      closeSessionLocally();
    } finally {
      setKeepingAlive(false);
    }
  }, [closeSessionLocally, inactivity, isKeepingAlive]);

  useEffect(() => {
    if (!enabled || inactivity.isWarningVisible) return;
    // Tratar navegacion interna autenticada como actividad.
    inactivity.forceReset();
  }, [
    enabled,
    inactivity.forceReset,
    inactivity.isWarningVisible,
    location.pathname,
    location.search,
    location.hash
  ]);

  const countdownText = useMemo(() => {
    const totalSeconds = Math.max(0, Math.ceil((inactivity.remainingMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [inactivity.remainingMs]);

  if (!enabled || !inactivity.isWarningVisible) return null;

  return (
    <div
      className="inactivity-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
    >
      <div className="inactivity-confirm-panel inactivity-confirm-panel-centered">
        <div className="inactivity-confirm-head">
          <div className="inactivity-confirm-head-main">
            <div className="inactivity-confirm-head-icon" aria-hidden="true">
              <i className="bi bi-exclamation-triangle-fill" />
            </div>
            <div className="inactivity-confirm-head-copy">
              <div id="inactivity-warning-title" className="inactivity-confirm-head-title">
                INACTIVIDAD DETECTADA
              </div>
              <div className="inactivity-confirm-head-subtitle">
                Su sesion se cerrara automaticamente por inactividad.
              </div>
            </div>
          </div>
        </div>

        <div className="inactivity-confirm-body">
          <div className="inactivity-confirm-question">
            Tiempo restante: <strong>{countdownText}</strong>
          </div>
        </div>

        <div className="inactivity-confirm-footer">
          <button
            type="button"
            className="btn inactivity-confirm-btn"
            onClick={handleKeepAlive}
            disabled={isKeepingAlive}
          >
            Seguir conectado
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalInactivityGuard;
