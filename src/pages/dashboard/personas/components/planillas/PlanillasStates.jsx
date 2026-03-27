export function PlanillasLoadingState({ message = 'Cargando planillas...' }) {
  return (
    <div className="inv-catpro-loading planillas-state" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{message}</span>
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
