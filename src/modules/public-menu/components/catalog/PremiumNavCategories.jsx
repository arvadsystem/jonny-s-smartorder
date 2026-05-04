// PremiumNavCategories: navegacion horizontal de categorias (solo presentacion).
// Props:
// - categories: lista de categorias visibles en el header.
// - selectedCategory: categoria activa actual.
// - onSelectCategory: handler existente para filtrar categoria.
import { formatPublicMenuCategoryLabel } from '../../utils/publicMenuCategoryLabels';

const PremiumNavCategories = ({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory
}) => (
  <nav className="pm-premium-header__nav" aria-label="Categorias del menu">
    {categories.map((category) => {
      const isActive = selectedCategory === category;
      return (
        <button
          key={`ph-cat-${category}`}
          type="button"
          className={`pm-premium-header__nav-item ${isActive ? 'is-active' : ''}`}
          onClick={() => onSelectCategory?.(category)}
        >
          {formatPublicMenuCategoryLabel(category)}
        </button>
      );
    })}
  </nav>
);

export default PremiumNavCategories;
