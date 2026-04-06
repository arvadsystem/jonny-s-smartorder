import { useMemo, useState } from 'react';

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatHours = (value) => `${safeNumber(value, 0).toLocaleString('es-HN')}h`;

const formatDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: '2-digit' });
};

const toText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeStatusNote = (value = '') => String(value ?? '').trim().toLowerCase();

const isRemovedHoraExtraRow = (row = {}) => {
  const note = normalizeStatusNote(row?.observacion);
  if (!note) return false;
  return (
    note.includes('[eliminada_he]') ||
    note.includes('eliminar la hora extra') ||
    note.includes('hora extra eliminada') ||
    note.includes('registro eliminado')
  );
};

const stripStatusMarkers = (value = '') =>
  String(value ?? '')
    .replace(/\[(eliminada_he|corregida_he)\]\s*/gi, '')
    .trim();

const STATUS_FILTERS = Object.freeze({
  all: 'all',
  pending: 'pending',
  compensated: 'compensated',
  removed: 'removed'
});

const resolveEmpleadoLabel = (row = {}, fallbackLabel = '') => {
  const directName = toText(
    row?.nombre_completo ||
      row?.empleado_nombre ||
      row?.nombre_empleado ||
      row?.nombre ||
      row?.empleado ||
      row?.nombre_persona,
    ''
  );
  if (directName) return directName;

  const parts = [toText(row?.nombres), toText(row?.apellidos)].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');

  const fallback = toText(fallbackLabel, '');
  if (fallback && !/vista general/i.test(fallback)) return fallback;

  const idEmpleado = toText(row?.id_empleado, '');
  return idEmpleado ? `Empleado #${idEmpleado}` : '';
};

const toDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function PlanillaHorasExtraModal({
  open,
  loading = false,
  rows = [],
  resumen = {},
  empleadoLabel = '',
  compensatingId = null,
  updatingId = null,
  deletingId = null,
  canEditar = false,
  canEliminar = false,
  onClose,
  onCompensar,
  onActualizar,
  onEliminar
}) {
  const [notesByRow, setNotesByRow] = useState({});
  const [editingRowId, setEditingRowId] = useState(null);
  const [editDraftsByRow, setEditDraftsByRow] = useState({});
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.all);

  const summary = useMemo(() => {
    const totalHoras = safeNumber(resumen.total_horas, null);
    const compensadasHoras = safeNumber(resumen.compensadas_horas, null);
    const pendientesHoras = safeNumber(resumen.pendientes_horas, null);

    if (totalHoras !== null && compensadasHoras !== null && pendientesHoras !== null) {
      return {
        total_horas: totalHoras,
        compensadas_horas: compensadasHoras,
        pendientes_horas: pendientesHoras
      };
    }

    return rows.reduce(
      (acc, row) => {
        const horas = safeNumber(row.horas, 0);
        acc.total_horas += horas;
        if (row.compensada) acc.compensadas_horas += horas;
        else acc.pendientes_horas += horas;
        return acc;
      },
      { total_horas: 0, compensadas_horas: 0, pendientes_horas: 0 }
    );
  }, [resumen, rows]);

  const rowsByStatus = useMemo(() => {
    const grouped = {
      [STATUS_FILTERS.all]: [...rows],
      [STATUS_FILTERS.pending]: [],
      [STATUS_FILTERS.compensated]: [],
      [STATUS_FILTERS.removed]: []
    };

    rows.forEach((row) => {
      const isCompensated = Boolean(row?.compensada);
      const isRemoved = isCompensated && isRemovedHoraExtraRow(row);
      if (!isCompensated) {
        grouped[STATUS_FILTERS.pending].push(row);
        return;
      }
      if (isRemoved) {
        grouped[STATUS_FILTERS.removed].push(row);
        return;
      }
      grouped[STATUS_FILTERS.compensated].push(row);
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
        key: STATUS_FILTERS.compensated,
        label: 'Compensadas',
        icon: 'bi-check-circle',
        count: rowsByStatus[STATUS_FILTERS.compensated].length
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

  const filteredRows = useMemo(
    () => rowsByStatus[activeFilter] || rowsByStatus[STATUS_FILTERS.all],
    [rowsByStatus, activeFilter]
  );

  if (!open) return null;

  const handleClose = () => {
    setStatusFilter(STATUS_FILTERS.all);
    onClose?.();
  };

  const startEditRow = (row) => {
    const rowId = row?.id_horas_extras || row?.id_horas_extra || row?.id_hora_extra;
    if (!rowId) return;
    setEditingRowId(rowId);
    setEditDraftsByRow((previous) => ({
      ...previous,
      [rowId]: {
        fecha: toDateInputValue(row?.fecha),
        horas: String(safeNumber(row?.horas, 0)),
        observacion: String(row?.observacion || '').trim()
      }
    }));
  };

  const cancelEditRow = (rowId) => {
    setEditingRowId((current) => (String(current || '') === String(rowId || '') ? null : current));
    setEditDraftsByRow((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const submitEditRow = async (row, rowId) => {
    const draft = editDraftsByRow[rowId] || {};
    const horas = Number(draft?.horas);
    const payload = {
      fecha: draft?.fecha || null,
      horas,
      observacion: String(draft?.observacion || '').trim() || null
    };
    if (!payload.fecha || !Number.isFinite(horas) || horas <= 0 || horas > 24) return;

    try {
      await onActualizar?.(row, payload);
      cancelEditRow(rowId);
    } catch {
      // toast handled in parent
    }
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="planillas-modal planillas-he-modal" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-he-modal__head">
          <div className="planillas-he-modal__title-wrap">
            <span className="planillas-he-modal__icon" aria-hidden="true">
              <i className="bi bi-clock-history" />
            </span>
            <div>
              <h5>Horas Extra - Tiempo x Tiempo</h5>
              <p>{empleadoLabel || 'Vista general de la planilla'}</p>
            </div>
          </div>
          <button type="button" className="planillas-he-modal__close" onClick={handleClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-he-modal__stats">
          <article className="planillas-he-modal__stat">
            <span>Total Horas</span>
            <strong>{formatHours(summary.total_horas)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Compensadas</span>
            <strong className="is-success">{formatHours(summary.compensadas_horas)}</strong>
          </article>
          <article className="planillas-he-modal__stat">
            <span>Pendientes</span>
            <strong className="is-warning">{formatHours(summary.pendientes_horas)}</strong>
          </article>
        </div>

        <div className="planillas-he-modal__body">
          {loading ? (
            <div className="inv-catpro-loading" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando horas extra...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="inv-catpro-empty">
              <div className="inv-catpro-empty-sub">No hay horas extra registradas para este contexto.</div>
            </div>
          ) : (
            <>
              <div className="planillas-he-modal__filters" role="group" aria-label="Filtrar horas extra por estado">
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
                const rowId = row.id_horas_extras || row.id_horas_extra || row.id_hora_extra;
                const note = notesByRow[rowId] || '';
                const editDraft = editDraftsByRow[rowId] || {};
                const empleadoName = resolveEmpleadoLabel(row, empleadoLabel);
                const isCompensated = Boolean(row.compensada);
                const isRemoved = isCompensated && isRemovedHoraExtraRow(row);
                const isEditing = String(editingRowId || '') === String(rowId || '');
                const isCompensating = String(compensatingId || '') === String(rowId || '');
                const isUpdating = String(updatingId || '') === String(rowId || '');
                const isDeleting = String(deletingId || '') === String(rowId || '');
                const isBusy = isCompensating || isUpdating || isDeleting;
                const rowNote = stripStatusMarkers(String(row.observacion || '').trim());
                const horasDraftValue = Number(editDraft?.horas);
                const canSaveEdit =
                  !isBusy &&
                  Boolean(editDraft?.fecha) &&
                  Number.isFinite(horasDraftValue) &&
                  horasDraftValue > 0 &&
                  horasDraftValue <= 24;
                return (
                  <article
                    key={rowId}
                    className={`planillas-he-modal__row ${
                      isRemoved ? 'is-removed' : isCompensated ? 'is-compensated' : 'is-pending'
                    }`}
                  >
                    <div className="planillas-he-modal__row-top">
                      <div className="planillas-he-modal__row-meta">
                        {empleadoName ? (
                          <div className="planillas-he-modal__employee">
                            <i className="bi bi-person-badge" />
                            <span>{empleadoName}</span>
                          </div>
                        ) : null}
                        <strong className="planillas-he-modal__date">
                          Fecha: {isEditing ? formatDate(editDraft?.fecha || row.fecha) : formatDate(row.fecha)}
                        </strong>
                        <p>{isEditing ? `${safeNumber(editDraft?.horas, 0)}h` : formatHours(row.horas)} extra</p>
                      </div>

                      {isCompensated ? (
                        <span className={`planillas-he-modal__badge ${isRemoved ? 'is-removed' : 'is-compensated'}`}>
                          <i className={`bi ${isRemoved ? 'bi-trash3-fill' : 'bi-check-circle-fill'} me-1`} />
                          {isRemoved ? 'Eliminada' : 'Compensada'}
                        </span>
                      ) : (
                        <div className="planillas-he-modal__row-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn planillas-he-modal__btn-save"
                                disabled={!canSaveEdit}
                                onClick={() => submitEditRow(row, rowId)}
                              >
                                {isUpdating ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                className="btn planillas-he-modal__btn-cancel"
                                disabled={isBusy}
                                onClick={() => cancelEditRow(rowId)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn planillas-he-modal__btn-compensar"
                                disabled={isBusy}
                                onClick={() => onCompensar?.(row, note)}
                              >
                                {isCompensating ? 'Compensando...' : 'Compensar'}
                              </button>
                              {canEditar ? (
                                <button
                                  type="button"
                                  className="btn planillas-he-modal__btn-edit"
                                  disabled={isBusy}
                                  onClick={() => startEditRow(row)}
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
                      )}
                    </div>

                    {isCompensated ? (
                      <div className={`planillas-he-modal__note is-readonly ${isRemoved ? 'is-removed' : ''}`}>
                        <div>
                          <i className={`bi ${isRemoved ? 'bi-trash3 me-1' : 'bi-calendar-check me-1'}`} />
                          {isRemoved ? 'Eliminada el' : 'Compensado el'} {formatDate(row.fecha_compensacion)}
                        </div>
                        <small>{rowNote || 'Sin observacion'}</small>
                      </div>
                    ) : isEditing ? (
                      <>
                        <div className="planillas-he-modal__edit-grid">
                          <div>
                            <label htmlFor={`he-edit-date-${rowId}`}>Fecha</label>
                            <input
                              id={`he-edit-date-${rowId}`}
                              type="date"
                              className="form-control"
                              value={editDraft?.fecha || ''}
                              onChange={(event) =>
                                setEditDraftsByRow((previous) => ({
                                  ...previous,
                                  [rowId]: {
                                    ...previous[rowId],
                                    fecha: event.target.value
                                  }
                                }))
                              }
                              disabled={isBusy}
                            />
                          </div>
                          <div>
                            <label htmlFor={`he-edit-hours-${rowId}`}>Horas</label>
                            <input
                              id={`he-edit-hours-${rowId}`}
                              type="number"
                              min="0.25"
                              max="24"
                              step="0.25"
                              className="form-control"
                              value={editDraft?.horas ?? ''}
                              onChange={(event) =>
                                setEditDraftsByRow((previous) => ({
                                  ...previous,
                                  [rowId]: {
                                    ...previous[rowId],
                                    horas: event.target.value
                                  }
                                }))
                              }
                              disabled={isBusy}
                            />
                          </div>
                        </div>
                        <div className="planillas-he-modal__note planillas-he-modal__edit-note">
                          <label htmlFor={`he-edit-note-${rowId}`}>Observacion (opcional)</label>
                          <textarea
                            id={`he-edit-note-${rowId}`}
                            rows={2}
                            maxLength={255}
                            placeholder="Detalle de la correccion..."
                            value={editDraft?.observacion || ''}
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
                      </>
                    ) : (
                      <div className="planillas-he-modal__note">
                        <label htmlFor={`he-note-${rowId}`}>Observacion (opcional)</label>
                        <textarea
                          id={`he-note-${rowId}`}
                          rows={2}
                          maxLength={255}
                          placeholder="Tiempo libre otorgado..."
                          value={note}
                          onChange={(event) =>
                            setNotesByRow((previous) => ({
                              ...previous,
                              [rowId]: event.target.value
                            }))
                          }
                        />
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
            <i className="bi bi-lightbulb me-1" />
            Las horas extra se compensan con tiempo libre, no con dinero.
          </span>
          <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
