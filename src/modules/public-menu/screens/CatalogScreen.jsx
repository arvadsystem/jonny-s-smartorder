import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogHeader from '../components/catalog/CatalogHeader';
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
import { usePublicMenuCart } from '../hooks/usePublicMenuCart';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS, PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';
import { requiresItemConfiguration } from '../utils/publicMenuItemConfig';

const getOrderTypeLabel = (orderTypeId) =>
  PUBLIC_MENU_ORDER_TYPE_OPTIONS.find((option) => option.id === orderTypeId)?.title || 'Pedido';

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
    if (confirmingOrder) return;

    const payload = {
      ...buildOrderPayload(),
      tipo_pedido: orderType
    };

    if (!payload.id_sucursal || !payload.tipo_pedido || !Array.isArray(payload.items) || payload.items.length === 0) {
      actions.pushToast({
        type: 'error',
        message: 'No se pudo preparar el pedido. Verifica sucursal, tipo de pedido y carrito.'
      });
      return;
    }

    try {
      setConfirmingOrder(true);
      const created = await publicMenuBootstrapService.createOrder(payload);

      actions.pushToast({
        type: 'success',
        message: created?.numero_ticket
          ? `Pedido ${created.numero_ticket} enviado correctamente.`
          : 'Pedido enviado correctamente.'
      });

      setCartOpen(false);
      clearCart();
    } catch (e) {
      actions.pushToast({
        type: 'error',
        message: e?.message || 'No se pudo enviar el pedido. Intenta nuevamente.'
      });
    } finally {
      setConfirmingOrder(false);
    }
  };

  // Permite corregir sucursal desde catalogo sin mezclar carrito entre sedes.
  const handleChangeBranch = () => {
    closeConfigSheet();
    clearCart();
    actions.selectMenu(null);
    actions.selectOrderType(null);
    actions.selectBranch(null);
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.BRANCH));
  };

  useEffect(() => {
    if (!selectedCategory || selectedCategory === 'all') {
      setShowCategorySplash(false);
      return;
    }

    const current = transitionRef.current + 1;
    transitionRef.current = current;
    setShowCategorySplash(true);
    const start = Date.now();
    const minDuration = 650;

    const timer = window.setTimeout(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(minDuration - elapsed, 0);
      window.setTimeout(() => {
        if (transitionRef.current !== current) return;
        setShowCategorySplash(false);
        setContentTransitionKey((prev) => prev + 1);
      }, remaining);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedCategory]);

  if (loading) {
    return (
      <StateBlock
        variant="loading"
        title="Cargando catalogo"
        description="Estamos preparando el menu vigente para tu sucursal."
      />
    );
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
          <span className="pm-catalog-hero__eyebrow">Menu publico</span>
          <h1 className="pm-catalog-hero__title">{menuSummary?.nombreMenu || 'Catalogo'}</h1>
          <p className="pm-catalog-hero__subtitle">
            {state.selectedBranch?.displayName || state.selectedBranch?.name || 'Sucursal'} · {getOrderTypeLabel(orderType)}
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

      <CatalogHeader
        branchName={state.selectedBranch?.name || 'Sucursal'}
        orderTypeLabel={getOrderTypeLabel(orderType)}
        menuName={menuSummary?.nombreMenu || 'Catalogo'}
        totalProducts={stats.total}
        availableProducts={stats.available}
      />

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
