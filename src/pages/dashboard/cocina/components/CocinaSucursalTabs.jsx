/**
 * CocinaSucursalTabs — Selector de sucursal para el KDS.
 *
 * Comportamiento:
 * - canFilter=true (super_admin o admin): muestra "Todas" + lista de sucursales
 * - canFilter=false (cocinero): muestra solo el nombre de su sucursal asignada
 *   como etiqueta fija (no un botón clicable), ya que el backend fuerza su scope.
 */
export default function CocinaSucursalTabs({
  sucursales,
  selectedSucursalId,
  canFilter,
  onSelectSucursal
}) {
  const listaSucursales = Array.isArray(sucursales) ? sucursales : [];

  // Usuario sin permiso de filtrado: mostrar solo su sucursal (no interactivo)
  if (!canFilter) {
    const sucursalAsignada = listaSucursales[0] || null;
    if (!sucursalAsignada) return null;

    return (
      <div className="kds-tabs-wrap" aria-label="Sucursal asignada">
        <span className="kds-sucursal-label">
          <i className="bi bi-geo-alt-fill" />
          {sucursalAsignada.nombre_sucursal}
        </span>
      </div>
    );
  }

  // Super Admin / admin: puede ver todas las sucursales
  return (
    <nav className="kds-tabs-wrap" role="tablist" aria-label="Filtrar por sucursal">
      <button
        type="button"
        role="tab"
        aria-selected={selectedSucursalId === null}
        className={`kds-tab ${selectedSucursalId === null ? 'is-active' : ''}`}
        onClick={() => onSelectSucursal(null)}
      >
        Todas
      </button>

      {listaSucursales.map((sucursal) => (
        <button
          key={sucursal.id_sucursal}
          type="button"
          role="tab"
          aria-selected={Number(selectedSucursalId ?? 0) === Number(sucursal.id_sucursal)}
          className={`kds-tab ${
            Number(selectedSucursalId ?? 0) === Number(sucursal.id_sucursal) ? 'is-active' : ''
          }`}
          onClick={() => onSelectSucursal(Number(sucursal.id_sucursal))}
        >
          {sucursal.nombre_sucursal}
        </button>
      ))}
    </nav>
  );
}
