import { AnimatePresence, motion } from 'framer-motion';

const _MOTION = motion;

const TOAST_ICONS = {
  success: 'bi bi-check-circle-fill',
  danger: 'bi bi-exclamation-circle-fill'
};

export default function CocinaToast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast?.show ? (
        <motion.div
          className={`kds-toast is-${toast.variant || 'success'}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.18 }}
        >
          <div className="kds-toast__icon" aria-hidden="true">
            <i className={TOAST_ICONS[toast.variant] || TOAST_ICONS.success} />
          </div>
          <div className="kds-toast__body">
            <div className="kds-toast__title">{toast.title}</div>
            <div className="kds-toast__message">{toast.message}</div>
          </div>
          <button
            type="button"
            className="kds-toast__close"
            onClick={onClose}
            aria-label="Cerrar notificación"
          >
            <i className="bi bi-x-lg" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
