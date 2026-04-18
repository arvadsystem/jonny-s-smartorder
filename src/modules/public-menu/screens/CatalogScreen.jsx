import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogSkeleton from '../components/catalog/CatalogSkeleton';
import CartSheet from '../components/catalog/CartSheet';
import CartFab from '../components/catalog/CartFab';
import CategoryChips from '../components/catalog/CategoryChips';
import ProductDetailSheet from '../components/catalog/ProductDetailSheet';
import ProductCard from '../components/catalog/ProductCard';
import SearchInput from '../components/catalog/SearchInput';
import StateBlock from '../components/feedback/StateBlock';
import jonnysLogo from '../../../assets/images/jonny_logo_no_bg_keep_teeth.png';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { usePublicMenuCart } from '../hooks/usePublicMenuCart';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS, PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';
import { isPublicMenuAuthError, toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';
import { requiresItemConfiguration } from '../utils/publicMenuItemConfig';

const getOrderTypeLabel = (orderTypeId) =>
  PUBLIC_MENU_ORDER_TYPE_OPTIONS.find((option) => option.id === orderTypeId)?.title || 'Pedido';

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
    searchTerm,
    selectedCategory,
    loading,
    error,
    syncWarning,
    stats,
    setSearchTerm,
    setSelectedCategory,
    reloadCatalog
  } = useCatalogProducts({ branchId, orderType });

  const [cartOpen, setCartOpen] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [showCategorySplash, setShowCategorySplash] = useState(false);
  const [contentTransitionKey, setContentTransitionKey] = useState(0);
  const transitionRef = useRef(0);
  const confirmLockRef = useRef(false);
  const authRedirectRef = useRef(false);
  const idempotencyRef = useRef({ fingerprint: '', key: '' });
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
  };

  const handleCardIncrease = (product) => {
    increaseSimpleItem(product);
  };

  const handleCardDecrease = (product) => {
    decreaseSimpleItem(product);
  };

  const handleConfiguredAdd = (product, configuration) => {
    addItem(product, configuration);
    closeConfigSheet();
  };

  // Guarda menu vigente en store para los siguientes pasos del flujo.
  useEffect(() => {
    actions.selectMenu(menuSummary);
  }, [actions, menuSummary]);

  const handleConfirmOrder = async () => {
    if (confirmingOrder || confirmLockRef.current) return;
    const mesaSeleccionada = String(state.dineInTable || '').trim();
    if (orderType === 'dine-in' && !mesaSeleccionada) {
      actions.pushToast({
        type: 'error',
        message: 'Primero indica el numero de mesa en Tipo de pedido.'
      });
      navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.ORDER_TYPE));
      return;
    }

    const payload = {
      ...buildOrderPayload(),
      tipo_pedido: orderType,
      // Backend espera servicio en raiz del payload.
      servicio: {
        mesa: orderType === 'dine-in' ? mesaSeleccionada : ''
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

  useEffect(() => {
    if (!selectedCategory || selectedCategory === 'all' || prefersReducedMotion) {
      setShowCategorySplash(false);
      return;
    }

    const current = transitionRef.current + 1;
    transitionRef.current = current;
    setShowCategorySplash(true);

    const timer = window.setTimeout(() => {
      if (transitionRef.current !== current) return;
      setShowCategorySplash(false);
      setContentTransitionKey((prev) => prev + 1);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, selectedCategory]);

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
      <div
        className={`pm-catalog-hero ${state.selectedBranch?.imageUrl ? 'has-photo' : ''}`}
        style={state.selectedBranch?.imageUrl ? { backgroundImage: `url(${state.selectedBranch.imageUrl})` } : undefined}
      >
        <div className="pm-catalog-hero__overlay" aria-hidden="true" />
        <div className="pm-catalog-hero__content">
          <h1 className="pm-catalog-hero__title">Menú</h1>
          <p className="pm-catalog-hero__subtitle">
            {state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal'} - {getOrderTypeLabel(orderType)}
          </p>
        </div>
      </div>

      <div className="pm-branch-banner">
        <div className="pm-branch-banner__row">
          <span>
            Estas ordenando en:{' '}
            <strong>{state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal'}</strong>
          </span>
          <button
            type="button"
            className="btn btn-outline-dark btn-sm pm-branch-banner__change"
            onClick={handleChangeBranch}
          >
            Cambiar sucursal
          </button>
        </div>
      </div>

      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        onClear={() => setSearchTerm('')}
        placeholder="Busca por nombre o descripcion"
      />

      <CategoryChips
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
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

      {showCategorySplash ? (
        <div className="pm-category-splash" aria-hidden="true">
          <div className="pm-category-splash__loader">
            <div className="pm-category-splash__halo" />
            <div className="pm-category-splash__ring" />
            <img src={jonnysLogo} alt="Jonny's" className="pm-category-splash__logo" />
          </div>
          <div className="pm-category-splash__label">
            Cargando categoria...
          </div>
        </div>
      ) : null}

      <div key={contentTransitionKey} className="pm-category-content">
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
            description="No encontramos productos con ese filtro. Prueba otro termino."
            actionLabel="Limpiar filtros"
            onAction={() => {
              setSearchTerm('');
              setSelectedCategory('all');
            }}
          />
        ) : (
          <div className="pm-product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id_detalle_menu}
                product={product}
                cartQuantity={cartQuantityByDetail.get(Number(product?.id_detalle_menu || 0)) || 0}
                onAdd={handleCardAdd}
                onIncrease={handleCardIncrease}
                onDecrease={handleCardDecrease}
              />
            ))}
          </div>
        )}
      </div>

      <CartFab itemCount={totalItems} disabled={totalItems <= 0} onClick={() => setCartOpen(true)} />

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

