import { useEffect, useState } from 'react';

const toastIconClass = (variant) => {
  if (variant === 'danger') return 'bi bi-exclamation-triangle-fill';
  if (variant === 'warning') return 'bi bi-exclamation-circle-fill';
  if (variant === 'info') return 'bi bi-info-circle-fill';
  return 'bi bi-check-circle-fill';
};

// Toast alineado al patron visual de Personas.
const MenuActionToast = ({
  message = '',
  title = 'OK',
  variant = 'success',
  durationMs = 3200,
  onClose
}) => {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, Math.max(1200, Number(durationMs || 0)));
    return () => clearTimeout(timer);
  }, [visible, durationMs, onClose]);

  if (!visible || !message) return null;

  const normalizedVariant = variant === 'error' ? 'danger' : variant;

  return (
    <div className="inv-toast-wrap" role="status" aria-live="polite">
      <div className={`inv-toast-card ${normalizedVariant || 'success'}`}>
        <div className="inv-toast-icon">
          <i className={toastIconClass(normalizedVariant)} aria-hidden="true" />
        </div>
        <div className="inv-toast-content">
          <div className="inv-toast-title">{title}</div>
          <div className="inv-toast-message">{message}</div>
        </div>
        <button
          type="button"
          className="inv-toast-close"
          aria-label="Cerrar notificacion"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
        <div className="inv-toast-progress" />
      </div>
    </div>
  );
};

export default MenuActionToast;
