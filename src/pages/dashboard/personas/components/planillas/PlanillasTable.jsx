import PayrollTable from './PayrollTable';

export default function PlanillasTable({
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
  return (
    <PayrollTable
      items={items}
      page={page}
      limit={limit}
      onOpenDetalle={onOpenDetalle}
      onOpenMovimientos={onOpenMovimientos}
      onOpenHorasExtra={onOpenHorasExtra}
      onOpenAdelanto={onOpenAdelanto}
      onRecalcularDetalle={onRecalcularDetalle}
      canAplicarAdelanto={canAplicarAdelanto}
      canRecalcular={canRecalcular}
    />
  );
}
