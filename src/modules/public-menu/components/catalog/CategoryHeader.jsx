const CategoryHeader = ({
  title = 'Menu',
  count = 0,
  availableCount = 0
}) => (
  <header className="pm-menu-category-header">
    <div>
      <span className="pm-menu-category-header__eyebrow">Menu Jonny’s</span>
      <h2 className="pm-menu-category-header__title">{title}</h2>
    </div>
    <div className="pm-menu-category-header__meta" aria-label="Resumen de productos">
      <strong>{count}</strong>
      <span>{availableCount} disponibles</span>
    </div>
  </header>
);

export default CategoryHeader;
