export default function VentasToolbar({
  search,
  selectedSucursalId,
  canSelectSucursal = false,
  sucursales = [],
  allowedSucursalIds = [],
  onSucursalChange,
  onSearchChange,
  onOpenCreate,
  canCreate = true,
  onOpenReversion,
  canReversion = false
}) {
  const allowedSet = new Set(
    (Array.isArray(allowedSucursalIds) ? allowedSucursalIds : [])
      .map((id) => Number.parseInt(String(id ?? ''), 10))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const selectableSucursales = (Array.isArray(sucursales) ? sucursales : [])
    .filter((row) => allowedSet.has(Number(row?.id_sucursal)))
    .sort((a, b) =>
      String(a?.nombre_sucursal || '').localeCompare(String(b?.nombre_sucursal || ''), 'es', {
        sensitivity: 'base'
      })
    );

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

        {canSelectSucursal ? (
          <label className="inv-ins-search" aria-label="Filtrar por sucursal">
            <i className="bi bi-shop" />
            <select
              value={selectedSucursalId ? String(selectedSucursalId) : ''}
              onChange={(event) => onSucursalChange?.(event.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {selectableSucursales.map((sucursal) => (
                <option key={sucursal.id_sucursal} value={String(sucursal.id_sucursal)}>
                  {sucursal.nombre_sucursal}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            <span>Registrar reversión</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
