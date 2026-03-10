import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { API_URL } from '../../utils/constants';
import { getAllowedTabs, PERMISSIONS } from '../../utils/permissions';

const MAX_VISIBLE_TABS = 3;
const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/)/i;

const getTabFromSearch = (search, tabs, fallbackKey, options = {}) => {
  const sp = new URLSearchParams(search || '');
  const current = String(sp.get('tab') || fallbackKey).toLowerCase();
  const normalized = options.normalizeMovimientos && current === 'movimientos' ? 'almacenes' : current;
  return tabs.some((tab) => tab.key === normalized) ? normalized : fallbackKey;
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

    const activeEl = tabRefs.current?.[activeKey] || (isActiveInOverflow ? moreBtnRef.current : null);

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
              <span>Mas</span>
              <i className={`bi ${moreOpen ? 'bi-chevron-up' : 'bi-chevron-down'} inventory-more-caret`} />
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
  config ? <InventoryTabsOverflow tabs={config.tabs} activeKey={config.activeKey} onGoTab={config.onGoTab} /> : null;

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [failedPhotoSrc, setFailedPhotoSrc] = useState('');
  const profileMenuRef = useRef(null);
  const gearMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canAny, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

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

  const moduleKey = useMemo(() => {
    if (location.pathname.startsWith('/dashboard/inventario')) return 'inventario';
    if (location.pathname.startsWith('/dashboard/seguridad')) return 'seguridad';
    if (location.pathname.startsWith('/dashboard/personas')) return 'personas';
    if (location.pathname.startsWith('/dashboard/ventas')) return 'ventas';
    return null;
  }, [location.pathname]);

  const moduleTabs = useMemo(() => {
    if (!moduleKey) return [];
    return getAllowedTabs(moduleKey, permisos, { isSuperAdmin });
  }, [isSuperAdmin, moduleKey, permisos]);

  const activeModuleTab = useMemo(() => {
    if (!moduleKey || moduleTabs.length === 0) return null;
    return getTabFromSearch(location.search, moduleTabs, moduleTabs[0].key, {
      normalizeMovimientos: moduleKey === 'inventario'
    });
  }, [location.search, moduleKey, moduleTabs]);

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

  const moduleTabsConfig = useMemo(() => {
    if (permisosLoading || !moduleKey || moduleTabs.length === 0 || !activeModuleTab) return null;
    return {
      tabs: moduleTabs,
      activeKey: activeModuleTab,
      onGoTab: (key) => navigate(`/dashboard/${moduleKey}?tab=${key}`)
    };
  }, [activeModuleTab, moduleKey, moduleTabs, navigate, permisosLoading]);

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
              aria-label="Configuracion"
              aria-haspopup="menu"
              aria-expanded={isGearMenuOpen}
              onClick={toggleGearDropdown}
            >
              <i className="bi bi-gear" />
            </button>

            {isGearMenuOpen && (
              <div className="dropdown-menu-custom gear-dropdown-menu" role="menu" aria-label="Menu de configuracion">
                <button
                  type="button"
                  className="dropdown-menu-item gear-dropdown-item"
                  role="menuitem"
                  onClick={handleGoChangePassword}
                >
                  <i className="bi bi-shield-lock" />
                  Cambiar contrasena
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

            <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} user-profile-caret`} aria-hidden="true" />
          </button>

          {isOpen && (
            <div className="dropdown-menu-custom" role="menu" aria-label="Menu de usuario">
              {canViewProfile ? (
                <button type="button" className="dropdown-menu-item" role="menuitem" onClick={handleGoProfile}>
                  <i className="bi bi-person-circle" />
                  Mi perfil
                </button>
              ) : null}

              <button type="button" className="dropdown-menu-item" role="menuitem" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
