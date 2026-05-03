import PromoBanner from './PromoBanner';

// PremiumPromoBanner: banner promocional premium del catalogo real.
// Reutiliza producto real y handler actual de agregar rapido.
const PremiumPromoBanner = ({ product, onQuickAdd }) => (
  <PromoBanner product={product} onQuickAdd={onQuickAdd} />
);

export default PremiumPromoBanner;
