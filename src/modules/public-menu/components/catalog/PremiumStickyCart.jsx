import StickyCartBar from './StickyCartBar';

// PremiumStickyCart: barra sticky premium del carrito en catalogo.
// Mantiene la misma logica de apertura y estado del carrito actual.
const PremiumStickyCart = ({
  itemCount = 0,
  total = 0,
  disabled = false,
  pulse = false,
  onOpenCart
}) => (
  <StickyCartBar
    itemCount={itemCount}
    total={total}
    disabled={disabled}
    pulse={pulse}
    onClick={onOpenCart}
  />
);

export default PremiumStickyCart;
