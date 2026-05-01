const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// PromoBanner: bloque promocional cinematografico solo visual.
// Props:
// - product: item existente usado para imagen/texto/precio.
// - onQuickAdd: handler actual de agregar al carrito.
const PromoBanner = ({ product, onQuickAdd }) => {
  if (!product) return null;

  const price = Number(product?.precio?.final || 0);
  const imageUrl = String(product?.imagen_url || '').trim();
  const isSoldOut = !product?.disponibilidad?.available;

  return (
    <section className="pm-promo-banner" aria-label="Promocion destacada">
      <div className="pm-promo-banner__media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.nombre || 'Promocion'}
            className="pm-promo-banner__image"
            loading="lazy"
          />
        ) : (
          <div className="pm-promo-banner__placeholder" />
        )}
        <div className="pm-promo-banner__overlay" aria-hidden="true" />
      </div>

      <div className="pm-promo-banner__copy">
        <span className="pm-promo-banner__tag">Promo del dia</span>
        <h3 className="pm-promo-banner__title">{product?.nombre || 'Combo explosivo'}</h3>
        <p className="pm-promo-banner__description">
          {product?.descripcion || 'Un combo poderoso para romper el hambre.'}
        </p>
      </div>

      <div className="pm-promo-banner__cta-wrap">
        <strong className="pm-promo-banner__price">{currencyFormatter.format(price)}</strong>
        <button
          type="button"
          className="pm-promo-banner__cta"
          onClick={() => onQuickAdd?.(product)}
          disabled={isSoldOut}
        >
          {isSoldOut ? 'Agotado' : 'Lo quiero'}
        </button>
      </div>
    </section>
  );
};

export default PromoBanner;
