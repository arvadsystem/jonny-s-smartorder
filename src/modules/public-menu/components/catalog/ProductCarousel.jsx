import PromoProductCard from './PromoProductCard';

// ProductCarousel: rail horizontal reutilizable para secciones destacadas.
// Props:
// - title: titulo visible de la seccion.
// - products: productos existentes provenientes del catalogo.
// - badgeLabel: etiqueta visual de contexto.
// - onQuickAdd: handler actual para agregar rapido al carrito.
// - recentlyAddedId: id para animar feedback visual de agregado.
const ProductCarousel = ({
  title,
  products = [],
  badgeLabel = '',
  onQuickAdd,
  recentlyAddedId = null
}) => {
  if (!Array.isArray(products) || !products.length) return null;

  return (
    <section className="pm-product-carousel" aria-label={title}>
      <header className="pm-product-carousel__header">
        <h3 className="pm-product-carousel__title">{title}</h3>
      </header>

      <div className="pm-product-carousel__scroller">
        {products.map((product) => (
          <PromoProductCard
            key={`carousel-${title}-${product?.id_detalle_menu}`}
            product={product}
            badge={badgeLabel}
            onQuickAdd={onQuickAdd}
            disabled={!product?.disponibilidad?.available}
            isRecentlyAdded={Number(recentlyAddedId) === Number(product?.id_detalle_menu || 0)}
          />
        ))}
      </div>
    </section>
  );
};

export default ProductCarousel;
