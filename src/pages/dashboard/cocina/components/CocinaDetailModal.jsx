import { AnimatePresence, motion } from 'framer-motion';
import {
  formatCurrency,
  formatDateTimeLabel,
  formatServiceLabel,
  formatTimerLabel
} from '../utils/cocinaHelpers';

const _MOTION = motion;

export default function CocinaDetailModal({ open, pedido, now, onClose }) {
  return (
    <AnimatePresence>
      {open && pedido ? (
        <motion.div
          className="kds-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="kds-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kds-modal-ticket"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <header className="kds-modal__header">
              <div>
                <div id="kds-modal-ticket" className="kds-modal__ticket">
                  {pedido.numero_ticket}
                </div>
                <div className="kds-modal__sucursal">
                  <i className="bi bi-geo-alt" /> {pedido.nombre_sucursal}
                </div>
              </div>
              <button
                type="button"
                className="kds-modal__close"
                onClick={onClose}
                aria-label="Cerrar detalle de pedido"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            {/* Body */}
            <div className="kds-modal__body">
              {/* Meta cards */}
              <div className="kds-modal__meta">
                <div className="kds-meta-card">
                  <div className="kds-meta-card__label">Cliente</div>
                  <div className="kds-meta-card__value">
                    {pedido.cliente_nombre || 'Consumidor final'}
                  </div>
                </div>
                <div className="kds-meta-card">
                  <div className="kds-meta-card__label">Tipo de servicio</div>
                  <div className="kds-meta-card__value">
                    {formatServiceLabel(pedido.tipo_servicio)}
                  </div>
                </div>
                <div className="kds-meta-card">
                  <div className="kds-meta-card__label">Tiempo en espera</div>
                  <div className="kds-meta-card__value">
                    {formatTimerLabel(
                      pedido.fecha_hora_facturacion || pedido.fecha_hora_pedido,
                      now
                    )}
                  </div>
                </div>
                <div className="kds-meta-card">
                  <div className="kds-meta-card__label">Creado</div>
                  <div className="kds-meta-card__value">
                    {formatDateTimeLabel(pedido.fecha_hora_pedido)}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="kds-modal__section-title">
                  Ítems del pedido ({pedido.total_items})
                </div>
                <div className="kds-modal__items">
                  {(Array.isArray(pedido.items) ? pedido.items : []).map((item) => (
                    <article
                      key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`}
                      className="kds-modal__item"
                    >
                      <div className="kds-qty">{item.cantidad}</div>
                      <div>
                        <div className="kds-modal__item-name">{item.nombre_item}</div>
                        {item.modificaciones?.length > 0 ? (
                          <div className="kds-card__item-mods" style={{ marginTop: '0.4rem' }}>
                            {item.modificaciones.map((mod) => (
                              <span key={mod} className="kds-mod">{mod}</span>
                            ))}
                          </div>
                        ) : null}
                        {item.observacion ? (
                          <div style={{
                            marginTop: '0.4rem',
                            fontSize: '0.78rem',
                            color: 'var(--kds-text-3)',
                            lineHeight: 1.4
                          }}>
                            <strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Nota:
                            </strong>{' '}
                            {item.observacion}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Observaciones generales */}
              {pedido.descripcion_pedido ? (
                <div>
                  <div className="kds-modal__section-title">Observaciones</div>
                  <div className="kds-modal__note">{pedido.descripcion_pedido}</div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <footer className="kds-modal__footer">
              <div>
                <div className="kds-modal__total-label">Total del pedido</div>
                <div className="kds-modal__total-value">{formatCurrency(pedido.total)}</div>
              </div>
              <div>
                <div className="kds-modal__total-label">Total de ítems</div>
                <div className="kds-modal__total-value">{pedido.total_items}</div>
              </div>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
