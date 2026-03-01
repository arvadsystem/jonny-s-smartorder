import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import "../../assets/styles/main.scss";
import { PermisosProvider } from "../../context/PermisosContext";

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";

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
      <div className={`dashboard-shell ${isSidebarCollapsed ? "shell--collapsed" : ""}`}>
        <Sidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />

        <div className="main-content">
          <Navbar />
          <Outlet />
        </div>

        <BottomNav />
      </div>
    </PermisosProvider>
  );
};

export default DashboardLayout;

