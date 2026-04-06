const RecetasToolbar = ({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate
}) => (
  <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions menu-toolbar-actions">
    <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar recetas">
      <i className="bi bi-search" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar por nombre, descripcion o ID..."
      />
    </label>

    <button
      type="button"
      className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
      onClick={onOpenFilters}
      title="Filtros"
      aria-expanded={filtersOpen}
      aria-controls="menu-recetas-filtros-drawer"
    >
      <i className="bi bi-funnel" />
      <span>Filtros</span>
    </button>

    <button
      type="button"
      className={`inv-prod-toolbar-btn ${drawerOpen ? 'is-on' : ''}`}
      onClick={onOpenCreate}
      title="Nuevo"
      aria-expanded={drawerOpen}
      aria-controls="menu-recetas-form-drawer"
    >
      <i className="bi bi-plus-circle" />
      <span>Nueva receta</span>
    </button>
  </div>
);

export default RecetasToolbar;
