import { useMemo, useState } from 'react';

const STATUS_FILTERS = Object.freeze({
  all: 'all',
  pending: 'pending',
  applied: 'applied',
  removed: 'removed'
});

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) =>
  `L ${safeNumber(value, 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const formatDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeStatus = (row = {}) => {
  const estado = String(row?.estado ?? '').trim().toLowerCase();
  if (estado === 'pendiente') return STATUS_FILTERS.pending;
  if (estado === 'eliminado') return STATUS_FILTERS.removed;
  if (estado === 'aplicado') return STATUS_FILTERS.applied;
  return STATUS_FILTERS.all;
};

export default function PlanillaAdelantosHistorialModal({
  open,
  loading = false,
  rows = [],
  empleadoLabel = '',
  updatingId = null,
  deletingId = null,
  canEditar = false,
  canEliminar = false,
  hasPlanillaSeleccionada = false,
  onClose,
  onAplicarPendiente,
  onEditar,
  onEliminar
}) {
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.all);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editDraftsByRow, setEditDraftsByRow] = useState({});

  const rowsByStatus = useMemo(() => {
    const grouped = {
      [STATUS_FILTERS.all]: [...rows],
      [STATUS_FILTERS.pending]: [],
      [STATUS_FILTERS.applied]: [],
      [STATUS_FILTERS.removed]: []
    };

    rows.forEach((row) => {
      const status = normalizeStatus(row);
      if (status !== STATUS_FILTERS.all) grouped[status].push(row);
    });

    return grouped;
  }, [rows]);

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

  const summary = useMemo(() => {
    const totals = {
      pendientes: 0,
      aplicadas: 0,
      eliminadas: 0,
      montoPendiente: 0,
      montoAplicado: 0,
      montoEliminado: 0
    };

    rows.forEach((row) => {
      const status = normalizeStatus(row);
      const amount = safeNumber(row?.monto, 0);
      if (status === STATUS_FILTERS.pending) {
        totals.pendientes += 1;
        totals.montoPendiente += safeNumber(row?.saldo ?? amount, 0);
        return;
      }
      if (status === STATUS_FILTERS.removed) {
        totals.eliminadas += 1;
        totals.montoEliminado += amount;
        return;
      }
      if (status === STATUS_FILTERS.applied) {
        totals.aplicadas += 1;
        totals.montoAplicado += amount;
      }
    });

    return totals;
  }, [rows]);

  const activeFilter = rowsByStatus[statusFilter] ? statusFilter : STATUS_FILTERS.all;
  const filteredRows = useMemo(
    () => rowsByStatus[activeFilter] || rowsByStatus[STATUS_FILTERS.all],
    [rowsByStatus, activeFilter]
  );

  if (!open) return null;

  const handleClose = () => {
    setStatusFilter(STATUS_FILTERS.all);
    setEditingRowId(null);
    setEditDraftsByRow({});
    onClose?.();
  };

  const startEdit = (row) => {
    const rowId = row?.id;
    if (!rowId) return;
    setEditingRowId(rowId);
    setEditDraftsByRow((previous) => ({
      ...previous,
      [rowId]: {
        monto_aplicar: String(safeNumber(row?.monto, 0)),
        observacion: toText(row?.observacion, '')
      }
    }));
  };

  const cancelEdit = (rowId) => {
    setEditingRowId((current) => (String(current || '') === String(rowId || '') ? null : current));
    setEditDraftsByRow((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const submitEdit = async (row, rowId) => {
    const draft = editDraftsByRow[rowId] || {};
    const montoAplicar = safeNumber(draft?.monto_aplicar, Number.NaN);
    if (!Number.isFinite(montoAplicar) || montoAplicar <= 0) return;

    try {
      await onEditar?.(row, {
        monto_aplicar: montoAplicar,
        observacion: toText(draft?.observacion, '')
      });
      cancelEdit(rowId);
    } catch {
      // parent toast
    }
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="planillas-modal planillas-he-modal planillas-adelantos-modal" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-he-modal__head planillas-adelantos-modal__head">
          <div className="planillas-he-modal__title-wrap">
            <span className="planillas-he-modal__icon" aria-hidden="true">
              <i className="bi bi-wallet2" />
            </span>
            <div>
              <h5>Adelantos de salario</h5>
              <p>{empleadoLabel || 'Historial general de la planilla'}</p>
            </div>
          </div>
          <button type="button" className="planillas-he-modal__close" onClick={handleClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-he-modal__stats planillas-adelantos-modal__stats">
          <article className="planillas-he-modal__stat">
            <span>Pendientes</span>
            <strong className="is-warning">{money(summary.montoPendiente)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Aplicadas</span>
            <strong className="is-success">{money(summary.montoAplicado)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Eliminadas</span>
            <strong className="is-danger">{money(summary.montoEliminado)}</strong>
          </article>
        </div>

        <div className="planillas-he-modal__body">
          {!hasPlanillaSeleccionada ? (
            <div className="alert alert-warning py-2">
              Selecciona primero una planilla para consultar y gestionar adelantos.
            </div>
          ) : null}

          {loading ? (
            <div className="inv-catpro-loading" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando historial de adelantos...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="inv-catpro-empty">
              <div className="inv-catpro-empty-sub">No hay adelantos registrados para este contexto.</div>
            </div>
          ) : (
            <>
              <div className="planillas-he-modal__filters" role="group" aria-label="Filtrar adelantos por estado">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`planillas-he-modal__filter-chip ${activeFilter === option.key ? 'is-active' : ''}`}
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

              {filteredRows.length === 0 ? (
                <div className="inv-catpro-empty planillas-he-modal__empty-filter">
                  <div className="inv-catpro-empty-sub">No hay registros para el filtro seleccionado.</div>
                </div>
              ) : (
                <div className="planillas-he-modal__rows">
                  {filteredRows.map((row) => {
                    const rowId = row?.id;
                    const status = normalizeStatus(row);
                    const isPending = status === STATUS_FILTERS.pending;
                    const isApplied = status === STATUS_FILTERS.applied;
                    const isRemoved = status === STATUS_FILTERS.removed;
                    const isEditing = String(editingRowId || '') === String(rowId || '');
                    const isUpdating = String(updatingId || '') === String(row?.id_movimiento || '') && isApplied;
                    const isDeleting = String(deletingId || '') === String(row?.id_movimiento || '') && isApplied;
                    const isBusy = isUpdating || isDeleting;
                    const draft = editDraftsByRow[rowId] || {};
                    const montoDraft = safeNumber(draft?.monto_aplicar, Number.NaN);
                    const canSaveEdit = !isBusy && Number.isFinite(montoDraft) && montoDraft > 0 && row?.id_adelanto;
                    const canEditRow = Boolean(row?.editable && canEditar);
                    const hasReusableSource = Boolean(row?.id_adelanto);

                    return (
                      <article
                        key={rowId}
                        className={`planillas-he-modal__row planillas-adelantos-modal__row ${
                          isRemoved ? 'is-removed' : isApplied ? 'is-compensated is-applied' : 'is-pending'
                        }`}
                      >
                        <div className="planillas-he-modal__row-top">
                          <div className="planillas-he-modal__row-meta">
                            <div className="planillas-he-modal__employee">
                              <i className="bi bi-person-badge" />
                              <span>{toText(row?.empleado_nombre, 'Empleado')}</span>
                            </div>
                            <strong className="planillas-he-modal__date">Fecha: {formatDate(row?.fecha)}</strong>
                            <p>
                              {isPending ? 'Saldo pendiente' : 'Monto registrado'}: <strong>{money(row?.monto)}</strong>
                              {isPending ? ` - Disponible ${money(row?.saldo || row?.monto)}` : ''}
                            </p>
                          </div>

                          {isPending ? (
                            <div className="planillas-he-modal__row-actions">
                              <button
                                type="button"
                                className="btn planillas-he-modal__btn-compensar"
                                disabled={!hasPlanillaSeleccionada}
                                onClick={() => onAplicarPendiente?.(row)}
                              >
                                Aplicar
                              </button>
                            </div>
                          ) : isApplied ? (
                            <div className="planillas-he-modal__row-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn planillas-he-modal__btn-save"
                                    disabled={!canSaveEdit}
                                    onClick={() => submitEdit(row, rowId)}
                                  >
                                    {isUpdating ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn planillas-he-modal__btn-cancel"
                                    disabled={isBusy}
                                    onClick={() => cancelEdit(rowId)}
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  {canEditar ? (
                                    <button
                                      type="button"
                                      className="btn planillas-he-modal__btn-edit"
                                      disabled={!canEditRow || isBusy}
                                      title={
                                        hasReusableSource
                                          ? ''
                                          : 'No se puede editar porque este movimiento no conserva id_adelanto de origen.'
                                      }
                                      onClick={() => startEdit(row)}
                                    >
                                      Editar
                                    </button>
                                  ) : null}
                                  {canEliminar ? (
                                    <button
                                      type="button"
                                      className="btn planillas-he-modal__btn-delete"
                                      disabled={isBusy}
                                      onClick={() => onEliminar?.(row)}
                                    >
                                      {isDeleting ? 'Eliminando...' : 'Eliminar'}
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="planillas-he-modal__badge is-removed">
                              <i className="bi bi-trash3-fill me-1" />
                              Eliminada
                            </span>
                          )}
                        </div>

                        {isApplied ? (
                          isEditing ? (
                            <>
                              <div className="planillas-he-modal__edit-grid planillas-adelantos-modal__edit-grid">
                                <div>
                                  <label htmlFor={`ad-edit-monto-${rowId}`}>Monto a aplicar</label>
                                  <input
                                    id={`ad-edit-monto-${rowId}`}
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    className="form-control"
                                    value={draft?.monto_aplicar ?? ''}
                                    onChange={(event) =>
                                      setEditDraftsByRow((previous) => ({
                                        ...previous,
                                        [rowId]: {
                                          ...previous[rowId],
                                          monto_aplicar: event.target.value
                                        }
                                      }))
                                    }
                                    disabled={isBusy}
                                  />
                                </div>
                              </div>
                              <div className="planillas-he-modal__note planillas-he-modal__edit-note">
                                <label htmlFor={`ad-edit-note-${rowId}`}>Observacion (opcional)</label>
                                <textarea
                                  id={`ad-edit-note-${rowId}`}
                                  rows={2}
                                  maxLength={255}
                                  placeholder="Motivo del ajuste..."
                                  value={draft?.observacion || ''}
                                  onChange={(event) =>
                                    setEditDraftsByRow((previous) => ({
                                      ...previous,
                                      [rowId]: {
                                        ...previous[rowId],
                                        observacion: event.target.value
                                      }
                                    }))
                                  }
                                  disabled={isBusy}
                                />
                              </div>
                              {!hasReusableSource ? (
                                <small className="planillas-adelantos-modal__hint">
                                  Este movimiento no conserva referencia al adelanto original, por eso no puede
                                  editarse.
                                </small>
                              ) : null}
                            </>
                          ) : (
                            <div className="planillas-he-modal__note is-readonly">
                              <div>
                                <i className="bi bi-calendar-check me-1" />
                                Aplicado el {formatDate(row?.fecha)}
                              </div>
                              <small>{toText(row?.observacion, 'Aplicado sin observacion adicional.')}</small>
                              {!hasReusableSource ? (
                                <small className="planillas-adelantos-modal__hint">
                                  Edicion deshabilitada: este movimiento no tiene id_adelanto reutilizable.
                                </small>
                              ) : null}
                            </div>
                          )
                        ) : (
                          <div className={`planillas-he-modal__note is-readonly ${isRemoved ? 'is-removed' : ''}`}>
                            <div>
                              <i className={`bi ${isRemoved ? 'bi-trash3 me-1' : 'bi-hourglass-split me-1'}`} />
                              {isRemoved
                                ? `Eliminada el ${formatDate(row?.fecha)}`
                                : `Pendiente desde ${formatDate(row?.fecha)}`}
                            </div>
                            <small>
                              {toText(
                                row?.observacion,
                                isRemoved
                                  ? 'Registro eliminado del calculo de planilla.'
                                  : 'Disponible para aplicar en esta planilla.'
                              )}
                            </small>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="planillas-he-modal__foot">
          <span>
            <i className="bi bi-info-circle me-1" />
            La eliminacion se gestiona como anulacion operativa para conservar trazabilidad.
          </span>
          <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

