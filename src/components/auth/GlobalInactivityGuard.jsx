import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useInactivityTimer from '../../hooks/useInactivityTimer';
import { useAuth } from '../../hooks/useAuth';
import '../layout/inactivity-timeout-modal.css';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const PROTECTED_PREFIXES = Object.freeze(['/dashboard', '/cambiar-password', '/cliente']);

const isProtectedPath = (pathname) =>
  PROTECTED_PREFIXES.some((prefix) => String(pathname || '').startsWith(prefix));

const GlobalInactivityGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const enabled = Boolean(user) && isProtectedPath(location.pathname);

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
            onClick={inactivity.keepAlive}
          >
            Seguir conectado
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalInactivityGuard;
