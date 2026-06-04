const MenuFiltersDrawer = ({
  open = false,
  onClose,
  onApply,
  onClear,
  title = 'Ajusta el estado y el orden del listado',
  chips = [],
  applyLabel = 'Aplicar',
  clearLabel = 'Limpiar',
  drawerId = 'menu-filters-drawer',
  children
}) => {
  if (!open) return null;

  return (
    <>
    <div
      className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop show"
      onClick={onClose}
      aria-hidden="true"
    />

    <aside
      className="inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters menu-filters-drawer show"
      id={drawerId}
      role="dialog"
      aria-modal="true"
    >
      <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
        <div className="inv-cat-create-hero inv-cat-filter-hero">
          <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close" onClick={onClose} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
          <div className="inv-cat-create-hero__icon">
            <i className="bi bi-funnel" aria-hidden="true" />
          </div>
          <div className="inv-cat-create-hero__copy">
            <div className="inv-cat-create-hero__kicker">VISTA DE FILTROS</div>
            <div className="inv-cat-create-hero__title">{title}</div>
          </div>

          {chips?.length ? (
            <div className="inv-cat-create-hero__chips">
              {chips.map((chip) => (
                <span key={`${chip?.icon || 'chip'}-${chip?.label || ''}`} className="inv-cat-create-hero__chip">
                  {chip?.icon ? <i className={`bi ${chip.icon}`} aria-hidden="true" /> : null}
                  {chip?.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="inv-cat-filter-grid">{children}</div>

        <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions menu-filters-drawer__actions">
          <button type="button" className="btn inv-prod-btn-subtle" onClick={onClear}>
            {clearLabel}
          </button>
          <button type="button" className="btn inv-prod-btn-primary" onClick={onApply}>
            {applyLabel}
          </button>
        </div>
      </div>
    </aside>
  </>
  );
};

export default MenuFiltersDrawer;
