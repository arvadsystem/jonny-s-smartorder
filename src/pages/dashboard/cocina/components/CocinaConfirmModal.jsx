import { AnimatePresence, motion } from 'framer-motion';

const VARIANT_TITLES = {
  EN_PREPARACION: 'Confirmar inicio',
  LISTO_PARA_ENTREGA: 'Confirmar pedido listo',
  COMPLETADO: 'Confirmar entrega'
};

export default function CocinaConfirmModal({
  open,
  pedido,
  action,
  saving,
  onCancel,
  onConfirm
}) {
  return (
    <AnimatePresence>
      {open && pedido && action ? (
        <motion.div
          className="cocina-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!saving ? onCancel : undefined}
        >
          <motion.section
            className="cocina-confirm"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cocina-confirm__icon">
              <i className={action.icon} />
            </div>
            <h3>{VARIANT_TITLES[action.nextStatus] || 'Confirmar accion'}</h3>
            <p>
              {pedido.numero_ticket} cambiara a <strong>{action.label}</strong>.
            </p>

            <div className="cocina-confirm__actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className={`cocina-confirm__submit ${action.buttonClass}`}
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
