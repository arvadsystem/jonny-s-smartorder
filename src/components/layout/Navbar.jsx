import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_URL } from '../../utils/constants';

const INVENTORY_TABS = [
  { key: 'categorias', label: 'Categorias', icon: 'bi bi-tag' },
  { key: 'insumos', label: 'Insumos', icon: 'bi bi-box-seam' },
  { key: 'productos', label: 'Productos', icon: 'bi bi-basket' },
  { key: 'almacenes', label: 'Almacenes', icon: 'bi bi-building' },
  { key: 'alertas', label: 'Alertas', icon: 'bi bi-exclamation-triangle' }
];

const SECURITY_TABS_BASE = [
  { key: 'sesiones', label: 'Sesiones activas', icon: 'bi bi-laptop' },
  { key: 'password', label: 'Politicas de contrasena', icon: 'bi bi-key' },
  { key: 'logins', label: 'Logs de login', icon: 'bi bi-journal-text' }
];

const PERSONAS_TABS = [
  { key: 'personas', label: 'Personas', icon: 'bi bi-person' },
  { key: 'empresas', label: 'Empresas', icon: 'bi bi-building' },
  { key: 'clientes', label: 'Clientes', icon: 'bi bi-people' },
  { key: 'empleados', label: 'Empleados', icon: 'bi bi-briefcase' },
  { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-person-gear' },
  { key: 'roles', label: 'Roles y permisos', icon: 'bi bi-person-lock' },
  
];

const VENTAS_TABS = [
  { key: 'ventas', label: 'Ventas', icon: 'bi bi-receipt-cutoff' },
  { key: 'caja', label: 'Caja', icon: 'bi bi-cart3' },
  { key: 'pedidos', label: 'Pedidos', icon: 'bi bi-journal-richtext' }
];

const MAX_VISIBLE_TABS = 3;
const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/)/i;

const getTabFromSearch = (search, tabs, fallbackKey) => {
  const sp = new URLSearchParams(search || '');
  const current = String(sp.get('tab') || fallbackKey).toLowerCase();
  return tabs.some((tab) => tab.key === current) ? current : fallbackKey;
};

// --- INICIO DE CONFLICTO 1 RESUELTO (Mantenemos funciones de personas + función de dev) ---
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

const getInventoryTabFromSearch = (search) => {
  const sp = new URLSearchParams(search || '');
  const current = String(sp.get('tab') || 'categorias').toLowerCase();
  const normalized = current === 'movimientos' ? 'almacenes' : current;
  return INVENTORY_TABS.some((tab) => tab.key === normalized) ? normalized : 'categorias';
};
// --- FIN DE CONFLICTO 1 RESUELTO ---

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
              <span>Mas</span>
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
    <InventoryTabsOverflow tabs={config.tabs} activeKey={config.activeKey} onGoTab={config.onGoTab} />
  ) : null;

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [failedPhotoSrc, setFailedPhotoSrc] = useState('');
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const userName = user?.nombre_usuario || 'Invitado';
  const isSuperAdmin = Number(user?.rol) === 1;
  const userRole = isSuperAdmin ? 'Super Admin' : 'Usuario';
  const userPhotoSrc = useMemo(() => resolveProfilePhotoSrc(user?.foto_perfil), [user?.foto_perfil]);
  const userInitials = useMemo(() => getUserInitials(userName), [userName]);
  const showUserPhoto = Boolean(userPhotoSrc) && failedPhotoSrc !== userPhotoSrc;
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  const securityTabs = useMemo(() => {
    const tabs = [...SECURITY_TABS_BASE];
    // --- INICIO DE CONFLICTO 2 RESUELTO (Usamos validación limpia de la rama personas) ---
    if (isSuperAdmin) {
      // Lo metemos después de Sesiones activas
      tabs.splice(1, 0, { key: 'usuarios', label: 'Usuarios', icon: 'bi bi-people' });
    }
    // --- FIN DE CONFLICTO 2 RESUELTO ---
    return tabs;
  }, [isSuperAdmin]);

  const isInventario = location.pathname?.startsWith('/dashboard/inventario');
  const isSeguridad = location.pathname?.startsWith('/dashboard/seguridad');
  const isPersonas = location.pathname?.startsWith('/dashboard/personas');
  const isVentas = location.pathname?.startsWith('/dashboard/ventas');

  const activeInventoryKey = useMemo(
    () => getInventoryTabFromSearch(location.search),
    [location.search]
  );

  const activeSecurityKey = useMemo(
    () => getTabFromSearch(location.search, securityTabs, 'sesiones'),
    [location.search, securityTabs]
  );

  const activePersonasKey = useMemo(
    () => getTabFromSearch(location.search, PERSONAS_TABS, 'personas'),
    [location.search]
  );

  const activeVentasKey = useMemo(
    () => getTabFromSearch(location.search, VENTAS_TABS, 'ventas'),
    [location.search]
  );

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDropdown = () => {
    setIsOpen((state) => !state);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleGoProfile = () => {
    closeDropdown();
    navigate('/dashboard/perfil');
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
    if (isInventario) {
      return {
        tabs: INVENTORY_TABS,
        activeKey: activeInventoryKey,
        onGoTab: goInventarioTab
      };
    }

    if (isSeguridad) {
      return {
        tabs: securityTabs,
        activeKey: activeSecurityKey,
        onGoTab: goSeguridadTab
      };
    }

    if (isPersonas) {
      return {
        tabs: PERSONAS_TABS,
        activeKey: activePersonasKey,
        onGoTab: goPersonasTab
      };
    }

    if (isVentas) {
      return {
        tabs: VENTAS_TABS,
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
    securityTabs
  ]);

  useEffect(() => {
    closeDropdown();
  }, [closeDropdown, location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDropdown();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDropdown, isOpen]);

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
          <button type="button" className="navbar-icon-btn" aria-label="Configuracion">
            <i className="bi bi-gear" />
          </button>
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
              <button type="button" className="dropdown-menu-item" role="menuitem" onClick={handleGoProfile}>
                <i className="bi bi-person-circle" />
                Mi perfil
              </button>
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