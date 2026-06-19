import { AnimatePresence, motion } from 'framer-motion';

const _MOTION = motion;

const VARIANT_CONFIG = {
  EN_PREPARACION: {
    title: 'Confirmar inicio',
    body: 'El pedido pasara a preparacion.',
    icon: 'bi bi-play-circle',
    submitClass: 'is-start'
  },
  LISTO_PARA_ENTREGA: {
    title: 'Confirmar listo',
    body: 'El pedido estara listo para entrega.',
    icon: 'bi bi-check-circle',
    submitClass: 'is-ready'
  },
  COMPLETADO: {
    title: 'Confirmar entrega',
    body: 'El pedido sera marcado como entregado.',
    icon: 'bi bi-box-seam',
    submitClass: 'is-deliver'
  },
  NO_ENTREGADO: {
    title: 'Marcar como no entregado',
    body: 'El pedido sera marcado como no entregado. Se enviara una notificacion.',
    icon: 'bi bi-x-circle',
    submitClass: 'is-fail'
  }
};

export default function CocinaConfirmModal({
  open,
  pedido,
  action,
  saving,
  onCancel,
  onConfirm
}) {
  const config = VARIANT_CONFIG[action?.nextStatus] || VARIANT_CONFIG.EN_PREPARACION;

  return (
    <AnimatePresence>
      {open && pedido && action ? (
        <motion.div
          className="kds-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!saving ? onCancel : undefined}
        >
          <motion.section
            className="kds-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kds-confirm-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.16 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kds-confirm__icon">
              <i className={config.icon} />
            </div>

            <h3 id="kds-confirm-title" className="kds-confirm__title">
              {config.title}
            </h3>

            <p className="kds-confirm__body">
              <strong>{pedido.numero_ticket}</strong> - {config.body}
              {action.nextStatus === 'NO_ENTREGADO' && pedido.minutos_en_espera != null && (
                <> Tiempo de espera: <strong>{pedido.minutos_en_espera} min</strong>.</>
              )}
            </p>

            <div className="kds-confirm__actions">
              <button
                type="button"
                className="kds-confirm__cancel"
                onClick={onCancel}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`kds-confirm__submit ${config.submitClass}`}
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


