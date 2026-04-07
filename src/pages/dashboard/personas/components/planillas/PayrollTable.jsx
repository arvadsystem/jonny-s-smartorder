import EmployeeRow from './EmployeeRow';

const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const computeTotalNeto = (rows = []) =>
  rows.reduce((acc, row) => {
    const neto = Number(row?.neto_pagar ?? row?.total_neto_pagar ?? row?.neto ?? 0);
    return Number.isFinite(neto) ? acc + neto : acc;
  }, 0);

export default function PayrollTable({
  items = [],
  page = 1,
  limit = 10,
  onOpenDetalle,
  onOpenMovimientos,
  onOpenHorasExtra,
  onOpenAdelanto,
  onRecalcularDetalle,
  canAplicarAdelanto = false,
  canRecalcular = false
}) {
  const totalNeto = computeTotalNeto(items);

  return (
    <div className="table-responsive payroll-table-wrap">
      <table className="table personas-page__table planillas-table payroll-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Cargo</th>
            <th className="text-end">Salario base</th>
            <th className="text-end">Bonos</th>
            <th className="text-end">Deducciones</th>
            <th className="text-end">Adelantos</th>
            <th className="text-end">H.E. tiempo</th>
            <th className="text-end">Neto a pagar</th>
            <th className="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <EmployeeRow
              key={item.id_detalle_planilla || item.id_detalle || `${item.id_empleado || 'emp'}-${idx}`}
              item={item}
              index={(page - 1) * limit + idx + 1}
              onOpenDetalle={onOpenDetalle}
              onOpenMovimientos={onOpenMovimientos}
              onOpenHorasExtra={onOpenHorasExtra}
              onOpenAdelanto={onOpenAdelanto}
              onRecalcularDetalle={onRecalcularDetalle}
              canAplicarAdelanto={canAplicarAdelanto}
              canRecalcular={canRecalcular}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="payroll-table__footer-label">
              Total neto mostrado
            </td>
            <td className="text-end payroll-table__footer-value">{formatMoney(totalNeto)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
