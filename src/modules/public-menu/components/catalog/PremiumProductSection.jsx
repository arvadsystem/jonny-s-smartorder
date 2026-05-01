import CategoryHeader from './CategoryHeader';
import MenuProductGrid from './MenuProductGrid';
import OrderSummaryPanel from './OrderSummaryPanel';

// PremiumProductSection: layout tipo menu con grid y resumen de orden.
// Mantiene los handlers actuales; solo reorganiza la presentacion.
const PremiumProductSection = ({
  categoryTitle = 'Menu',
  filteredProducts = [],
  recentlyAddedId = null,
  cartQuantityByDetail = new Map(),
  cartItems = [],
  total = 0,
  branchName = '',
  confirmingOrder = false,
  onAdd,
  onIncrease,
  onDecrease,
  onIncreaseLine,
  onDecreaseLine,
  onRemoveLine,
  onConfirmOrder
}) => (
  <div className="pm-menu-layout">
    <main className="pm-menu-layout__main">
      <CategoryHeader
        title={categoryTitle}
        count={filteredProducts.length}
        availableCount={filteredProducts.filter((item) => item?.disponibilidad?.available).length}
      />
      <MenuProductGrid
        products={filteredProducts}
        cartQuantityByDetail={cartQuantityByDetail}
        recentlyAddedId={recentlyAddedId}
        onAdd={onAdd}
        onIncrease={onIncrease}
        onDecrease={onDecrease}
      />
    </main>
    <OrderSummaryPanel
      branchName={branchName}
      items={cartItems}
      total={total}
      confirming={confirmingOrder}
      onIncrease={onIncreaseLine}
      onDecrease={onDecreaseLine}
      onRemove={onRemoveLine}
      onConfirm={onConfirmOrder}
    />
  </div>
);

export default PremiumProductSection;
