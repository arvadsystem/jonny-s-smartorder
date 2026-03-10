import { motion } from 'framer-motion';
import {
  formatServiceLabel,
  formatTimerLabel,
  getOrderAction
} from '../utils/cocinaHelpers';

export default function CocinaOrderCard({
  canAdvance,
  canOpenDetail,
  pedido,
  now,
  disabled,
  onOpenDetail,
  onOpenConfirm
}) {
  const action = getOrderAction(pedido);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="cocina-order-card"
      role={canOpenDetail ? 'button' : undefined}
      tabIndex={canOpenDetail ? 0 : -1}
      onClick={() => {
        if (!canOpenDetail) return;
        onOpenDetail(pedido);
      }}
      onKeyDown={(event) => {
        if (!canOpenDetail) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(pedido);
        }
      }}
    >
      <div className="cocina-order-card__top">
        <div>
          <div className="cocina-order-card__ticket">{pedido.numero_ticket}</div>
          <div className="cocina-order-card__badges">
            <span className="cocina-chip is-service">{formatServiceLabel(pedido.tipo_servicio)}</span>
            <span className="cocina-chip is-timer">
              <i className="bi bi-clock" /> {formatTimerLabel(pedido.fecha_hora_facturacion || pedido.fecha_hora_pedido, now)}
            </span>
          </div>
        </div>
      </div>

      <div className="cocina-order-card__client">
        <i className="bi bi-person" />
        <span>{pedido.cliente_nombre || 'Consumidor final'}</span>
      </div>

      <div className="cocina-order-card__items">
        {pedido.items.map((item) => {
          const visibleTags = item.modificaciones?.slice(0, 2) || [];
          const hiddenCount = Math.max((item.modificaciones?.length || 0) - visibleTags.length, 0);

          return (
            <div key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`} className="cocina-order-card__item">
              <div className="cocina-order-card__item-main">
                <span className="cocina-order-card__qty">{item.cantidad}</span>
                <div>
                  <strong>{item.nombre_item}</strong>
                  {visibleTags.length ? (
                    <div className="cocina-order-card__tags">
                      {visibleTags.map((tag) => (
                        <span key={`${item.id_detalle}-${tag}`} className="cocina-tag is-alert">
                          {tag}
                        </span>
                      ))}
                      {hiddenCount > 0 ? (
                        <span className="cocina-tag is-muted">+{hiddenCount}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`cocina-order-card__action ${action.buttonClass}`}
        onClick={(event) => {
          if (!canAdvance) return;
          event.stopPropagation();
          onOpenConfirm(pedido, action);
        }}
        disabled={disabled || !canAdvance}
      >
        <i className={action.icon} />
        <span>{action.label}</span>
      </button>
    </motion.article>
  );
}
