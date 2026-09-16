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

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";
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

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <PermisosProvider>
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

          <BottomNav />
        </div>
      )}
    </PermisosProvider>
  );
};

export default DashboardLayout;
