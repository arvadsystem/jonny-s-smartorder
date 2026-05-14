import ProductCard from './ProductCard';

// PremiumProductCard: wrapper de presentacion para la card real del catalogo.
// Reexpone las mismas props/handlers de carrito sin alterar su comportamiento.
const PremiumProductCard = ({
  product,
  cartQuantity = 0,
  onAdd,
  onIncrease,
  onDecrease,
  isRecentlyAdded = false
}) => (
  <ProductCard
    product={product}
    cartQuantity={cartQuantity}
    onAdd={onAdd}
    onIncrease={onIncrease}
    onDecrease={onDecrease}
    isRecentlyAdded={isRecentlyAdded}
  />
);

export default PremiumProductCard;
