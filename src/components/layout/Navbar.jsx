import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { securityService } from '../../services/securityService';
import { API_URL } from '../../utils/constants';
import { getAllowedTabs, PERMISSIONS } from '../../utils/permissions';
import {
  isPlanillasContext,
  PLANILLAS_NAV_QUERY_PARAM,
  PLANILLAS_PARENT_TAB_KEY
} from '../../modules/planillas/navigation';

const MAX_VISIBLE_TABS = 3;
const NOTIFICATIONS_POLL_MS = 1500;
const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/|data:image\/)/i;
const NOTIFICATION_SOUND_BUCKET_PATH = 'notificacion/NotificacionJonnys.mp3';
const SUPABASE_PUBLIC_BASE = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const NOTIFICATION_SOUND_URL = SUPABASE_PUBLIC_BASE
  ? `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/${NOTIFICATION_SOUND_BUCKET_PATH}`
  : `https://ooofeoziqaoqcufifqci.supabase.co/storage/v1/object/public/${NOTIFICATION_SOUND_BUCKET_PATH}`;

const getTabFromSearch = (search, tabs, fallbackKey, options = {}) => {
  const sp = new URLSearchParams(search || '');
  const paramName = String(options.paramName || 'tab');
  const current = String(sp.get(paramName) || fallbackKey).toLowerCase();
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

  if (/^data:image\//i.test(photo)) return photo;
  if (/^https?:\/\//i.test(photo)) return photo;

  if (/^\/uploads\//i.test(photo)) {
    const origin = getApiOrigin();
    return origin ? `${origin}${photo}` : photo;
  }

  return '';
};

const formatNotificationDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const InventoryTabsOverflow = ({ tabs, activeKey, onGoTab, onMoreOpenChange }) => {
  const rowRef = useRef(null);
  const sliderRef = useRef(null);
  const moreBtnRef = useRef(null);
  const moreWrapRef = useRef(null);
  const tabRefs = useRef({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreBackdropTop, setMoreBackdropTop] = useState(0);

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

  const updateMoreBackdropTop = useCallback(() => {
    const navEl = rowRef.current?.closest('.top-navbar');
    if (!navEl) {
      setMoreBackdropTop(0);
      return;
    }

    const rect = navEl.getBoundingClientRect();
    setMoreBackdropTop(Math.max(0, Math.round(rect.bottom + 2)));
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

  useEffect(() => {
    if (!onMoreOpenChange) return undefined;
    onMoreOpenChange(moreOpen);
    return () => onMoreOpenChange(false);
  }, [moreOpen, onMoreOpenChange]);

  useEffect(() => {
    if (!moreOpen) return undefined;

    updateMoreBackdropTop();

    const handleViewportChange = () => updateMoreBackdropTop();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [moreOpen, updateMoreBackdropTop]);

  return (
    <div className="inventory-tabs-bar" aria-label="Submodulos">
      {moreOpen ? (
        <button
          type="button"
          className="inventory-more-mobile-backdrop"
          style={{ top: `${moreBackdropTop}px` }}
          onClick={closeMore}
          aria-label="Cerrar menu"
        />
      ) : null}

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
              onClick={() =>
                setMoreOpen((state) => {
                  const next = !state;
                  if (next) updateMoreBackdropTop();
                  return next;
                })
              }
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

const NavbarTabs = ({ config, onMoreOpenChange }) =>
  config ? (
    <InventoryTabsOverflow
      tabs={config.tabs}
      activeKey={config.activeKey}
      onGoTab={config.onGoTab}
      onMoreOpenChange={onMoreOpenChange}
    />
  ) : null;

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTabsMoreOpen, setIsTabsMoreOpen] = useState(false);
  const [failedPhotoSrc, setFailedPhotoSrc] = useState('');
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationsRows, setNotificationsRows] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const profileMenuRef = useRef(null);
  const gearMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const readNotificationIdsRef = useRef([]);
  const lastSoundNotificationIdRef = useRef('');
  const notificationsHydratedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const notificationAudioRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canAny, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const userName = user?.nombre_usuario || 'Invitado';
  const userRole = Array.isArray(user?.roles) && user.roles.length > 0
    ? user.roles.join(', ')
    : 'Usuario';
  const userPhotoSrc = useMemo(() => resolveProfilePhotoSrc(user?.foto_perfil), [user?.foto_perfil]);
  const userInitials = useMemo(() => getUserInitials(userName), [userName]);
  const showUserPhoto = Boolean(userPhotoSrc) && failedPhotoSrc !== userPhotoSrc;
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const canViewProfile = canAny([PERMISSIONS.PERFIL_VER]);
  const canViewEmailCampaigns = canAny([
    PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_VER,
    PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_GESTIONAR
  ]);
  const canViewSecurityNotifications = canAny([
    PERMISSIONS.SEGURIDAD_VER,
    PERMISSIONS.SEGURIDAD_LOGINS_VER,
    PERMISSIONS.SEGURIDAD_SESIONES_VER_GLOBAL,
    PERMISSIONS.SEGURIDAD_USUARIOS_AUDITORIA_VER
  ]);
  const readNotificationsStorageKey = useMemo(() => {
    const actorId = user?.id_usuario || user?.nombre_usuario || 'guest';
    return `security-notif-read:${actorId}`;
  }, [user?.id_usuario, user?.nombre_usuario]);
  const readNotificationSet = useMemo(
    () => new Set((Array.isArray(readNotificationIds) ? readNotificationIds : []).map((id) => String(id || '').trim()).filter(Boolean)),
    [readNotificationIds]
  );
  const hasUnreadNotifications = useMemo(
    () => notificationsRows.some((item) => !readNotificationSet.has(String(item?.id || '').trim())),
    [notificationsRows, readNotificationSet]
  );

  const ensureNotificationAudio = useCallback(() => {
    const currentAudio = notificationAudioRef.current;
    const currentSource = currentAudio?.getAttribute?.('data-sound-src') || '';
    if (currentAudio && currentSource === NOTIFICATION_SOUND_URL) {
      return currentAudio;
    }

    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.preload = 'auto';
    audio.volume = 1;
    audio.setAttribute('data-sound-src', NOTIFICATION_SOUND_URL);
    notificationAudioRef.current = audio;
    return audio;
  }, []);

  const unlockNotificationAudio = useCallback(() => {
    if (typeof window === 'undefined') return;

    audioUnlockedRef.current = true;

    try {
      const audio = ensureNotificationAudio();
      if (audio) {
        audio.muted = true;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }).catch(() => {});
      }
    } catch {
      // ignore unsupported audio environments
    }
  }, [ensureNotificationAudio]);

  const playNotificationSound = useCallback(() => {
    if (typeof window === 'undefined' || !audioUnlockedRef.current) return;

    try {
      const audio = ensureNotificationAudio();
      if (!audio) return;
      audio.muted = false;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch {
      // ignore autoplay/api errors
    }
  }, [ensureNotificationAudio]);

  const moduleKey = useMemo(() => {
    if (location.pathname.startsWith('/dashboard/planillas')) return 'planillas';
    if (isPlanillasContext(location.pathname, location.search)) return 'planillas';
    if (location.pathname.startsWith('/dashboard/inventario')) return 'inventario';
    if (location.pathname.startsWith('/dashboard/sucursales')) return 'sucursales';
    if (location.pathname.startsWith('/dashboard/seguridad')) return 'seguridad';
    if (location.pathname.startsWith('/dashboard/personas')) return 'personas';
    if (location.pathname.startsWith('/dashboard/ventas')) return 'ventas';
    if (location.pathname.startsWith('/dashboard/cierres-caja')) return 'cierres-caja';
    if (location.pathname.startsWith('/dashboard/menu')) return 'menu';
    if (location.pathname.startsWith('/dashboard/fidelizacion')) return 'fidelizacion';
    return null;
  }, [location.pathname, location.search]);

  const moduleTabs = useMemo(() => {
    if (!moduleKey) return [];
    const tabs = getAllowedTabs(moduleKey, permisos, { isSuperAdmin });
    if (moduleKey === 'personas') {
      const hiddenPersonasTabs = new Set([PLANILLAS_PARENT_TAB_KEY, 'personas', 'empresas']);
      return tabs.filter((tab) => !hiddenPersonasTabs.has(String(tab?.key || '').toLowerCase()));
    }
    return tabs;
  }, [isSuperAdmin, moduleKey, permisos]);

  const activeModuleTab = useMemo(() => {
    if (!moduleKey || moduleTabs.length === 0) return null;
    return getTabFromSearch(location.search, moduleTabs, moduleTabs[0].key, {
      normalizeMovimientos: moduleKey === 'inventario',
      paramName: moduleKey === 'planillas' ? PLANILLAS_NAV_QUERY_PARAM : 'tab'
    });
  }, [location.search, moduleKey, moduleTabs]);

  const closeProfileDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const closeGearDropdown = useCallback(() => {
    setIsGearMenuOpen(false);
  }, []);

  const closeNotificationsDropdown = useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  const persistReadNotifications = useCallback((ids) => {
    const normalized = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))]
      .slice(0, 250);
    setReadNotificationIds(normalized);
    readNotificationIdsRef.current = normalized;
    try {
      window.localStorage.setItem(readNotificationsStorageKey, JSON.stringify(normalized));
    } catch {
      // ignore storage errors
    }
  }, [readNotificationsStorageKey]);

  const markNotificationAsRead = useCallback((idValue) => {
    const normalized = String(idValue || '').trim();
    if (!normalized) return;
    const current = readNotificationIdsRef.current || [];
    if (current.includes(normalized)) return;
    persistReadNotifications([...current, normalized]);
  }, [persistReadNotifications]);

  const markAllNotificationsAsRead = useCallback(() => {
    const allIds = notificationsRows.map((item) => String(item?.id || '').trim()).filter(Boolean);
    if (allIds.length === 0) return;
    const current = readNotificationIdsRef.current || [];
    persistReadNotifications([...current, ...allIds]);
  }, [notificationsRows, persistReadNotifications]);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!canViewSecurityNotifications) {
      setNotificationsRows([]);
      setNotificationsError('');
      return;
    }

    if (!silent) {
      setNotificationsLoading(true);
      setNotificationsError('');
    }

    try {
      const qs = new URLSearchParams();
      qs.set('limit', '30');
      qs.set('_ts', String(Date.now()));

      const payload = await securityService.getSecurityNotifications(qs.toString());
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const newestId = String(rows?.[0]?.id || '').trim();

      if (!notificationsHydratedRef.current) {
        notificationsHydratedRef.current = true;
        lastSoundNotificationIdRef.current = newestId;
      } else if (
        newestId
        && newestId !== lastSoundNotificationIdRef.current
        && !((readNotificationIdsRef.current || []).includes(newestId))
      ) {
        playNotificationSound();
        lastSoundNotificationIdRef.current = newestId;
      }

      setNotificationsRows(rows);
      setNotificationsError('');
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        setNotificationsRows([]);
        setNotificationsError('');
      } else {
        setNotificationsError(error?.message || 'No se pudieron cargar las notificaciones.');
      }
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  }, [canViewSecurityNotifications, playNotificationSound]);

  const toggleDropdown = () => {
    setIsOpen((state) => {
      const nextState = !state;
      if (nextState) {
        closeGearDropdown();
        closeNotificationsDropdown();
      }
      return nextState;
    });
  };

  const toggleGearDropdown = () => {
    setIsGearMenuOpen((state) => {
      const nextState = !state;
      if (nextState) {
        closeProfileDropdown();
        closeNotificationsDropdown();
      }
      return nextState;
    });
  };

  const toggleNotificationsDropdown = () => {
    setIsNotificationsOpen((state) => {
      const nextState = !state;
      if (nextState) {
        closeProfileDropdown();
        closeGearDropdown();
        unlockNotificationAudio();
        void loadNotifications();
      }
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
    closeNotificationsDropdown();
    navigate('/dashboard/perfil');
  };

  const handleGoChangePassword = () => {
    closeGearDropdown();
    closeProfileDropdown();
    closeNotificationsDropdown();
    navigate('/dashboard/perfil/cambiar-contrasena');
  };

  const handleGoEmailCampaigns = () => {
    closeGearDropdown();
    closeProfileDropdown();
    closeNotificationsDropdown();
    navigate('/dashboard/configuracion/campanas-correo');
  };

  const moduleTabsConfig = useMemo(() => {
    if (permisosLoading || !moduleKey || moduleTabs.length === 0) return null;
    return {
      tabs: moduleTabs,
      activeKey: activeModuleTab ?? '',
      onGoTab: (key) => {
        if (moduleKey === 'planillas') {
          const next = new URLSearchParams(location.search || '');
          next.delete('tab');
          next.set(PLANILLAS_NAV_QUERY_PARAM, key);
          navigate(`/dashboard/planillas?${next.toString()}`);
          return;
        }

        navigate(`/dashboard/${moduleKey}?tab=${key}`);
      }
    };
  }, [activeModuleTab, location.search, moduleKey, moduleTabs, navigate, permisosLoading]);

  const topNavbarClassName = useMemo(() => {
    if (!moduleKey) return 'top-navbar';
    return `top-navbar top-navbar--${moduleKey}`;
  }, [moduleKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(readNotificationsStorageKey) || '[]';
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed)
        ? [...new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 250)
        : [];
      setReadNotificationIds(normalized);
      readNotificationIdsRef.current = normalized;
    } catch {
      setReadNotificationIds([]);
      readNotificationIdsRef.current = [];
    }
  }, [readNotificationsStorageKey]);

  useEffect(() => {
    readNotificationIdsRef.current = Array.isArray(readNotificationIds) ? readNotificationIds : [];
  }, [readNotificationIds]);

  useEffect(() => {
    const onUserGesture = () => unlockNotificationAudio();
    window.addEventListener('pointerdown', onUserGesture);
    window.addEventListener('keydown', onUserGesture);
    window.addEventListener('touchstart', onUserGesture);
    return () => {
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
    };
  }, [unlockNotificationAudio]);

  useEffect(() => {
    if (!canViewSecurityNotifications) return undefined;

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, NOTIFICATIONS_POLL_MS);

    return () => window.clearInterval(timer);
  }, [canViewSecurityNotifications, loadNotifications]);

  useEffect(() => {
    if (!canViewSecurityNotifications) return undefined;

    const refreshOnFocus = () => {
      void loadNotifications({ silent: true });
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications({ silent: true });
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [canViewSecurityNotifications, loadNotifications]);

  const getPrimaryNotificationAction = useCallback((item) => {
    if (!item || !Array.isArray(item.actions) || item.actions.length === 0) return null;
    const primary = item.actions.find((action) => {
      const route = String(action?.route || '').trim();
      return route.length > 0;
    });
    if (!primary) return null;
    const label = String(primary.label || '').trim() || 'Ver detalle';
    return {
      label,
      route: String(primary.route).trim()
    };
  }, []);

  const handleNotificationAction = useCallback((item, { navigateToRoute = false } = {}) => {
    const itemId = String(item?.id || '').trim();
    if (itemId) markNotificationAsRead(itemId);
    if (navigateToRoute) {
      const primaryAction = getPrimaryNotificationAction(item);
      if (primaryAction?.route) {
        navigate(primaryAction.route);
      }
    }
  }, [getPrimaryNotificationAction, markNotificationAsRead, navigate]);

  useEffect(() => {
    const bodyEl = typeof document !== 'undefined' ? document.body : null;
    if (!bodyEl) return undefined;

    const className = 'sec-more-menu-open';
    const media = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : null;

    const syncClass = () => {
      const shouldApply =
        moduleKey === 'seguridad' &&
        Boolean(media?.matches) &&
        (isTabsMoreOpen || isGearMenuOpen || isOpen || isNotificationsOpen);
      bodyEl.classList.toggle(className, shouldApply);
    };

    syncClass();

    const onMediaChange = () => syncClass();
    if (media?.addEventListener) media.addEventListener('change', onMediaChange);
    else if (media?.addListener) media.addListener(onMediaChange);

    return () => {
      bodyEl.classList.remove(className);
      if (media?.removeEventListener) media.removeEventListener('change', onMediaChange);
      else if (media?.removeListener) media.removeListener(onMediaChange);
    };
  }, [isGearMenuOpen, isNotificationsOpen, isOpen, isTabsMoreOpen, moduleKey]);

  useEffect(() => {
    if (!isOpen && !isGearMenuOpen && !isNotificationsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (isOpen && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        closeProfileDropdown();
      }

      if (isGearMenuOpen && gearMenuRef.current && !gearMenuRef.current.contains(event.target)) {
        closeGearDropdown();
      }

      if (isNotificationsOpen && notificationsMenuRef.current && !notificationsMenuRef.current.contains(event.target)) {
        closeNotificationsDropdown();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeProfileDropdown();
        closeGearDropdown();
        closeNotificationsDropdown();
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
  }, [
    closeGearDropdown,
    closeNotificationsDropdown,
    closeProfileDropdown,
    isGearMenuOpen,
    isNotificationsOpen,
    isOpen
  ]);

  return (
    <div className={topNavbarClassName}>
      <div className="top-navbar__left">
        {isDashboard ? (
          <div className="navbar-context" aria-label="Ubicacion actual">
            <span className="navbar-context__eyebrow">Panel Dashboard</span>
            <span className="navbar-context__title">Vista general</span>
          </div>
        ) : null}

        {moduleTabsConfig ? (
          <div className="navbar-tabs-zone">
            <NavbarTabs config={moduleTabsConfig} onMoreOpenChange={setIsTabsMoreOpen} />
          </div>
        ) : null}
      </div>

      <div className="navbar-right">
        <div className="navbar-icon-group" aria-label="Acciones rapidas">
          <div className="position-relative notifications-dropdown-wrap" ref={notificationsMenuRef}>
            <button
              type="button"
              className={`navbar-icon-btn ${isNotificationsOpen ? 'is-active' : ''}`.trim()}
              aria-label="Notificaciones"
              aria-haspopup="menu"
              aria-expanded={isNotificationsOpen}
              onClick={toggleNotificationsDropdown}
            >
              <i className="bi bi-bell" />
              {hasUnreadNotifications ? <span className="navbar-notification-dot" /> : null}
            </button>

            {isNotificationsOpen && (
              <div className="dropdown-menu-custom notifications-dropdown-menu" role="menu" aria-label="Notificaciones de seguridad">
                <div className="notifications-dropdown-head">
                  <strong>Notificaciones</strong>
                  <div className="notifications-head-actions">
                    <button
                      type="button"
                      className="notifications-mark-all-btn"
                      onClick={markAllNotificationsAsRead}
                      aria-label="Marcar todas como leídas"
                      disabled={notificationsRows.length === 0 || !hasUnreadNotifications}
                    >
                      Marcar todas como leídas
                    </button>
                    <button
                      type="button"
                      className="notifications-refresh-btn"
                      onClick={() => {
                        void loadNotifications();
                      }}
                      aria-label="Actualizar notificaciones"
                    >
                      <i className="bi bi-arrow-clockwise" />
                    </button>
                  </div>
                </div>

                {notificationsLoading && notificationsRows.length === 0 ? (
                  <div className="notifications-empty">Cargando notificaciones...</div>
                ) : null}

                {!notificationsLoading && notificationsError ? (
                  <div className="notifications-empty notifications-empty--error">{notificationsError}</div>
                ) : null}

                {!notificationsLoading && !notificationsError && notificationsRows.length === 0 ? (
                  <div className="notifications-empty">No hay notificaciones por ahora.</div>
                ) : null}

                {!notificationsError && notificationsRows.length > 0 ? (
                  <div className="notifications-list">
                    {notificationsRows.map((item) => {
                      const itemId = String(item?.id || '').trim();
                      const isUnread = itemId && !readNotificationSet.has(itemId);
                      const primaryAction = getPrimaryNotificationAction(item);
                      return (
                        <div
                          key={item.id}
                          className={`notification-list-item notification-list-item--${item.severity || 'info'} ${isUnread ? 'is-unread' : 'is-read'}`}
                        >
                          <button
                            type="button"
                            className="notification-list-item__body"
                            onClick={() => handleNotificationAction(item)}
                          >
                            <div className="notification-list-item__head">
                              <strong>{item.title || 'Notificación'}</strong>
                              <span>{formatNotificationDate(item.created_at) || '-'}</span>
                            </div>
                            <p>{item.message || 'Sin detalle disponible.'}</p>
                          </button>

                          {primaryAction ? (
                            <button
                              type="button"
                              className="notification-list-item__action"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleNotificationAction(item, { navigateToRoute: true });
                              }}
                            >
                              {primaryAction.label}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="position-relative gear-dropdown-wrap" ref={gearMenuRef}>
            <button
              type="button"
              className={`navbar-icon-btn ${isGearMenuOpen ? 'is-active' : ''}`.trim()}
              aria-label="Configuracion"
              aria-haspopup="menu"
              aria-expanded={isGearMenuOpen}
              onClick={toggleGearDropdown}
            >
              <i className="bi bi-gear" />
            </button>

            {isGearMenuOpen && (
              <div className="dropdown-menu-custom gear-dropdown-menu" role="menu" aria-label="Menu de configuracion">
                {canViewEmailCampaigns ? (
                  <button
                    type="button"
                    className="dropdown-menu-item gear-dropdown-item"
                    role="menuitem"
                    onClick={handleGoEmailCampaigns}
                  >
                    <i className="bi bi-envelope-paper" />
                    {"Campa\u00f1as de correo"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="dropdown-menu-item gear-dropdown-item"
                  role="menuitem"
                  onClick={handleGoChangePassword}
                >
                  <i className="bi bi-shield-lock" />
                  {"Cambiar contrase\u00f1a"}
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
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;

