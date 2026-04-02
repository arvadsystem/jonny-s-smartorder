const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const textValue = (value, fallback = 'No registrado') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function PlanillasTable({
  items = [],
  page = 1,
  limit = 10,
  onOpenDetalle,
  onOpenMovimientos,
  onOpenBono,
  onOpenDeduccion,
  onOpenAdelanto,
  onRecalcularDetalle,
  canRegistrarMovimiento = false,
  canAplicarAdelanto = false,
  canRecalcular = false
}) {
  return (
    <div className="table-responsive">
      <table className="table personas-page__table planillas-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Cargo</th>
            <th>Salario base</th>
            <th>Bonos</th>
            <th>Deducciones</th>
            <th>Adelantos</th>
            <th>H.E. tiempo</th>
            <th>Neto a pagar</th>
            <th className="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rowIndex = (page - 1) * limit + idx + 1;
            const empleadoNombre =
              item.nombre_completo ||
              item.empleado_nombre ||
              item.nombre_empleado ||
              `${item.nombre || ''} ${item.apellido || ''}`.trim();

            return (
              <tr key={item.id_detalle_planilla || item.id_detalle || `${item.id_empleado || 'emp'}-${idx}`}>
                <td>
                  <strong>{rowIndex}. {textValue(empleadoNombre, 'Empleado sin nombre')}</strong>
                  <div className="text-muted small">{textValue(item.dni, 'Sin DNI')}</div>
                </td>
                <td>{textValue(item.cargo, 'Sin cargo')}</td>
                <td>{formatMoney(item.salario_base)}</td>
                <td>{formatMoney(item.total_bonos ?? item.bonos)}</td>
                <td>{formatMoney(item.total_deducciones ?? item.deducciones)}</td>
                <td>{formatMoney(item.total_adelantos_aplicados ?? item.adelantos)}</td>
                <td>{textValue(item.he_tiempo ?? item.horas_extra_tiempo ?? '0', '0')}</td>
                <td>
                  <strong>{formatMoney(item.neto_pagar ?? item.total_neto_pagar ?? item.neto)}</strong>
                </td>
                <td className="text-end">
                  <div className="planillas-table__actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => onOpenDetalle?.(item)}
                      title="Ver detalle"
                    >
                      <i className="bi bi-eye" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => onOpenMovimientos?.(item)}
                      title="Movimientos"
                    >
                      <i className="bi bi-list-ul" />
                    </button>

                    {canRegistrarMovimiento ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={() => onOpenBono?.(item)}
                          title="Registrar bono"
                        >
                          <i className="bi bi-plus-lg" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning"
                          onClick={() => onOpenDeduccion?.(item)}
                          title="Registrar deduccion"
                        >
                          <i className="bi bi-dash-lg" />
                        </button>
                      </>
                    ) : null}

                    {canAplicarAdelanto ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => onOpenAdelanto?.(item)}
                        title="Aplicar adelanto"
                      >
                        <i className="bi bi-wallet2" />
                      </button>
                    ) : null}

                    {canRecalcular ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark"
                        onClick={() => onRecalcularDetalle?.(item)}
                        title="Recalcular detalle"
                      >
                        <i className="bi bi-arrow-repeat" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
