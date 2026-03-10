import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import {
  getAllowedTabs,
  getVisibleModuleItems
} from '../../utils/permissions';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { isSuperAdmin, loading, permisos } = usePermisos();
  const [showInventarioSheet, setShowInventarioSheet] = useState(false);

  const isInInventario = location.pathname.startsWith('/dashboard/inventario');

  const visibleMenuItems = useMemo(
    () => getVisibleModuleItems(permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  const visibleInventarioOptions = useMemo(
    () => getAllowedTabs('inventario', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
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
              if (item.key === 'inventario') {
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`bottom-nav-item ${isInInventario ? 'active' : ''}`}
                    onClick={() => {
                      if (visibleInventarioOptions.length <= 1) {
                        const onlyTab = visibleInventarioOptions[0]?.key || 'categorias';
                        goInventario(onlyTab);
                        return;
                      }
                      setShowInventarioSheet(true);
                    }}
                    title={item.name}
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
                    <i className={`${option.icon} me-2`} />
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
