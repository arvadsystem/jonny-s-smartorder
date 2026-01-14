import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const BottomNav = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // ✅ Mantiene EXACTAMENTE las opciones originales del sidebar
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
    await logout(); // ✅ mantiene la lógica nueva (borra cookies en backend)
    navigate('/', { replace: true });
  };

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-scroll">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title={item.name}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.name}</span>
          </NavLink>
        ))}

        {/* ✅ Opción original (Salir) ahora en la barra inferior */}
        <button type="button" className="bottom-nav-item" onClick={handleLogout} title="Salir">
          <i className="bi bi-box-arrow-right"></i>
          <span>Salir</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
