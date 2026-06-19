export default function VentasToolbar({
  search,
  onSearchChange,
  activeFilters = 0,
  onOpenFilters,
  onOpenCreate,
  canCreate = true,
  onOpenReversion,
  canReversion = false,
  view = 'grid',
  onViewChange
}) {
  return (
    <div className="inv-prod-header ventas-page__toolbar">
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className="bi bi-cart3 inv-prod-title-icon" />
          <span className="inv-prod-title">Ventas</span>
        </div>
        <div className="inv-prod-subtitle">Control de transacciones, estados y detalle operativo.</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
        <label className="inv-ins-search ventas-page__search" aria-label="Buscar ventas">
          <i className="bi bi-search" />
          <input
            type="search"
            maxLength={120}
            placeholder="Buscar por cliente, numero, sucursal o usuario..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value.slice(0, 120))}
          />
        </label>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ventas-page__filter-btn ${activeFilters > 0 ? 'is-active' : ''}`}
          onClick={onOpenFilters}
        >
          <i className="bi bi-funnel" />
          <span>Filtros</span>
          {activeFilters > 0 ? <strong>{activeFilters}</strong> : null}
        </button>

        {canCreate ? (
          <button
            type="button"
            className="inv-prod-toolbar-btn"
            onClick={onOpenCreate}
          >
            <i className="bi bi-plus-circle" />
            <span>Nueva venta</span>
          </button>
        ) : null}

        {canReversion ? (
          <button
            type="button"
            className="inv-prod-toolbar-btn"
            onClick={onOpenReversion}
          >
            <i className="bi bi-arrow-counterclockwise" />
            <span>Registrar reversion</span>
          </button>
        ) : null}

        <div className="ventas-page__view-toggle" role="tablist" aria-label="Cambiar vista">
          <button
            type="button"
            className={`ventas-page__view-btn ${view === 'grid' ? 'is-active' : ''}`}
            onClick={() => onViewChange?.('grid')}
            aria-pressed={view === 'grid'}
            title="Vista en tarjetas"
          >
            <i className="bi bi-grid-3x3-gap-fill" />
          </button>
          <button
            type="button"
            className={`ventas-page__view-btn ${view === 'list' ? 'is-active' : ''}`}
            onClick={() => onViewChange?.('list')}
            aria-pressed={view === 'list'}
            title="Vista en lista"
          >
            <i className="bi bi-list-ul" />
          </button>
        </div>
      </div>
    </div>
  );
}
