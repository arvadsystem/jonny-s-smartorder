import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogHeader from '../components/catalog/CatalogHeader';
import CartSheet from '../components/catalog/CartSheet';
import CartFab from '../components/catalog/CartFab';
import CategoryChips from '../components/catalog/CategoryChips';
import ProductCard from '../components/catalog/ProductCard';
import ProductDetailSheet from '../components/catalog/ProductDetailSheet';
import SearchInput from '../components/catalog/SearchInput';
import StateBlock from '../components/feedback/StateBlock';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { useMenuItemDetail } from '../hooks/useMenuItemDetail';
import { usePublicMenuCart } from '../hooks/usePublicMenuCart';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS, PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';

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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  const {
    itemDetail,
    loading: detailLoading,
    error: detailError,
    loadItemDetail,
    clearItemDetail
  } = useMenuItemDetail({ branchId });

  const {
    items: cartItems,
    totalItems,
    total,
    addItem,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    buildOrderPayload
  } = usePublicMenuCart({
    branch: state.selectedBranch
  });

  // Guarda menu vigente en store para los siguientes pasos del flujo.
  useEffect(() => {
    actions.selectMenu(menuSummary);
  }, [actions, menuSummary]);

  // Mantiene helper para reintento del detalle con el mismo id.
  const retryDetailLoad = useMemo(
    () =>
      detailItemId
        ? () => {
            loadItemDetail(detailItemId);
          }
        : null,
    [detailItemId, loadItemDetail]
  );

  // Abre detalle real de item por id_detalle_menu.
  const openDetail = async (product) => {
    const nextId = Number(product?.id_detalle_menu);
    if (!nextId) return;

    setDetailItemId(nextId);
    setDetailOpen(true);
    await loadItemDetail(nextId);
  };

  // Cierra sheet y limpia estado del detalle.
  const closeDetail = () => {
    setDetailOpen(false);
    setDetailItemId(null);
    clearItemDetail();
  };

  const handleAddToCart = (item) => {
    addItem(item);
    closeDetail();
    actions.pushToast({
      type: 'success',
      message: 'Item agregado al carrito.'
    });
  };

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
    clearCart();
    actions.selectMenu(null);
    actions.selectOrderType(null);
    actions.selectBranch(null);
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.BRANCH));
  };

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
              onOpenDetail={openDetail}
            />
          ))}
        </div>
      )}

      <CartFab itemCount={totalItems} disabled={totalItems <= 0} onClick={() => setCartOpen(true)} />

      <ProductDetailSheet
        open={detailOpen}
        item={itemDetail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
        onRetry={retryDetailLoad}
        onAdd={handleAddToCart}
      />

      <CartSheet
        open={cartOpen}
        branchName={state.selectedBranch?.displayName || state.selectedBranch?.name}
        items={cartItems}
        total={total}
        onClose={() => setCartOpen(false)}
        onIncrease={increaseItem}
        onDecrease={decreaseItem}
        onRemove={removeItem}
        onConfirm={handleConfirmOrder}
        confirming={confirmingOrder}
      />
    </section>
  );
};

export default CatalogScreen;
