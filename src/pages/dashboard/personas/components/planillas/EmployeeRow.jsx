const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const textValue = (value, fallback = 'No registrado') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function EmployeeRow({
  item,
  index = 0,
  onOpenDetalle,
  onOpenMovimientos,
  onOpenHorasExtra,
  onOpenAdelanto,
  onRecalcularDetalle,
  canAplicarAdelanto = false,
  canRecalcular = false
}) {
  const empleadoNombre =
    item.nombre_completo ||
    item.empleado_nombre ||
    item.nombre_empleado ||
    `${item.nombre || ''} ${item.apellido || ''}`.trim();
  const horasExtraLabel = textValue(item.he_tiempo ?? item.horas_extra_tiempo ?? '0', '0');
  const canOpenHorasExtra = typeof onOpenHorasExtra === 'function';

  return (
    <tr className="payroll-row">
      <td>
        <div className="payroll-row__employee">
          <span className="payroll-row__avatar" aria-hidden="true">
            {String(empleadoNombre || '?').charAt(0).toUpperCase()}
          </span>
          <div className="payroll-row__employee-copy">
            <strong>
              {index}. {textValue(empleadoNombre, 'Empleado sin nombre')}
            </strong>
            <div className="text-muted small">{textValue(item.dni, 'Sin DNI')}</div>
          </div>
        </div>
      </td>
      <td>{textValue(item.cargo, 'Sin cargo')}</td>
      <td className="payroll-row__number">{formatMoney(item.salario_base)}</td>
      <td className="payroll-row__number">{formatMoney(item.total_bonos ?? item.bonos)}</td>
      <td className="payroll-row__number">{formatMoney(item.total_deducciones ?? item.deducciones)}</td>
      <td className="payroll-row__number">{formatMoney(item.total_adelantos_aplicados ?? item.adelantos)}</td>
      <td className="payroll-row__number">
        {canOpenHorasExtra ? (
          <button
            type="button"
            className="btn btn-link payroll-row__he-btn"
            onClick={() => onOpenHorasExtra?.(item)}
            title="Ver horas extra"
          >
            <i className="bi bi-clock-history me-1" />
            {horasExtraLabel}
          </button>
        ) : (
          <span className="payroll-row__he-text">{horasExtraLabel}</span>
        )}
      </td>
      <td className="payroll-row__number">
        <strong className="payroll-row__net">
          {formatMoney(item.neto_pagar ?? item.total_neto_pagar ?? item.neto)}
        </strong>
      </td>
      <td className="text-end">
        <div className="planillas-table__actions">
          <button
            type="button"
            className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--view"
            onClick={() => onOpenDetalle?.(item)}
            title="Ver detalle"
          >
            <i className="bi bi-eye" />
          </button>

          <button
            type="button"
            className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--list"
            onClick={() => onOpenMovimientos?.(item)}
            title="Movimientos"
          >
            <i className="bi bi-list-ul" />
          </button>

          {canAplicarAdelanto ? (
            <button
              type="button"
              className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--adelanto payroll-row__action-strong"
              onClick={() => onOpenAdelanto?.(item)}
              title="Aplicar adelanto"
            >
              <i className="bi bi-wallet2" />
            </button>
          ) : null}

          {canRecalcular ? (
            <button
              type="button"
              className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--recalc payroll-row__action-strong"
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
}
