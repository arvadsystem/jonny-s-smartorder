const DepartamentosToolbar = ({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate,
  canCreate = true,
  showInactiveOnly,
  onToggleInactiveOnly
}) => (
  <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions menu-toolbar-actions">
    <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar departamentos">
      <i className="bi bi-search" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar por nombre, codigo, descripcion o ID..."
      />
    </label>

    <button
      type="button"
      className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
      onClick={onOpenFilters}
      title="Filtros"
      aria-expanded={filtersOpen}
      aria-controls="menu-departamentos-filtros-drawer"
    >
      <i className="bi bi-funnel" />
      <span>Filtros</span>
    </button>

    <button
      type="button"
      className={`inv-prod-toolbar-btn ${drawerOpen ? 'is-on' : ''}`}
      onClick={onOpenCreate}
      title="Nuevo departamento"
      aria-expanded={drawerOpen}
      aria-controls="menu-departamentos-form-drawer"
      disabled={!canCreate}
    >
      <i className="bi bi-plus-circle" />
      <span>Nuevo departamento</span>
    </button>

    <label className="form-check form-switch mb-0 personas-page__inactive-toggle inv-catpro-inline-toggle">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        checked={Boolean(showInactiveOnly)}
        onChange={(event) => onToggleInactiveOnly?.(event.target.checked)}
        aria-label="Ver inactivos"
      />
      <span className="form-check-label">Ver inactivos</span>
    </label>
  </div>
);

export default DepartamentosToolbar;
