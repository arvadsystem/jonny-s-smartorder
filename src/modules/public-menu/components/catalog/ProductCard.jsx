import SoldOutBadge from './SoldOutBadge';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// Tarjeta de item del catalogo publico.
// En HU-133 el CTA abre detalle real del item por id_detalle_menu.
const ProductCard = ({ product, onOpenDetail }) => {
  const finalPrice = product?.precio?.final;
  const isSoldOut = !product?.disponibilidad?.available;
  const canOpenDetail = typeof onOpenDetail === 'function' && Number(product?.id_detalle_menu) > 0;
  const imageUrl = String(product?.imagen_url || '').trim();

  return (
    <article className={`pm-product-card ${isSoldOut ? 'is-soldout' : ''}`}>
      <div className="pm-product-card__media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.nombre || 'Imagen del item'}
            className="pm-product-card__image"
            loading="lazy"
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
        <span className="pm-product-card__time">{product.tipo_item}</span>
      </div>

      <button
        type="button"
        className="btn btn-dark pm-product-card__cta"
        onClick={() => onOpenDetail?.(product)}
        disabled={!canOpenDetail}
      >
        Ver detalle
      </button>
    </article>
  );
};

export default ProductCard;
