const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// StickyCartBar: barra sticky inferior del carrito (solo capa visual).
// Props:
// - itemCount/total/disabled/pulse: estado actual ya calculado en CatalogScreen.
// - onClick: abre el cart sheet existente sin cambiar su logica.
const StickyCartBar = ({ itemCount = 0, total = 0, disabled = false, pulse = false, onClick }) => {
  if (disabled || Number(itemCount || 0) <= 0) return null;

  return (
    <button
      type="button"
      className={`pm-sticky-cart-bar ${pulse ? 'is-pulse' : ''}`}
      aria-label="Abrir carrito"
      onClick={onClick}
    >
      <span className="pm-sticky-cart-bar__left">
        <i className="bi bi-bag-fill" aria-hidden="true" />
        <span>Mi pedido</span>
        <strong className="pm-sticky-cart-bar__count">{itemCount}</strong>
      </span>
      <span className="pm-sticky-cart-bar__mid">
        <small>Subtotal</small>
        <strong>{currencyFormatter.format(Number(total || 0))}</strong>
      </span>
      <span className="pm-sticky-cart-bar__cta">
        Ver carrito
        <i className="bi bi-arrow-right" aria-hidden="true" />
      </span>
    </button>
  );
};

export default StickyCartBar;
