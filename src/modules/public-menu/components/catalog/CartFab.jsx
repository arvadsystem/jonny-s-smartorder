const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// Barra de carrito mobile-first: accesible para pulgar y siempre visible cuando hay items.
const CartFab = ({ itemCount = 0, total = 0, disabled = false, onClick }) => {
  if (disabled || Number(itemCount || 0) <= 0) return null;

  return (
    <button
      type="button"
      className="pm-cart-fab"
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
