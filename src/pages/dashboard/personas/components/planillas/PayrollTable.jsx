import { useEffect, useState } from 'react';
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
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767.98px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767.98px)');
    const onChange = (event) => setIsMobileLayout(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }
    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  const totalNeto = computeTotalNeto(items);

  if (isMobileLayout) {
    return (
      <div className="planillas-payroll-cards">
        {items.map((item, idx) => {
          const rowIndex = (page - 1) * limit + idx + 1;
          const empleadoNombre =
            item.nombre_completo ||
            item.empleado_nombre ||
            item.nombre_empleado ||
            `${item.nombre || ''} ${item.apellido || ''}`.trim();
          const horasExtraLabel = String(item.he_tiempo ?? item.horas_extra_tiempo ?? '0').trim() || '0';
          return (
            <article
              key={item.id_detalle_planilla || item.id_detalle || `${item.id_empleado || 'emp'}-${idx}`}
              className="planillas-payroll-card"
            >
              <header className="planillas-payroll-card__head">
                <strong>{rowIndex}. {empleadoNombre || 'Empleado sin nombre'}</strong>
                <small>{item.dni || 'Sin DNI'}</small>
              </header>
              <div className="planillas-payroll-card__grid">
                <span>Salario base: <strong>{formatMoney(item.salario_base)}</strong></span>
                <span>Bonos: <strong>{formatMoney(item.total_bonos ?? item.bonos)}</strong></span>
                <span>Deducciones: <strong>{formatMoney(item.total_deducciones ?? item.deducciones)}</strong></span>
                <span>Adelantos: <strong>{formatMoney(item.total_adelantos_aplicados ?? item.adelantos)}</strong></span>
                <span>H.E. tiempo: <strong>{horasExtraLabel}</strong></span>
                <span>Neto: <strong>{formatMoney(item.neto_pagar ?? item.total_neto_pagar ?? item.neto)}</strong></span>
              </div>
              <div className="planillas-payroll-card__actions">
                <button type="button" className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--view" onClick={() => onOpenDetalle?.(item)} title="Ver detalle">
                  <i className="bi bi-eye" />
                </button>
                <button type="button" className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--list" onClick={() => onOpenMovimientos?.(item)} title="Movimientos">
                  <i className="bi bi-list-ul" />
                </button>
                {typeof onOpenHorasExtra === 'function' ? (
                  <button type="button" className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--recalc" onClick={() => onOpenHorasExtra?.(item)} title="Horas extra">
                    <i className="bi bi-clock-history" />
                  </button>
                ) : null}
                {canAplicarAdelanto ? (
                  <button type="button" className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--adelanto payroll-row__action-strong" onClick={() => onOpenAdelanto?.(item)} title="Aplicar adelanto">
                    <i className="bi bi-wallet2" />
                  </button>
                ) : null}
                {canRecalcular ? (
                  <button type="button" className="btn btn-sm payroll-row__icon-btn payroll-row__icon-btn--recalc payroll-row__action-strong" onClick={() => onRecalcularDetalle?.(item)} title="Recalcular detalle">
                    <i className="bi bi-arrow-repeat" />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        <div className="planillas-payroll-card__total">
          Total neto mostrado: <strong>{formatMoney(totalNeto)}</strong>
        </div>
      </div>
    );
  }

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
