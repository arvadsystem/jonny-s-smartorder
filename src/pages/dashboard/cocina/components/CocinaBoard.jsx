import { BOARD_COLUMNS } from '../utils/cocinaHelpers';
import CocinaColumn from './CocinaColumn';

export default function CocinaBoard({
  canAdvancePedido,
  isSuperAdmin = false,
  canOpenDetail,
  isScreenMode = false,
  canDeliverPedido = false,
  groupedPedidos,
  now,
  mutatingIds,
  onOpenDetail,
  onOpenConfirm
}) {
  return (
    <div className="kds-board">
      {BOARD_COLUMNS.map((column) => (
        <CocinaColumn
          key={column.key}
          columnKey={column.key}
          pedidos={groupedPedidos[column.key] || []}
          now={now}
          mutatingIds={mutatingIds}
          isSuperAdmin={isSuperAdmin}
          canAdvancePedido={canAdvancePedido}
          canOpenDetail={canOpenDetail}
          isScreenMode={isScreenMode}
          canDeliverPedido={canDeliverPedido}
          onOpenDetail={onOpenDetail}
          onOpenConfirm={onOpenConfirm}
        />
      ))}
    </div>
  );
}
