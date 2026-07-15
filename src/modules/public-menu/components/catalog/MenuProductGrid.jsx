import MenuProductCard from './MenuProductCard';

const MenuProductGrid = ({
  products = [],
  cartQuantityByDetail = new Map(),
  recentlyAddedId = null,
  onAdd,
  onIncrease,
  onDecrease
}) => (
  <div className="pm-menu-product-grid" aria-label="Elementos del menu">
    {products.map((product) => {
      const idDetalle = Number(product?.id_detalle_menu || 0);
      return (
        <MenuProductCard
          key={idDetalle || product?.nombre}
          product={product}
          cartQuantity={cartQuantityByDetail.get(idDetalle) || 0}
          onAdd={onAdd}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          isRecentlyAdded={recentlyAddedId === idDetalle}
        />
      );
    })}
  </div>
);

export default MenuProductGrid;
