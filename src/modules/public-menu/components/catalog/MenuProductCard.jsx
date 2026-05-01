import { useEffect, useMemo, useState } from 'react';
import EmptyProductImagePlaceholder from './EmptyProductImagePlaceholder';
import SoldOutBadge from './SoldOutBadge';
import { requiresItemConfiguration } from '../../utils/publicMenuItemConfig';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const MenuProductCard = ({
  product,
  cartQuantity = 0,
  onAdd,
  onIncrease,
  onDecrease,
  isRecentlyAdded = false
}) => {
  const imageUrl = String(product?.imagen_url || '').trim();
  const [imageFailed, setImageFailed] = useState(false);
  const quantity = Number(cartQuantity || 0);
  const hasInCart = quantity > 0;
  const isSoldOut = !product?.disponibilidad?.available;
  const isConfigurable = requiresItemConfiguration(product);
  const canAddToCart = !isSoldOut && Number(product?.id_detalle_menu || 0) > 0;
  const productName = String(product?.nombre || 'Producto').trim();
  const productDescription = String(product?.descripcion || '').trim();
  const shouldShowDescription =
    productDescription && normalizeText(productDescription) !== normalizeText(productName);
  const priceLabel = product?.precio?.final === null || product?.precio?.final === undefined
    ? 'Precio pendiente'
    : currencyFormatter.format(product.precio.final);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const actionLabel = useMemo(() => {
    if (isSoldOut) return 'Agotado';
    return 'Ordenar';
  }, [isSoldOut]);

  return (
    <article className={`pm-menu-product-card ${isSoldOut ? 'is-soldout' : ''} ${isRecentlyAdded ? 'is-added' : ''}`}>
      <div className="pm-menu-product-card__media">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={productName}
            className="pm-menu-product-card__image"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <EmptyProductImagePlaceholder label={productName || "JONNY'S"} />
        )}
        <span className="pm-menu-product-card__category">{product?.categoria?.nombre || 'Categoria'}</span>
      </div>

      <div className="pm-menu-product-card__body">
        <div className="pm-menu-product-card__heading">
          <h3 className="pm-menu-product-card__title">{productName}</h3>
          {isSoldOut ? <SoldOutBadge /> : null}
        </div>
        {shouldShowDescription ? (
          <p className="pm-menu-product-card__description">{productDescription}</p>
        ) : null}
      </div>

      <footer className="pm-menu-product-card__footer">
        <strong className="pm-menu-product-card__price">{priceLabel}</strong>
        {hasInCart && !isConfigurable ? (
          <div className="pm-menu-product-card__qty" aria-label={`Cantidad de ${productName}`}>
            <button type="button" onClick={() => onDecrease?.(product)} aria-label="Quitar unidad">
              -
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => onIncrease?.(product)} aria-label="Agregar unidad">
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pm-menu-product-card__add"
            onClick={() => onAdd?.(product)}
            disabled={!canAddToCart}
          >
            {actionLabel}
          </button>
        )}
      </footer>
    </article>
  );
};

export default MenuProductCard;
