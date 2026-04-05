import PayrollTable from './PayrollTable';

export default function PlanillasTable({
  items = [],
  page = 1,
  limit = 10,
  onOpenDetalle,
  onOpenMovimientos,
  onOpenHorasExtra,
  onOpenBono,
  onOpenDeduccion,
  onOpenAdelanto,
  onRecalcularDetalle,
  canRegistrarMovimiento = false,
  canAplicarAdelanto = false,
  canRecalcular = false
}) {
  return (
    <PayrollTable
      items={items}
      page={page}
      limit={limit}
      onOpenDetalle={onOpenDetalle}
      onOpenMovimientos={onOpenMovimientos}
      onOpenHorasExtra={onOpenHorasExtra}
      onOpenBono={onOpenBono}
      onOpenDeduccion={onOpenDeduccion}
      onOpenAdelanto={onOpenAdelanto}
      onRecalcularDetalle={onRecalcularDetalle}
      canRegistrarMovimiento={canRegistrarMovimiento}
      canAplicarAdelanto={canAplicarAdelanto}
      canRecalcular={canRecalcular}
    />
  );
}
