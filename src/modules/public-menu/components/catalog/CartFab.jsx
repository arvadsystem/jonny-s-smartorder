// Floating cart button: visual only for this phase (no cart logic yet).
const CartFab = ({ itemCount = 0, disabled = false, onClick }) => (
  <button
    type="button"
    className="pm-cart-fab"
    disabled={disabled}
    aria-label="Abrir carrito"
    onClick={onClick}
  >
    <i className="bi bi-cart3" aria-hidden="true" />
    <span>Carrito</span>
    <strong className="pm-cart-fab__count">{itemCount}</strong>
  </button>
);

export default CartFab;
