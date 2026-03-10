import { AnimatePresence, motion } from 'framer-motion';
import { getColumnMeta } from '../utils/cocinaHelpers';
import CocinaOrderCard from './CocinaOrderCard';

export default function CocinaColumn({
  canAdvancePedido,
  canOpenDetail,
  columnKey,
  pedidos,
  now,
  mutatingIds,
  onOpenDetail,
  onOpenConfirm
}) {
  const column = getColumnMeta(columnKey);

  return (
    <section className={`cocina-column ${column.badgeClass}`}>
      <header className="cocina-column__header">
        <div className="cocina-column__title">
          <span className="cocina-column__dot" />
          <strong>{column.title}</strong>
        </div>
        <span className="cocina-column__count">{pedidos.length}</span>
      </header>

      <motion.div layout className="cocina-column__body">
        <AnimatePresence initial={false}>
          {pedidos.map((pedido) => (
            <CocinaOrderCard
              key={pedido.id_pedido}
              pedido={pedido}
              now={now}
              canAdvance={canAdvancePedido(pedido)}
              canOpenDetail={canOpenDetail}
              disabled={mutatingIds.includes(pedido.id_pedido)}
              onOpenDetail={onOpenDetail}
              onOpenConfirm={onOpenConfirm}
            />
          ))}
        </AnimatePresence>

        {pedidos.length === 0 ? (
          <div className="cocina-column__empty">No hay pedidos en esta columna.</div>
        ) : null}
      </motion.div>
    </section>
  );
}
