const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Barra de carrito mobile-first: accesible para pulgar y siempre visible cuando hay items.
const CartFab = ({ itemCount = 0, total = 0, disabled = false, pulse = false, onClick }) => {
  if (disabled || Number(itemCount || 0) <= 0) return null;

  return (
    <button
      type="button"
      className={`pm-cart-fab ${pulse ? 'is-pulse' : ''}`}
      aria-label="Abrir carrito"
      onClick={onClick}
    >
      <span className="pm-cart-fab__left">
        <i className="bi bi-cart3" aria-hidden="true" />
        <span>Carrito</span>
        <strong className="pm-cart-fab__count">{itemCount}</strong>
      </span>
      <strong className="pm-cart-fab__total">{currencyFormatter.format(Number(total || 0))}</strong>
    </button>
  );
};

export default CartFab;
