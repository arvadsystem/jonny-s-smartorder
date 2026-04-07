import { useMemo } from 'react';

const STATUS_FILTERS = Object.freeze({
  all: 'all',
  pending: 'pending',
  applied: 'applied',
  removed: 'removed'
});

const normalizeStatusKey = (value = '') => String(value ?? '').trim().toLowerCase();

const resolveFilterKey = (item = {}) => {
  const estado = normalizeStatusKey(item?.estado);
  if (estado === 'pendiente') return STATUS_FILTERS.pending;
  if (estado === 'aplicado') return STATUS_FILTERS.applied;
  if (estado === 'eliminado') return STATUS_FILTERS.removed;
  return STATUS_FILTERS.all;
};

const toSafeText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export default function PlanillasAdelantosInsight({
  summaryText = '',
  loading = false,
  items = [],
  loadingAction = false,
  canAplicarAdelantos = false,
  hasPlanillaSeleccionada = false,
  onApplyItem,
  onApplyAll,
  onOpenRegister,
  onOpenDetail,
  formatFriendlyDate,
  formatMoney
}) {
  const pendingRows = useMemo(
    () => items.filter((item) => resolveFilterKey(item) === STATUS_FILTERS.pending),
    [items]
  );
  const visibleRows = pendingRows.slice(0, 4);

  return (
    <section className="planillas-insight planillas-insight--adelantos">
      <div className="planillas-insight__head">
        <div className="planillas-insight__title-wrap">
          <span className="planillas-insight__icon" aria-hidden="true">
            <i className="bi bi-wallet2" />
          </span>
          <div>
            <h4>Adelantos de salario</h4>
            <p>{summaryText || 'Consulta y aplica adelantos pendientes de la planilla seleccionada.'}</p>
          </div>
        </div>
        <div className="planillas-insight__head-actions planillas-insight__head-actions--adelantos">
          <button
            type="button"
            className="planillas-insight__primary"
            onClick={onApplyAll}
            disabled={
              loadingAction ||
              loading ||
              pendingRows.length === 0 ||
              !canAplicarAdelantos ||
              !hasPlanillaSeleccionada
            }
          >
            <i className="bi bi-check2 me-1" />
            Aplicar Todos
          </button>
          <button
            type="button"
            className="planillas-insight__ghost"
            onClick={onOpenRegister}
            disabled={loadingAction || loading || !canAplicarAdelantos || !hasPlanillaSeleccionada}
          >
            <i className="bi bi-plus-circle me-1" />
            Registrar adelanto
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
        <div className="planillas-insight__empty">Cargando adelantos...</div>
      ) : pendingRows.length === 0 ? (
        <div className="planillas-insight__empty">No hay adelantos pendientes por aplicar en este contexto.</div>
      ) : (
        <>
          <div className="planillas-insight__rows">
            {visibleRows.map((item, index) => {
              const key = item?.id || item?.id_movimiento || item?.id_adelanto || index;
              const rowStatus = resolveFilterKey(item);
              const employeeName = toSafeText(item?.empleado_nombre, 'Empleado');

              return (
                <article
                  key={key}
                  className={`planillas-insight__row planillas-insight__row--${rowStatus || 'all'}`}
                >
                  <div>
                    <strong>{employeeName}</strong>
                    <small>
                      Pendiente desde {formatFriendlyDate(item?.fecha)}
                    </small>
                    <small>
                      Saldo pendiente: {formatMoney(item?.saldo || item?.monto)}
                    </small>
                  </div>
                  <div className="planillas-insight__row-actions">
                    <span className={`planillas-insight__status-chip planillas-insight__status-chip--${rowStatus}`}>
                      <i className="bi bi-hourglass-split" />
                      Pendiente
                    </span>
                    <button
                      type="button"
                      className="planillas-insight__apply-btn"
                      disabled={loadingAction || !hasPlanillaSeleccionada || !canAplicarAdelantos}
                      onClick={() => onApplyItem?.(item)}
                    >
                      Aplicar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {pendingRows.length > visibleRows.length ? (
            <div className="planillas-insight__more">
              +{pendingRows.length - visibleRows.length} adelanto(s) pendiente(s) adicional(es).
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
