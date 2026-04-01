// Selector de sucursal + metadata del menu vigente para evitar edicion cruzada.
const MenuSucursalSelector = ({
  sucursales = [],
  selectedSucursalId = '',
  selectedSucursal = null,
  menuSummary = null,
  loading = false,
  onChange,
  onReload
}) => {
  const rows = Array.isArray(sucursales) ? sucursales : [];
  const sanitizedRows = rows.filter((branch) => !String(branch?.nombre_sucursal || '').toLowerCase().includes('ejemplo'));
  const activeWithMenu = sanitizedRows.filter((branch) => Boolean(branch?.estado) && Boolean(branch?.tiene_menu_vigente));
  const activeRows = sanitizedRows.filter((branch) => Boolean(branch?.estado));
  // Prioriza solo sucursales operativas con menu vigente para evitar ruido visual (ejemplo/sandbox).
  const branchRows = activeWithMenu.length > 0 ? activeWithMenu : activeRows;

  return (
    <section className="menu-pub-admin__selector" aria-label="Selector de sucursal para publicacion">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2">
        <div className="flex-grow-1">
          <label className="form-label mb-1">Sucursal</label>
          <div className="d-flex flex-wrap gap-2">
            {branchRows.map((branch) => {
              const branchId = String(branch?.id_sucursal || '');
              const isSelected = branchId && branchId === String(selectedSucursalId || '');

              return (
                <button
                  key={`menu-pub-branch-${branchId || branch?.nombre_sucursal || 'x'}`}
                  type="button"
                  className={`btn btn-sm ${isSelected ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={() => onChange?.(branchId)}
                  disabled={loading || !branchId}
                >
                  {branch?.nombre_sucursal || `Sucursal #${branchId}`}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn inv-prod-btn-subtle"
          onClick={onReload}
          disabled={loading || !selectedSucursalId}
        >
          Recargar
        </button>
      </div>

      <div className="menu-pub-admin__selector-meta">
        {selectedSucursalId ? (
          !selectedSucursal ? (
            <span className="text-danger">La sucursal seleccionada ya no esta disponible. Selecciona otra sucursal.</span>
          ) : !Boolean(selectedSucursal?.estado) ? (
            <span className="text-danger">La sucursal seleccionada esta inactiva.</span>
          ) : menuSummary ? (
            <>
              <span>Menu vigente: <strong>{menuSummary.nombre_menu || 'Menu'}</strong></span>
              <span>ID menu: <strong>{menuSummary.id_menu}</strong></span>
            </>
          ) : (
            <span className="text-danger">La sucursal no tiene menu vigente activo.</span>
          )
        ) : (
          <span className="text-muted">Selecciona una sucursal para editar publicacion.</span>
        )}
      </div>
    </section>
  );
};

export default MenuSucursalSelector;

