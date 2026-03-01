export default function VentasToolbar({
  search,
  onSearchChange,
  createOpen,
  onOpenCreate
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
        <label className="inv-ins-search" aria-label="Buscar ventas">
          <i className="bi bi-search" />
          <input
            type="search"
            placeholder="Buscar por cliente, numero, sucursal o usuario..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <button
          type="button"
          className={`inv-prod-toolbar-btn ${createOpen ? 'is-on' : ''}`}
          onClick={onOpenCreate}
        >
          <i className="bi bi-plus-circle" />
          <span>Nueva venta</span>
        </button>
      </div>
    </div>
  );
}
