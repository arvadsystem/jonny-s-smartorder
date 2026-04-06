import { useMemo, useState } from 'react';

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
  dismissed = false,
  summaryText = '',
  loading = false,
  items = [],
  loadingAction = false,
  canAplicarAdelantos = false,
  hasPlanillaSeleccionada = false,
  onDismiss,
  onApplyItem,
  onApplyAll,
  onOpenDetail,
  formatFriendlyDate,
  formatMoney
}) {
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.all);

  const rowsByStatus = useMemo(() => {
    const grouped = {
      [STATUS_FILTERS.all]: [...items],
      [STATUS_FILTERS.pending]: [],
      [STATUS_FILTERS.applied]: [],
      [STATUS_FILTERS.removed]: []
    };

    items.forEach((item) => {
      const key = resolveFilterKey(item);
      if (key !== STATUS_FILTERS.all) grouped[key].push(item);
    });

    return grouped;
  }, [items]);

  const filterOptions = useMemo(
    () => [
      {
        key: STATUS_FILTERS.all,
        label: 'Todas',
        icon: 'bi-list-ul',
        count: rowsByStatus[STATUS_FILTERS.all].length
      },
      {
        key: STATUS_FILTERS.pending,
        label: 'Pendientes',
        icon: 'bi-hourglass-split',
        count: rowsByStatus[STATUS_FILTERS.pending].length
      },
      {
        key: STATUS_FILTERS.applied,
        label: 'Aplicadas',
        icon: 'bi-check-circle',
        count: rowsByStatus[STATUS_FILTERS.applied].length
      },
      {
        key: STATUS_FILTERS.removed,
        label: 'Eliminadas',
        icon: 'bi-trash3',
        count: rowsByStatus[STATUS_FILTERS.removed].length
      }
    ],
    [rowsByStatus]
  );

  const activeFilter = rowsByStatus[statusFilter] ? statusFilter : STATUS_FILTERS.all;
  const filteredRows = rowsByStatus[activeFilter] || [];
  const visibleRows = filteredRows.slice(0, 4);

  if (dismissed) return null;

  return (
    <section className="planillas-insight planillas-insight--adelantos">
      <div className="planillas-insight__head">
        <div className="planillas-insight__title-wrap">
          <span className="planillas-insight__icon" aria-hidden="true">
            <i className="bi bi-wallet2" />
          </span>
          <div>
            <h4>Adelantos de salario</h4>
            <p>{summaryText || 'Consulta y gestiona adelantos aplicados a esta planilla.'}</p>
          </div>
        </div>
        <button
          type="button"
          className="planillas-insight__close"
          onClick={onDismiss}
          aria-label="Ocultar bloque de adelantos"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="planillas-insight__filters" role="group" aria-label="Filtrar adelantos por estado">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`planillas-insight__filter-chip ${activeFilter === option.key ? 'is-active' : ''}`}
            data-filter={option.key}
            onClick={() => setStatusFilter(option.key)}
            aria-pressed={activeFilter === option.key}
          >
            <i className={`bi ${option.icon}`} />
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="planillas-insight__empty">Cargando adelantos...</div>
      ) : filteredRows.length === 0 ? (
        <div className="planillas-insight__empty">No hay registros para el filtro seleccionado.</div>
      ) : (
        <>
          <div className="planillas-insight__rows">
            {visibleRows.map((item, index) => {
              const key = item?.id || item?.id_movimiento || item?.id_adelanto || index;
              const rowStatus = resolveFilterKey(item);
              const isPending = rowStatus === STATUS_FILTERS.pending;
              const isApplied = rowStatus === STATUS_FILTERS.applied;
              const isRemoved = rowStatus === STATUS_FILTERS.removed;
              const employeeName = toSafeText(item?.empleado_nombre, 'Empleado');

              return (
                <article
                  key={key}
                  className={`planillas-insight__row planillas-insight__row--${rowStatus || 'all'}`}
                >
                  <div>
                    <strong>{employeeName}</strong>
                    <small>
                      {isPending ? 'Pendiente del' : isApplied ? 'Aplicado el' : 'Eliminado el'}{' '}
                      {formatFriendlyDate(item?.fecha)}
                    </small>
                    <small>
                      {isPending ? 'Saldo pendiente' : 'Monto registrado'}: {formatMoney(item?.saldo || item?.monto)}
                    </small>
                  </div>
                  <div className="planillas-insight__row-actions">
                    <span className={`planillas-insight__status-chip planillas-insight__status-chip--${rowStatus}`}>
                      <i
                        className={`bi ${
                          isPending
                            ? 'bi-hourglass-split'
                            : isRemoved
                              ? 'bi-trash3'
                              : 'bi-check-circle'
                        }`}
                      />
                      {isPending ? 'Pendiente' : isRemoved ? 'Eliminada' : 'Aplicada'}
                    </span>
                    {isPending ? (
                      <button
                        type="button"
                        className="planillas-insight__apply-btn"
                        disabled={!hasPlanillaSeleccionada || !canAplicarAdelantos}
                        onClick={() => onApplyItem?.(item)}
                      >
                        Aplicar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="planillas-insight__ghost"
                        onClick={() => onOpenDetail?.(item)}
                        disabled={!hasPlanillaSeleccionada}
                      >
                        Ver detalle
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {filteredRows.length > visibleRows.length ? (
            <div className="planillas-insight__more">
              +{filteredRows.length - visibleRows.length} registro(s) adicional(es) en este estado.
            </div>
          ) : null}
        </>
      )}

      <div className="planillas-insight__actions">
        <button
          type="button"
          className="planillas-insight__primary"
          onClick={onApplyAll}
          disabled={
            activeFilter !== STATUS_FILTERS.pending ||
            loadingAction ||
            loading ||
            rowsByStatus[STATUS_FILTERS.pending].length === 0 ||
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
          onClick={() => onOpenDetail?.()}
          disabled={loading || !hasPlanillaSeleccionada}
        >
          <i className="bi bi-clock-history me-1" />
          Ver historial
        </button>
        <button type="button" className="planillas-insight__ghost" onClick={onDismiss}>
          <i className="bi bi-x-lg me-1" />
          Ignorar
        </button>
      </div>
    </section>
  );
}
