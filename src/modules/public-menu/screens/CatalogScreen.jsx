import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import CartSheet from '../components/catalog/CartSheet';
import AuthRequiredModal from '../components/feedback/AuthRequiredModal';
import ConfirmModal from '../components/feedback/ConfirmModal';
import OrderSuccessModal from '../components/feedback/OrderSuccessModal';
import PremiumCatalogHeader from '../components/catalog/PremiumCatalogHeader';
import PremiumHero from '../components/catalog/PremiumHero';
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
import {
  getHeroCarouselCustomImagesByBranch,
  getHeroCarouselSelectionByBranch
} from '../utils/heroCarouselStorage';
import { resolveInventarioImageUrl } from '../../../utils/inventarioImagenes';
import jonnysLogo from '../../../assets/images/logo-sin-fondo.png';

const getOrderTypeLabel = (orderTypeId) =>
  PUBLIC_MENU_ORDER_TYPE_OPTIONS.find((option) => option.id === orderTypeId)?.title || 'Pedido';

const formatCategoryLabel = (category) =>
  String(category || '').replace(/\btenders\b/gi, 'Tenders');

const HERO_AUTOPLAY_MS = 5000;

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
  const withImage = (Array.isArray(products) ? products : []).filter((row) => Boolean(row?.imagen_url));
  const unique = [];
  const seen = new Set();

  withImage.forEach((row) => {
    const imageUrl = String(row?.imagen_url || '').trim();
    if (!imageUrl || seen.has(imageUrl)) return;
    seen.add(imageUrl);
    unique.push(row);
  });

  const preferredOrder = Array.isArray(preferredDetailIds)
    ? preferredDetailIds.map((value) => Number(value || 0)).filter((value) => value > 0)
    : [];

  const preferredRows = [];
  preferredOrder.forEach((idDetalle) => {
    const found = unique.find((row) => Number(row?.id_detalle_menu || 0) === idDetalle);
    if (found) preferredRows.push(found);
  });

  const preferredSet = new Set(preferredRows.map((row) => Number(row?.id_detalle_menu || 0)));
  const fallbackRows = unique.filter((row) => !preferredSet.has(Number(row?.id_detalle_menu || 0)));
  const sortedRows = [...preferredRows, ...fallbackRows];

  const customSlides = (Array.isArray(customImages) ? customImages : [])
    .map((row, index) => ({
      id: `hero-custom-${row?.id || index}`,
      imageUrl: resolveInventarioImageUrl(String(row?.imageUrl || '').trim()),
      title: String(row?.title || '').trim() || 'Especialidad de la casa',
      subtitle: `${branchName} - ${orderTypeLabel} - Entrega estimada 20-30 min`
    }))
    .filter((row) => Boolean(row.imageUrl));

  const catalogSlides = sortedRows.map((row, index) => ({
    id: `hero-${row?.id_detalle_menu || index}`,
    imageUrl: row.imagen_url,
    title: row?.nombre || 'Platillo',
    subtitle: `${branchName} - ${orderTypeLabel} - Entrega estimada 20-30 min`
  }));
  const slides = [...customSlides, ...catalogSlides].slice(0, 6);

  if (!slides.length) {
    slides.push({
      id: 'hero-fallback',
      imageUrl: '',
      title: 'Menu',
      subtitle: `${branchName} - ${orderTypeLabel} - Entrega estimada 20-30 min`
    });
  }

  return slides;
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

// Paso 3: catalogo real basado en menu_vigente + detalle_menu.
const CatalogScreen = () => {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { user } = useAuth();
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

  const [cartOpen, setCartOpen] = useState(false);
  const [authRequired, setAuthRequired] = useState({ open: false, message: '' });
  const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState({ open: false, order: null });
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [cartFabPulse, setCartFabPulse] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [categorySwitching, setCategorySwitching] = useState(false);
  const heroTimerRef = useRef(null);
  const recentlyAddedTimerRef = useRef(null);
  const categorySwitchTimerRef = useRef(null);
  const confirmLockRef = useRef(false);
  const authRedirectRef = useRef(false);
  const idempotencyRef = useRef({ fingerprint: '', key: '' });
  const previousTotalItemsRef = useRef(0);
  const catalogAnchorRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const playOrderSuccessSound = useOrderSuccessSound();

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
    if (!state.selectedBranch?.id && preferredBranch?.id) {
      actions.selectBranch(preferredBranch);
    }
  }, [actions, preferredBranch, state.selectedBranch?.id]);

  useEffect(() => {
    if (!state.orderType) {
      actions.selectOrderType(PUBLIC_MENU_ORDER_TYPES.DINE_IN);
    }
  }, [actions, state.orderType]);

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
  const topNavCategories = useMemo(
    () => categories.filter((category) => category !== 'all').slice(0, 8),
    [categories]
  );
  const activeCategoryLabel = selectedCategory === 'all' ? 'Todo el menu' : formatCategoryLabel(selectedCategory);
  const isCatalogLanding = selectedCategory === 'all';
  const heroSlides = useMemo(
    () =>
      buildCatalogHeroSlides({
        products: availableProducts,
        branchName: state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal',
        orderTypeLabel,
        preferredDetailIds: getHeroCarouselSelectionByBranch(branchId),
        customImages: getHeroCarouselCustomImagesByBranch(branchId)
      }),
    [availableProducts, branchId, orderTypeLabel, state.selectedBranch?.displayName, state.selectedBranch?.name]
  );

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
    setOrderSuccess({ open: false, order: null });
  };

  const startNewOrderAfterSuccess = () => {
    closeOrderSuccessModal();
    handleScrollToCatalog();
  };

  const handleHomeClick = () => {
    if (cartItems.length > 0) {
      setHomeConfirmOpen(true);
      return;
    }

    navigate('/menu-publico');
  };

  const cancelHomeNavigation = () => {
    setHomeConfirmOpen(false);
  };

  const confirmHomeNavigation = () => {
    setHomeConfirmOpen(false);
    navigate('/menu-publico');
  };

  // Guarda menu vigente en store para los siguientes pasos del flujo.
  useEffect(() => {
    actions.selectMenu(menuSummary);
  }, [actions, menuSummary]);

  const handleConfirmOrder = async () => {
    if (confirmingOrder || confirmLockRef.current) return;
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
      setConfirmingOrder(true);
      confirmLockRef.current = true;
      const created = await publicMenuBootstrapService.createOrder(payload);

      setCartOpen(false);
      clearCart();
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
    <section className="pm-screen pm-catalog-screen" aria-label="Catalogo publico">
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
        onCartClick={() => setCartOpen(true)}
        cartCount={totalItems}
        greetingName={greetingName}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

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

      {syncWarning ? (
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

        {!isCatalogLanding && filteredProducts.length ? (
          <PremiumProductSection
            categoryTitle={activeCategoryLabel}
            filteredProducts={filteredProducts}
            recentlyAddedId={recentlyAddedId}
            cartQuantityByDetail={cartQuantityByDetail}
            cartItems={cartItems}
            total={total}
            branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
            confirmingOrder={confirmingOrder}
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

      <PremiumStickyCart
        itemCount={totalItems}
        total={total}
        disabled={totalItems <= 0}
        pulse={cartFabPulse}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartSheet
        open={cartOpen}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
        items={cartItems}
        total={total}
        onClose={() => setCartOpen(false)}
        onIncrease={increaseItemByLine}
        onDecrease={decreaseItemByLine}
        onRemove={removeItemByLine}
        onConfirm={handleConfirmOrder}
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

      <ConfirmModal
        open={homeConfirmOpen}
        title="¿Volver al inicio?"
        message="Tienes productos en tu pedido. Si vuelves al inicio, podrías perder tu selección actual."
        cancelLabel="Cancelar"
        confirmLabel="Volver al inicio"
        onCancel={cancelHomeNavigation}
        onConfirm={confirmHomeNavigation}
      />

      <OrderSuccessModal
        open={orderSuccess.open}
        order={orderSuccess.order}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
        orderTypeLabel={orderTypeLabel}
        onClose={closeOrderSuccessModal}
        onNewOrder={startNewOrderAfterSuccess}
      />
    </section>
  );
};

export default CatalogScreen;

