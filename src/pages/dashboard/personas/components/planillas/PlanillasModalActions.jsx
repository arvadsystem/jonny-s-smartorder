export default function PlanillasModalActions({
  onCancel,
  cancelLabel = 'Cancelar',
  cancelDisabled = false,
  primaryLabel = 'Guardar',
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel = 'Procesando...',
  onPrimary,
  primaryType = 'button',
  primaryForm,
  hidePrimary = false
}) {
  const handleCancelClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCancel?.(event);
  };

  const handlePrimaryClick = (event) => {
    if (primaryType !== 'submit') {
      event.preventDefault();
      event.stopPropagation();
    }
    onPrimary?.(event);
  };

  return (
    <div className="planillas-modal-actions">
      <button
        type="button"
        className="btn planillas-modal-actions__cancel"
        onClick={handleCancelClick}
        disabled={cancelDisabled}
      >
        {cancelLabel}
      </button>

      {!hidePrimary ? (
        <button
          type={primaryType}
          form={primaryForm}
          className="btn planillas-modal-actions__primary"
          onClick={onPrimary ? handlePrimaryClick : undefined}
          disabled={primaryDisabled || primaryLoading}
        >
          {primaryLoading ? primaryLoadingLabel : primaryLabel}
        </button>
      ) : null}
    </div>
  );
}
