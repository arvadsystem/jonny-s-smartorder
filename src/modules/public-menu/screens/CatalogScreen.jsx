import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogSkeleton from '../components/catalog/CatalogSkeleton';
import CartSheet from '../components/catalog/CartSheet';
import PremiumCatalogHeader from '../components/catalog/PremiumCatalogHeader';
import PremiumHero from '../components/catalog/PremiumHero';
import PremiumProductSection from '../components/catalog/PremiumProductSection';
import PremiumStickyCart from '../components/catalog/PremiumStickyCart';
import ProductDetailSheet from '../components/catalog/ProductDetailSheet';
import StateBlock from '../components/feedback/StateBlock';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { usePublicMenuCart } from '../hooks/usePublicMenuCart';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS, PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';
import { buildCatalogPromoSections } from '../utils/catalogPromoSections';
import { isPublicMenuAuthError, toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';
import { requiresItemConfiguration } from '../utils/publicMenuItemConfig';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
  getHeroCarouselCustomImagesByBranch,
  getHeroCarouselSelectionByBranch
} from '../utils/heroCarouselStorage';
import { resolveInventarioImageUrl } from '../../../utils/inventarioImagenes';

const getOrderTypeLabel = (orderTypeId) =>
  PUBLIC_MENU_ORDER_TYPE_OPTIONS.find((option) => option.id === orderTypeId)?.title || 'Pedido';

const HERO_AUTOPLAY_MS = 5000;

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
  const { state, actions } = usePublicMenuFlow();
  const branchId = state.selectedBranch?.id;
  const orderType = state.orderType;

  const {
    products,
    filteredProducts,
    categories,
    menuSummary,
    selectedCategory,
    loading,
    error,
    syncWarning,
    stats,
    setSelectedCategory,
    reloadCatalog
  } = useCatalogProducts({ branchId, orderType });

  const [cartOpen, setCartOpen] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [cartFabPulse, setCartFabPulse] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const heroTimerRef = useRef(null);
  const recentlyAddedTimerRef = useRef(null);
  const confirmLockRef = useRef(false);
  const authRedirectRef = useRef(false);
  const idempotencyRef = useRef({ fingerprint: '', key: '' });
  const previousTotalItemsRef = useRef(0);
  const catalogAnchorRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

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
  const promoSections = useMemo(
    () => buildCatalogPromoSections(products),
    [products]
  );
  const topNavCategories = useMemo(
    () => categories.filter((category) => category !== 'all').slice(0, 8),
    [categories]
  );
  const heroSlides = useMemo(
    () =>
      buildCatalogHeroSlides({
        products,
        branchName: state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal',
        orderTypeLabel,
        preferredDetailIds: getHeroCarouselSelectionByBranch(branchId),
        customImages: getHeroCarouselCustomImagesByBranch(branchId)
      }),
    [branchId, orderTypeLabel, products, state.selectedBranch?.displayName, state.selectedBranch?.name]
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

      actions.pushToast({
        type: 'success',
        message: created?.numero_ticket
          ? `Pedido ${created.numero_ticket} enviado correctamente.`
          : 'Pedido enviado correctamente.'
      });

      setCartOpen(false);
      clearCart();
      idempotencyRef.current = { fingerprint: '', key: '' };
    } catch (e) {
      if (isPublicMenuAuthError(e)) {
        actions.pushToast({
          type: 'error',
          durationMs: 5000,
          message: toPublicMenuUiErrorMessage(
            e,
            'Tu sesion de cliente no es valida. Inicia sesion para confirmar el pedido.'
          )
        });

        if (!authRedirectRef.current) {
          authRedirectRef.current = true;
          setCartOpen(false);
          navigate('/auth/login?from=public-menu');
          window.setTimeout(() => {
            authRedirectRef.current = false;
          }, 2000);
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

  // Permite ajustar el tipo de pedido desde catalogo manteniendo el flujo existente.
  const handleChangeOrderType = () => {
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.ORDER_TYPE));
  };

  if (loading) {
    return <CatalogSkeleton />;
  }

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

  if (!products.length) {
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
        onSelectCategory={setSelectedCategory}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal'}
        orderTypeLabel={orderTypeLabel}
        onChangeBranch={handleChangeBranch}
        onChangeOrderType={handleChangeOrderType}
        onHomeClick={() => navigate('/menu-publico')}
        onUserClick={() => navigate('/auth/login?from=public-menu')}
        onCartClick={() => setCartOpen(true)}
        cartCount={totalItems}
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
        {stats.allFilteredSoldOut ? (
          <StateBlock
            variant="warning"
            title="Todo agotado por ahora"
            description="Prueba otra categoria o vuelve en unos minutos."
          />
        ) : null}

        {!filteredProducts.length ? (
          <StateBlock
            variant="empty"
            title="Sin resultados"
            description="No encontramos productos en esta categoria."
            actionLabel="Ver todo"
            onAction={() => {
              setSelectedCategory('all');
            }}
          />
        ) : (
          <PremiumProductSection
            promoSections={promoSections}
            filteredProducts={filteredProducts}
            recentlyAddedId={recentlyAddedId}
            cartQuantityByDetail={cartQuantityByDetail}
            onQuickAdd={handleCardAdd}
            onAdd={handleCardAdd}
            onIncrease={handleCardIncrease}
            onDecrease={handleCardDecrease}
          />
        )}
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
    </section>
  );
};

export default CatalogScreen;

