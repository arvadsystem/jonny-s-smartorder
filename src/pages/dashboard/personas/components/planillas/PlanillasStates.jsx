export function PlanillasLoadingState({ message = 'Cargando planillas...' }) {
  return (
    <div className="planillas-state" role="status" aria-live="polite">
      <div className="inv-catpro-loading mb-3">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <div className="d-grid gap-2">
        <span className="placeholder col-8" />
        <span className="placeholder col-6" />
        <span className="placeholder col-9" />
        <span className="placeholder col-7" />
      </div>
    </div>
  );
}

export function PlanillasErrorState({ message, onRetry }) {
  return (
    <div className="inv-catpro-empty planillas-state">
      <div className="inv-catpro-empty-icon">
        <i className="bi bi-exclamation-triangle" />
      </div>
      <div className="inv-catpro-empty-title">No se pudo cargar planillas</div>
      <div className="inv-catpro-empty-sub">{message || 'Intente nuevamente.'}</div>
      {typeof onRetry === 'function' ? (
        <button type="button" className="btn btn-outline-secondary" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function PlanillasEmptyState({ onGenerar, canGenerar = false }) {
  return (
    <div className="inv-catpro-empty planillas-state">
      <div className="inv-catpro-empty-icon">
        <i className="bi bi-wallet2" />
      </div>
      <div className="inv-catpro-empty-title">No hay planillas para los filtros seleccionados</div>
      <div className="inv-catpro-empty-sub">
        Puedes generar una planilla mensual por sucursal para iniciar el flujo.
      </div>
      {canGenerar && typeof onGenerar === 'function' ? (
        <button type="button" className="btn btn-primary" onClick={onGenerar}>
          Generar planilla
        </button>
      ) : null}
    </div>
  );
}
