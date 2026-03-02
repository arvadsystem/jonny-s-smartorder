import SearchBar from "./SearchBar";

export default function HeaderPersonas({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate,
}) {
  return (
    <div className="inv-prod-header inv-cat-v2__header">
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className="bi bi-people-fill inv-prod-title-icon" />
          <span className="inv-prod-title">Personas</span>
        </div>
        <div className="inv-prod-subtitle">Gestion visual de personas</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions">
        <SearchBar value={search} onChange={onSearchChange} />

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${filtersOpen ? "is-on" : ""}`}
          onClick={onOpenFilters}
          title="Filtros"
          aria-expanded={filtersOpen}
          aria-controls="per-filtros-drawer"
        >
          <i className="bi bi-funnel" /> <span>Filtros</span>
        </button>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${drawerOpen ? "is-on" : ""}`}
          onClick={onOpenCreate}
          title="Nueva persona"
          aria-expanded={drawerOpen}
          aria-controls="per-form-drawer"
        >
          <i className="bi bi-plus-circle" /> <span>Nuevo</span>
        </button>
      </div>
    </div>
  );
}
