import { useMemo, useState } from 'react';

const TYPE_FILTERS = Object.freeze({
  all: 'all',
  bono: 'bono',
  deduccion: 'deduccion'
});

const STATUS_FILTERS = Object.freeze({
  all: 'all',
  vigente: 'vigente',
  anulada: 'anulada'
});

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) =>
  `L ${safeNumber(value, 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const formatDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeType = (row = {}) => (toText(row?.tipo, '').toLowerCase().includes('bono') ? 'bono' : 'deduccion');
const normalizeStatus = (row = {}) =>
  toText(row?.estado, '').toLowerCase().includes('anulad') ? STATUS_FILTERS.anulada : STATUS_FILTERS.vigente;

export default function PlanillaBonosDeduccionesHistorialModal({
  open,
  loading = false,
  rows = [],
  loadingAction = false,
  anulandoId = null,
  canAnular = false,
  onClose,
  onAnular
}) {
  const [typeFilter, setTypeFilter] = useState(TYPE_FILTERS.all);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.all);

  const normalizedRows = useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((row) => ({
        ...row,
        tipo: normalizeType(row),
        estado: normalizeStatus(row)
      })),
    [rows]
  );

  const stats = useMemo(() => {
    return normalizedRows.reduce(
      (acc, row) => {
        const monto = Math.max(0, safeNumber(row?.monto, 0));
        if (row.estado === STATUS_FILTERS.anulada) {
          acc.montoAnulado += monto;
          return acc;
        }

        if (row.tipo === TYPE_FILTERS.bono) {
          acc.bonosVigentes += monto;
        } else {
          acc.deduccionesVigentes += monto;
        }
        return acc;
      },
      {
        bonosVigentes: 0,
        deduccionesVigentes: 0,
        montoAnulado: 0
      }
    );
  }, [normalizedRows]);

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((row) => {
      const byType = typeFilter === TYPE_FILTERS.all || row.tipo === typeFilter;
      const byStatus = statusFilter === STATUS_FILTERS.all || row.estado === statusFilter;
      return byType && byStatus;
    });
  }, [normalizedRows, statusFilter, typeFilter]);

  const typeCounts = useMemo(
    () => ({
      all: normalizedRows.length,
      bono: normalizedRows.filter((row) => row.tipo === TYPE_FILTERS.bono).length,
      deduccion: normalizedRows.filter((row) => row.tipo === TYPE_FILTERS.deduccion).length
    }),
    [normalizedRows]
  );

  const statusCounts = useMemo(
    () => ({
      all: normalizedRows.length,
      vigente: normalizedRows.filter((row) => row.estado === STATUS_FILTERS.vigente).length,
      anulada: normalizedRows.filter((row) => row.estado === STATUS_FILTERS.anulada).length
    }),
    [normalizedRows]
  );

  if (!open) return null;

  const impactoNeto = stats.bonosVigentes - stats.deduccionesVigentes;

  const handleClose = () => {
    setTypeFilter(TYPE_FILTERS.all);
    setStatusFilter(STATUS_FILTERS.all);
    onClose?.();
  };

  const renderFilterChip = ({ key, label, icon, count, active, onClick, dataFilter }) => (
    <button
      key={key}
      type="button"
      className={`planillas-he-modal__filter-chip ${active ? 'is-active' : ''}`}
      data-filter={dataFilter}
      onClick={onClick}
      aria-pressed={active}
    >
      <i className={`bi ${icon}`} />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="planillas-modal planillas-he-modal planillas-bd-modal" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-he-modal__head planillas-bd-modal__head">
          <div className="planillas-he-modal__title-wrap">
            <span className="planillas-he-modal__icon" aria-hidden="true">
              <i className="bi bi-receipt" />
            </span>
            <div>
              <h5>Bonos y deducciones</h5>
              <p>Historial general de movimientos de la planilla</p>
            </div>
          </div>
          <button type="button" className="planillas-he-modal__close" onClick={handleClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-he-modal__stats planillas-bd-modal__stats">
          <article className="planillas-he-modal__stat">
            <span>Bonos vigentes</span>
            <strong className="is-success">{money(stats.bonosVigentes)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Deducciones vigentes</span>
            <strong className="is-warning">{money(stats.deduccionesVigentes)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Impacto neto</span>
            <strong className={impactoNeto >= 0 ? 'is-success' : 'is-danger'}>{money(impactoNeto)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Monto anulado</span>
            <strong className="is-danger">{money(stats.montoAnulado)}</strong>
          </article>
        </div>

        <div className="planillas-he-modal__body">
          {loading ? (
            <div className="inv-catpro-loading" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando movimientos...</span>
            </div>
          ) : normalizedRows.length === 0 ? (
            <div className="inv-catpro-empty">
              <div className="inv-catpro-empty-sub">No hay movimientos de bonos o deducciones para este contexto.</div>
            </div>
          ) : (
            <>
              <div className="planillas-bd-modal__filters-group">
                <section className="planillas-bd-modal__filter-section">
                  <p className="planillas-bd-modal__filter-label">Tipo de movimiento</p>
                  <div className="planillas-he-modal__filters" role="group" aria-label="Filtrar por tipo">
                    {renderFilterChip({
                      key: 'type-all',
                      label: 'Todas',
                      icon: 'bi-list-ul',
                      count: typeCounts.all,
                      active: typeFilter === TYPE_FILTERS.all,
                      onClick: () => setTypeFilter(TYPE_FILTERS.all),
                      dataFilter: 'all'
                    })}
                    {renderFilterChip({
                      key: 'type-bono',
                      label: 'Bonos',
                      icon: 'bi-plus-circle',
                      count: typeCounts.bono,
                      active: typeFilter === TYPE_FILTERS.bono,
                      onClick: () => setTypeFilter(TYPE_FILTERS.bono),
                      dataFilter: 'applied'
                    })}
                    {renderFilterChip({
                      key: 'type-deduccion',
                      label: 'Deducciones',
                      icon: 'bi-dash-circle',
                      count: typeCounts.deduccion,
                      active: typeFilter === TYPE_FILTERS.deduccion,
                      onClick: () => setTypeFilter(TYPE_FILTERS.deduccion),
                      dataFilter: 'pending'
                    })}
                  </div>
                </section>

                <section className="planillas-bd-modal__filter-section">
                  <p className="planillas-bd-modal__filter-label">Estado del movimiento</p>
                  <div className="planillas-he-modal__filters" role="group" aria-label="Filtrar por estado">
                    {renderFilterChip({
                      key: 'status-all',
                      label: 'Todos',
                      icon: 'bi-funnel',
                      count: statusCounts.all,
                      active: statusFilter === STATUS_FILTERS.all,
                      onClick: () => setStatusFilter(STATUS_FILTERS.all),
                      dataFilter: 'all'
                    })}
                    {renderFilterChip({
                      key: 'status-vigente',
                      label: 'Vigentes',
                      icon: 'bi-check-circle',
                      count: statusCounts.vigente,
                      active: statusFilter === STATUS_FILTERS.vigente,
                      onClick: () => setStatusFilter(STATUS_FILTERS.vigente),
                      dataFilter: 'applied'
                    })}
                    {renderFilterChip({
                      key: 'status-anulada',
                      label: 'Anuladas',
                      icon: 'bi-trash3',
                      count: statusCounts.anulada,
                      active: statusFilter === STATUS_FILTERS.anulada,
                      onClick: () => setStatusFilter(STATUS_FILTERS.anulada),
                      dataFilter: 'removed'
                    })}
                  </div>
                </section>
              </div>

              {filteredRows.length === 0 ? (
                <div className="inv-catpro-empty planillas-he-modal__empty-filter">
                  <div className="inv-catpro-empty-sub">No hay registros para el filtro seleccionado.</div>
                </div>
              ) : (
                <div className="planillas-he-modal__rows">
                  {filteredRows.map((row, index) => {
                    const rowId = row?.id || row?.id_movimiento || `mov-bd-${index}`;
                    const isAnulada = row.estado === STATUS_FILTERS.anulada;
                    const isBono = row.tipo === TYPE_FILTERS.bono;
                    const isAnulando =
                      String(anulandoId || '') !== '' && String(anulandoId || '') === String(rowId || '');

                    return (
                      <article
                        key={rowId}
                        className={`planillas-he-modal__row planillas-bd-modal__row ${
                          isAnulada ? 'is-removed' : isBono ? 'is-compensated' : 'is-pending'
                        }`}
                      >
                        <div className="planillas-he-modal__row-top">
                          <div className="planillas-he-modal__row-meta">
                            <div className="planillas-he-modal__employee">
                              <i className="bi bi-person-badge" />
                              <span>{toText(row?.empleado_nombre, 'Empleado')}</span>
                            </div>
                            <strong className="planillas-he-modal__date">Fecha: {formatDate(row?.fecha)}</strong>
                            <p className="planillas-bd-modal__concept-line">
                              {toText(row?.concepto, 'Sin concepto')} - <strong>{money(row?.monto)}</strong>
                            </p>
                          </div>

                          <div className="planillas-he-modal__row-actions">
                            <span
                              className={`planillas-he-modal__badge planillas-bd-modal__type-badge ${
                                isBono ? 'is-compensated' : 'is-removed'
                              }`}
                            >
                              <i className={`bi ${isBono ? 'bi-plus-circle' : 'bi-dash-circle'} me-1`} />
                              {isBono ? 'Bono' : 'Deduccion'}
                            </span>
                            {isAnulada ? (
                              <span className="planillas-he-modal__badge planillas-bd-modal__status-badge is-removed">
                                <i className="bi bi-trash3-fill me-1" />
                                Movimiento anulado
                              </span>
                            ) : canAnular ? (
                              <button
                                type="button"
                                className="btn planillas-he-modal__btn-delete"
                                disabled={loadingAction || isAnulando}
                                onClick={() => onAnular?.(row)}
                              >
                                {isAnulando ? 'Anulando...' : 'Anular'}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className={`planillas-he-modal__note is-readonly ${isAnulada ? 'is-removed' : ''}`}>
                          <label>Observacion</label>
                          <div>{toText(row?.observacion, isAnulada ? 'Movimiento anulado.' : 'Sin observaciones.')}</div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

