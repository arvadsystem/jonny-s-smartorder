const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// MenuFeaturedProducts: cards destacadas de la landing.
// Muestra solo productos reales del catalogo; no renderiza placeholders fake.
const MenuFeaturedProducts = ({ products = [], onPrimaryAction, onAddProduct }) => (
  <section className="pm-landing-featured" aria-label="Productos destacados">
    <header className="pm-landing-section__header">
      <h2>Lo mas pedido</h2>
      <button type="button" onClick={onPrimaryAction}>Ver todo</button>
    </header>

    <div className="pm-landing-featured__grid">
      {products.map((product) => (
        <article key={product.id_detalle_menu} className="pm-landing-product-card">
          <div className="pm-landing-product-card__media">
            <img src={product.imagen_url} alt={product.nombre} loading="lazy" />
            <span className="pm-landing-product-card__badge">Top ventas</span>
          </div>
          <div className="pm-landing-product-card__body">
            <h3>{product.nombre}</h3>
            <p>{product.descripcion || 'Especialidad recomendada para hoy.'}</p>
            <div className="pm-landing-product-card__row">
              <strong>{currencyFormatter.format(Number(product?.precio?.final || 0))}</strong>
              <button
                type="button"
                onClick={() => onAddProduct?.(product)}
                aria-label={`Agregar ${product.nombre}`}
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  </section>
);

export default MenuFeaturedProducts;
