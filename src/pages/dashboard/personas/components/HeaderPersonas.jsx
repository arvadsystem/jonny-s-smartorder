import ListHeader from "../../../../components/ui/ListHeader";
import ViewToggle from "../../../../components/ui/ViewToggle";

export default function HeaderPersonas({
  search,
  onSearchChange,
  filtersOpen,
  onOpenFilters,
  drawerOpen,
  onOpenCreate,
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
    </>
  );

  return (
    <ListHeader
      iconClass="bi bi-people-fill"
      title="Personas"
      subtitle="Gestion visual de personas"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nombre, DNI, telefono, correo o direccion..."
      searchAriaLabel="Buscar personas"
      actions={actions}
      viewToggle={viewMode ? <ViewToggle value={viewMode} onChange={onViewModeChange} /> : null}
    />
  );
}
