import CategoryChips from './CategoryChips';
import SearchInput from './SearchInput';

// PremiumCategoryRail: rail de categorias + buscador del catalogo real.
// Mantiene los mismos callbacks funcionales del filtro existente.
const PremiumCategoryRail = ({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  categoryVisuals = {},
  searchTerm = '',
  onSearch,
  onClearSearch
}) => (
  <div className="pm-catalog-main">
    <CategoryChips
      categories={categories}
      selectedCategory={selectedCategory}
      onSelect={onSelectCategory}
      categoryVisuals={categoryVisuals}
    />

    <SearchInput
      value={searchTerm}
      onChange={onSearch}
      onClear={onClearSearch}
      placeholder="Busca por nombre o descripcion"
    />
  </div>
);

export default PremiumCategoryRail;
