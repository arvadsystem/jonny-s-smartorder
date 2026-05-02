// CatalogTopNav: barra superior visual del catalogo tipo app premium.
// Props:
// - categories: categorias actuales del catalogo (sin alterar su origen).
// - selectedCategory: categoria activa del filtro actual.
// - onSelectCategory: handler actual de seleccion de categoria.
// - branchName: nombre de sucursal seleccionada para contexto visual.
const CatalogTopNav = ({
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  onChangeBranch,
  onHomeClick,
  onUserClick,
  onCartClick
}) => (
  <section className="pm-catalog-topnav" aria-label="Navegacion del menu">
    <div className="pm-catalog-topnav__actions">
      <button type="button" className="pm-catalog-topnav__branch" aria-label="Sucursal actual">
        <i className="bi bi-geo-alt-fill" aria-hidden="true" />
        <span>{branchName}</span>
      </button>
      <span className="pm-catalog-topnav__order-chip">{orderTypeLabel}</span>
      <button type="button" className="pm-catalog-topnav__change" onClick={onChangeBranch}>
        <i className="bi bi-arrow-repeat" aria-hidden="true" />
        Cambiar
      </button>
      <button type="button" className="pm-catalog-topnav__ghost" onClick={onHomeClick}>
        <i className="bi bi-house-door-fill" aria-hidden="true" />
        Inicio
      </button>
      <button type="button" className="pm-catalog-topnav__ghost" onClick={onUserClick}>
        <i className="bi bi-person-fill" aria-hidden="true" />
        Iniciar sesion
      </button>
      <button type="button" className="pm-catalog-topnav__icon" onClick={onCartClick} aria-label="Carrito">
        <i className="bi bi-cart3" aria-hidden="true" />
      </button>
    </div>
  </section>
);

export default CatalogTopNav;
