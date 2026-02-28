const DEFAULT_SORT_OPTIONS = [
  { value: "recientes", label: "Mas recientes" },
  { value: "nombre_asc", label: "Nombre (A-Z)" },
  { value: "nombre_desc", label: "Nombre (Z-A)" },
];

export default function ModuleFiltros({
  open,
  drawerId,
  iconClass,
  title,
  subtitle,
  draft,
  onChangeDraft,
  onClose,
  onApply,
  onClear,
  statusLabel = "Estado",
  allLabel = "Todas",
  activeLabel = "Activas",
  inactiveLabel = "Inactivas",
  sortLabel = "Ordenar por",
  sortOptions = DEFAULT_SORT_OPTIONS,
}) {
  const selectId = `${drawerId}-sort`;

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? "show" : ""}`}
      id={drawerId}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className={`${iconClass} inv-cat-v2__drawer-mark`} aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">{title}</div>
          <div className="inv-prod-drawer-sub">{subtitle}</div>
        </div>
        <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">{statusLabel}</div>
          <div className="inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === "todos" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, estadoFiltro: "todos" }))}
            >
              {allLabel}
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === "activo" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, estadoFiltro: "activo" }))}
            >
              {activeLabel}
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${draft.estadoFiltro === "inactivo" ? "is-active" : ""}`}
              onClick={() => onChangeDraft((state) => ({ ...state, estadoFiltro: "inactivo" }))}
            >
              {inactiveLabel}
            </button>
          </div>
          <div className="inv-ins-help">Selecciona un estado o deja el listado completo.</div>
        </div>

        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor={selectId}>{sortLabel}</label>
          <select
            id={selectId}
            className="form-select"
            value={draft.sortBy}
            onChange={(event) => onChangeDraft((state) => ({ ...state, sortBy: event.target.value }))}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
