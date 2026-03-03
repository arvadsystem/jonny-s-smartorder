import { BOARD_COLUMNS } from '../utils/cocinaHelpers';
import CocinaColumn from './CocinaColumn';

export default function CocinaBoard({
  groupedPedidos,
  now,
  mutatingIds,
  onOpenDetail,
  onOpenConfirm
}) {
  return (
    <div className="cocina-board">
      {BOARD_COLUMNS.map((column) => (
        <CocinaColumn
          key={column.key}
          columnKey={column.key}
          pedidos={groupedPedidos[column.key] || []}
          now={now}
          mutatingIds={mutatingIds}
          onOpenDetail={onOpenDetail}
          onOpenConfirm={onOpenConfirm}
        />
      ))}
    </div>
  );
}
