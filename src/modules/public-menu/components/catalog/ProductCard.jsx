import { useEffect, useState } from 'react';
import SoldOutBadge from './SoldOutBadge';
import { requiresItemConfiguration } from '../../utils/publicMenuItemConfig';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// Tarjeta de item del catalogo publico con control directo de carrito.
const ProductCard = ({ product, cartQuantity = 0, onAdd, onIncrease, onDecrease }) => {
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

  useEffect(() => {
    setImageSrc(imageUrl);
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <article className={`pm-product-card ${isSoldOut ? 'is-soldout' : ''}`}>
      <div className="pm-product-card__media">
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
        <p className="pm-product-card__category">{product.categoria.nombre}</p>
        {isSoldOut ? <SoldOutBadge /> : null}
      </div>

      <h3 className="pm-product-card__title">{product.nombre}</h3>
      <p className="pm-product-card__description">{product.descripcion}</p>

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
              className="btn btn-dark pm-product-card__cta"
              onClick={() => onAdd?.(product)}
              disabled={!canAddToCart}
            >
              {isSoldOut ? (
                'Agotado'
              ) : (
                <>
                  <i className="bi bi-cart3" aria-hidden="true" />
                  <span>Agregar al Carrito</span>
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
          >
            {isSoldOut ? (
              'Agotado'
            ) : (
              <>
                <i className="bi bi-cart3" aria-hidden="true" />
                <span>Agregar al Carrito</span>
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
