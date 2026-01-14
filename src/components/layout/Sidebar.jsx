import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/images/logo-jonnys.png'; // ✅ logo del proyecto

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2' },
    { name: 'Sucursales', path: '/dashboard/sucursales', icon: 'bi-shop' },
    { name: 'Personas/Empresas', path: '/dashboard/personas', icon: 'bi-people' },
    { name: 'Inventario', path: '/dashboard/inventario', icon: 'bi-box-seam' },
    { name: 'Ventas', path: '/dashboard/ventas', icon: 'bi-cart3' },
    { name: 'Menú', path: '/dashboard/menu', icon: 'bi-journal-text' },
    { name: 'Seguridad', path: '/dashboard/seguridad', icon: 'bi-shield-lock' },
    { name: 'Configuración', path: '/dashboard/configuracion', icon: 'bi-gear' },
  ];

  const handleLogout = async () => {
    await logout(); // ✅ cookies/httpOnly (sin tocar)
    navigate('/', { replace: true });
  };

  const userName = user?.nombre_usuario || 'Usuario';
  const userRole = user?.rol === 1 ? 'Administrador' : 'Empleado';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          {/* ✅ Logo como antes */}
          <img className="brand-logo" src={logo} alt="Jonny's" />
          <h4>Jonny's Smart</h4>
        </div>

        <button
          className="collapse-btn"
          onClick={toggleSidebar}
          style={{ display: isCollapsed ? 'flex' : 'none' }}
          aria-label="Expandir menú"
        >
          <i className="bi bi-list text-white"></i>
        </button>

        <button
          className="collapse-btn"
          onClick={toggleSidebar}
          style={{ display: !isCollapsed ? 'flex' : 'none' }}
          aria-label="Colapsar menú"
        >
          <i className="bi bi-chevron-left"></i>
        </button>
      </div>

      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.name : ''}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-profile" onClick={handleLogout} title="Cerrar Sesión">
          <div className="user-avatar">{userInitial}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-email">{userRole}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;


