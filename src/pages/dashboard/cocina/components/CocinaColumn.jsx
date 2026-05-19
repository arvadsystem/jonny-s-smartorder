import { AnimatePresence, motion } from 'framer-motion';
import { getColumnMeta } from '../utils/cocinaHelpers';
import CocinaOrderCard from './CocinaOrderCard';

const _MOTION = motion;

const COLUMN_CSS_CLASS = {
  PENDIENTES: 'is-pending',
  EN_PREPARACION: 'is-prep',
  LISTOS_PARA_ENTREGA: 'is-ready'
};

export default function CocinaColumn({
  canAdvancePedido,
  isSuperAdmin = false,
  canOpenDetail,
  isScreenMode = false,
  canDeliverPedido = false,
  columnKey,
  pedidos,
  now,
  mutatingIds,
  onOpenDetail,
  onOpenConfirm
}) {
  const column = getColumnMeta(columnKey);
  const cssClass = COLUMN_CSS_CLASS[columnKey] || 'is-pending';

  return (
    <section className={`kds-column ${cssClass}`}>
      <header className="kds-column__header">
        <div className="kds-column__title">
          <span className="kds-column__dot" aria-hidden="true" />
          <strong>{column.title}</strong>
        </div>
        <span className="kds-column__count">{pedidos.length}</span>
      </header>

      <motion.div layout className="kds-column__body">
        <AnimatePresence initial={false}>
          {pedidos.map((pedido) => (
            <CocinaOrderCard
              key={pedido.id_pedido}
              pedido={pedido}
              isPendingColumn={columnKey === 'PENDIENTES'}
              now={now}
              canAdvance={canAdvancePedido(pedido)}
              isSuperAdmin={isSuperAdmin}
              canOpenDetail={canOpenDetail}
              isScreenMode={isScreenMode}
              canDeliverPedido={canDeliverPedido}
              disabled={mutatingIds.includes(pedido.id_pedido)}
              onOpenDetail={onOpenDetail}
              onOpenConfirm={onOpenConfirm}
            />
          ))}
        </AnimatePresence>

        {pedidos.length === 0 ? (
          <div className="kds-column__empty">
            <i className="bi bi-inbox" aria-hidden="true" />
            <span>Sin pedidos</span>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}
