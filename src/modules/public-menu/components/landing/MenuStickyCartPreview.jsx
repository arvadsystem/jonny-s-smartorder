const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// MenuStickyCartPreview: preview visual del carrito en landing.
// Solo aparece si hay items segun estado real del carrito actual.
const MenuStickyCartPreview = ({ totalItems = 0, total = 0, onPrimaryAction }) => {
  if (Number(totalItems || 0) <= 0) return null;

  return (
    <button type="button" className="pm-landing-sticky-cart" onClick={onPrimaryAction} aria-label="Ir al carrito">
      <span className="pm-landing-sticky-cart__left">
        <i className="bi bi-bag-fill" aria-hidden="true" />
        <span>Mi pedido</span>
        <strong>{totalItems}</strong>
      </span>
      <span className="pm-landing-sticky-cart__mid">
        <small>Subtotal</small>
        <strong>{currencyFormatter.format(Number(total || 0))}</strong>
      </span>
      <span className="pm-landing-sticky-cart__cta">
        Ver carrito
        <i className="bi bi-arrow-right" aria-hidden="true" />
      </span>
    </button>
  );
};

export default MenuStickyCartPreview;
