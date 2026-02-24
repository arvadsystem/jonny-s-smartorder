export default function SucursalesFiltersDrawer({
  open,
  draft,
  onChangeDraft,
  onClose,
  onApply,
  onClear
}) {
  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? 'show' : ''}`}
      id="suc-filters-drawer"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-shop-window inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">Filtros de sucursales</div>
          <div className="inv-prod-drawer-sub">Estado y orden visual del carrusel</div>
        </div>
        <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === 'todos' ? 'is-active' : ''}`}
              onClick={() => onChangeDraft((s) => ({ ...s, estadoFiltro: 'todos' }))}
            >
              Todas
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === 'activo' ? 'is-active' : ''}`}
              onClick={() => onChangeDraft((s) => ({ ...s, estadoFiltro: 'activo' }))}
            >
              Activas
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === 'inactivo' ? 'is-active' : ''}`}
              onClick={() => onChangeDraft((s) => ({ ...s, estadoFiltro: 'inactivo' }))}
            >
              Inactivas
            </button>
          </div>
          <div className="inv-ins-help">Selecciona un estado o deja "Todas".</div>
        </div>

        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="suc_filter_sort">Ordenar por</label>
          <select
            id="suc_filter_sort"
            className="form-select"
            value={draft.sortBy}
            onChange={(e) => onChangeDraft((s) => ({ ...s, sortBy: e.target.value }))}
          >
            <option value="recientes">Mas recientes</option>
            <option value="nombre_asc">Nombre (A-Z)</option>
            <option value="nombre_desc">Nombre (Z-A)</option>
            <option value="direccion_asc">Direccion (A-Z)</option>
            <option value="direccion_desc">Direccion (Z-A)</option>
          </select>
        </div>

        <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions">
          <button type="button" className="btn inv-prod-btn-subtle" onClick={onClear}>
            Limpiar
          </button>
          <button type="button" className="btn inv-prod-btn-primary" onClick={onApply}>
            Aplicar
          </button>
        </div>
      </div>
    </aside>
  );
}

