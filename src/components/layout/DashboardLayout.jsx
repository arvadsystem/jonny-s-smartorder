import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import '../../assets/styles/main.scss';

const DashboardLayout = () => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <Navbar />
        <Outlet />
      </div>

      {/*  Solo se verá en tablets/smartphones por CSS */}
      <BottomNav />
    </>
  );
};

export default DashboardLayout;

