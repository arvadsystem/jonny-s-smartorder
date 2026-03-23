const CombosToolbar = ({
  search,
  onSearchChange,
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
        placeholder="Buscar combo por descripcion o ID"
      />
    </label>

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