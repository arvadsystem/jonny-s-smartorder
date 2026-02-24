export default function SucursalesToolbar({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  drawerMode,
  onOpenCreate
}) {
  return (
    <div className="inv-prod-header inv-cat-v2__header">
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className="bi bi-shop inv-prod-title-icon" />
          <span className="inv-prod-title">Sucursales</span>
        </div>
        <div className="inv-prod-subtitle">Gestión visual de sucursales</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions">
        <label className="inv-ins-search" aria-label="Buscar sucursales">
          <i className="bi bi-search" />
          <input
            type="search"
            placeholder="Buscar por nombre, direccion, telefono o correo..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
          onClick={onOpenFilters}
          title="Filtros"
          aria-expanded={filtersOpen}
          aria-controls="suc-filters-drawer"
        >
          <i className="bi bi-funnel" /> <span>Filtros</span>
        </button>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${drawerOpen && drawerMode === 'create' ? 'is-on' : ''}`}
          onClick={onOpenCreate}
          title="Nueva"
          aria-expanded={drawerOpen && drawerMode === 'create'}
          aria-controls="suc-form-drawer"
        >
          <i className="bi bi-plus-circle" /> <span>Nuevo</span>
        </button>
      </div>
    </div>
  );
}

