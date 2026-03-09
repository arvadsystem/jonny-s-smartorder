const CombosToolbar = ({
  search,
  onSearchChange,
  drawerOpen,
  onOpenCreate
}) => (
  <div className="menu-recetas-admin__header-actions d-flex gap-2 align-items-center">
    <div className="inv-ins-search">
      <i className="bi bi-search" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar combo por descripcion o ID"
      />
    </div>

    <button
      type="button"
      className="btn inv-prod-btn-primary"
      onClick={onOpenCreate}
      disabled={drawerOpen}
    >
      <i className="bi bi-plus-lg me-1" />
      Nuevo combo
    </button>
  </div>
);

export default CombosToolbar;

