const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const text = (value, fallback = 'Sin dato') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function PlanillaMovimientosModal({
  open,
  item,
  loading = false,
  movimientos = [],
  onClose,
  onAnular,
  canAnular = false
}) {
  if (!open || !item) return null;

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal planillas-modal--lg" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Movimientos del empleado</h5>
            <p>{text(item.nombre_completo || item.empleado_nombre || item.nombre_empleado, 'Empleado')}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {loading ? (
          <div className="inv-catpro-loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando movimientos...</span>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-sub">No hay movimientos registrados para este empleado.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Observacion</th>
                  <th>Fecha</th>
                  {canAnular ? <th className="text-end">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento, idx) => (
                  <tr key={movimiento.id_movimiento_planilla || movimiento.id_movimiento || idx}>
                    <td>{text(movimiento.tipo)}</td>
                    <td>{text(movimiento.concepto)}</td>
                    <td>{formatMoney(movimiento.monto)}</td>
                    <td>{text(movimiento.observacion, '-')}</td>
                    <td>{text(movimiento.fecha_registro || movimiento.fecha, '-')}</td>
                    {canAnular ? (
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onAnular?.(movimiento)}
                        >
                          <i className="bi bi-trash me-1" />
                          Anular
                        </button>
                      </td>
                    ) : null}
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
