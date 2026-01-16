import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // ==============================
  // ESTADO DEL "SHEET" INVENTARIO (RESPONSIVE)
  // ==============================
  const [showInventarioSheet, setShowInventarioSheet] = useState(false);

  // DETECTAR SI ESTAMOS EN INVENTARIO (PARA MARCAR ACTIVO)
  const isInInventario = location.pathname.startsWith('/dashboard/inventario');

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
    // ✅ MANTIENE LA LOGICA NUEVA (BORRA COOKIES EN BACKEND)
    await logout();
    navigate('/', { replace: true });
  };

  // ==============================
  // NAVEGAR A SUBMODULO INVENTARIO (CIERRA SHEET)
  // ==============================
  const goInventario = (tab) => {
    setShowInventarioSheet(false);
    navigate(`/dashboard/inventario?tab=${tab}`);
  };

  return (
    <>
      <div className="bottom-nav">
        <div className="bottom-nav-scroll">
          {menuItems.map((item) => {
            // ==============================
            // INVENTARIO: EN MOVIL ABRE MODAL DE SUBMODULOS
            // ==============================
            if (item.name === 'Inventario') {
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`bottom-nav-item ${isInInventario ? 'active' : ''}`}
                  onClick={() => setShowInventarioSheet(true)}
                  title="Inventario"
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.name}</span>
                </button>
              );
            }

            // ==============================
            // RESTO: IGUAL QUE ANTES
            // ==============================
            return (
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
            );
          })}

          {/* ✅ Opción original (Salir) ahora en la barra inferior */}
          <button type="button" className="bottom-nav-item" onClick={handleLogout} title="Salir">
            <i className="bi bi-box-arrow-right"></i>
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* ==============================
          MODAL INVENTARIO (CENTRADO)
          ============================== */}
      {showInventarioSheet && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2000 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowInventarioSheet(false)}
        >
          {/* COMENTARIO EN MAYÚSCULAS: CAMBIO DE BOTTOM SHEET A MODAL CENTRADO */}
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow">
              <div className="modal-header d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Inventario</div>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={() => setShowInventarioSheet(false)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('categorias')}
                >
                  <i className="bi bi-tags me-2"></i>
                  Categorías
                </button>

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('insumos')}
                >
                  <i className="bi bi-box me-2"></i>
                  Insumos
                </button>

                {/* COMENTARIO EN MAYÚSCULAS: NUEVA OPCIÓN PRODUCTOS */}
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('productos')}
                >
                  <i className="bi bi-basket2 me-2"></i>
                  Productos
                </button>

                {/* COMENTARIO EN MAYÚSCULAS: NUEVA OPCIÓN ALMACENES */}
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('almacenes')}
                >
                  <i className="bi bi-building me-2"></i>
                  Almacenes
                </button>

                {/* COMENTARIO EN MAYÚSCULAS: NUEVA OPCIÓN MOVIMIENTOS */}
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('movimientos')}
                >
                  <i className="bi bi-arrow-left-right me-2"></i>
                  Movimientos
                </button>

                {/* COMENTARIO EN MAYÚSCULAS: NUEVA OPCIÓN ALERTAS */}
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => goInventario('alertas')}
                >
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Alertas
                </button>


              </div>

              <div className="modal-footer">
                <div className="text-muted small me-auto">SELECCIONA UN SUBMÓDULO</div>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowInventarioSheet(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNav;
