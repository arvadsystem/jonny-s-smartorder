import { useEffect, useState } from 'react';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// Card compacta para rails horizontales de venta.
const PromoProductCard = ({
  product,
  badge = '',
  onQuickAdd,
  disabled = false,
  isRecentlyAdded = false
}) => {
  const imageUrl = String(product?.imagen_url || '').trim();
  const price = product?.precio?.final;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <article className={`pm-promo-card ${isRecentlyAdded ? 'is-added' : ''}`}>
      <div className="pm-promo-card__media">
        <button type="button" className="pm-promo-card__favorite" aria-label="Favorito">
          <i className="bi bi-heart" aria-hidden="true" />
        </button>
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={product?.nombre || 'Producto'}
            className="pm-promo-card__image"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="pm-promo-card__placeholder">Sin imagen</div>
        )}
        {badge ? <span className="pm-promo-card__badge">{badge}</span> : null}
      </div>

      <div className="pm-promo-card__body">
        <h3 className="pm-promo-card__title">{product?.nombre || 'Producto'}</h3>
        <div className="pm-promo-card__meta">
          <strong className="pm-promo-card__price">
            {price === null || price === undefined ? 'Precio pendiente' : currencyFormatter.format(price)}
          </strong>
          <button
            type="button"
            className="pm-promo-card__add"
            onClick={() => onQuickAdd?.(product)}
            disabled={disabled}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>Agregar +</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default PromoProductCard;
