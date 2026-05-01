import { useState } from 'react';
import PremiumNavCategories from './PremiumNavCategories';
import PremiumHeaderActions from './PremiumHeaderActions';
import jonnysLogo from '../../../../assets/images/logo-sin-fondo.png';

// PremiumHeader: header unico del catalogo.
// En mobile agrega menu desplegable de categorias sin cambiar handlers de negocio.
const PremiumHeader = ({
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
  cartCount = 0,
  onHomeClick,
  onUserClick,
  onCartClick,
  greetingName = '',
  theme = 'dark',
  onToggleTheme
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelectCategory = (category) => {
    onSelectCategory?.(category);
    setMobileMenuOpen(false);
  };

  return (
    <header className="pm-premium-header" aria-label="Cabecera principal del catalogo">
      <div className="pm-premium-header__brand-row">
        <button
          type="button"
          className="pm-premium-header__menu-btn"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Abrir categorias"
          aria-expanded={mobileMenuOpen}
        >
          <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
        </button>

        <div className="pm-premium-header__brand">
          <img src={jonnysLogo} alt="JONNY'S Grill & Burger" className="pm-premium-header__brand-logo" />
        </div>
      </div>

      <PremiumNavCategories
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {mobileMenuOpen ? (
        <div className="pm-premium-header__mobile-panel" aria-label="Listado de categorias">
          <PremiumNavCategories
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        </div>
      ) : null}

      <PremiumHeaderActions
        branchName={branchName}
        branchId={branchId}
        cartCount={cartCount}
        orderTypeLabel={orderTypeLabel}
        orderType={orderType}
        onChangeBranch={onChangeBranch}
        onSelectBranch={onSelectBranch}
        branches={branches}
        branchesLoading={branchesLoading}
        branchesError={branchesError}
        onReloadBranches={onReloadBranches}
        onChangeOrderType={onChangeOrderType}
        onHomeClick={onHomeClick}
        onUserClick={onUserClick}
        onCartClick={onCartClick}
        greetingName={greetingName}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </header>
  );
};

export default PremiumHeader;
