const formatHorario = (row) => {
  if (row?.cerrado) return 'Cerrado';
  const inicio = row?.hora_inicio ? String(row.hora_inicio).slice(0, 5) : '--:--';
  const fin = row?.hora_final ? String(row.hora_final).slice(0, 5) : '--:--';
  return `${inicio} - ${fin}`;
};

export default function SucursalFechasEspecialesTable({
  rows = [],
  loading = false,
  saving = false,
  onEdit,
  onDeactivate,
  onCreate
}) {
  if (loading) return <div className="suc-horarios-loading">Cargando fechas especiales...</div>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="suc-fechas-empty">
        <i className="bi bi-calendar3" />
        <strong>Todavia no hay fechas especiales.</strong>
        <span>Define horarios para festivos, eventos o dias con cierre temprano. Las fechas especiales anulan el horario semanal.</span>
        <button type="button" className="btn inv-prod-btn-primary" onClick={onCreate} disabled={saving}>
          Nueva fecha especial
        </button>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table align-middle suc-fechas-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Descripcion</th>
            <th>Estado</th>
            <th>Horario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id_fecha_especial}>
              <td>{row?.fecha ? String(row.fecha).slice(0, 10) : '-'}</td>
              <td>{row?.tipo || '-'}</td>
              <td>{row?.descripcion || '-'}</td>
              <td>{row?.estado ? 'Activo' : 'Inactivo'}</td>
              <td>{formatHorario(row)}</td>
              <td>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm inv-prod-btn-outline" onClick={() => onEdit(row)} disabled={saving}>Editar</button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDeactivate(row)} disabled={saving || row?.estado === false}>Desactivar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
