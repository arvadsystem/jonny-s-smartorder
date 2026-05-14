const toastIconClass = (variant) => {
  if (variant === 'danger') return 'bi bi-x-octagon-fill';
  if (variant === 'warning') return 'bi bi-exclamation-triangle-fill';
  if (variant === 'info') return 'bi bi-info-circle-fill';
  return 'bi bi-check2-circle';
};

export default function VentasToast({ toast, onClose }) {
  if (!toast?.show) return null;

  const variant = toast.variant || 'success';

  return (
    <div className="inv-toast-wrap" role="status" aria-live="polite">
      <div className={`inv-toast-card ${variant}`}>
        <div className="inv-toast-icon">
          <i className={toastIconClass(variant)} />
        </div>

        <div className="inv-toast-content">
          <div className="inv-toast-title">{toast.title}</div>
          <div className="inv-toast-message">{toast.message}</div>
        </div>

        <button type="button" className="inv-toast-close" onClick={onClose} aria-label="Cerrar notificacion">
          <i className="bi bi-x-lg" />
        </button>

        <div className="inv-toast-progress" />
      </div>
    </div>
  );
}
