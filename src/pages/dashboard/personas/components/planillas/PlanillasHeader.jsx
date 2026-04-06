const ESTADO_LABELS = {
  borrador: 'Borrador',
  calculada: 'Calculada',
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  pagada: 'Pagada',
  anulada: 'Anulada'
};

export default function PlanillasHeader({
  sucursalOptions = [],
  sucursalId = '',
  onSucursalChange,
  periodo = '',
  onPeriodoChange,
  selectedPlanilla = null,
  onGenerar,
  onRecalcular,
  onCerrar,
  onPagar,
  onAnular,
  onExport,
  canGenerar = false,
  canRecalcular = false,
  canCerrar = false,
  canPagar = false,
  canAnular = false,
  canExport = false,
  exportLoading = false,
  loadingAction = false
}) {
  const estadoRaw = String(
    selectedPlanilla?.estado_descripcion ||
      selectedPlanilla?.estado_planilla ||
      selectedPlanilla?.estado ||
      selectedPlanilla?.descripcion_estado ||
      ''
  )
    .trim()
    .toLowerCase();

  const estadoLabel =
    ESTADO_LABELS[estadoRaw] ||
    selectedPlanilla?.estado_descripcion ||
    selectedPlanilla?.estado_planilla ||
    'Sin estado';

  const planillaCode =
    selectedPlanilla?.codigo_planilla ||
    selectedPlanilla?.correlativo ||
    (selectedPlanilla?.id_planilla ? `PLA-${selectedPlanilla.id_planilla}` : 'Sin planilla');

  return (
    <div className="planillas-header">
      <div className="planillas-header__top">
        <div>
          <h3 className="planillas-header__title">{planillaCode}</h3>
          <p className="planillas-header__sub">
            {selectedPlanilla?.nombre_sucursal ||
              selectedPlanilla?.sucursal ||
              selectedPlanilla?.sucursal_nombre ||
              'Selecciona sucursal'}{' '}
            · {periodo || 'Sin periodo'}
          </p>
        </div>
        <span className={`planillas-badge planillas-badge--${estadoRaw || 'na'}`}>{estadoLabel}</span>
      </div>

      <div className="planillas-header__controls">
        <div className="planillas-header__field">
          <label htmlFor="planillas-sucursal">Sucursal</label>
          <select
            id="planillas-sucursal"
            className="form-select"
            value={sucursalId}
            onChange={(event) => onSucursalChange?.(event.target.value)}
            disabled={loadingAction}
          >
            <option value="">Seleccione sucursal</option>
            {sucursalOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="planillas-header__field">
          <label htmlFor="planillas-periodo">Periodo</label>
          <input
            id="planillas-periodo"
            type="month"
            className="form-control"
            value={periodo}
            onChange={(event) => onPeriodoChange?.(event.target.value)}
            disabled={loadingAction}
          />
        </div>
      </div>

      <div className="planillas-header__actions">
        {canExport ? (
          <button
            type="button"
            className="btn btn-outline-dark"
            onClick={onExport}
            disabled={loadingAction || exportLoading || !selectedPlanilla?.id_planilla}
            title="Exportar planilla"
          >
            {exportLoading ? (
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            ) : (
              <i className="bi bi-download me-1" />
            )}
            Exportar
          </button>
        ) : null}

        {canGenerar ? (
          <button type="button" className="btn btn-primary" onClick={onGenerar} disabled={loadingAction || !sucursalId || !periodo}>
            <i className="bi bi-plus-circle me-1" />
            Generar
          </button>
        ) : null}

        {canRecalcular ? (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onRecalcular}
            disabled={loadingAction || !selectedPlanilla?.id_planilla}
          >
            <i className="bi bi-arrow-repeat me-1" />
            Recalcular
          </button>
        ) : null}

        {canCerrar ? (
          <button
            type="button"
            className="btn btn-outline-warning"
            onClick={onCerrar}
            disabled={loadingAction || !selectedPlanilla?.id_planilla}
          >
            <i className="bi bi-lock me-1" />
            Cerrar
          </button>
        ) : null}

        {canPagar ? (
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={onPagar}
            disabled={loadingAction || !selectedPlanilla?.id_planilla}
          >
            <i className="bi bi-cash-coin me-1" />
            Pagar
          </button>
        ) : null}

        {canAnular ? (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onAnular}
            disabled={loadingAction || !selectedPlanilla?.id_planilla}
          >
            <i className="bi bi-x-octagon me-1" />
            Anular
          </button>
        ) : null}
      </div>
    </div>
  );
}
