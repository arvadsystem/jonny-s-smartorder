import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import "../../assets/styles/main.scss";
import { PermisosProvider } from "../../context/PermisosContext";
import { useAuth } from "../../hooks/useAuth";
import { normalizeRoleName } from "../../utils/permissions";
import "./inactivity-timeout-modal.css";
import CajaAperturaEnforcer from "./CajaAperturaEnforcer";

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";
const PASSWORD_WARNING_DISMISS_PREFIX = "ui.passwordWarning58.dismissed";
const SCREEN_MODE_ROLES = new Set(["P_COCINA", "PANTALLA_COCINA", "PANTALLA_DE_COCINA"]);

const readStoredSidebarState = () => {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const DashboardLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredSidebarState());
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);

  const warningStorageKey = `${PASSWORD_WARNING_DISMISS_PREFIX}:${String(user?.id_usuario ?? "anon")}:${String(user?.password_age_days ?? "na")}`;
  const isPantallaCocina = (Array.isArray(user?.roles) ? user.roles : [])
    .some((role) => SCREEN_MODE_ROLES.has(normalizeRoleName(role)));
  const isPantallaCocinaRoute = isPantallaCocina && location.pathname.startsWith("/dashboard/cocina");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!user) {
      setShowPasswordWarning(false);
      return;
    }

    const shouldWarn =
      Boolean(user?.password_warning_58d) &&
      !Boolean(user?.password_policy_excluded);

    if (!shouldWarn) {
      setShowPasswordWarning(false);
      return;
    }

    try {
      const dismissed = window.sessionStorage.getItem(warningStorageKey) === "1";
      setShowPasswordWarning(!dismissed);
    } catch {
      setShowPasswordWarning(true);
    }
  }, [
    user,
    warningStorageKey,
  ]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const closePasswordWarning = useCallback(() => {
    setShowPasswordWarning(false);

    try {
      window.sessionStorage.setItem(warningStorageKey, "1");
    } catch {
      // Keep working when storage is blocked.
    }
  }, [warningStorageKey]);

  return (
    <PermisosProvider>
      {showPasswordWarning && !isPantallaCocinaRoute ? (
        <div
          className="password-expiry-warning-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-expiry-warning-title"
        >
          <div className="password-expiry-warning-panel">
            <button
              type="button"
              className="password-expiry-warning-close"
              onClick={closePasswordWarning}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div className="password-expiry-warning-head">
              <div className="password-expiry-warning-head-icon" aria-hidden="true">
                <i className="bi bi-shield-exclamation" />
              </div>
              <div>
                <div
                  id="password-expiry-warning-title"
                  className="password-expiry-warning-title"
                >
                  AVISO DE SEGURIDAD
                </div>
                <div className="password-expiry-warning-subtitle">
                  Su contraseña se vencerá en 2 días.
                </div>
              </div>
            </div>

            <div className="password-expiry-warning-body">
              Actualice su contraseña: De clic al icono de engranaje arriba a la derecha &gt; Cambiar contraseña
            </div>
          </div>
        </div>
      ) : null}

      {isPantallaCocinaRoute ? (
        <div className="dashboard-shell dashboard-shell--tv-mode">
          <div className="main-content">
            <Outlet />
          </div>
        </div>
      ) : (
        <div className={`dashboard-shell ${isSidebarCollapsed ? "shell--collapsed" : ""}`}>
          <Sidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />

          <div className="main-content">
            <Navbar />
            <Outlet />
          </div>

          <CajaAperturaEnforcer />
          <BottomNav />
        </div>
      )}
    </PermisosProvider>
  );
};

export default DashboardLayout;
