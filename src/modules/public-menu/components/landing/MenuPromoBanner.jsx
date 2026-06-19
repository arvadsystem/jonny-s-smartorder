const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// MenuPromoBanner: bloque promocional oscuro/dorado de alto impacto.
// Props:
// - product: item real opcional para imagen/precio.
// - onPrimaryAction: CTA del banner.
const MenuPromoBanner = ({ product, onPrimaryAction }) => (
  <section className="pm-landing-promo" aria-label="Promocion del dia">
    <div className="pm-landing-promo__media">
      {product?.imagen_url ? <img src={product.imagen_url} alt={product?.nombre || 'Promo'} loading="lazy" /> : <span />}
      <div className="pm-landing-promo__overlay" aria-hidden="true" />
    </div>

    <div className="pm-landing-promo__copy">
      <small>Promo del dia</small>
      <h3>{product?.nombre || 'Combo explosivo'}</h3>
      <p>{product?.descripcion || 'Hamburguesa + alitas + bebida por tiempo limitado.'}</p>
    </div>

    <div className="pm-landing-promo__cta">
      <strong>{product?.precio?.final ? currencyFormatter.format(product.precio.final) : 'Oferta especial'}</strong>
      <button type="button" onClick={onPrimaryAction}>Lo quiero</button>
    </div>
  </section>
);

export default MenuPromoBanner;
