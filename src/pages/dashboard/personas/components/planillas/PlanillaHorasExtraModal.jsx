import { useEffect, useMemo, useState } from 'react';

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
  registering = false,
  canRegister = false,
  empleados = [],
  defaultEmpleadoId = '',
  onClose,
  onCompensar,
  onRegister
}) {
  const [notesByRow, setNotesByRow] = useState({});
  const [form, setForm] = useState({
    id_empleado: '',
    fecha: toDateInputValue(),
    horas: '',
    observacion: ''
  });

  useEffect(() => {
    if (!open) return;
    setNotesByRow({});
    setForm({
      id_empleado: defaultEmpleadoId ? String(defaultEmpleadoId) : '',
      fecha: toDateInputValue(),
      horas: '',
      observacion: ''
    });
  }, [defaultEmpleadoId, open, empleadoLabel]);

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

  if (!open) return null;

  const horasValue = Number(form.horas);
  const canSubmitRegister =
    canRegister &&
    Number.isFinite(horasValue) &&
    horasValue > 0 &&
    horasValue <= 24 &&
    String(form.id_empleado || '').trim() !== '';

  const handleRegister = (event) => {
    event.preventDefault();
    if (!canSubmitRegister) return;

    onRegister?.({
      id_empleado: Number(form.id_empleado),
      fecha: form.fecha || null,
      horas: horasValue,
      observacion: String(form.observacion || '').trim() || null
    });
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
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
          <button type="button" className="planillas-he-modal__close" onClick={onClose} aria-label="Cerrar">
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
          {canRegister ? (
            <form className="planillas-he-modal__register" onSubmit={handleRegister}>
              <div className="planillas-he-modal__register-grid">
                <div>
                  <label className="form-label">Empleado</label>
                  <select
                    className="form-select"
                    value={form.id_empleado}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        id_empleado: event.target.value
                      }))
                    }
                    disabled={registering || empleados.length === 0}
                  >
                    <option value="">Seleccionar empleado</option>
                    {empleados.map((empleado) => (
                      <option key={empleado.value} value={empleado.value}>
                        {empleado.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.fecha}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        fecha: event.target.value
                      }))
                    }
                    disabled={registering}
                  />
                </div>

                <div>
                  <label className="form-label">Horas</label>
                  <input
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    className="form-control"
                    placeholder="0.00"
                    value={form.horas}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        horas: event.target.value
                      }))
                    }
                    disabled={registering}
                  />
                </div>
              </div>

              <div className="planillas-he-modal__register-note">
                <label className="form-label">Observacion (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={255}
                  placeholder="Detalle de las horas extra..."
                  value={form.observacion}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      observacion: event.target.value
                    }))
                  }
                  disabled={registering}
                />
              </div>

              <div className="planillas-he-modal__register-actions">
                <button type="submit" className="btn btn-primary" disabled={registering || !canSubmitRegister}>
                  {registering ? 'Registrando...' : 'Registrar horas extra'}
                </button>
              </div>
            </form>
          ) : null}

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
            <div className="planillas-he-modal__rows">
              {rows.map((row) => {
                const rowId = row.id_horas_extras || row.id_horas_extra || row.id_hora_extra;
                const note = notesByRow[rowId] || '';
                const isCompensated = Boolean(row.compensada);
                const isBusy = String(compensatingId || '') === String(rowId || '');
                return (
                  <article
                    key={rowId}
                    className={`planillas-he-modal__row ${isCompensated ? 'is-compensated' : 'is-pending'}`}
                  >
                    <div className="planillas-he-modal__row-top">
                      <div>
                        <strong>Fecha: {formatDate(row.fecha)}</strong>
                        <p>{formatHours(row.horas)} extra</p>
                      </div>

                      {isCompensated ? (
                        <span className="planillas-he-modal__badge is-compensated">
                          <i className="bi bi-check-circle-fill me-1" />
                          Compensada
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn planillas-he-modal__btn-compensar"
                          disabled={isBusy}
                          onClick={() => onCompensar?.(row, note)}
                        >
                          {isBusy ? 'Compensando...' : 'Compensar'}
                        </button>
                      )}
                    </div>

                    {isCompensated ? (
                      <div className="planillas-he-modal__note is-readonly">
                        <div>
                          <i className="bi bi-calendar-check me-1" />
                          Compensado el {formatDate(row.fecha_compensacion)}
                        </div>
                        <small>{String(row.observacion || 'Sin observacion').trim()}</small>
                      </div>
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
        </div>

        <div className="planillas-he-modal__foot">
          <span>
            <i className="bi bi-lightbulb me-1" />
            Las horas extra se compensan con tiempo libre, no con dinero.
          </span>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
