// Lightweight confirmation modal for risky flow actions (e.g. reset).
const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return (
    <div className="pm-confirm-modal__backdrop" role="presentation" onClick={onCancel}>
      <div
        className="pm-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="pm-confirm-title" className="pm-confirm-modal__title">
          {title}
        </h2>
        <p className="pm-confirm-modal__message">{message}</p>

        <div className="pm-confirm-modal__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-dark" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

