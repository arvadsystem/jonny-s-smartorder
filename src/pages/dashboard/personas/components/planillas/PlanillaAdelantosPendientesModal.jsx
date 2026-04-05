const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export default function PlanillaAdelantosPendientesModal({
  open,
  loading = false,
  items = [],
  hasPlanillaSeleccionada = false,
  onClose,
  onApplyForEmpleado
}) {
  if (!open) return null;

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal planillas-modal--lg" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Adelantos pendientes por sucursal</h5>
            <p>
              Selecciona un empleado para abrir el flujo de aplicacion en la planilla actual.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {!hasPlanillaSeleccionada ? (
          <div className="alert alert-warning py-2">
            Selecciona primero una planilla para poder aplicar adelantos a empleados.
          </div>
        ) : null}

        {loading ? (
          <div className="inv-catpro-loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando adelantos...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-sub">No hay adelantos pendientes en la sucursal seleccionada.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Monto</th>
                  <th>Saldo</th>
                  <th>Fecha</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((adelanto, idx) => {
                  const key = adelanto.id_adelanto_salario || adelanto.id_adelanto || idx;
                  return (
                    <tr key={key}>
                      <td>{toText(adelanto.nombre_completo || adelanto.empleado_nombre, 'Empleado')}</td>
                      <td>{toText(adelanto.cargo, 'Sin cargo')}</td>
                      <td>{formatMoney(adelanto.monto)}</td>
                      <td>{formatMoney(adelanto.saldo)}</td>
                      <td>{toText(adelanto.fecha, '-')}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={!hasPlanillaSeleccionada}
                          onClick={() => onApplyForEmpleado?.(adelanto)}
                        >
                          <i className="bi bi-wallet2 me-1" />
                          Aplicar
                        </button>
                      </td>
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

