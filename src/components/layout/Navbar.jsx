import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import userAvatar from '../../assets/images/logo-jonnys.png';

// ==================================
// INVENTARIO - SUBMODULOS (4 + MÁS)
// ==================================
const INVENTORY_TABS = [
  { key: 'categorias', label: 'Categorías', icon: 'bi bi-tag' },
  { key: 'insumos', label: 'Insumos', icon: 'bi bi-box-seam' },
  { key: 'productos', label: 'Productos', icon: 'bi bi-basket' },
  { key: 'almacenes', label: 'Almacenes', icon: 'bi bi-building' },
  { key: 'movimientos', label: 'Movimientos', icon: 'bi bi-arrow-left-right' },
  { key: 'alertas', label: 'Alertas', icon: 'bi bi-exclamation-triangle' }
];

// ==================================
// PERSONAS - SUBMODULOS
// ==================================
const PERSONAS_TABS = [
  { key: 'personas', label: 'Personas', icon: 'bi bi-person' },
  { key: 'empresas', label: 'Empresas', icon: 'bi bi-building' },
  { key: 'empleados', label: 'Empleados', icon: 'bi bi-briefcase' },
  { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-person-gear' },
  { key: 'clientes', label: 'Clientes', icon: 'bi bi-people' }
];

const MAX_VISIBLE_TABS = 4;

// ==================================
// UTILIDAD GENERICA
// ==================================
const getTabFromSearch = (search, tabs, defaultKey) => {
  const sp = new URLSearchParams(search || '');
  const t = String(sp.get('tab') || defaultKey).toLowerCase();
  return tabs.some((x) => x.key === t) ? t : defaultKey;
};

// ==================================
// COMPONENTE OVERFLOW (MISMO DISEÑO)
// ==================================
const TabsOverflow = ({ tabs, activeKey, onGoTab }) => {
  const rowRef = useRef(null);
  const sliderRef = useRef(null);
  const moreBtnRef = useRef(null);
  const moreWrapRef = useRef(null);
  const tabRefs = useRef({});
  const [moreOpen, setMoreOpen] = useState(false);

  const layout = useMemo(() => {
    const keys = tabs.map((t) => t.key);
    return {
      visibleKeys: keys.slice(0, MAX_VISIBLE_TABS),
      overflowKeys: keys.slice(MAX_VISIBLE_TABS)
    };
  }, [tabs]);

  const visibleTabs = useMemo(
    () => tabs.filter((t) => layout.visibleKeys.includes(t.key)),
    [tabs, layout.visibleKeys]
  );

  const overflowTabs = useMemo(
    () => tabs.filter((t) => layout.overflowKeys.includes(t.key)),
    [tabs, layout.overflowKeys]
  );

  const isActiveInOverflow = useMemo(
    () => overflowTabs.some((t) => t.key === activeKey),
    [overflowTabs, activeKey]
  );

  const closeMore = () => setMoreOpen(false);

  const updateSlider = () => {
    const rowEl = rowRef.current;
    const sliderEl = sliderRef.current;
    if (!rowEl || !sliderEl) return;

    const activeEl =
      tabRefs.current?.[activeKey] ||
      (isActiveInOverflow ? moreBtnRef.current : null);

    if (!activeEl) {
      sliderEl.style.opacity = '0';
      return;
    }

    const rowRect = rowEl.getBoundingClientRect();
    const btnRect = activeEl.getBoundingClientRect();

    sliderEl.style.left = `${btnRect.left - rowRect.left}px`;
    sliderEl.style.width = `${btnRect.width}px`;
    sliderEl.style.opacity = '1';
  };

  useEffect(() => {
    updateSlider();
  }, [activeKey, isActiveInOverflow]);

  useEffect(() => {
    closeMore();
  }, [activeKey]);

  useEffect(() => {
    const onDown = (e) => {
      if (!moreOpen) return;
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };

    const onKey = (e) => {
      if (moreOpen && e.key === 'Escape') setMoreOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <div className="navbar-left">
      <div className="inventory-tabs-bar">
        <div className="inventory-tabs-fixed" ref={rowRef}>
          <div className="inventory-active-slider" ref={sliderRef} />

          {visibleTabs.map((t) => (
            <button
              key={t.key}
              ref={(el) => (tabRefs.current[t.key] = el)}
              type="button"
              className={`inventory-tab-btn ${activeKey === t.key ? 'inventory-tab-active' : ''}`}
              onClick={() => onGoTab(t.key)}
            >
              <span className="active-dot" />
              <i className={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}

          {overflowTabs.length > 0 && (
            <div className="inventory-more-wrap" ref={moreWrapRef}>
              <button
                ref={moreBtnRef}
                type="button"
                className={`inventory-tab-btn inventory-more-btn ${isActiveInOverflow ? 'inventory-tab-active' : ''}`}
                onClick={() => setMoreOpen((s) => !s)}
              >
                <span className="active-dot" />
                <i className="bi bi-three-dots" />
                <span>Más</span>
              </button>

              {moreOpen && (
                <div className="inventory-more-menu">
                  {overflowTabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`inventory-more-item ${activeKey === t.key ? 'active' : ''}`}
                      onClick={() => {
                        closeMore();
                        onGoTab(t.key);
                      }}
                    >
                      <i className={t.icon} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================================
// NAVBAR PRINCIPAL (SIN TOCAR DISEÑO)
// ==================================
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const moduleTabs = useMemo(() => {
    if (location.pathname.startsWith('/dashboard/inventario')) {
      return { key: 'inventario', tabs: INVENTORY_TABS };
    }
    if (location.pathname.startsWith('/dashboard/personas')) {
      return { key: 'personas', tabs: PERSONAS_TABS };
    }
    return null;
  }, [location.pathname]);

  const activeKey = useMemo(() => {
    if (!moduleTabs) return null;
    return getTabFromSearch(location.search, moduleTabs.tabs, moduleTabs.tabs[0].key);
  }, [location.search, moduleTabs]);

  const goTab = (key) => {
    if (!moduleTabs) return;
    navigate(`/dashboard/${moduleTabs.key}?tab=${key}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const userName = user?.nombre_usuario || 'Invitado';
  const userRole = user?.rol === 1 ? 'Super Admin' : 'Usuario';

  return (
    <div className="top-navbar">
      {moduleTabs && (
        <TabsOverflow
          tabs={moduleTabs.tabs}
          activeKey={activeKey}
          onGoTab={goTab}
        />
      )}

      <div className="user-profile-container" onClick={() => setIsOpen((s) => !s)}>
        <div className="user-profile">
          <div className="text-info d-none d-sm-block">
            <h6>{userName}</h6>
            <p>{userRole}</p>
          </div>
          <img src={userAvatar} alt="Perfil" />
        </div>

        {isOpen && (
          <div className="dropdown-menu-custom">
            <ul>
              <li onClick={() => navigate('/dashboard/perfil')}>
                <i className="bi bi-person-circle" />
                Mi perfil
              </li>
              <li onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" />
                Cerrar Sesión
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;