const CombosToolbar = ({
  search,
  onSearchChange,
  drawerOpen,
  onOpenCreate,
  showInactiveOnly,
  onToggleInactiveOnly
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
      className="inv-prod-toolbar-btn"
      onClick={onOpenCreate}
      disabled={drawerOpen}
    >
      <i className="bi bi-plus-circle" />
      Nuevo combo
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

export default CombosToolbar;
