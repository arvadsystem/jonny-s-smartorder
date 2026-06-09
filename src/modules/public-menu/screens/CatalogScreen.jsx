import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import CartSheet from '../components/catalog/CartSheet';
import AuthRequiredModal from '../components/feedback/AuthRequiredModal';
import ConfirmModal from '../components/feedback/ConfirmModal';
import OrderSuccessModal from '../components/feedback/OrderSuccessModal';
import PremiumCatalogHeader from '../components/catalog/PremiumCatalogHeader';
import PremiumHero from '../components/catalog/PremiumHero';
import JonnyExperienceSection from '../components/catalog/JonnyExperienceSection';
import PremiumProductSection from '../components/catalog/PremiumProductSection';
import PremiumStickyCart from '../components/catalog/PremiumStickyCart';
import ProductDetailSheet from '../components/catalog/ProductDetailSheet';
import StateBlock from '../components/feedback/StateBlock';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { useAuth } from '../../../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { usePublicMenuCart } from '../hooks/usePublicMenuCart';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import {
  PUBLIC_MENU_ORDER_TYPE_OPTIONS,
  PUBLIC_MENU_ORDER_TYPES,
  PUBLIC_MENU_STEPS
} from '../types/publicMenuTypes';
import { isPublicMenuAuthError, toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';
import { requiresItemConfiguration } from '../utils/publicMenuItemConfig';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import useOrderSuccessSound from '../hooks/useOrderSuccessSound';
import { formatPublicMenuCategoryLabel } from '../utils/publicMenuCategoryLabels';
import { resolveInventarioImageUrl } from '../../../utils/inventarioImagenes';
import jonnysLogo from '../../../assets/images/logo-sin-fondo.png';

const getOrderTypeLabel = (orderTypeId) =>
  PUBLIC_MENU_ORDER_TYPE_OPTIONS.find((option) => option.id === orderTypeId)?.title || 'Pedido';

const HERO_AUTOPLAY_MS = 5000;
const HERO_CONFIG_GLOBAL_BRANCH_KEY = '0';
const CLOSED_HOURS_DISMISS_STORAGE_KEY = 'pm_closed_hours_dismissed_branches';
const ENTRY_SETUP_DISMISS_STORAGE_KEY = 'pm_entry_setup_dismissed';
const ENTRY_SETUP_DISMISS_AT_STORAGE_KEY = 'pm_entry_setup_dismissed_at';
const ENTRY_SETUP_REPROMPT_TTL_MS = 90 * 60 * 1000;
const EMPTY_HERO_CONTACT_PHONES = Object.freeze({
  primary: '',
  secondary: '',
  whatsapp: ''
});
const FALLBACK_TOP_NAV_CATEGORIES = Object.freeze([
  'Combos',
  'Tacos de Birria',
  'Hamburguesas',
  'Cervezas',
  'Refrescos / Agua',
  'Hot Dogs',
  'Alitas y Tenders',
  'Jugos naturales',
  'Snacks',
  'Helados'
]);

const loadDismissedClosedHoursBranches = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(CLOSED_HOURS_DISMISS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};

    return parsed.reduce((acc, value) => {
      const id = Number.parseInt(String(value ?? '').trim(), 10);
      if (Number.isInteger(id) && id > 0) {
        acc[String(id)] = true;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const loadEntrySetupDismissed = () => {
  if (typeof window === 'undefined') return false;

  try {
    const now = Date.now();
    const dismissedAtRaw = window.localStorage.getItem(ENTRY_SETUP_DISMISS_AT_STORAGE_KEY);
    const dismissedAt = Number.parseInt(String(dismissedAtRaw || '').trim(), 10);
    if (Number.isInteger(dismissedAt) && dismissedAt > 0) {
      if (now - dismissedAt < ENTRY_SETUP_REPROMPT_TTL_MS) return true;
      window.localStorage.removeItem(ENTRY_SETUP_DISMISS_AT_STORAGE_KEY);
      window.sessionStorage.removeItem(ENTRY_SETUP_DISMISS_STORAGE_KEY);
      return false;
    }

    // Compatibilidad con la version anterior que solo usaba sessionStorage.
    if (window.sessionStorage.getItem(ENTRY_SETUP_DISMISS_STORAGE_KEY) === '1') {
      window.localStorage.setItem(ENTRY_SETUP_DISMISS_AT_STORAGE_KEY, String(now));
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const saveEntrySetupDismissed = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ENTRY_SETUP_DISMISS_AT_STORAGE_KEY, String(Date.now()));
    window.sessionStorage.setItem(ENTRY_SETUP_DISMISS_STORAGE_KEY, '1');
  } catch {
    // Silencioso: si sessionStorage falla, no bloqueamos el flujo.
  }
};

const normalizeHeroContactPhones = (value) => {
  if (!value || typeof value !== 'object') return { ...EMPTY_HERO_CONTACT_PHONES };
  return {
    primary: String(value.primary || value.telefono_principal || value.phone_primary || '').trim(),
    secondary: String(value.secondary || value.telefono_secundario || value.phone_secondary || '').trim(),
    whatsapp: String(value.whatsapp || value.telefono_whatsapp || '').trim()
  };
};

const normalizeHeroCarouselConfig = (value) => {
  if (!value || typeof value !== 'object') {
    return { byBranch: {}, customByBranch: {}, contactPhones: { ...EMPTY_HERO_CONTACT_PHONES } };
  }
  return {
    byBranch: value.byBranch && typeof value.byBranch === 'object' ? value.byBranch : {},
    customByBranch:
      value.customByBranch && typeof value.customByBranch === 'object'
        ? value.customByBranch
        : {},
    contactPhones: normalizeHeroContactPhones(value.contactPhones)
  };
};

const toBranchKey = (branchId) => {
  const parsed = Number.parseInt(String(branchId ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return HERO_CONFIG_GLOBAL_BRANCH_KEY;
  return String(parsed);
};

const toPositiveUniqueIds = (values = []) => {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) return;
    seen.add(parsed);
    normalized.push(parsed);
  });

  return normalized.slice(0, 6);
};

const toCustomSlides = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `custom-${index}`),
      imageUrl: resolveInventarioImageUrl(String(row?.imageUrl || '').trim()),
      title: String(row?.title || '').trim()
    }))
    .filter((row) => Boolean(row.imageUrl))
    .slice(0, 6);

const resolveHeroSelectionByBranch = (config, branchId) => {
  const branchKey = toBranchKey(branchId);
  const ids = config?.byBranch?.[branchKey] ?? config?.byBranch?.[HERO_CONFIG_GLOBAL_BRANCH_KEY];
  return toPositiveUniqueIds(ids);
};

const resolveHeroCustomByBranch = (config, branchId) => {
  const branchKey = toBranchKey(branchId);
  const rows =
    config?.customByBranch?.[branchKey] ?? config?.customByBranch?.[HERO_CONFIG_GLOBAL_BRANCH_KEY];
  return toCustomSlides(rows);
};

const getGreetingName = (user) => {
  const candidates = [
    user?.nombre_completo_cliente,
    user?.nombre_cliente,
    user?.cliente?.nombre_completo,
    user?.cliente?.nombre,
    user?.nombre_completo,
    user?.nombre,
    user?.nombres,
    user?.nombre_usuario,
    user?.email,
    user?.correo
  ];

  const rawName = candidates
    .map((value) => String(value || '').trim())
    .find(Boolean);

  if (!rawName) return '';
  return rawName.includes('@') ? rawName.split('@')[0] : rawName.split(/\s+/)[0];
};

const buildCatalogHeroSlides = ({
  products = [],
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  preferredDetailIds = [],
  customImages = []
}) => {
  const customSlides = (Array.isArray(customImages) ? customImages : [])
    .map((row, index) => ({
      id: `hero-custom-${row?.id || index}`,
      imageUrl: resolveInventarioImageUrl(String(row?.imageUrl || '').trim()),
      title: String(row?.title || '').trim() || 'Especialidad de la casa',
      subtitle: `${branchName} - ${orderTypeLabel} - Entrega estimada 20-30 min`
    }))
    .filter((row) => Boolean(row.imageUrl))
    .slice(0, 6);

  if (customSlides.length > 0) return customSlides;

  const productsWithImage = (Array.isArray(products) ? products : [])
    .map((product) => ({
      id: Number(product?.id_detalle_menu || 0),
      imageUrl: resolveInventarioImageUrl(String(product?.imagen_url || '').trim()),
      title: String(product?.nombre || '').trim() || 'Especialidad de la casa'
    }))
    .filter((product) => Boolean(product.id) && Boolean(product.imageUrl));

  if (productsWithImage.length === 0) return [];

  const productById = new Map(productsWithImage.map((product) => [product.id, product]));
  const preferredIds = Array.isArray(preferredDetailIds) ? preferredDetailIds : [];
  const selectedIds = [];

  preferredIds.forEach((id) => {
    const parsedId = Number(id || 0);
    if (!productById.has(parsedId) || selectedIds.includes(parsedId)) return;
    selectedIds.push(parsedId);
  });

  productsWithImage.forEach((product) => {
    if (selectedIds.includes(product.id)) return;
    selectedIds.push(product.id);
  });

  return selectedIds.slice(0, 6).map((id, index) => {
    const product = productById.get(id);
    return {
      id: `hero-product-${id || index}`,
      imageUrl: product?.imageUrl || '',
      title: product?.title || 'Especialidad de la casa',
      subtitle: `${branchName} - ${orderTypeLabel} - Entrega estimada 20-30 min`
    };
  });
};

const buildOrderPayloadFingerprint = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const normalizedItems = items
    .map((item) => ({
      id_detalle_menu: Number(item?.id_detalle_menu || 0),
      cantidad: Number(item?.cantidad || 0),
      extras: (Array.isArray(item?.extras) ? item.extras : [])
        .map((entry) => String(entry?.id_extra || '').trim())
        .filter(Boolean)
        .sort(),
      salsas_por_unidad: (Array.isArray(item?.salsas_por_unidad) ? item.salsas_por_unidad : [])
        .map((entry) => ({
          id_salsa: Number(entry?.id_salsa || 0),
          cantidad: Number(entry?.cantidad || 0)
        }))
        .sort((left, right) => left.id_salsa - right.id_salsa),
      nota: String(item?.nota || '').trim()
    }))
    .sort((left, right) => left.id_detalle_menu - right.id_detalle_menu);

  return JSON.stringify({
    id_sucursal: Number(payload?.id_sucursal || 0),
    tipo_pedido: String(payload?.tipo_pedido || ''),
    pago: {
      metodo: String(payload?.pago?.metodo || '').trim().toLowerCase()
    },
    servicio: {
      mesa: String(payload?.servicio?.mesa || '').trim()
    },
    items: normalizedItems
  });
};

const generateOrderIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pm-${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 12);
  return `pm-${Date.now().toString(36)}-${random}`;
};

const formatWhatsAppNumber = (value) => {
  const clean = String(value || '').replace(/[^\d+]/g, '').trim();
  return clean || '';
};

const getOrderTypeIconById = (orderTypeId) => {
  if (orderTypeId === PUBLIC_MENU_ORDER_TYPES.DELIVERY) return 'bi-truck';
  if (orderTypeId === PUBLIC_MENU_ORDER_TYPES.PICKUP) return 'bi-bag-check-fill';
  if (orderTypeId === PUBLIC_MENU_ORDER_TYPES.DINE_IN) return 'bi-shop';
  return 'bi-receipt-cutoff';
};

// Paso 3: catalogo real basado en menu_vigente + detalle_menu.
const CatalogScreen = () => {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { user, logout } = useAuth();
  const { state, actions } = usePublicMenuFlow();
  const branchId = state.selectedBranch?.id;
  const orderType = state.orderType;
  const theme = outletContext.theme || 'dark';
  const onToggleTheme = outletContext.onToggleTheme;

  const {
    products,
    availableProducts,
    filteredProducts,
    categories,
    menuSummary,
    selectedCategory,
    loading,
    error,
    syncWarning,
    stats,
    setSearchTerm,
    setSelectedCategory,
    reloadCatalog
  } = useCatalogProducts({ branchId, orderType });
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    reloadBranches
  } = useBranches();

  const preferredBranch = useMemo(
    () => state.selectedBranch || branches.find((branch) => branch?.isOpen) || branches[0] || null,
    [branches, state.selectedBranch]
  );
  const liveSelectedBranch = useMemo(() => {
    if (!state.selectedBranch?.id) return state.selectedBranch || null;
    return branches.find((branch) => Number(branch?.id) === Number(state.selectedBranch?.id)) || state.selectedBranch;
  }, [branches, state.selectedBranch]);
  const hasOpenBranches = useMemo(
    () => (Array.isArray(branches) ? branches.some((branch) => branch?.isOpen !== false) : false),
    [branches]
  );

  const [cartOpen, setCartOpen] = useState(false);
  const [authRequired, setAuthRequired] = useState({ open: false, message: '' });
  const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);
  const [entrySetupDismissed, setEntrySetupDismissed] = useState(loadEntrySetupDismissed);
  const [entrySetupOpen, setEntrySetupOpen] = useState(false);
  const [entrySetupBranchId, setEntrySetupBranchId] = useState('');
  const [entrySetupOrderType, setEntrySetupOrderType] = useState('');
  const [closedHoursConfirmOpen, setClosedHoursConfirmOpen] = useState(false);
  const [closedHoursDismissedByBranch, setClosedHoursDismissedByBranch] = useState(
    loadDismissedClosedHoursBranches
  );
  const [orderSuccess, setOrderSuccess] = useState({ open: false, order: null });
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroCarouselConfig, setHeroCarouselConfig] = useState({
    byBranch: {},
    customByBranch: {},
    contactPhones: { ...EMPTY_HERO_CONTACT_PHONES }
  });
  const [cartFabPulse, setCartFabPulse] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [categorySwitching, setCategorySwitching] = useState(false);
  const heroTimerRef = useRef(null);
  const recentlyAddedTimerRef = useRef(null);
  const categorySwitchTimerRef = useRef(null);
  const confirmLockRef = useRef(false);
  const confirmOriginRef = useRef('');
  const authRedirectRef = useRef(false);
  const idempotencyRef = useRef({ fingerprint: '', key: '' });
  const previousTotalItemsRef = useRef(0);
  const previousUserIdRef = useRef(Number(user?.id_usuario || 0) || null);
  const catalogAnchorRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const playOrderSuccessSound = useOrderSuccessSound();
  const shouldPromptEntrySetup =
    !branchesLoading &&
    !entrySetupDismissed &&
    hasOpenBranches &&
    !state.selectedBranch?.id &&
    !state.orderType;
  const pauseAutoContextBootstrap = shouldPromptEntrySetup || entrySetupOpen;

  const {
    items: cartItems,
    totalItems,
    total,
    addItem,
    increaseItemByLine,
    decreaseItemByLine,
    removeItemByLine,
    increaseSimpleItem,
    decreaseSimpleItem,
    clearCart,
    buildOrderPayload
  } = usePublicMenuCart({
    branch: state.selectedBranch
  });

  useEffect(() => {
    if (!shouldPromptEntrySetup || entrySetupDismissed) return;
    setEntrySetupOpen(true);
  }, [entrySetupDismissed, shouldPromptEntrySetup]);

  useEffect(() => {
    if (pauseAutoContextBootstrap) return;
    if (!state.selectedBranch?.id && preferredBranch?.id) {
      actions.selectBranch(preferredBranch);
    }
  }, [actions, pauseAutoContextBootstrap, preferredBranch, state.selectedBranch?.id]);

  useEffect(() => {
    if (!state.selectedBranch?.id || !liveSelectedBranch?.id) return;

    const changed =
      String(liveSelectedBranch?.name || '') !== String(state.selectedBranch?.name || '') ||
      String(liveSelectedBranch?.displayName || '') !== String(state.selectedBranch?.displayName || '') ||
      String(liveSelectedBranch?.schedule || '') !== String(state.selectedBranch?.schedule || '') ||
      String(liveSelectedBranch?.statusLabel || '') !== String(state.selectedBranch?.statusLabel || '') ||
      String(liveSelectedBranch?.closedReason || '') !== String(state.selectedBranch?.closedReason || '') ||
      Boolean(liveSelectedBranch?.isOpen) !== Boolean(state.selectedBranch?.isOpen);

    if (changed) {
      actions.selectBranch(liveSelectedBranch);
    }
  }, [actions, liveSelectedBranch, state.selectedBranch]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = Number(user?.id_usuario || 0) || null;

    if (previousUserId && !currentUserId) {
      setCartOpen(false);
      clearCart();
      setDetailOpen(false);
      setDetailItem(null);
      setOrderSuccess({ open: false, order: null });
      idempotencyRef.current = { fingerprint: '', key: '' };
    }

    previousUserIdRef.current = currentUserId;
  }, [clearCart, user]);

  useEffect(() => {
    if (pauseAutoContextBootstrap) return;
    if (!state.selectedBranch?.id) return;
    if (!state.orderType) {
      actions.selectOrderType(PUBLIC_MENU_ORDER_TYPES.DINE_IN);
    }
  }, [actions, pauseAutoContextBootstrap, state.orderType, state.selectedBranch?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadHeroCarouselConfig = async () => {
      try {
        const response = await publicMenuBootstrapService.getHeroCarouselConfig();
        if (!isMounted) return;
        setHeroCarouselConfig(normalizeHeroCarouselConfig(response));
      } catch {
        if (!isMounted) return;
        setHeroCarouselConfig({
          byBranch: {},
          customByBranch: {},
          contactPhones: { ...EMPTY_HERO_CONTACT_PHONES }
        });
      }
    };

    void loadHeroCarouselConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const cartQuantityByDetail = useMemo(
    () => {
      const map = new Map();
      (Array.isArray(cartItems) ? cartItems : []).forEach((item) => {
        const idDetalle = Number(item?.id_detalle_menu || 0);
        if (!idDetalle) return;
        const current = Number(map.get(idDetalle) || 0);
        map.set(idDetalle, current + Number(item?.cantidad || 0));
      });
      return map;
    },
    [cartItems]
  );
  const orderTypeLabel = getOrderTypeLabel(orderType);
  const greetingName = getGreetingName(user);
  const selectedBranchOpen = liveSelectedBranch?.isOpen !== false;
  const branchScheduleText = liveSelectedBranch?.schedule || 'Horario no configurado';
  const branchClosedReason = liveSelectedBranch?.closedReason || `Disponible de ${branchScheduleText}`;
  const orderDisabledReason = selectedBranchOpen ? '' : 'Sucursal cerrada';
  const liveBranchId = Number(liveSelectedBranch?.id || 0);
  const liveBranchKey = liveBranchId > 0 ? String(liveBranchId) : '';
  const topNavCategories = useMemo(
    () => {
      const visibleCategories = categories.filter((category) => category !== 'all');
      if (visibleCategories.length === 0) {
        // Evita el "flash" inicial de solo Snacks/Helados mientras termina de cargar QA.
        return loading ? [...FALLBACK_TOP_NAV_CATEGORIES] : [];
      }
      ['Snacks', 'Helados'].forEach((category) => {
        if (!visibleCategories.includes(category)) visibleCategories.push(category);
      });
      return visibleCategories.slice(0, 10);
    },
    [categories, loading]
  );
  const activeCategoryLabel = selectedCategory === 'all' ? 'Todo el menu' : formatPublicMenuCategoryLabel(selectedCategory);
  const isCatalogLanding = selectedCategory === 'all';
  const hasVisibleProducts = !isCatalogLanding && filteredProducts.length > 0;
  const hasSelectedCategory = !isCatalogLanding;
  const shouldUseFixedHeader = hasSelectedCategory || detailOpen;
  const shouldShowSyncWarning = Boolean(syncWarning) && !hasVisibleProducts;
  const [showJonnyExperience, setShowJonnyExperience] = useState(true);
  const preferredHeroDetailIds = useMemo(
    () => resolveHeroSelectionByBranch(heroCarouselConfig, branchId),
    [branchId, heroCarouselConfig]
  );
  const customHeroSlides = useMemo(
    () => resolveHeroCustomByBranch(heroCarouselConfig, branchId),
    [branchId, heroCarouselConfig]
  );
  const heroContactPhones = useMemo(
    () => normalizeHeroContactPhones(heroCarouselConfig?.contactPhones),
    [heroCarouselConfig]
  );
  const landingContactPhones = useMemo(
    () => {
      const fallbackWhatsapp = String(state.selectedBranch?.whatsapp || '').trim();
      return {
        primary: heroContactPhones.primary || fallbackWhatsapp,
        secondary: heroContactPhones.secondary,
        whatsapp: heroContactPhones.whatsapp || fallbackWhatsapp
      };
    },
    [
      heroContactPhones.primary,
      heroContactPhones.secondary,
      heroContactPhones.whatsapp,
      state.selectedBranch?.whatsapp
    ]
  );
  const heroSlides = useMemo(
    () =>
      buildCatalogHeroSlides({
        products: availableProducts,
        branchName: state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal',
        orderTypeLabel,
        preferredDetailIds: preferredHeroDetailIds,
        customImages: customHeroSlides
      }),
    [
      availableProducts,
      customHeroSlides,
      orderTypeLabel,
      preferredHeroDetailIds,
      state.selectedBranch?.displayName,
      state.selectedBranch?.name
    ]
  );

  useEffect(() => {
    setShowJonnyExperience(!hasSelectedCategory && !hasVisibleProducts);
  }, [hasSelectedCategory, hasVisibleProducts]);

  useEffect(() => {
    const previous = Number(previousTotalItemsRef.current || 0);
    if (totalItems > previous) {
      setCartFabPulse(true);
      const timer = window.setTimeout(() => setCartFabPulse(false), 520);
      previousTotalItemsRef.current = totalItems;
      return () => window.clearTimeout(timer);
    }
    previousTotalItemsRef.current = totalItems;
    return undefined;
  }, [totalItems]);

  useEffect(() => {
    if (heroIndex <= heroSlides.length - 1) return;
    setHeroIndex(0);
  }, [heroIndex, heroSlides.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const branchIds = Object.keys(closedHoursDismissedByBranch || {});
      window.sessionStorage.setItem(CLOSED_HOURS_DISMISS_STORAGE_KEY, JSON.stringify(branchIds));
    } catch {
      // Silencioso: si sessionStorage falla, no bloqueamos el menu.
    }
  }, [closedHoursDismissedByBranch]);

  useEffect(() => {
    if (!liveBranchId) {
      setClosedHoursConfirmOpen(false);
      return;
    }

    if (selectedBranchOpen) {
      setClosedHoursConfirmOpen(false);
      return;
    }

    if (closedHoursDismissedByBranch[liveBranchKey]) {
      setClosedHoursConfirmOpen(false);
      return;
    }

    setClosedHoursConfirmOpen(true);
  }, [closedHoursDismissedByBranch, liveBranchId, liveBranchKey, selectedBranchOpen]);

  useEffect(() => {
    if (heroTimerRef.current) {
      window.clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    }
    if (heroSlides.length <= 1 || prefersReducedMotion) return undefined;

    heroTimerRef.current = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, HERO_AUTOPLAY_MS);

    return () => {
      if (!heroTimerRef.current) return;
      window.clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    };
  }, [heroSlides.length, prefersReducedMotion]);

  useEffect(() => () => {
    if (!recentlyAddedTimerRef.current) return;
    window.clearTimeout(recentlyAddedTimerRef.current);
    recentlyAddedTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    if (!categorySwitchTimerRef.current) return;
    window.clearTimeout(categorySwitchTimerRef.current);
    categorySwitchTimerRef.current = null;
  }, []);

  const goToHeroSlide = (index) => {
    if (!heroSlides.length) return;
    const normalized = (index + heroSlides.length) % heroSlides.length;
    setHeroIndex(normalized);
  };

  const openConfigSheet = (product) => {
    setDetailItem(product);
    setDetailOpen(true);
  };

  const closeConfigSheet = () => {
    setDetailOpen(false);
    setDetailItem(null);
  };

  const handleCardAdd = (product) => {
    if (requiresItemConfiguration(product)) {
      openConfigSheet(product);
      return;
    }

    addItem(product, { cantidad: 1 });
    const id = Number(product?.id_detalle_menu || 0);
    if (id > 0) {
      setRecentlyAddedId(id);
      if (recentlyAddedTimerRef.current) window.clearTimeout(recentlyAddedTimerRef.current);
      recentlyAddedTimerRef.current = window.setTimeout(() => setRecentlyAddedId(null), 580);
    }
  };

  const handleCardIncrease = (product) => {
    increaseSimpleItem(product);
    const id = Number(product?.id_detalle_menu || 0);
    if (id > 0) {
      setRecentlyAddedId(id);
      if (recentlyAddedTimerRef.current) window.clearTimeout(recentlyAddedTimerRef.current);
      recentlyAddedTimerRef.current = window.setTimeout(() => setRecentlyAddedId(null), 580);
    }
  };

  const handleCardDecrease = (product) => {
    decreaseSimpleItem(product);
  };

  const handleScrollToCatalog = () => {
    catalogAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectCategory = (category) => {
    setCategorySwitching(true);
    setSearchTerm('');
    setSelectedCategory(category);

    if (categorySwitchTimerRef.current) window.clearTimeout(categorySwitchTimerRef.current);
    categorySwitchTimerRef.current = window.setTimeout(() => {
      setCategorySwitching(false);
      categorySwitchTimerRef.current = null;
    }, prefersReducedMotion ? 220 : 720);
  };

  const handleConfiguredAdd = (product, configuration) => {
    addItem(product, configuration);
    const id = Number(product?.id_detalle_menu || 0);
    if (id > 0) {
      setRecentlyAddedId(id);
      if (recentlyAddedTimerRef.current) window.clearTimeout(recentlyAddedTimerRef.current);
      recentlyAddedTimerRef.current = window.setTimeout(() => setRecentlyAddedId(null), 580);
    }
    closeConfigSheet();
  };

  const closeAuthRequiredModal = () => {
    authRedirectRef.current = false;
    setAuthRequired({ open: false, message: '' });
  };

  const goToLoginFromAuthModal = () => {
    closeAuthRequiredModal();
    navigate('/auth/login?from=public-menu');
  };

  const closeOrderSuccessModal = () => {
    setCartOpen(false);
    clearCart();
    setOrderSuccess({ open: false, order: null });
  };

  const handleHomeClick = () => {
    if (cartItems.length > 0) {
      setHomeConfirmOpen(true);
      return;
    }

    navigate('/menu-publico');
  };

  const markEntrySetupDismissed = () => {
    setEntrySetupDismissed(true);
    saveEntrySetupDismissed();
  };

  const handleEntrySetupContinue = () => {
    const nextBranchId = Number(entrySetupBranchId || 0);
    const selectedBranchFromModal =
      branches.find((branch) => Number(branch?.id || 0) === nextBranchId) || null;
    const normalizedOrderType = String(entrySetupOrderType || '').trim();
    if (!selectedBranchFromModal || !normalizedOrderType) return;

    actions.selectBranch(selectedBranchFromModal);
    actions.selectOrderType(normalizedOrderType);
    if (normalizedOrderType === PUBLIC_MENU_ORDER_TYPES.PICKUP && !state.pickupPaymentMethod) {
      actions.setPickupPaymentMethod('caja');
    }
    setEntrySetupOpen(false);
    markEntrySetupDismissed();
  };

  const handleEntrySetupViewMenu = () => {
    setEntrySetupOpen(false);
    markEntrySetupDismissed();
  };

  const cancelHomeNavigation = () => {
    setHomeConfirmOpen(false);
  };

  const confirmHomeNavigation = () => {
    setHomeConfirmOpen(false);
    setCartOpen(false);
    clearCart();
    navigate('/menu-publico');
  };

  const continueBrowsingClosedMenu = () => {
    const dismissBranchId = Number(liveSelectedBranch?.id || state.selectedBranch?.id || 0);
    if (dismissBranchId > 0) {
      const branchKey = String(dismissBranchId);
      setClosedHoursDismissedByBranch((prev) => ({ ...prev, [branchKey]: true }));
    }
    setClosedHoursConfirmOpen(false);
  };

  const leaveClosedMenu = () => {
    setClosedHoursConfirmOpen(false);
    navigate('/menu-publico');
  };

  const handleLogout = async () => {
    await logout();
    setCartOpen(false);
    clearCart();
    closeConfigSheet();
    navigate('/menu-publico');
  };

  // Guarda menu vigente en store para los siguientes pasos del flujo.
  useEffect(() => {
    actions.selectMenu(menuSummary);
  }, [actions, menuSummary]);

  const handleConfirmOrder = async ({ keepCartSheetVisible = false } = {}) => {
    if (confirmingOrder || confirmLockRef.current) return;
    if (!selectedBranchOpen) {
      setClosedHoursConfirmOpen(true);
      return;
    }

    const pickupPaymentMethod = String(state.pickupPaymentMethod || '')
      .trim()
      .toLowerCase();
    if (orderType === 'pickup' && !['caja', 'transferencia'].includes(pickupPaymentMethod)) {
      actions.pushToast({
        type: 'error',
        message: 'Selecciona metodo de pago en Tipo de pedido antes de confirmar.'
      });
      navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.ORDER_TYPE));
      return;
    }

    if (orderType === 'pickup' && pickupPaymentMethod === 'transferencia') {
      const whatsapp = formatWhatsAppNumber(state.selectedBranch?.whatsapp || '');
      actions.pushToast({
        type: 'info',
        durationMs: 7000,
        message: whatsapp
          ? `Importante: envia tu comprobante de transferencia al WhatsApp ${whatsapp}. Ahora enviaremos tu pedido.`
          : 'Importante: envia tu comprobante de transferencia al WhatsApp de la sucursal. Ahora enviaremos tu pedido.'
      });
    }

    const payload = {
      ...buildOrderPayload(),
      tipo_pedido: orderType,
      pago: {
        metodo:
          orderType === 'pickup'
            ? pickupPaymentMethod
            : (orderType === 'dine-in' ? 'caja' : 'transferencia')
      },
      // Backend espera servicio en raiz del payload.
      servicio: {
        mesa: ''
      }
    };

    if (!payload.id_sucursal || !payload.tipo_pedido || !Array.isArray(payload.items) || payload.items.length === 0) {
      actions.pushToast({
        type: 'error',
        message: 'No se pudo preparar el pedido. Verifica sucursal, tipo de pedido y carrito.'
      });
      return;
    }

    // Reutiliza llave cuando el payload es igual (reintentos), y regenera al cambiar carrito/contexto.
    const payloadFingerprint = buildOrderPayloadFingerprint(payload);
    if (idempotencyRef.current.fingerprint !== payloadFingerprint) {
      idempotencyRef.current = {
        fingerprint: payloadFingerprint,
        key: generateOrderIdempotencyKey()
      };
    }
    payload.idempotency_key = idempotencyRef.current.key;

    try {
      confirmOriginRef.current = keepCartSheetVisible ? 'cart-sheet' : 'summary';
      setConfirmingOrder(true);
      confirmLockRef.current = true;
      const created = await publicMenuBootstrapService.createOrder(payload);

      idempotencyRef.current = { fingerprint: '', key: '' };
      playOrderSuccessSound();
      setOrderSuccess({ open: true, order: created });
    } catch (e) {
      if (isPublicMenuAuthError(e)) {
        if (!authRedirectRef.current) {
          authRedirectRef.current = true;
          setCartOpen(false);
          setAuthRequired({
            open: true,
            message: toPublicMenuUiErrorMessage(
              e,
              'Tu sesión de cliente no es válida. Inicia sesión para confirmar el pedido.'
            )
          });
        }
        return;
      }

      actions.pushToast({
        type: 'error',
        message: toPublicMenuUiErrorMessage(e, 'No se pudo enviar el pedido. Intenta nuevamente.')
      });
    } finally {
      confirmOriginRef.current = '';
      setConfirmingOrder(false);
      confirmLockRef.current = false;
    }
  };

  // Permite corregir sucursal desde catalogo sin mezclar carrito entre sedes.
  const handleChangeBranch = () => {
    closeConfigSheet();
    clearCart();
    idempotencyRef.current = { fingerprint: '', key: '' };
    actions.selectMenu(null);
    actions.selectOrderType(null);
    actions.selectBranch(null);
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.BRANCH));
  };

  const handleSelectBranchFromHeader = (branch) => {
    const nextBranchId = Number(branch?.id || 0);
    if (!nextBranchId) return;

    if (Number(state.selectedBranch?.id || 0) === nextBranchId) {
      setSelectedCategory('all');
      return;
    }

    closeConfigSheet();
    clearCart();
    idempotencyRef.current = { fingerprint: '', key: '' };
    actions.selectMenu(null);
    actions.selectBranch(branch);
    if (orderType) actions.selectOrderType(orderType);
    if (orderType === 'pickup' && state.pickupPaymentMethod) {
      actions.setPickupPaymentMethod(state.pickupPaymentMethod);
    }
    setSelectedCategory('all');
  };

  // Permite ajustar el tipo de pedido desde catalogo manteniendo el flujo existente.
  const handleChangeOrderType = (nextOrderType) => {
    const normalized = String(nextOrderType || '').trim();
    if (!normalized || normalized === orderType) return;

    closeConfigSheet();
    idempotencyRef.current = { fingerprint: '', key: '' };
    actions.selectOrderType(normalized);
    if (normalized === 'pickup' && !state.pickupPaymentMethod) {
      actions.setPickupPaymentMethod('caja');
    }
    setSelectedCategory('all');
  };

  if (error) {
    return (
      <StateBlock
        variant="error"
        title="No pudimos cargar el catalogo"
        description={error}
        actionLabel="Reintentar"
        onAction={() => reloadCatalog()}
      />
    );
  }

  if (!loading && branchId && !products.length) {
    return (
      <StateBlock
        variant="empty"
        title="Menu no disponible"
        description="Esta sucursal no tiene menu disponible en este momento."
      />
    );
  }

  return (
    <section
      className={`pm-screen pm-catalog-screen ${totalItems > 0 ? 'pm-catalog-screen--with-cart' : ''} ${shouldUseFixedHeader ? 'pm-catalog-screen--header-fixed' : ''}`.trim()}
      aria-label="Catalogo publico"
    >
      <PremiumCatalogHeader
        categories={topNavCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal'}
        branchId={state.selectedBranch?.id}
        orderTypeLabel={orderTypeLabel}
        orderType={orderType}
        onChangeBranch={handleChangeBranch}
        onSelectBranch={handleSelectBranchFromHeader}
        branches={branches}
        branchesLoading={branchesLoading}
        branchesError={branchesError}
        onReloadBranches={reloadBranches}
        onChangeOrderType={handleChangeOrderType}
        onHomeClick={handleHomeClick}
        onUserClick={() => navigate('/auth/login?from=public-menu&intent=login')}
        onLogout={handleLogout}
        onCartClick={() => setCartOpen(true)}
        cartCount={totalItems}
        greetingName={greetingName}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {isCatalogLanding && heroSlides.length > 0 ? (
        <PremiumHero
          slides={heroSlides}
          heroIndex={heroIndex}
          branchName={state.selectedBranch?.displayName || state.selectedBranch?.name || ''}
          orderTypeLabel={orderTypeLabel}
          onPrev={() => goToHeroSlide(heroIndex - 1)}
          onNext={() => goToHeroSlide(heroIndex + 1)}
          onSelectSlide={goToHeroSlide}
          onPrimaryAction={handleScrollToCatalog}
        />
      ) : null}

      {showJonnyExperience ? <JonnyExperienceSection contactPhones={landingContactPhones} /> : null}

      {!selectedBranchOpen ? (
        <div className="pm-branch-hours-alert" role="status">
          <span className="pm-branch-hours-alert__icon" aria-hidden="true">
            <i className="bi bi-clock-history" />
          </span>
          <div className="pm-branch-hours-alert__copy">
            <strong>Pedidos cerrados por ahora</strong>
            <span>{branchClosedReason}. Puedes revisar el menú y preparar tu pedido.</span>
          </div>
        </div>
      ) : null}

      {shouldShowSyncWarning ? (
        <StateBlock
          variant="warning"
          title="Conexion inestable"
          description={syncWarning}
          actionLabel="Reintentar"
          onAction={() => reloadCatalog()}
        />
      ) : null}

      <div className="pm-category-content" ref={catalogAnchorRef}>
        {categorySwitching ? (
          <div className="pm-category-switch-loader" role="status" aria-label="Cargando categoria">
            <div className="pm-category-switch-loader__ring" aria-hidden="true">
              <img src={jonnysLogo} alt="" className="pm-category-switch-loader__logo" />
            </div>
          </div>
        ) : null}

        {!loading && !isCatalogLanding && stats.allFilteredSoldOut ? (
          <StateBlock
            variant="warning"
            title="Todo agotado por ahora"
            description="Prueba otra categoria o vuelve en unos minutos."
          />
        ) : null}

        {!loading && !isCatalogLanding && !filteredProducts.length ? (
          <StateBlock
            variant="empty"
            title={selectedCategory === 'all' ? 'Sin productos disponibles' : 'Sin resultados'}
            description={
              selectedCategory === 'all'
                ? 'No hay productos disponibles para ordenar en este momento.'
                : 'No encontramos productos disponibles en esta categoria.'
            }
            actionLabel="Ver todo"
            onAction={() => {
              handleSelectCategory('all');
            }}
          />
        ) : null}

        {hasVisibleProducts ? (
          <PremiumProductSection
            categoryTitle={activeCategoryLabel}
            filteredProducts={filteredProducts}
            recentlyAddedId={recentlyAddedId}
            cartQuantityByDetail={cartQuantityByDetail}
            cartItems={cartItems}
            total={total}
            branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
            confirmingOrder={confirmingOrder}
            orderDisabled={!selectedBranchOpen}
            orderDisabledReason={orderDisabledReason}
            onAdd={handleCardAdd}
            onIncrease={handleCardIncrease}
            onDecrease={handleCardDecrease}
            onIncreaseLine={increaseItemByLine}
            onDecreaseLine={decreaseItemByLine}
            onRemoveLine={removeItemByLine}
            onConfirmOrder={handleConfirmOrder}
          />
        ) : null}
      </div>

      <footer className="pm-public-footer" aria-label="Creditos del sistema">
        <span>© 2026 AVAD SYSTEM</span>
      </footer>

      <PremiumStickyCart
        itemCount={totalItems}
        total={total}
        disabled={totalItems <= 0}
        pulse={cartFabPulse}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartSheet
        open={cartOpen || (confirmingOrder && confirmOriginRef.current === 'cart-sheet')}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
        items={cartItems}
        total={total}
        disabled={!selectedBranchOpen}
        disabledReason={orderDisabledReason}
        onClose={() => setCartOpen(false)}
        onIncrease={increaseItemByLine}
        onDecrease={decreaseItemByLine}
        onRemove={removeItemByLine}
        onConfirm={() => handleConfirmOrder({ keepCartSheetVisible: true })}
        confirming={confirmingOrder}
      />

      <ProductDetailSheet
        open={detailOpen}
        item={detailItem}
        loading={false}
        error=""
        onClose={closeConfigSheet}
        onAdd={handleConfiguredAdd}
      />

      <AuthRequiredModal
        open={authRequired.open}
        message={authRequired.message}
        onLogin={goToLoginFromAuthModal}
        onClose={closeAuthRequiredModal}
      />

      {entrySetupOpen ? (
        <div className="pm-confirm-modal__backdrop pm-entry-setup-modal__backdrop" role="presentation">
          <div
            className="pm-confirm-modal pm-entry-setup-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm-entry-setup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pm-confirm-modal__icon" aria-hidden="true">
              <i className="bi bi-compass" />
            </div>
            <h2 id="pm-entry-setup-title" className="pm-confirm-modal__title">
              SELECCIONE LA SUCURSAL DONDE PEDIRA
            </h2>
            <p className="pm-confirm-modal__message">
              Configure su pedido desde el inicio. Puede cambiar esta informacion luego en la barra superior.
            </p>

            <div className="pm-entry-setup-modal__section">
              <h3 className="pm-entry-setup-modal__section-title">
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                <span>Sucursal</span>
              </h3>
              <div className="pm-entry-setup-modal__list" role="listbox" aria-label="Sucursales disponibles">
                {branchesLoading ? (
                  <div className="pm-premium-header__location-menu-state">Cargando sucursales...</div>
                ) : null}

                {!branchesLoading && branchesError ? (
                  <button
                    type="button"
                    className="pm-premium-header__location-menu-item"
                    onClick={() => reloadBranches?.()}
                  >
                    <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                    <span>Reintentar carga</span>
                  </button>
                ) : null}

                {!branchesLoading && !branchesError && branches.length > 0 ? (
                  branches.map((branch) => {
                    const branchNumericId = Number(branch?.id || 0);
                    const isCurrent = Number(entrySetupBranchId || 0) === branchNumericId;
                    return (
                      <button
                        type="button"
                        key={`entry-branch-${branchNumericId}`}
                        className={`pm-premium-header__location-menu-item ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => setEntrySetupBranchId(String(branchNumericId))}
                      >
                        <i className="bi bi-shop" aria-hidden="true" />
                        <span className="pm-entry-setup-modal__item-copy">
                          <strong>{branch.displayName || branch.name || 'Sucursal'}</strong>
                          <small className="pm-entry-setup-modal__item-meta">
                            {branch.statusLabel || (branch?.isOpen ? 'Abierto ahora' : 'Cerrado')}
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : null}

                {!branchesLoading && !branchesError && branches.length === 0 ? (
                  <div className="pm-premium-header__location-menu-state">No hay sucursales disponibles.</div>
                ) : null}
              </div>
            </div>

            <div className="pm-entry-setup-modal__section">
              <h3 className="pm-entry-setup-modal__section-title">
                <i className="bi bi-house-door-fill" aria-hidden="true" />
                <span>Tipo de pedido</span>
              </h3>
              <div className="pm-entry-setup-modal__list" role="listbox" aria-label="Tipos de pedido">
                {PUBLIC_MENU_ORDER_TYPE_OPTIONS.map((option) => {
                  const isCurrent = option.id === entrySetupOrderType;
                  return (
                    <button
                      type="button"
                      key={`entry-order-${option.id}`}
                      className={`pm-premium-header__location-menu-item ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => setEntrySetupOrderType(option.id)}
                    >
                      <i className={`bi ${getOrderTypeIconById(option.id)}`} aria-hidden="true" />
                      <span className="pm-entry-setup-modal__item-copy">
                        <strong>{option.title}</strong>
                        <small className="pm-entry-setup-modal__item-meta">{option.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="pm-entry-setup-modal__note">
              Nota adicional: Podrá cambiar la sucursal o tipo de pedido en los iconos de la barra superior.
            </p>

            <div className="pm-confirm-modal__actions pm-entry-setup-modal__actions">
              <button type="button" className="btn btn-outline-secondary" onClick={handleEntrySetupViewMenu}>
                Ver menú
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleEntrySetupContinue}
                disabled={!entrySetupBranchId || !entrySetupOrderType}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={homeConfirmOpen}
        title="¿Volver al inicio?"
        message="Tienes productos en tu pedido. Si vuelves al inicio, podrías perder tu selección actual."
        cancelLabel="Cancelar"
        confirmLabel="Volver al inicio"
        onCancel={cancelHomeNavigation}
        onConfirm={confirmHomeNavigation}
      />

      <ConfirmModal
        open={closedHoursConfirmOpen && !homeConfirmOpen}
        title="RESTAURANTE CERRADO"
        message={`En este momento no estamos recibiendo pedidos. ${branchClosedReason}. Puedes seguir viendo el menu.`}
        cancelLabel={null}
        confirmLabel="Seguir viendo menu"
        onCancel={continueBrowsingClosedMenu}
        onConfirm={continueBrowsingClosedMenu}
      />

      <OrderSuccessModal
        open={orderSuccess.open}
        order={orderSuccess.order}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
        orderTypeLabel={orderTypeLabel}
        onClose={closeOrderSuccessModal}
      />
    </section>
  );
};

export default CatalogScreen;
