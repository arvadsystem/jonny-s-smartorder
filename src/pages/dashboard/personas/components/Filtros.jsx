export default function Filtros({
  open,
  draft,
  onChangeDraft,
  onClose,
  onApply,
  onClear,
}) {
  const blurCurrentTarget = (event) => {
    const target = event?.currentTarget;
    if (target && typeof target.blur === "function") target.blur();
  };

  const handleClose = (event) => {
    blurCurrentTarget(event);
    if (typeof onClose === "function") onClose();
  };

  const handleApply = (event) => {
    blurCurrentTarget(event);
    if (typeof onApply === "function") onApply();
  };

  const handleClear = (event) => {
    blurCurrentTarget(event);
    if (typeof onClear === "function") onClear();
  };

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? "show" : ""}`}
      id="per-filtros-drawer"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-people-fill inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">Filtros de personas</div>
          <div className="inv-prod-drawer-sub">Genero y orden visual del listado</div>
        </div>
        <button
          type="button"
          className="inv-prod-drawer-close"
          onClick={handleClose}
          title="Cerrar"
          aria-label="Cerrar filtros"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Genero</div>
          <div className="inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${draft.generoFiltro === "todos" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, generoFiltro: "todos" }))}
            >
              Todos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.generoFiltro === "femenino" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, generoFiltro: "femenino" }))}
            >
              Femenino
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.generoFiltro === "masculino" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, generoFiltro: "masculino" }))}
            >
              Masculino
            </button>
          </div>
          <div className="inv-ins-help">Selecciona un genero o deja 'Todos'.</div>
        </div>

        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="per_filter_sort">Ordenar por</label>
          <select
            id="per_filter_sort"
            className="form-select"
            value={draft.sortBy}
            onChange={(event) => onChangeDraft((state) => ({ ...state, sortBy: event.target.value }))}
          >
            <option value="recientes">Mas recientes</option>
            <option value="nombre_asc">Nombre (A-Z)</option>
            <option value="nombre_desc">Nombre (Z-A)</option>
          </select>
        </div>

        <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions">
          <button type="button" className="btn inv-prod-btn-subtle" onClick={handleClear}>
            Limpiar
          </button>
          <button type="button" className="btn inv-prod-btn-primary" onClick={handleApply}>
            Aplicar
          </button>
        </div>
      </div>
    </aside>
  );
}
