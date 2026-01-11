import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../assets/images/logo-jonnys.png';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const menuItems = [
    { name: 'Sucursales', path: '/dashboard/sucursales', icon: 'bi-shop' },
    { name: 'Personas/Empresas', path: '/dashboard/personas', icon: 'bi-people' },
    { name: 'Inventario', path: '/dashboard/inventario', icon: 'bi-box-seam' },
    { name: 'Ventas', path: '/dashboard/ventas', icon: 'bi-cart3' },
    { name: 'Menú', path: '/dashboard/menu', icon: 'bi-journal-text' },
    { name: 'Seguridad', path: '/dashboard/seguridad', icon: 'bi-shield-lock' },
    { name: 'Configuración', path: '/dashboard/configuracion', icon: 'bi-gear' },
  ];

  return (
    <div className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
      
      <div className="sidebar-header">
        {/* El Logo y texto solo se ven si NO está colapsado */}
        <div className="brand">
          <img src={logo} alt="Logo" />
          <h4>Jonny's Smart</h4>
        </div>

        {/* Botón Toggle: Cambia de icono según el estado */}
        <button className="collapse-btn" onClick={toggleSidebar}>
           <i className={`bi ${isCollapsed ? 'bi-list' : 'bi-chevron-left'}`}></i>
        </button>
      </div>

      <div className="sidebar-menu">
        {menuItems.map((item, index) => (
          <NavLink 
            key={index}
            to={item.path}
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.name : ''} // Tooltip nativo
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer comentado porque moveremos el cerrar sesión arriba. 
          Descomenta si lo quieres mantener aquí también. */}
      {/* <div className="sidebar-footer">
        <div className="logout-btn">
            <i className="bi bi-box-arrow-right"></i>
            <span>Cerrar Sesión</span>
        </div>
      </div> 
      */}
    </div>
  );
};

export default Sidebar;