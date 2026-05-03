// MenuHero: bloque principal visual de la landing premium.
// Props:
// - imageUrl: imagen protagonista (si existe producto real).
// - branchName: contexto visual de sucursal seleccionada.
// - onPrimaryAction/onSecondaryAction: CTAs de navegacion.
const MenuHero = ({
  imageUrl = '',
  branchName = '',
  onPrimaryAction,
  onSecondaryAction
}) => (
  <section className="pm-landing-hero" aria-label="Hero del menu">
    <div className="pm-landing-hero__media">
      {imageUrl ? (
        <img src={imageUrl} alt="Especialidad de la casa" className="pm-landing-hero__image" />
      ) : (
        <div className="pm-landing-hero__placeholder" />
      )}
      <div className="pm-landing-hero__overlay" aria-hidden="true" />
    </div>

    <header className="pm-landing-hero__header">
      <div className="pm-landing-hero__brand">
        <i className="bi bi-fire" aria-hidden="true" />
        <div>
          <strong>JONNY&apos;S</strong>
          <small>GRILL & BURGER</small>
        </div>
      </div>
      <nav className="pm-landing-hero__nav" aria-label="Secciones">
        <span>Menu</span>
        <span>Combos</span>
        <span>Bebidas</span>
        <span>Postres</span>
        <span>Promociones</span>
      </nav>
      <div className="pm-landing-hero__header-actions">
        <button type="button" className="pm-landing-hero__action-btn" onClick={onSecondaryAction}>
          <i className="bi bi-person-fill" aria-hidden="true" />
          Login
        </button>
        <button type="button" className="pm-landing-hero__icon-btn" onClick={onPrimaryAction} aria-label="Carrito">
          <i className="bi bi-cart3" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div className="pm-landing-hero__copy">
      <span className="pm-landing-hero__chip">
        <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
        Lo mas pedido hoy
      </span>
      <h1>¿Listo para romper la dieta?</h1>
      <p>Los mejores sabores, recien hechos, directo a tu mesa.</p>
      {branchName ? <small className="pm-landing-hero__branch">Sucursal: {branchName}</small> : null}
      <div className="pm-landing-hero__cta-row">
        <button type="button" className="pm-landing-hero__cta" onClick={onPrimaryAction}>
          Ver menu
        </button>
        <button type="button" className="pm-landing-hero__ghost" onClick={onSecondaryAction}>
          Ordena ahora
        </button>
      </div>
    </div>
  </section>
);

export default MenuHero;
