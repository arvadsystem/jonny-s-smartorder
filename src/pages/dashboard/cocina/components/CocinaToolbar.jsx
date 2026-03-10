export default function CocinaToolbar({
  search,
  onSearchChange,
  onRefresh,
  refreshing,
  canRefresh,
  canSearch
}) {
  return (
    <div className="inv-prod-header inv-cat-v2__header">
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className="bi bi-display inv-prod-title-icon" />
          <span className="inv-prod-title">Cocina</span>
        </div>
        <div className="inv-prod-subtitle">Kitchen Display System</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions">
        <label className="inv-ins-search" aria-label="Buscar pedido de cocina">
          <i className="bi bi-search" />
          <input
            type="search"
            placeholder="Buscar por ticket, cliente o item..."
            value={search}
            disabled={!canSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${refreshing ? 'is-on' : ''}`}
          disabled={!canRefresh}
          onClick={onRefresh}
        >
          <i className={`bi ${refreshing ? 'bi-arrow-repeat' : 'bi-arrow-clockwise'}`} />
          <span>{refreshing ? 'Actualizando' : 'Actualizar'}</span>
        </button>
      </div>
    </div>
  );
}
