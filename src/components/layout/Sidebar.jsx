import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Importamos el hook de seguridad

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // Obtenemos usuario y función logout

  // Menú de navegación
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

  // Función para manejar el cierre de sesión
  const handleLogout = () => {
    logout(); // Limpia estado y localStorage
    navigate('/', { replace: true }); // Redirige al login
  };

  // Datos para mostrar en el footer (fallback si no hay usuario cargado)
  const userName = user?.nombre_usuario || 'Usuario';
  const userRole = user?.rol === 1 ? 'Administrador' : 'Empleado';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
      
      {/* 1. Header: Diseño tipo "shadcn/ui" + Botón Toggle */}
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">
            <i className="bi bi-command"></i> 
          </div>
          <h4>Jonny's Smart</h4>
        </div>
        
        {/* Botón para colapsar/expandir (Visible como hamburguesa si está colapsado) */}
        <button className="collapse-btn" onClick={toggleSidebar} style={{display: isCollapsed ? 'flex' : 'none'}}>
             <i className="bi bi-list text-white"></i>
        </button>
         {/* Botón flecha solo si está expandido (opcional según CSS, aquí lo forzamos visualmente si deseas) */}
         <button className="collapse-btn" onClick={toggleSidebar} style={{display: !isCollapsed ? 'flex' : 'none'}}>
             <i className="bi bi-chevron-left"></i>
        </button>
      </div>

      {/* 2. Menú: Lista de opciones */}
      <div className="sidebar-menu">
        {menuItems.map((item, index) => (
          <NavLink 
            key={index}
            to={item.path}
            end={item.path === '/dashboard'} // 'end' para que Dashboard no quede siempre activo
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.name : ''}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* 3. Footer: Perfil de Usuario (Clic para Logout) */}
      <div className="sidebar-footer">
        <div className="user-profile" onClick={handleLogout} title="Cerrar Sesión">
            <div className="user-avatar">
                {userInitial}
            </div>
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