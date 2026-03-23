// Selector de sucursal + metadata del menu vigente para evitar edicion cruzada.
const MenuSucursalSelector = ({
  sucursales = [],
  selectedSucursalId = '',
  menuSummary = null,
  loading = false,
  onChange,
  onReload
}) => (
  <section className="menu-pub-admin__selector" aria-label="Selector de sucursal para publicacion">
    <div className="d-flex flex-wrap align-items-end gap-2">
      <div className="flex-grow-1">
        <label className="form-label mb-1" htmlFor="menu_pub_sucursal_select">Sucursal</label>
        <select
          id="menu_pub_sucursal_select"
          className="form-select"
          value={selectedSucursalId}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={loading}
        >
          <option value="">Selecciona una sucursal</option>
          {(Array.isArray(sucursales) ? sucursales : []).map((branch) => (
            <option key={branch.id_sucursal} value={String(branch.id_sucursal)}>
              {branch.nombre_sucursal}
            </option>
          ))}
        </select>
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
        menuSummary ? (
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

export default MenuSucursalSelector;
