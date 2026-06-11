import { DIAS_SEMANA, isEndTimeAfterStart } from '../utils/sucursalHelpers';

export default function SucursalHorarioRegularForm({
  horarios = [],
  loading = false,
  saving = false,
  sucursalNombre = '',
  onChange,
  onSave
}) {
  return (
    <div className="card border-0 shadow-sm mb-3 suc-horarios-week-card">
      <div className="card-body">
        <div className="suc-horarios-section-head">
          <div>
            <h5 className="mb-0">Horario semanal</h5>
            {sucursalNombre ? <span>{sucursalNombre}</span> : null}
          </div>
          <button type="button" className="btn inv-prod-btn-primary" onClick={onSave} disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Guardar horarios'}
          </button>
        </div>

        {loading ? <div className="suc-horarios-loading">Cargando horarios...</div> : (
          <div className="suc-horarios-week-grid">
            {horarios.map((row) => {
              const dayLabel = DIAS_SEMANA.find((d) => d.value === row.dia_semana)?.label || row.dia_semana;
              const isClosed = Boolean(row.cerrado);
              const invalidOpen = !isClosed && row.hora_inicio && row.hora_final && !isEndTimeAfterStart(row.hora_inicio, row.hora_final);
              return (
                <article key={row.dia_semana} className={`suc-horario-day-card ${isClosed ? 'is-closed' : 'is-open'} ${row.estado ? '' : 'is-inactive'}`}>
                  <header className="suc-horario-day-card__head">
                    <strong>{dayLabel}</strong>
                    <span className={`suc-horario-day-card__status ${isClosed ? 'is-closed' : 'is-open'}`}>
                      <i className="bi bi-circle-fill" />
                      {isClosed ? 'Cerrado' : 'Abierto'}
                    </span>
                  </header>

                  <label className="suc-horario-check">
                    <input
                      type="checkbox"
                      checked={isClosed}
                      onChange={(e) => onChange(row.dia_semana, 'cerrado', e.target.checked)}
                    />
                    <span>Cerrado</span>
                  </label>

                  <div className="suc-horario-time-grid">
                    <label>
                      <span>Hora inicio</span>
                      <input
                        className="form-control"
                        type="time"
                        value={row.hora_inicio || ''}
                        disabled={isClosed}
                        onChange={(e) => onChange(row.dia_semana, 'hora_inicio', e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Hora final</span>
                      <input
                        className={`form-control ${invalidOpen ? 'is-invalid' : ''}`}
                        type="time"
                        value={row.hora_final || ''}
                        disabled={isClosed}
                        onChange={(e) => onChange(row.dia_semana, 'hora_final', e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="suc-horario-check">
                    <input
                      type="checkbox"
                      checked={Boolean(row.estado)}
                      onChange={(e) => onChange(row.dia_semana, 'estado', e.target.checked)}
                    />
                    <span>Estado activo</span>
                  </label>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
