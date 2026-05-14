const ESTADO_LABELS = {
  borrador: 'Borrador',
  calculada: 'Calculada',
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  pagada: 'Pagada',
  anulada: 'Anulada'
};

export default function PlanillasHeader({
  periodo = '',
  tipoPeriodo = 'mensual',
  quincena = '1',
  onPeriodoChange,
  onTipoPeriodoChange,
  onQuincenaChange,
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
  const periodoLabel =
    String(tipoPeriodo).toLowerCase() === 'quincenal'
      ? `${periodo || 'Sin periodo'} · ${String(quincena) === '2' ? 'Q2 (16-fin)' : 'Q1 (1-15)'}`
      : `${periodo || 'Sin periodo'} · Mensual`;
  const hasActionButtons = Boolean(
    canExport || canGenerar || canRecalcular || canCerrar || canPagar || canAnular
  );

  return (
    <div className="planillas-header">
      <div className="planillas-header__top">
        <div className="planillas-header__identity">
          <span className="planillas-header__eyebrow">Gestion de planilla</span>
          <h3 className="planillas-header__title">{planillaCode}</h3>
          <p className="planillas-header__sub">
            {selectedPlanilla?.nombre_sucursal ||
              selectedPlanilla?.sucursal ||
              selectedPlanilla?.sucursal_nombre ||
              'Selecciona sucursal'}{' '}
            · {periodoLabel}
          </p>
        </div>
        <span className={`planillas-badge planillas-badge--${estadoRaw || 'na'}`}>{estadoLabel}</span>
      </div>

      <div className="planillas-header__controls">
        <div className="planillas-header__field">
          <label htmlFor="planillas-periodo">Periodo</label>
          <div className="planillas-header__period-wrap">
            <i className="bi bi-calendar3" aria-hidden="true" />
            <input
              id="planillas-periodo"
              type="month"
              className="form-control planillas-header__period-input"
              value={periodo}
              onChange={(event) => onPeriodoChange?.(event.target.value)}
              disabled={loadingAction}
            />
          </div>
        </div>
        <div className="planillas-header__field">
          <label htmlFor="planillas-tipo-periodo">Tipo</label>
          <select
            id="planillas-tipo-periodo"
            className="form-select"
            value={tipoPeriodo}
            onChange={(event) => onTipoPeriodoChange?.(event.target.value)}
            disabled={loadingAction}
          >
            <option value="mensual">Mensual</option>
            <option value="quincenal">Quincenal</option>
          </select>
        </div>
        {String(tipoPeriodo).toLowerCase() === 'quincenal' ? (
          <div className="planillas-header__field">
            <label htmlFor="planillas-quincena">Quincena</label>
            <select
              id="planillas-quincena"
              className="form-select"
              value={quincena}
              onChange={(event) => onQuincenaChange?.(event.target.value)}
              disabled={loadingAction}
            >
              <option value="1">1 (1-15)</option>
              <option value="2">2 (16-fin de mes)</option>
            </select>
          </div>
        ) : null}
      </div>

      {hasActionButtons ? (
        <div className="planillas-header__actions">
          {canGenerar ? (
            <button
              type="button"
              className="btn planillas-header__btn planillas-header__btn--primary"
              onClick={onGenerar}
              disabled={loadingAction || !periodo}
            >
              <i className="bi bi-plus-circle me-1" />
              Generar
            </button>
          ) : null}

          {canRecalcular ? (
            <button
              type="button"
              className="btn planillas-header__btn planillas-header__btn--secondary"
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
              className="btn planillas-header__btn planillas-header__btn--warning"
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
              className="btn planillas-header__btn planillas-header__btn--success"
              onClick={onPagar}
              disabled={loadingAction || !selectedPlanilla?.id_planilla}
            >
              <i className="bi bi-cash-coin me-1" />
              Pagar
            </button>
          ) : null}

          {canExport ? (
            <button
              type="button"
              className="btn planillas-header__btn planillas-header__btn--secondary"
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

          {canAnular ? (
            <button
              type="button"
              className="btn planillas-header__btn planillas-header__btn--danger"
              onClick={onAnular}
              disabled={loadingAction || !selectedPlanilla?.id_planilla}
            >
              <i className="bi bi-x-octagon me-1" />
              Anular
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
