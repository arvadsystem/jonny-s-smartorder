import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import {
  INVENTARIO_TAB_PERMISSIONS,
  NAV_ITEM_PERMISSIONS,
  PERMISSIONS
} from '../../utils/permissions';

const INVENTARIO_OPTIONS = [
  { key: 'categorias', label: 'Categorias', icon: 'bi-tags', required: INVENTARIO_TAB_PERMISSIONS.categorias },
  { key: 'insumos', label: 'Insumos', icon: 'bi-box', required: INVENTARIO_TAB_PERMISSIONS.insumos },
  { key: 'productos', label: 'Productos', icon: 'bi-basket2', required: INVENTARIO_TAB_PERMISSIONS.productos },
  { key: 'almacenes', label: 'Almacenes', icon: 'bi-building', required: INVENTARIO_TAB_PERMISSIONS.almacenes },
  { key: 'movimientos', label: 'Movimientos', icon: 'bi-arrow-left-right', required: [PERMISSIONS.MOVIMIENTOS_VER] },
  { key: 'alertas', label: 'Alertas', icon: 'bi-exclamation-triangle', required: INVENTARIO_TAB_PERMISSIONS.alertas }
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { canAny, loading } = usePermisos();
  const [showInventarioSheet, setShowInventarioSheet] = useState(false);

  const isInInventario = location.pathname.startsWith('/dashboard/inventario');

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2' },
    { name: 'Sucursales', path: '/dashboard/sucursales', icon: 'bi-shop' },
    { name: 'Personas/Empresas', path: '/dashboard/personas', icon: 'bi-people' },
    { name: 'Inventario', path: '/dashboard/inventario', icon: 'bi-box-seam' },
    { name: 'Ventas', path: '/dashboard/ventas', icon: 'bi-cart3' },
    { name: 'Cocina', path: '/dashboard/cocina', icon: 'bi-display' },
    { name: 'Menu', path: '/dashboard/menu', icon: 'bi-journal-text' },
    { name: 'Seguridad', path: '/dashboard/seguridad', icon: 'bi-shield-lock' },
    { name: 'Configuracion', path: '/dashboard/configuracion', icon: 'bi-gear' }
  ];

  const visibleMenuItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const required = NAV_ITEM_PERMISSIONS[item.path];
        if (!required || required.length === 0) return true;
        return canAny(required);
      }),
    [canAny]
  );

  const visibleInventarioOptions = useMemo(
    () => INVENTARIO_OPTIONS.filter((option) => canAny(option.required)),
    [canAny]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const goInventario = (tab) => {
    setShowInventarioSheet(false);
    navigate(`/dashboard/inventario?tab=${tab}`);
  };

  return (
    <>
      <div className="bottom-nav">
        <div className="bottom-nav-scroll">
          {!loading &&
            visibleMenuItems.map((item) => {
              if (item.name === 'Inventario') {
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`bottom-nav-item ${isInInventario ? 'active' : ''}`}
                    onClick={() => setShowInventarioSheet(true)}
                    title="Inventario"
                  >
                    <i className={`bi ${item.icon}`} />
                    <span>{item.name}</span>
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                  title={item.name}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}

          <button type="button" className="bottom-nav-item" onClick={handleLogout} title="Salir">
            <i className="bi bi-box-arrow-right" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {showInventarioSheet ? (
        <div
          className="modal fade show inv-submodule-modal"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2000 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowInventarioSheet(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered inv-submodule-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content shadow inv-submodule-content">
              <div className="modal-header d-flex align-items-center justify-content-between inv-submodule-header">
                <div className="fw-semibold inv-submodule-title">Inventario</div>
                <button
                  type="button"
                  className="btn btn-sm btn-light inv-submodule-close"
                  onClick={() => setShowInventarioSheet(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body d-grid gap-2 inv-submodule-body">
                {visibleInventarioOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="btn btn-outline-primary inv-submodule-option"
                    onClick={() => goInventario(option.key)}
                  >
                    <i className={`bi ${option.icon} me-2`} />
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="modal-footer inv-submodule-footer">
                <div className="text-muted small me-auto inv-submodule-help">SELECCIONA UN SUBMODULO</div>
                <button
                  type="button"
                  className="btn btn-outline-secondary inv-submodule-footer-btn"
                  onClick={() => setShowInventarioSheet(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BottomNav;
