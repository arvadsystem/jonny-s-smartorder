// PremiumNavCategories: navegacion horizontal de categorias (solo presentacion).
// Props:
// - categories: lista de categorias visibles en el header.
// - selectedCategory: categoria activa actual.
// - onSelectCategory: handler existente para filtrar categoria.
const formatCategoryLabel = (category) =>
  String(category || '').replace(/\btenders\b/gi, 'Tenders');

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
          {formatCategoryLabel(category)}
        </button>
      );
    })}
  </nav>
);

export default PremiumNavCategories;
