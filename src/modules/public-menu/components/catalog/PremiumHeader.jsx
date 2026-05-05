import { useEffect, useState } from 'react';
import PremiumNavCategories from './PremiumNavCategories';
import PremiumHeaderActions from './PremiumHeaderActions';

const MOBILE_MENU_MEDIA_QUERY = '(max-width: 767.98px)';

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
  onLogout,
  onCartClick,
  greetingName = '',
  theme = 'dark',
  onToggleTheme
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MENU_MEDIA_QUERY).matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(MOBILE_MENU_MEDIA_QUERY);
    const syncViewportMode = (matches) => {
      setIsMobileViewport(matches);
      if (!matches) setMobileMenuOpen(false);
    };

    syncViewportMode(mediaQuery.matches);

    const handleViewportChange = (event) => syncViewportMode(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  const handleSelectCategory = (category) => {
    onSelectCategory?.(category);
    setMobileMenuOpen(false);
  };

  return (
    <header className="pm-premium-header" aria-label="Cabecera principal del catalogo">
      <div className="pm-premium-header__brand-row">
        {isMobileViewport ? (
          <button
            type="button"
            className="pm-premium-header__menu-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Abrir categorias"
            aria-expanded={mobileMenuOpen}
          >
            <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
          </button>
        ) : null}

      </div>

      {!isMobileViewport ? (
        <PremiumNavCategories
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
        />
      ) : null}

      {isMobileViewport && mobileMenuOpen ? (
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
        onLogout={onLogout}
        onCartClick={onCartClick}
        greetingName={greetingName}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </header>
  );
};

export default PremiumHeader;
