const toCategoryLabel = (category) => (category === 'all' ? 'Todas' : category);

// Horizontal chip selector for quick category filtering.
const CategoryChips = ({ categories = [], selectedCategory = 'all', onSelect }) => {
  if (!categories.length) return null;

  return (
    <div className="pm-category-chips" role="tablist" aria-label="Filtrar por categoria">
      {categories.map((category) => {
        const selected = selectedCategory === category;

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`pm-category-chip ${selected ? 'is-selected' : ''}`}
            onClick={() => onSelect?.(category)}
          >
            {toCategoryLabel(category)}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryChips;

