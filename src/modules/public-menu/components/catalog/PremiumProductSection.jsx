import ProductCarousel from './ProductCarousel';
import PremiumProductCard from './PremiumProductCard';

// PremiumProductSection: secciones destacadas + grid real de productos.
// Props:
// - promoSections: rails "lo mas pedido" del catalogo real.
// - filteredProducts: listado filtrado actual.
// - cartQuantityByDetail: mapa de cantidades en carrito por producto.
// - handlers: mismos handlers existentes de add/increase/decrease.
const PremiumProductSection = ({
  promoSections = [],
  filteredProducts = [],
  recentlyAddedId = null,
  cartQuantityByDetail = new Map(),
  onQuickAdd,
  onAdd,
  onIncrease,
  onDecrease
}) => (
  <>
    {promoSections.map((section) => (
      <ProductCarousel
        key={section.id}
        title={section.title}
        products={section.items}
        badgeLabel={section.badgeLabel}
        onQuickAdd={onQuickAdd}
        recentlyAddedId={recentlyAddedId}
      />
    ))}

    <div className="pm-product-grid">
      {filteredProducts.map((product) => (
        <PremiumProductCard
          key={product.id_detalle_menu}
          product={product}
          cartQuantity={cartQuantityByDetail.get(Number(product?.id_detalle_menu || 0)) || 0}
          onAdd={onAdd}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          isRecentlyAdded={recentlyAddedId === Number(product?.id_detalle_menu || 0)}
        />
      ))}
    </div>
  </>
);

export default PremiumProductSection;
