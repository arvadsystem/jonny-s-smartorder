import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/images/logo-jonnys.png'; //  logo del proyecto
import Can from "../common/Can";

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // ==============================
  // MENU PRINCIPAL
  // ==============================
  // ✅ IMPORTANTE: SOLO MODULOS, SIN SUBMODULOS (INVENTARIO SE MANEJA EN NAVBAR)
  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2' },
    { name: 'Sucursales', path: '/dashboard/sucursales', icon: 'bi-shop' },
    { name: 'Personas/Empresas', path: '/dashboard/personas', icon: 'bi-people' },
    { name: 'Inventario', path: '/dashboard/inventario', icon: 'bi-box-seam' },
    { name: 'Ventas', path: '/dashboard/ventas', icon: 'bi-cart3' },
    { name: 'Menú', path: '/dashboard/menu', icon: 'bi-journal-text' },
    { name: 'Seguridad', path: '/dashboard/seguridad', icon: 'bi-shield-lock' },
    // Inserta el acceso de Parametros antes de Configuracion para mantener coherencia funcional.
    { name: 'Parámetros', path: '/dashboard/parametros', icon: 'bi-sliders' },
    { name: 'Configuración', path: '/dashboard/configuracion', icon: 'bi-gear' },
  ];

  // ==============================
  // SUBMENUS INVENTARIO 
  // ==============================
  const isInInventario = location.pathname.startsWith('/dashboard/inventario');
  const tabInventario = (new URLSearchParams(location.search).get('tab') || 'categorias').toLowerCase();

  const [openInventario, setOpenInventario] = useState(isInInventario);

  useEffect(() => {
    if (isInInventario) setOpenInventario(true);
  }, [isInInventario]);

  // ==============================
  // SUBMENUS PERSONAS
  // ==============================
  const isInPersonasEmpresas = location.pathname.startsWith('/dashboard/personas');
  const tabPersonasEmpresas =
    (new URLSearchParams(location.search).get('tab') || 'personas').toLowerCase();

  const [openPersonasEmpresas, setOpenPersonasEmpresas] = useState(isInPersonasEmpresas);

  useEffect(() => {
    if (isInPersonasEmpresas) setOpenPersonasEmpresas(true);
  }, [isInPersonasEmpresas]);

  //----------------------------------------------------------------------------

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const userName = user?.nombre_usuario || 'Usuario';
  const userRole = user?.rol === 1 ? 'Administrador' : 'Empleado';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
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

      {/* HACER SCROLL EN EL MENÚ PARA PODER VER TODO EL SIDEBAR */}
      <div
        className="sidebar-menu"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          paddingBottom: 8,
        }}
      >
        {/* ✅ EL SIDEBAR AHORA SOLO MUESTRA MODULOS (SIN SUBMENUS) */}
        {menuItems.map((item) => {
          // ✅ HU82: OCULTAR "SEGURIDAD" SI NO TIENE PERMISO
          if (item.name === 'Seguridad') {
            return (
              <Can perm="SEGURIDAD_VER" key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.name : ''}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.name}</span>
                </NavLink>
              </Can>
            );
          }

          // Para el resto de los módulos, se muestran normales sin submenús
          return (
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
          );
        })}
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