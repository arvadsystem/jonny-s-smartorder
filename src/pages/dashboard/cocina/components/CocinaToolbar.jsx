/**
 * CocinaToolbar — Barra superior del KDS
 * Usa clases propias del módulo (kds-*) en lugar de clases de inventario.
 */
export default function CocinaToolbar({
  search,
  onSearchChange,
  onRefresh,
  refreshing,
  canRefresh,
  canSearch,
  isRealtimeConnected,
  isFullscreen,
  onToggleFullscreen
}) {
  return (
    <header className="kds-toolbar">
      <div className="kds-toolbar__brand">
        <div className="kds-toolbar__icon" aria-hidden="true">
          <i className="bi bi-display" />
        </div>
        <div>
          <div className="kds-toolbar__title">Kitchen Display</div>
          <div className="kds-toolbar__subtitle">KDS · Jonny's SmartOrder</div>
        </div>
      </div>

      <div className="kds-toolbar__actions">
        <label className="kds-search" aria-label="Buscar pedido de cocina">
          <i className="bi bi-search" style={{ fontSize: '0.85rem' }} />
          <input
            type="search"
            placeholder="Ticket, cliente, ítem..."
            value={search}
            disabled={!canSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className={`kds-realtime ${isRealtimeConnected ? 'is-connected' : ''}`}>
          <span className="kds-realtime__dot" />
          <span>{isRealtimeConnected ? 'En tiempo real' : 'Reconectando...'}</span>
        </div>

        <button
          type="button"
          className={`kds-btn ${refreshing ? 'is-spinning' : ''}`}
          disabled={!canRefresh || refreshing}
          onClick={onRefresh}
          title="Actualizar tablero"
        >
          <i className="bi bi-arrow-clockwise" />
          <span>{refreshing ? 'Actualizando' : 'Actualizar'}</span>
        </button>

        <button
          type="button"
          className="kds-btn is-fullscreen"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`} />
        </button>
      </div>
    </header>
  );
}
