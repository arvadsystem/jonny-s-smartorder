const RecetasToolbar = ({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate,
  viewMode,
  onChangeViewMode
}) => (
  <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions">
    <label className="inv-ins-search inv-prod-header-search" aria-label="Buscar recetas">
      <i className="bi bi-search" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar receta..."
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
      <span>Nuevo</span>
    </button>

    <div
      className="personas-page__view-toggle menu-recetas-admin__view-toggle"
      role="tablist"
      aria-label="Cambiar vista recetas"
    >
      <button
        type="button"
        className={`personas-page__view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
        onClick={() => onChangeViewMode('cards')}
        aria-pressed={viewMode === 'cards'}
        title="Vista tarjetas"
      >
        <i className="bi bi-grid-3x3-gap-fill" />
      </button>
      <button
        type="button"
        className={`personas-page__view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
        onClick={() => onChangeViewMode('table')}
        aria-pressed={viewMode === 'table'}
        title="Vista tabla"
      >
        <i className="bi bi-list-ul" />
      </button>
    </div>
  </div>
);

export default RecetasToolbar;
