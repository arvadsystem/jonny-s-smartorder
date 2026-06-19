import PremiumHeader from './PremiumHeader';

// PremiumCatalogHeader: agrupa la cabecera premium del catalogo real.
// Solo compone UI con props existentes; no contiene logica de negocio.
const PremiumCatalogHeader = ({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  branchName = 'Sucursal',
  branchId = null,
  orderTypeLabel = 'Pedido',
  orderType = '',
  onChangeBranch,
  onSelectBranch,
  branches = [],
  branchesLoading = false,
  branchesError = '',
  onReloadBranches,
  onChangeOrderType,
  onHomeClick,
  onUserClick,
  onLogout,
  onCartClick,
  cartCount = 0,
  greetingName = '',
  theme = 'dark',
  onToggleTheme
}) => (
  <PremiumHeader
    categories={categories}
    selectedCategory={selectedCategory}
    onSelectCategory={onSelectCategory}
    branchName={branchName}
    branchId={branchId}
    orderTypeLabel={orderTypeLabel}
    orderType={orderType}
    onChangeBranch={onChangeBranch}
    onSelectBranch={onSelectBranch}
    branches={branches}
    branchesLoading={branchesLoading}
    branchesError={branchesError}
    onReloadBranches={onReloadBranches}
    onChangeOrderType={onChangeOrderType}
    cartCount={cartCount}
    onHomeClick={onHomeClick}
    onUserClick={onUserClick}
    onLogout={onLogout}
    onCartClick={onCartClick}
    greetingName={greetingName}
    theme={theme}
    onToggleTheme={onToggleTheme}
  />
);

export default PremiumCatalogHeader;
