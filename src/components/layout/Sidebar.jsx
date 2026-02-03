import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/images/logo-jonnys.png'; //  logo del proyecto

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // ==============================
  // MENU PRINCIPAL 
  // ==============================
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

  // ==============================
  // SUBMENUS INVENTARIO 
  // ==============================
  const isInInventario = location.pathname.startsWith('/dashboard/inventario');
  const tabInventario = (new URLSearchParams(location.search).get('tab') || 'categorias').toLowerCase();

  
  const [openInventario, setOpenInventario] = useState(isInInventario);

  useEffect(() => {
    if (isInInventario) setOpenInventario(true);
  }, [isInInventario]);

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
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {menuItems.map((item) => {
          // ==============================
          // INVENTARIO CON SUBMENU 
          // ==============================
          if (item.name === 'Inventario') {
            return (
              <div key={item.path}>
                <button
                  type="button"
                  className={`menu-item ${isInInventario ? 'active' : ''}`}
                  title={isCollapsed ? item.name : ''}
                  aria-expanded={openInventario}
                  onClick={() => {
                    
                    if (!isInInventario) {
                      navigate('/dashboard/inventario?tab=categorias');
                      return;
                    }

                    // SI YA ESTAMOS EN INVENTARIO, SOLO ABRIR/CERRAR SUBMENU
                    setOpenInventario((v) => !v);
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.name}</span>

                  <i
                    className={`bi ${openInventario ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                    style={{ marginLeft: 'auto' }}
                  ></i>
                </button>

               
                {openInventario && (
                  <div style={{ paddingLeft: isCollapsed ? 0 : 18 }}>
                    <NavLink
                      to="/dashboard/inventario?tab=categorias"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'categorias' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Categorías' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-tags"></i>
                      <span>Categorías</span>
                    </NavLink>

                    <NavLink
                      to="/dashboard/inventario?tab=insumos"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'insumos' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Insumos' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-box"></i>
                      <span>Insumos</span>
                    </NavLink>

                    
                    <NavLink
                      to="/dashboard/inventario?tab=productos"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'productos' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Productos' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-basket2"></i>
                      <span>Productos</span>
                    </NavLink>

                    
                    <NavLink
                      to="/dashboard/inventario?tab=almacenes"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'almacenes' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Almacenes' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-building"></i>
                      <span>Almacenes</span>
                    </NavLink>

                    
                    <NavLink
                      to="/dashboard/inventario?tab=movimientos"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'movimientos' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Movimientos' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-arrow-left-right"></i>
                      <span>Movimientos</span>
                    </NavLink>

                    
                    <NavLink
                      to="/dashboard/inventario?tab=alertas"
                      className={() =>
                        `menu-item ${isInInventario && tabInventario === 'alertas' ? 'active' : ''}`
                      }
                      title={isCollapsed ? 'Alertas' : ''}
                      style={{ fontSize: 14 }}
                    >
                      <i className="bi bi-exclamation-triangle"></i>
                      <span>Alertas</span>
                    </NavLink>
                  </div>
                )}
              </div>
            );
          }

          // ==============================
          // RESTO DE OPCIONES
          // ==============================
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
