import { useEffect } from 'react';

export default function CierresCajaFiltersDrawer({
  open,
  title,
  subtitle,
  activeFilters = 0,
  onClose,
  onClear,
  onApply,
  children
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  return (
    <>
      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters ${open ? 'show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
          <div className="inv-cat-create-hero inv-cat-filter-hero">
            <button
              type="button"
              className="inv-prod-drawer-close inv-cat-create-hero__close"
              onClick={onClose}
              title="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-cat-create-hero__icon">
              <i className="bi bi-funnel" aria-hidden="true" />
            </div>
            <div className="inv-cat-create-hero__copy">
              <div className="inv-cat-create-hero__kicker">Vista De Filtros</div>
              <div className="inv-cat-create-hero__title">{title}</div>
              {subtitle ? <div className="inv-cat-create-hero__text">{subtitle}</div> : null}
            </div>
            <div className="inv-cat-create-hero__chips">
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-sliders2" aria-hidden="true" />
                {activeFilters > 0 ? `${activeFilters} filtros activos` : 'Sin filtros activos'}
              </span>
            </div>
          </div>

          <div className="inv-cat-filter-grid cierres-caja-filters-drawer__grid">{children}</div>

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={onClear}>
              Limpiar
            </button>
            <button type="button" className="btn inv-prod-btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={onApply}>
              Aplicar
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
