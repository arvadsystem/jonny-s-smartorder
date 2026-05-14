import { useEffect, useMemo, useState } from 'react';
import SoldOutBadge from './SoldOutBadge';
import { requiresItemConfiguration } from '../../utils/publicMenuItemConfig';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeBadgeData = (product) => {
  const category = String(product?.categoria?.nombre || '').toLowerCase();
  const idBase = Number(product?.id_detalle_menu || 0);
  const rating = toFiniteNumber(product?.rating_promedio) ?? (4.5 + ((idBase % 5) * 0.1));
  const prepTime = toFiniteNumber(product?.tiempo_preparacion_minutos) ?? (18 + (idBase % 6) * 2);
  const firstLabel = category.includes('combo') ? 'Combo top' : 'Popular';

  return [
    { text: firstLabel, type: 'highlight' },
    { text: `${rating.toFixed(1)}/5`, type: 'rating' },
    { text: `${prepTime}-${prepTime + 8} min`, type: 'time' }
  ];
};

// Tarjeta de item del catalogo publico con control directo de carrito.
const ProductCard = ({
  product,
  cartQuantity = 0,
  onAdd,
  onIncrease,
  onDecrease,
  isRecentlyAdded = false
}) => {
  const finalPrice = product?.precio?.final;
  const isSoldOut = !product?.disponibilidad?.available;
  const idDetalleMenu = Number(product?.id_detalle_menu || 0);
  const quantity = Number(cartQuantity || 0);
  const hasInCart = quantity > 0;
  const isConfigurable = requiresItemConfiguration(product);
  const canAddToCart = !isSoldOut && idDetalleMenu > 0;
  const imageUrl = String(product?.imagen_url || '').trim();
  const [imageSrc, setImageSrc] = useState(imageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const badges = useMemo(() => computeBadgeData(product), [product]);

  useEffect(() => {
    setImageSrc(imageUrl);
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <article className={`pm-product-card ${isSoldOut ? 'is-soldout' : ''} ${isRecentlyAdded ? 'is-added' : ''}`}>
      <div className="pm-product-card__media">
        <div className="pm-product-card__media-top">
          <span className="pm-product-card__media-badge">{badges[0]?.text || 'Popular'}</span>
          <span className="pm-product-card__favorite" aria-hidden="true">
            <i className="bi bi-heart" />
          </span>
        </div>
        {imageSrc && !imageFailed ? (
          <img
            src={imageSrc}
            alt={product?.nombre || 'Imagen del item'}
            className="pm-product-card__image"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="pm-product-card__placeholder">Sin imagen</div>
        )}
      </div>

      <div className="pm-product-card__top">
        <p className="pm-product-card__category">{product?.categoria?.nombre || 'Categoria'}</p>
        {isSoldOut ? <SoldOutBadge /> : null}
      </div>

      <h3 className="pm-product-card__title">{product?.nombre || 'Producto'}</h3>
      <p className="pm-product-card__description">{product?.descripcion || 'Descripcion no disponible.'}</p>
      <div className="pm-product-card__badges">
        {badges.map((badge) => (
          <span key={`${idDetalleMenu}-${badge.text}`} className={`pm-product-card__badge pm-product-card__badge--${badge.type}`}>
            {badge.text}
          </span>
        ))}
      </div>

      <div className="pm-product-card__meta">
        <span className="pm-product-card__price">
          {finalPrice === null || finalPrice === undefined ? 'Precio pendiente' : currencyFormatter.format(finalPrice)}
        </span>
      </div>

      <div className="pm-product-card__actions">
        {isConfigurable ? (
          <>
            <button
              type="button"
              className="btn btn-dark pm-product-card__cta pm-product-card__cta--full"
              onClick={() => onAdd?.(product)}
              disabled={!canAddToCart}
            >
              {isSoldOut ? (
                'Agotado'
              ) : (
                <>
                  <i className="bi bi-plus-circle-fill" aria-hidden="true" />
                  <span>Agregar +</span>
                </>
              )}
            </button>
            {hasInCart ? (
              <small className="pm-product-card__config-note">En carrito: {quantity}</small>
            ) : null}
          </>
        ) : !hasInCart ? (
          <button
            type="button"
            className="btn btn-dark pm-product-card__cta"
            onClick={() => onAdd?.(product)}
            disabled={!canAddToCart}
            aria-label={`Agregar ${product?.nombre || 'producto'}`}
          >
            {isSoldOut ? (
              'Agotado'
            ) : (
              <>
                <i className="bi bi-plus-lg" aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <div className="pm-product-card__qty">
            <button
              type="button"
              className="pm-product-card__qty-btn"
              onClick={() => onDecrease?.(product)}
              aria-label={`Quitar una unidad de ${product?.nombre || 'item'}`}
            >
              -
            </button>
            <span className="pm-product-card__qty-count">{quantity}</span>
            <button
              type="button"
              className="pm-product-card__qty-btn"
              onClick={() => onIncrease?.(product)}
              aria-label={`Agregar una unidad de ${product?.nombre || 'item'}`}
              disabled={isSoldOut}
            >
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
