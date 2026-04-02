const toText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export default function PlanillaAuditoriaModal({
  open,
  loading = false,
  items = [],
  onClose
}) {
  if (!open) return null;

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal planillas-modal--lg" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Auditoria de planilla</h5>
            <p>Eventos y cambios registrados</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {loading ? (
          <div className="inv-catpro-loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando auditoria...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-sub">No hay eventos de auditoria registrados.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Accion</th>
                  <th>Usuario</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id_auditoria_planilla || row.id_bitacora || idx}>
                    <td>{toText(row.fecha_hora || row.fecha)}</td>
                    <td>{toText(row.accion)}</td>
                    <td>{toText(row.usuario || row.nombre_usuario)}</td>
                    <td>{toText(row.descripcion || row.detalle, 'Sin detalle')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
