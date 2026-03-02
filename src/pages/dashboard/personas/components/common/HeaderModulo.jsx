import SearchBar from "../SearchBar";

export default function HeaderModulo({
  iconClass,
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filtersOpen,
  onOpenFilters,
  createOpen,
  onOpenCreate,
  createLabel = "Nuevo",
  filtersControlsId,
  formControlsId,
}) {
  return (
    <div className="inv-prod-header inv-cat-v2__header">
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className={`${iconClass} inv-prod-title-icon`} />
          <span className="inv-prod-title">{title}</span>
        </div>
        <div className="inv-prod-subtitle">{subtitle}</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
        />

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${filtersOpen ? "is-on" : ""}`}
          onClick={onOpenFilters}
          title="Filtros"
          aria-expanded={filtersOpen}
          aria-controls={filtersControlsId}
        >
          <i className="bi bi-funnel" /> <span>Filtros</span>
        </button>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${createOpen ? "is-on" : ""}`}
          onClick={onOpenCreate}
          title={createLabel}
          aria-expanded={createOpen}
          aria-controls={formControlsId}
        >
          <i className="bi bi-plus-circle" /> <span>{createLabel}</span>
        </button>
      </div>
    </div>
  );
}
