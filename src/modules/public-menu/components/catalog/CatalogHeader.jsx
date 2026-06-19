// Resumen contextual sticky del catalogo publico.
const CatalogHeader = ({ branchName, orderTypeLabel, menuName, totalProducts, availableProducts }) => (
  <section className="pm-catalog-header">
    <div className="pm-catalog-header__top">
      <h2 className="pm-catalog-header__title">{menuName || 'Catalogo'}</h2>
      <span className="pm-catalog-header__count">{totalProducts} opciones</span>
    </div>

    <p className="pm-catalog-header__meta">
      {branchName} - {orderTypeLabel}
    </p>
    <p className="pm-catalog-header__availability">{availableProducts} disponibles ahora</p>
  </section>
);

export default CatalogHeader;
