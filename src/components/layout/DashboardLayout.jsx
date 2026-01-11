import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import '../../assets/styles/main.scss';

const DashboardLayout = () => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    // Quitamos display:flex inline styles porque ya lo maneja el CSS global
    <> 
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)} 
      />

      {/* El main-content ya tiene margin-left y width calculados en el CSS */}
      <div className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <Navbar nombreUsuario="Gerson" />
        <Outlet />
      </div>
    </>
  );
};

export default DashboardLayout;