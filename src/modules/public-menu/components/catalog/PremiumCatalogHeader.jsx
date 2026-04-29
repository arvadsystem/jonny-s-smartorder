import PremiumHeader from './PremiumHeader';

// PremiumCatalogHeader: agrupa la cabecera premium del catalogo real.
// Solo compone UI con props existentes; no contiene logica de negocio.
const PremiumCatalogHeader = ({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  onChangeBranch,
  onChangeOrderType,
  onHomeClick,
  onUserClick,
  onCartClick,
  cartCount = 0
}) => (
  <PremiumHeader
    categories={categories}
    selectedCategory={selectedCategory}
    onSelectCategory={onSelectCategory}
    branchName={branchName}
    orderTypeLabel={orderTypeLabel}
    onChangeBranch={onChangeBranch}
    onChangeOrderType={onChangeOrderType}
    cartCount={cartCount}
    onHomeClick={onHomeClick}
    onUserClick={onUserClick}
    onCartClick={onCartClick}
  />
);

export default PremiumCatalogHeader;
