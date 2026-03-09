import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { API_URL } from '../../utils/constants';
import {
  INVENTARIO_TAB_PERMISSIONS,
  PERSONAS_TAB_PERMISSIONS,
  PERMISSIONS,
  SEGURIDAD_TAB_PERMISSIONS,
  VENTAS_TAB_PERMISSIONS
} from '../../utils/permissions';

const INVENTORY_TABS = [
  { key: 'categorias', label: 'Categorias', icon: 'bi bi-tag', required: INVENTARIO_TAB_PERMISSIONS.categorias },
  { key: 'insumos', label: 'Insumos', icon: 'bi bi-box-seam', required: INVENTARIO_TAB_PERMISSIONS.insumos },
  { key: 'productos', label: 'Productos', icon: 'bi bi-basket', required: INVENTARIO_TAB_PERMISSIONS.productos },
  { key: 'almacenes', label: 'Almacenes', icon: 'bi bi-building', required: INVENTARIO_TAB_PERMISSIONS.almacenes },
  { key: 'alertas', label: 'Alertas', icon: 'bi bi-exclamation-triangle', required: INVENTARIO_TAB_PERMISSIONS.alertas }
];

const PERSONAS_TABS = [
  { key: 'personas', label: 'Personas', icon: 'bi bi-person', required: PERSONAS_TAB_PERMISSIONS.personas },
  { key: 'empresas', label: 'Empresas', icon: 'bi bi-building', required: PERSONAS_TAB_PERMISSIONS.empresas },
  { key: 'clientes', label: 'Clientes', icon: 'bi bi-people', required: PERSONAS_TAB_PERMISSIONS.clientes },
  { key: 'empleados', label: 'Empleados', icon: 'bi bi-briefcase', required: PERSONAS_TAB_PERMISSIONS.empleados },
  { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-person-gear', required: PERSONAS_TAB_PERMISSIONS.usuarios },
  { key: 'roles', label: 'Roles y permisos', icon: 'bi bi-person-lock', required: PERSONAS_TAB_PERMISSIONS.roles }
];

const SECURITY_TABS = [
  { key: 'sesiones', label: 'Sesiones activas', icon: 'bi bi-laptop', required: SEGURIDAD_TAB_PERMISSIONS.sesiones },
  { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-people', required: SEGURIDAD_TAB_PERMISSIONS.usuarios },
  { key: 'password', label: 'Politicas de contrasena', icon: 'bi bi-key', required: SEGURIDAD_TAB_PERMISSIONS.password },
  { key: 'logins', label: 'Logs de login', icon: 'bi bi-journal-text', required: SEGURIDAD_TAB_PERMISSIONS.logins }
];

const VENTAS_TABS = [
  { key: 'ventas', label: 'Ventas', icon: 'bi bi-receipt-cutoff', required: VENTAS_TAB_PERMISSIONS.ventas },
  { key: 'caja', label: 'Caja', icon: 'bi bi-cart3', required: VENTAS_TAB_PERMISSIONS.caja },
  { key: 'pedidos', label: 'Pedidos', icon: 'bi bi-journal-richtext', required: VENTAS_TAB_PERMISSIONS.pedidos }
];

const MAX_VISIBLE_TABS = 3;
const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/)/i;

const getTabFromSearch = (search, tabs, fallbackKey) => {
  const sp = new URLSearchParams(search || '');
  const current = String(sp.get('tab') || fallbackKey).toLowerCase();
  return tabs.some((tab) => tab.key === current) ? current : fallbackKey;
};

const normalizeText = (value) => String(value ?? '').trim();

const getUserInitials = (value) => {
  const clean = normalizeText(value);
  if (!clean) return 'IN';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  const first = parts[0]?.charAt(0) || '';
  const last = parts[parts.length - 1]?.charAt(0) || '';
  return `${first}${last}`.toUpperCase() || 'IN';
};

const getApiOrigin = () => {
  const clean = normalizeText(API_URL);
  if (!clean) return '';

  try {
    return new URL(clean).origin;
  } catch {
    return clean.replace(/\/+$/, '');
  }
};

const resolveProfilePhotoSrc = (value) => {
  const photo = normalizeText(value);
  if (!photo || !PHOTO_URL_RE.test(photo)) return '';

  if (/^https?:\/\//i.test(photo)) return photo;

  if (/^\/uploads\//i.test(photo)) {
    const origin = getApiOrigin();
    return origin ? `${origin}${photo}` : photo;
  }

  return '';
};

const getInventoryTabFromSearch = (search, tabs, fallbackKey = 'categorias') => {
  const allowedTabs = Array.isArray(tabs) && tabs.length > 0 ? tabs : INVENTORY_TABS;
  const sp = new URLSearchParams(search || '');
  const current = String(sp.get('tab') || fallbackKey).toLowerCase();
  const normalized = current === 'movimientos' ? 'almacenes' : current;
  return allowedTabs.some((tab) => tab.key === normalized) ? normalized : fallbackKey;
};

const InventoryTabsOverflow = ({ tabs, activeKey, onGoTab }) => {
  const rowRef = useRef(null);
  const sliderRef = useRef(null);
  const moreBtnRef = useRef(null);
  const moreWrapRef = useRef(null);
  const tabRefs = useRef({});
  const [moreOpen, setMoreOpen] = useState(false);

  const layout = useMemo(() => {
    const keys = tabs.map((tab) => tab.key);
    return {
      visibleKeys: keys.slice(0, MAX_VISIBLE_TABS),
      overflowKeys: keys.slice(MAX_VISIBLE_TABS)
    };
  }, [tabs]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => layout.visibleKeys.includes(tab.key)),
    [layout.visibleKeys, tabs]
  );

  const overflowTabs = useMemo(
    () => tabs.filter((tab) => layout.overflowKeys.includes(tab.key)),
    [layout.overflowKeys, tabs]
  );

  const isActiveInOverflow = useMemo(
    () => overflowTabs.some((tab) => tab.key === activeKey),
    [activeKey, overflowTabs]
  );

  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

  const updateSlider = useCallback(() => {
    const rowEl = rowRef.current;
    const sliderEl = sliderRef.current;
    if (!rowEl || !sliderEl) return;

    const activeEl =
      tabRefs.current?.[activeKey] || (isActiveInOverflow ? moreBtnRef.current : null);

    if (!activeEl) {
      sliderEl.style.opacity = '0';
      return;
    }

    const rowRect = rowEl.getBoundingClientRect();
    const buttonRect = activeEl.getBoundingClientRect();
    sliderEl.style.left = `${buttonRect.left - rowRect.left}px`;
    sliderEl.style.width = `${buttonRect.width}px`;
    sliderEl.style.opacity = '1';
  }, [activeKey, isActiveInOverflow]);

  useEffect(() => {
    updateSlider();
  }, [layout.visibleKeys, moreOpen, updateSlider]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.addEventListener('resize', updateSlider);
    return () => {
      window.removeEventListener('resize', updateSlider);
    };
  }, [updateSlider]);

  useEffect(() => {
    closeMore();
  }, [activeKey, closeMore]);

  useEffect(() => {
    if (!moreOpen) return undefined;

    const handlePointerDown = (event) => {
      if (moreWrapRef.current && !moreWrapRef.current.contains(event.target)) {
        closeMore();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMore();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMore, moreOpen]);

  return (
    <div className="inventory-tabs-bar" aria-label="Submodulos">
      <div className="inventory-tabs-fixed" ref={rowRef}>
        <div className="inventory-active-slider" ref={sliderRef} />

        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            ref={(element) => {
              if (element) tabRefs.current[tab.key] = element;
            }}
            type="button"
            className={`inventory-tab-btn ${activeKey === tab.key ? 'inventory-tab-active' : ''}`}
            onClick={() => onGoTab(tab.key)}
            aria-current={activeKey === tab.key ? 'page' : undefined}
          >
            <span className="active-dot" />
            <i className={tab.icon} />
            <span>{tab.label}</span>
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
              onClick={() => setMoreOpen((state) => !state)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <span className="active-dot" />
              <i className="bi bi-three-dots" />
              <span>Más</span>
              <i
                className={`bi ${
                  moreOpen ? 'bi-chevron-up' : 'bi-chevron-down'
                } inventory-more-caret`}
              />
            </button>

            {moreOpen && (
              <div className="inventory-more-menu" role="menu">
                {overflowTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="menuitem"
                    className={`inventory-more-item ${activeKey === tab.key ? 'active' : ''}`}
                    onClick={() => {
                      closeMore();
                      onGoTab(tab.key);
                    }}
                  >
                    <i className={tab.icon} />
                    <span>{tab.label}</span>
                    {activeKey === tab.key ? <span className="inventory-more-dot" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const NavbarTabs = ({ config }) =>
  config ? (
    <InventoryTabsOverflow
      tabs={config.tabs}
      activeKey={config.activeKey}
      onGoTab={config.onGoTab}
    />
  ) : null;

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [failedPhotoSrc, setFailedPhotoSrc] = useState('');
  const profileMenuRef = useRef(null);
  const gearMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canAny, loading: permisosLoading } = usePermisos();

  const userName = user?.nombre_usuario || 'Invitado';
  const userRole = useMemo(() => {
    const roleRows = Array.isArray(user?.roles) ? user.roles : [];
    if (roleRows.length === 0) return 'Usuario';
    return roleRows.join(', ');
  }, [user?.roles]);
  const userPhotoSrc = useMemo(() => resolveProfilePhotoSrc(user?.foto_perfil), [user?.foto_perfil]);
  const userInitials = useMemo(() => getUserInitials(userName), [userName]);
  const showUserPhoto = Boolean(userPhotoSrc) && failedPhotoSrc !== userPhotoSrc;
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const canViewProfile = canAny([PERMISSIONS.PERFIL_VER]);

  const visibleInventoryTabs = useMemo(
    () => INVENTORY_TABS.filter((tab) => canAny(tab.required || [])),
    [canAny]
  );

  const visibleSecurityTabs = useMemo(
    () => SECURITY_TABS.filter((tab) => canAny(tab.required || [])),
    [canAny]
  );

  const visiblePersonasTabs = useMemo(
    () => PERSONAS_TABS.filter((tab) => canAny(tab.required || [])),
    [canAny]
  );

  const visibleVentasTabs = useMemo(
    () => VENTAS_TABS.filter((tab) => canAny(tab.required || [])),
    [canAny]
  );

  const isInventario = location.pathname?.startsWith('/dashboard/inventario');
  const isSeguridad = location.pathname?.startsWith('/dashboard/seguridad');
  const isPersonas = location.pathname?.startsWith('/dashboard/personas');
  const isVentas = location.pathname?.startsWith('/dashboard/ventas');

  const activeInventoryKey = useMemo(() => {
    const fallback = visibleInventoryTabs[0]?.key || 'categorias';
    return getInventoryTabFromSearch(location.search, visibleInventoryTabs, fallback);
  }, [location.search, visibleInventoryTabs]);

  const activeSecurityKey = useMemo(
    () => getTabFromSearch(location.search, visibleSecurityTabs, visibleSecurityTabs[0]?.key || 'sesiones'),
    [location.search, visibleSecurityTabs]
  );

  const activePersonasKey = useMemo(
    () => getTabFromSearch(location.search, visiblePersonasTabs, visiblePersonasTabs[0]?.key || 'personas'),
    [location.search, visiblePersonasTabs]
  );

  const activeVentasKey = useMemo(
    () => getTabFromSearch(location.search, visibleVentasTabs, visibleVentasTabs[0]?.key || 'ventas'),
    [location.search, visibleVentasTabs]
  );

  const closeProfileDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const closeGearDropdown = useCallback(() => {
    setIsGearMenuOpen(false);
  }, []);

  const toggleDropdown = () => {
    setIsOpen((state) => {
      const nextState = !state;
      if (nextState) closeGearDropdown();
      return nextState;
    });
  };

  const toggleGearDropdown = () => {
    setIsGearMenuOpen((state) => {
      const nextState = !state;
      if (nextState) closeProfileDropdown();
      return nextState;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleGoProfile = () => {
    closeProfileDropdown();
    closeGearDropdown();
    navigate('/dashboard/perfil');
  };

  const handleGoChangePassword = () => {
    closeGearDropdown();
    closeProfileDropdown();
    navigate('/dashboard/perfil/cambiar-contrasena');
  };

  const goInventarioTab = useCallback((key) => {
    navigate(`/dashboard/inventario?tab=${key}`);
  }, [navigate]);

  const goSeguridadTab = useCallback((key) => {
    navigate(`/dashboard/seguridad?tab=${key}`);
  }, [navigate]);

  const goPersonasTab = useCallback((key) => {
    navigate(`/dashboard/personas?tab=${key}`);
  }, [navigate]);

  const goVentasTab = useCallback((key) => {
    navigate(`/dashboard/ventas?tab=${key}`);
  }, [navigate]);

  const moduleTabsConfig = useMemo(() => {
    if (permisosLoading) return null;

    if (isInventario) {
      if (visibleInventoryTabs.length === 0) return null;
      return {
        tabs: visibleInventoryTabs,
        activeKey: activeInventoryKey,
        onGoTab: goInventarioTab
      };
    }

    if (isSeguridad) {
      if (visibleSecurityTabs.length === 0) return null;
      return {
        tabs: visibleSecurityTabs,
        activeKey: activeSecurityKey,
        onGoTab: goSeguridadTab
      };
    }

    if (isPersonas) {
      if (visiblePersonasTabs.length === 0) return null;
      return {
        tabs: visiblePersonasTabs,
        activeKey: activePersonasKey,
        onGoTab: goPersonasTab
      };
    }

    if (isVentas) {
      if (visibleVentasTabs.length === 0) return null;
      return {
        tabs: visibleVentasTabs,
        activeKey: activeVentasKey,
        onGoTab: goVentasTab
      };
    }

    return null;
  }, [
    activeInventoryKey,
    activePersonasKey,
    activeSecurityKey,
    activeVentasKey,
    goInventarioTab,
    goPersonasTab,
    goSeguridadTab,
    goVentasTab,
    isInventario,
    isPersonas,
    isSeguridad,
    isVentas,
    permisosLoading,
    visibleInventoryTabs,
    visiblePersonasTabs,
    visibleSecurityTabs,
    visibleVentasTabs
  ]);

  useEffect(() => {
    closeProfileDropdown();
    closeGearDropdown();
  }, [closeGearDropdown, closeProfileDropdown, location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen && !isGearMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (isOpen && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        closeProfileDropdown();
      }

      if (isGearMenuOpen && gearMenuRef.current && !gearMenuRef.current.contains(event.target)) {
        closeGearDropdown();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeProfileDropdown();
        closeGearDropdown();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeGearDropdown, closeProfileDropdown, isGearMenuOpen, isOpen]);

  return (
    <div className="top-navbar">
      <div className="top-navbar__left">
        {isDashboard ? (
          <div className="navbar-context" aria-label="Ubicacion actual">
            <span className="navbar-context__eyebrow">Panel Dashboard</span>
            <span className="navbar-context__title">Vista general</span>
          </div>
        ) : null}

        {moduleTabsConfig ? (
          <div className="navbar-tabs-zone">
            <NavbarTabs config={moduleTabsConfig} />
          </div>
        ) : null}
      </div>

      <div className="navbar-right">
        <div className="navbar-icon-group" aria-label="Acciones rapidas">
          <button type="button" className="navbar-icon-btn" aria-label="Notificaciones">
            <i className="bi bi-bell" />
          </button>

          <div className="position-relative gear-dropdown-wrap" ref={gearMenuRef}>
            <button
              type="button"
              className="navbar-icon-btn"
              aria-label="Configuración"
              aria-haspopup="menu"
              aria-expanded={isGearMenuOpen}
              onClick={toggleGearDropdown}
            >
              <i className="bi bi-gear" />
            </button>

            {isGearMenuOpen && (
              <div
                className="dropdown-menu-custom gear-dropdown-menu"
                role="menu"
                aria-label="Menú de configuración"
              >
                <button
                  type="button"
                  className="dropdown-menu-item gear-dropdown-item"
                  role="menuitem"
                  onClick={handleGoChangePassword}
                >
                  <i className="bi bi-shield-lock" />
                  Cambiar contraseña
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`user-profile-container ${isOpen ? 'is-open' : ''}`} ref={profileMenuRef}>
          <button
            type="button"
            className="user-profile"
            onClick={toggleDropdown}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-label="Abrir menu de usuario"
          >
            <div className="text-info">
              <h6>{userName}</h6>
              <p>{userRole}</p>
            </div>

            <span className="user-avatar-frame">
              {showUserPhoto ? (
                <img
                  src={userPhotoSrc}
                  alt={`Perfil de ${userName}`}
                  onError={() => setFailedPhotoSrc(userPhotoSrc)}
                />
              ) : (
                <span className="user-avatar-fallback">{userInitials}</span>
              )}
            </span>

            <i
              className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} user-profile-caret`}
              aria-hidden="true"
            />
          </button>

          {isOpen && (
            <div className="dropdown-menu-custom" role="menu" aria-label="Menu de usuario">
              {canViewProfile ? (
                <button
                  type="button"
                  className="dropdown-menu-item"
                  role="menuitem"
                  onClick={handleGoProfile}
                >
                  <i className="bi bi-person-circle" />
                  Mi perfil
                </button>
              ) : null}

              <button
                type="button"
                className="dropdown-menu-item"
                role="menuitem"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;