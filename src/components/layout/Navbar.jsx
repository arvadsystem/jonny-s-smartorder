import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import userAvatar from '../../assets/images/logo-jonnys.png';

// ==================================
// INVENTARIO - SUBMODULOS (4 + MAS)
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
// SEGURIDAD - SUBMODULOS
// ==================================
const SECURITY_TABS = [
  { key: 'sesiones', label: 'Sesiones activas', icon: 'bi bi-laptop' },
  { key: 'password', label: 'Políticas de contraseña', icon: 'bi bi-key' },
  { key: 'logins', label: 'Logs de login', icon: 'bi bi-journal-text' }
];

// ==================================
// PERSONAS - SUBMODULOS (NUEVO)
// ==================================
const PERSONAS_TABS = [
  { key: 'personas', label: 'Personas', icon: 'bi bi-person' },
  { key: 'empresas', label: 'Empresas', icon: 'bi bi-building' },
  { key: 'empleados', label: 'Empleados', icon: 'bi bi-briefcase' },
  { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-person-gear' },
  { key: 'clientes', label: 'Clientes', icon: 'bi bi-people' }
];

// AJUSTE: se muestran 4 tabs fijos y el resto en "Mas".
const MAX_VISIBLE_TABS = 4;

const getTabFromSearch = (search, tabs, fallbackKey) => {
  const sp = new URLSearchParams(search || '');
  const t = String(sp.get('tab') || fallbackKey).toLowerCase();
  return tabs.some((x) => x.key === t) ? t : fallbackKey;
};

const InventoryTabsOverflow = ({ tabs, activeKey, onGoTab }) => {
  const rowRef = useRef(null);
  const sliderRef = useRef(null);
  const moreBtnRef = useRef(null);
  const moreWrapRef = useRef(null);
  const tabRefs = useRef({});

  const [moreOpen, setMoreOpen] = useState(false);

  // AJUSTE: 4 FIJOS + EL RESTO EN "MAS"
  const layout = useMemo(() => {
    const keys = tabs.map((t) => t.key);
    const visibleKeys = keys.slice(0, MAX_VISIBLE_TABS);
    const overflowKeys = keys.slice(MAX_VISIBLE_TABS);
    return { visibleKeys, overflowKeys };
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

    // FUNCIONALIDAD: SI EL ACTIVO ESTA EN OVERFLOW, LA PASTILLA ACTIVA SE VA A "MAS"
    const activeEl =
      tabRefs.current?.[activeKey] || (isActiveInOverflow ? moreBtnRef.current : null);

    if (!activeEl) {
      sliderEl.style.opacity = '0';
      return;
    }

    const rowRect = rowEl.getBoundingClientRect();
    const btnRect = activeEl.getBoundingClientRect();
    const left = btnRect.left - rowRect.left;

    sliderEl.style.left = `${left}px`;
    sliderEl.style.width = `${btnRect.width}px`;
    sliderEl.style.opacity = '1';
  };

  useEffect(() => {
    updateSlider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, isActiveInOverflow, layout.visibleKeys.join('|')]);

  useEffect(() => {
    // FUNCIONALIDAD: CIERRA EL MENU AL CAMBIAR TAB
    closeMore();
  }, [activeKey]);

  useEffect(() => {
    // FUNCIONALIDAD: CERRAR "MAS" AL HACER CLICK FUERA / ESC
    const onDown = (e) => {
      if (!moreOpen) return;
      const wrap = moreWrapRef.current;
      if (wrap && !wrap.contains(e.target)) setMoreOpen(false);
    };

    const onKey = (e) => {
      if (!moreOpen) return;
      if (e.key === 'Escape') setMoreOpen(false);
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
              ref={(el) => {
                if (el) tabRefs.current[t.key] = el;
              }}
              type="button"
              className={`inventory-tab-btn ${activeKey === t.key ? 'inventory-tab-active' : ''}`}
              onClick={() => onGoTab(t.key)}
              aria-current={activeKey === t.key ? 'page' : undefined}
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
                className={`inventory-tab-btn inventory-more-btn ${
                  isActiveInOverflow ? 'inventory-tab-active' : ''
                }`}
                onClick={() => setMoreOpen((s) => !s)}
                aria-expanded={moreOpen}
              >
                <span className="active-dot" />
                <i className="bi bi-three-dots" />
                <span>Mas</span>
                <i
                  className={`bi ${
                    moreOpen ? 'bi-chevron-up' : 'bi-chevron-down'
                  } inventory-more-caret`}
                />
              </button>

              {moreOpen && (
                <div className="inventory-more-menu" role="menu">
                  {overflowTabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="menuitem"
                      className={`inventory-more-item ${activeKey === t.key ? 'active' : ''}`}
                      onClick={() => {
                        closeMore();
                        onGoTab(t.key);
                      }}
                    >
                      <i className={t.icon} />
                      <span>{t.label}</span>
                      {activeKey === t.key ? <span className="inventory-more-dot" /> : null}
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

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);

  const toggleDropdown = () => setIsOpen((s) => !s);
  const toggleSearch = () => setIsSearchOpen((s) => !s);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const userName = user?.nombre_usuario || 'Invitado';
  const userRole = user?.rol === 1 ? 'Super Admin' : 'Usuario';

  // FUNCIONALIDAD: SOLO EN INVENTARIO/SEGURIDAD/PERSONAS SE MUESTRAN SUBMODULOS
  const isInventario = location.pathname?.startsWith('/dashboard/inventario');
  const isSeguridad = location.pathname?.startsWith('/dashboard/seguridad');
  const isPersonas = location.pathname?.startsWith('/dashboard/personas'); // NUEVO

  const activeInventoryKey = useMemo(
    () => getTabFromSearch(location.search, INVENTORY_TABS, 'categorias'),
    [location.search]
  );

  const activeSecurityKey = useMemo(
    () => getTabFromSearch(location.search, SECURITY_TABS, 'sesiones'),
    [location.search]
  );

  const activePersonasKey = useMemo(
    () => getTabFromSearch(location.search, PERSONAS_TABS, 'personas'),
    [location.search]
  );

  const goInventarioTab = (key) => {
    navigate(`/dashboard/inventario?tab=${key}`);
  };

  const goSeguridadTab = (key) => {
    navigate(`/dashboard/seguridad?tab=${key}`);
  };

  const goPersonasTab = (key) => {
    navigate(`/dashboard/personas?tab=${key}`);
  };

  useEffect(() => {
    if (!isSearchOpen) return;

    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    const onDown = (e) => {
      const wrap = searchWrapRef.current;
      if (wrap && !wrap.contains(e.target)) setIsSearchOpen(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setIsSearchOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isSearchOpen]);

  return (
    <div className="top-navbar">
      <div className="navbar-tabs-zone">
        {isInventario ? (
          <InventoryTabsOverflow
            tabs={INVENTORY_TABS}
            activeKey={activeInventoryKey}
            onGoTab={goInventarioTab}
          />
        ) : null}

        {isSeguridad ? (
          <InventoryTabsOverflow
            tabs={SECURITY_TABS}
            activeKey={activeSecurityKey}
            onGoTab={goSeguridadTab}
          />
        ) : null}

        {isPersonas ? (
          <InventoryTabsOverflow
            tabs={PERSONAS_TABS}
            activeKey={activePersonasKey}
            onGoTab={goPersonasTab}
          />
        ) : null}
      </div>

      <div className="navbar-right">
        <div
          ref={searchWrapRef}
          className={`search-container d-none d-md-flex ${isSearchOpen ? 'is-open' : 'is-collapsed'}`}
          role="search"
          aria-label="Buscar"
        >
          <button
            type="button"
            className="search-trigger"
            onClick={toggleSearch}
            aria-label={isSearchOpen ? 'Cerrar búsqueda' : 'Abrir búsqueda'}
            aria-expanded={isSearchOpen}
          >
            <i className="bi bi-search" />
          </button>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Buscar..."
            tabIndex={isSearchOpen ? 0 : -1}
            aria-hidden={!isSearchOpen}
          />
        </div>

        <div className="navbar-icon-group" aria-label="Acciones rápidas">
          <button type="button" className="navbar-icon-btn" aria-label="Notificaciones">
            <i className="bi bi-bell" />
          </button>
          <button type="button" className="navbar-icon-btn" aria-label="Configuración">
            <i className="bi bi-gear" />
          </button>
        </div>

        <div className="user-profile-container" onClick={toggleDropdown}>
          <div className="user-profile">
            <div className="text-info d-none d-sm-block">
              <h6>{userName}</h6>
              <p>{userRole}</p>
            </div>
            <img src={userAvatar} alt="Perfil" />

            <i
              className={`bi bi-chevron-down small ms-2 text-muted ${isOpen ? 'd-none' : ''}`}
              style={{ fontSize: '0.8rem' }}
            />
            <i
              className={`bi bi-chevron-up small ms-2 text-muted ${!isOpen ? 'd-none' : ''}`}
              style={{ fontSize: '0.8rem' }}
            />
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
                  Cerrar Sesion
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
