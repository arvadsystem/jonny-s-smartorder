import { useMemo } from 'react';

const STATUS = Object.freeze({
  vigente: 'vigente',
  anulada: 'anulada'
});

const TYPE = Object.freeze({
  bono: 'bono',
  deduccion: 'deduccion'
});

const normalizeText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export default function PlanillasBonosDeduccionesInsight({
  summaryText = '',
  loading = false,
  items = [],
  loadingAction = false,
  canRegistrarMovimiento = false,
  hasPlanillaSeleccionada = false,
  onOpenRegister,
  onOpenDetail,
  formatFriendlyDate,
  formatMoney
}) {
  const vigentes = useMemo(
    () => (Array.isArray(items) ? items : []).filter((row) => row?.estado === STATUS.vigente),
    [items]
  );
  const visibleRows = vigentes.slice(0, 4);

  return (
    <section className="planillas-insight planillas-insight--bonos-deducciones">
      <div className="planillas-insight__head">
        <div className="planillas-insight__title-wrap">
          <span className="planillas-insight__icon" aria-hidden="true">
            <i className="bi bi-receipt" />
          </span>
          <div>
            <h4>Bonos y deducciones</h4>
            <p>{summaryText || 'Gestiona movimientos de bonos y deducciones de la planilla seleccionada.'}</p>
          </div>
        </div>
        <div className="planillas-insight__head-actions planillas-insight__head-actions--bonos-deducciones">
          <button
            type="button"
            className="planillas-insight__ghost"
            onClick={onOpenRegister}
            disabled={loading || loadingAction || !canRegistrarMovimiento || !hasPlanillaSeleccionada}
          >
            <i className="bi bi-plus-circle me-1" />
            Registrar movimiento
          </button>
          <button
            type="button"
            className="planillas-insight__ghost"
            onClick={() => onOpenDetail?.()}
            disabled={loading || !hasPlanillaSeleccionada}
          >
            <i className="bi bi-clock-history me-1" />
            Ver detalle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="planillas-insight__empty">Cargando movimientos...</div>
      ) : vigentes.length === 0 ? (
        <div className="planillas-insight__empty">No hay bonos o deducciones vigentes en este contexto.</div>
      ) : (
        <>
          <div className="planillas-insight__rows">
            {visibleRows.map((row, index) => {
              const rowId = row?.id || row?.id_movimiento || `bd-${index}`;
              const tipo = row?.tipo === TYPE.bono ? TYPE.bono : TYPE.deduccion;
              const tipoLabel = tipo === TYPE.bono ? 'Bono' : 'Deducción';
              const empleado = normalizeText(row?.empleado_nombre, 'Empleado');
              const concepto = normalizeText(row?.concepto, 'Sin concepto');
              const fechaLabel =
                typeof formatFriendlyDate === 'function'
                  ? formatFriendlyDate(row?.fecha)
                  : normalizeText(row?.fecha, '-');
              const montoLabel =
                typeof formatMoney === 'function' ? formatMoney(row?.monto) : normalizeText(row?.monto, 'L 0.00');

              return (
                <article key={rowId} className={`planillas-insight__row planillas-insight__row--${tipo}`}>
                  <div>
                    <strong>{empleado}</strong>
                    <small>{concepto}</small>
                    <small>Fecha: {fechaLabel}</small>
                  </div>
                  <div className="planillas-insight__row-actions">
                    <span className={`planillas-insight__status-chip planillas-insight__status-chip--${tipo}`}>
                      <i className={tipo === TYPE.bono ? 'bi bi-plus-circle' : 'bi bi-dash-circle'} />
                      {tipoLabel}
                    </span>
                    <strong className="planillas-insight__bd-amount">{montoLabel}</strong>
                  </div>
                </article>
              );
            })}
          </div>

          {vigentes.length > visibleRows.length ? (
            <div className="planillas-insight__more">
              +{vigentes.length - visibleRows.length} movimiento(s) vigente(s) adicional(es).
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

