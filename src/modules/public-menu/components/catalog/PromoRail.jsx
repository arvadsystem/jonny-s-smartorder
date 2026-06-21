import PromoProductCard from './PromoProductCard';

// Rail horizontal para secciones de venta (mas vendidos y antojos).
const PromoRail = ({ title, products = [], badgeLabel = '', onQuickAdd, recentlyAddedId = null }) => {
  if (!Array.isArray(products) || !products.length) return null;

  return (
    <section className="pm-promo-rail" aria-label={title}>
      <header className="pm-promo-rail__header">
        <h3 className="pm-promo-rail__title">{title}</h3>
      </header>

      <div className="pm-promo-rail__scroller">
        {products.map((product) => {
          const isSoldOut = !product?.disponibilidad?.available;
          return (
            <PromoProductCard
              key={`promo-${title}-${product?.id_detalle_menu}`}
              product={product}
              badge={badgeLabel}
              onQuickAdd={onQuickAdd}
              disabled={isSoldOut}
              isRecentlyAdded={Number(recentlyAddedId) === Number(product?.id_detalle_menu || 0)}
            />
          );
        })}
      </div>
    </section>
  );
};

export default PromoRail;
