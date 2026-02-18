import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import "../../assets/styles/main.scss";
import { PermisosProvider } from "../../context/PermisosContext";

const DashboardLayout = () => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <PermisosProvider>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={`main-content ${isSidebarCollapsed ? "expanded" : ""}`}>
        <Navbar />
        <Outlet />
      </div>

      <BottomNav />
    </PermisosProvider>
  );
};

export default DashboardLayout;

