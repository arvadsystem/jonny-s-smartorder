const CombosToolbar = ({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate
}) => (
  <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions menu-toolbar-actions">
    <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar combos">
      <i className="bi bi-search" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar combo por nombre o ID"
      />
    </label>

    <button
      type="button"
      className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
      onClick={onOpenFilters}
      title="Filtros"
      aria-expanded={filtersOpen}
      aria-controls="menu-combos-filtros-drawer"
    >
      <i className="bi bi-funnel" />
      <span>Filtros</span>
    </button>

    <button
      type="button"
      className="inv-prod-toolbar-btn"
      onClick={onOpenCreate}
      disabled={drawerOpen}
    >
      <i className="bi bi-plus-circle" />
      Nuevo combo
    </button>

  </div>
);

export default CombosToolbar;
