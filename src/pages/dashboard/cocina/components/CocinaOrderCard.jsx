import { motion } from 'framer-motion';
import {
  formatServiceLabel,
  formatTimerLabel,
  getOrderAction
} from '../utils/cocinaHelpers';

export default function CocinaOrderCard({
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
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(pedido)}
      onKeyDown={(event) => {
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
        {pedido.items.map((item) => (
          <div key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`} className="cocina-order-card__item">
            <div className="cocina-order-card__item-main">
              <span className="cocina-order-card__qty">{item.cantidad}</span>
              <div>
                <strong>{item.nombre_item}</strong>
                {item.modificaciones?.length ? (
                  <div className="cocina-order-card__tags">
                    {item.modificaciones.slice(0, 3).map((tag) => (
                      <span key={`${item.id_detalle}-${tag}`} className="cocina-tag is-alert">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`cocina-order-card__action ${action.buttonClass}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenConfirm(pedido, action);
        }}
        disabled={disabled}
      >
        <i className={action.icon} />
        <span>{action.label}</span>
      </button>
    </motion.article>
  );
}
