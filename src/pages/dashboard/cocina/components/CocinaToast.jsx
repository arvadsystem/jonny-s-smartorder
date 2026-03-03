export default function CocinaToast({ toast, onClose }) {
  if (!toast?.show) return null;

  return (
    <div className={`cocina-toast is-${toast.variant || 'success'}`} role="status" aria-live="polite">
      <div className="cocina-toast__copy">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" className="cocina-toast__close" onClick={onClose}>
        <i className="bi bi-x-lg" />
      </button>
    </div>
  );
}
