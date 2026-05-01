const toCategoryLabel = (category) => (category === 'all' ? 'Todas' : category);

// Horizontal chip selector for quick category filtering.
// Props:
// - categoryVisuals: mapa opcional con imagen por categoria (solo visual).
const CategoryChips = ({
  categories = [],
  selectedCategory = 'all',
  onSelect,
  categoryVisuals = {}
}) => {
  if (!categories.length) return null;

  return (
    <div className="pm-category-chips" role="tablist" aria-label="Filtrar por categoria">
      {categories.map((category) => {
        const selected = selectedCategory === category;
        const mediaUrl = String(categoryVisuals?.[category]?.imageUrl || '').trim();

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`pm-category-chip ${selected ? 'is-selected' : ''}`}
            onClick={() => onSelect?.(category)}
          >
            {mediaUrl ? (
              <span className="pm-category-chip__media" aria-hidden="true">
                <img src={mediaUrl} alt="" loading="lazy" />
              </span>
            ) : null}
            <span>{toCategoryLabel(category)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryChips;
