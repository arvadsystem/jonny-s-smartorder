import { AnimatePresence, motion } from 'framer-motion';
import {
  formatCurrency,
  formatDateTimeLabel,
  formatServiceLabel,
  formatTimerLabel
} from '../utils/cocinaHelpers';

export default function CocinaDetailModal({ open, pedido, now, onClose }) {
  return (
    <AnimatePresence>
      {open && pedido ? (
        <motion.div
          className="cocina-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="cocina-modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cocina-modal__header">
              <div>
                <h3>{pedido.numero_ticket}</h3>
                <p>{pedido.nombre_sucursal}</p>
              </div>
              <button type="button" className="cocina-modal__close" onClick={onClose}>
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="cocina-modal__body">
              <div className="cocina-modal__meta">
                <div className="cocina-modal__meta-card">
                  <span>Cliente</span>
                  <strong>{pedido.cliente_nombre || 'Consumidor final'}</strong>
                </div>
                <div className="cocina-modal__meta-card">
                  <span>Servicio</span>
                  <strong>{formatServiceLabel(pedido.tipo_servicio)}</strong>
                </div>
                <div className="cocina-modal__meta-card">
                  <span>Timer</span>
                  <strong>{formatTimerLabel(pedido.fecha_hora_facturacion || pedido.fecha_hora_pedido, now)}</strong>
                </div>
                <div className="cocina-modal__meta-card">
                  <span>Creado</span>
                  <strong>{formatDateTimeLabel(pedido.fecha_hora_pedido)}</strong>
                </div>
              </div>

              <div className="cocina-modal__section">
                <div className="cocina-modal__section-title">Items</div>
                <div className="cocina-modal__items">
                  {pedido.items.map((item) => (
                    <article key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`} className="cocina-modal__item">
                      <div className="cocina-modal__item-head">
                        <span className="cocina-modal__qty">{item.cantidad}</span>
                        <strong>{item.nombre_item}</strong>
                        <span className="cocina-chip is-outline">{item.tipo_item}</span>
                      </div>
                      {item.modificaciones?.length ? (
                        <div className="cocina-order-card__tags">
                          {item.modificaciones.map((tag) => (
                            <span key={`${item.id_detalle}-${tag}`} className="cocina-tag is-alert">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>

              {pedido.descripcion_pedido ? (
                <div className="cocina-modal__section">
                  <div className="cocina-modal__section-title">Observaciones</div>
                  <div className="cocina-modal__note">{pedido.descripcion_pedido}</div>
                </div>
              ) : null}

              <footer className="cocina-modal__footer">
                <div>
                  <span>Total del pedido</span>
                  <strong>{formatCurrency(pedido.total)}</strong>
                </div>
                <div>
                  <span>Total de items</span>
                  <strong>{pedido.total_items}</strong>
                </div>
              </footer>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
