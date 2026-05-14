const MenuConfirmDialog = ({
  open,
  title = 'Confirmar accion',
  subtitle = 'Esta accion requiere confirmacion',
  question = 'Deseas continuar?',
  description = '',
  itemLabel = '',
  itemIcon = 'bi-exclamation-triangle-fill',
  confirmLabel = 'Confirmar',
  confirmingLabel = 'Procesando...',
  loading = false,
  onClose,
  onConfirm
}) => {
  if (!open) return null;

  return (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-glow" aria-hidden="true" />

        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon" aria-hidden="true">
              <i className={`bi ${itemIcon}`} />
            </div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Modulo menu</div>
              <div className="inv-pro-confirm-title">{title}</div>
              <div className="inv-pro-confirm-sub">{subtitle}</div>
            </div>
          </div>

          <button
            type="button"
            className="inv-pro-confirm-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          <div className="inv-pro-confirm-question">{question}</div>
          {description ? <div className="inv-pro-confirm-description">{description}</div> : null}

          {itemLabel ? (
            <div className="inv-pro-confirm-name">
              <span className="inv-pro-confirm-name-label">Seleccionado</span>
              <span className="inv-pro-confirm-name-value">
                <i className="bi bi-card-text" aria-hidden="true" />
                {itemLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn inv-pro-btn-danger" onClick={onConfirm} disabled={loading}>
            <i className="bi bi-check2-circle" aria-hidden="true" />
            <span>{loading ? confirmingLabel : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuConfirmDialog;
