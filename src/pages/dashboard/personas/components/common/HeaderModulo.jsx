import ListHeader from "../../../../../components/ui/ListHeader";
import ViewToggle from "../../../../../components/ui/ViewToggle";

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
  viewMode,
  onViewModeChange,
}) {
  const actions = (
    <>
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
    </>
  );

  return (
    <ListHeader
      iconClass={iconClass}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchAriaLabel={searchAriaLabel}
      actions={actions}
      viewToggle={viewMode ? <ViewToggle value={viewMode} onChange={onViewModeChange} /> : null}
    />
  );
}
