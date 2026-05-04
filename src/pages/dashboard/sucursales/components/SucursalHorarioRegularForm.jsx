import { DIAS_SEMANA, isEndTimeAfterStart } from '../utils/sucursalHelpers';

export default function SucursalHorarioRegularForm({ horarios = [], loading = false, saving = false, onChange, onSave }) {
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Horario semanal</h5>
          <button type="button" className="btn inv-prod-btn-primary" onClick={onSave} disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Guardar horarios'}
          </button>
        </div>

        {loading ? <div className="text-muted">Cargando horarios...</div> : (
          <div className="table-responsive">
            <table className="table align-middle suc-horarios-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Cerrado</th>
                  <th>Hora inicio</th>
                  <th>Hora final</th>
                  <th>Estado activo</th>
                </tr>
              </thead>
              <tbody>
                {horarios.map((row) => {
                  const dayLabel = DIAS_SEMANA.find((d) => d.value === row.dia_semana)?.label || row.dia_semana;
                  const invalidOpen = !row.cerrado && row.hora_inicio && row.hora_final && !isEndTimeAfterStart(row.hora_inicio, row.hora_final);
                  return (
                    <tr key={row.dia_semana}>
                      <td>{dayLabel}</td>
                      <td><input type="checkbox" checked={Boolean(row.cerrado)} onChange={(e) => onChange(row.dia_semana, 'cerrado', e.target.checked)} /></td>
                      <td><input className="form-control" type="time" value={row.hora_inicio || ''} disabled={row.cerrado} onChange={(e) => onChange(row.dia_semana, 'hora_inicio', e.target.value)} /></td>
                      <td>
                        <input className={`form-control ${invalidOpen ? 'is-invalid' : ''}`} type="time" value={row.hora_final || ''} disabled={row.cerrado} onChange={(e) => onChange(row.dia_semana, 'hora_final', e.target.value)} />
                      </td>
                      <td><input type="checkbox" checked={Boolean(row.estado)} onChange={(e) => onChange(row.dia_semana, 'estado', e.target.checked)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
