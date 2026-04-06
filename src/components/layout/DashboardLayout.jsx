import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import "../../assets/styles/main.scss";
import "./inactivity-timeout-modal.css";
import { PermisosProvider } from "../../context/PermisosContext";
import { useAuth } from "../../hooks/useAuth";
import useInactivityTimer from "../../hooks/useInactivityTimer";

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

const readStoredSidebarState = () => {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const DashboardLayout = () => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredSidebarState());
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [isSidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const closeSessionLocally = useCallback(() => {
    // HU162: cierre por inactividad solo en cliente (sin request backend)
    window.dispatchEvent(new CustomEvent("auth:logout"));
    navigate("/login", { replace: true });
  }, [navigate]);

  const inactivity = useInactivityTimer({
    enabled: Boolean(user),
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningMs: WARNING_BEFORE_MS,
    onTimeout: closeSessionLocally
  });

  const countdownText = useMemo(() => {
    const totalSeconds = Math.max(0, Math.ceil((inactivity.remainingMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [inactivity.remainingMs]);

  return (
    <PermisosProvider>
      <>
        <div className={`dashboard-shell ${isSidebarCollapsed ? "shell--collapsed" : ""}`}>
          <Sidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />

          <div className="main-content">
            <Navbar />
            <Outlet />
          </div>

          <BottomNav />
        </div>

        {inactivity.isWarningVisible ? (
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
                      ¡INACTIVIDAD DETECTADA!
                    </div>
                    <div className="inactivity-confirm-head-subtitle">
                      Su sesión se cerrará automáticamente por inactividad.
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
        ) : null}
      </>
    </PermisosProvider>
  );
};

export default DashboardLayout;
