import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SecurityConfirmAction = ({
  className = "btn inv-prod-toolbar-btn sec-btn-soft-danger",
  disabled = false,
  onConfirm,
  children,
  title,
  subtitle,
  question,
  confirmText,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  triggerTitle,
  centered = true,
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
  }, [submitting]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await onConfirm?.();
      if (result !== false) {
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="sec-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className={`sec-confirm-panel${centered ? " sec-confirm-panel-centered" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sec-confirm-head">
          <div className="sec-confirm-head-main">
            <div className="sec-confirm-head-icon" aria-hidden="true">
              <i className="bi bi-exclamation-triangle-fill" />
            </div>
            <div className="sec-confirm-head-copy">
              <div className="sec-confirm-head-title">{title || "CONFIRMAR ACCIÓN"}</div>
              <div className="sec-confirm-head-subtitle">
                {subtitle || "Esta acción puede afectar sesiones activas."}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sec-confirm-head-close"
            onClick={close}
            disabled={submitting}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="sec-confirm-body">
          <div className="sec-confirm-question">
            {question || confirmText || "¿Deseas continuar?"}
          </div>
        </div>

        <div className="sec-confirm-footer">
          <button
            type="button"
            className="btn sec-confirm-btn-cancel"
            onClick={close}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn sec-confirm-btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Procesando...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={triggerTitle}
      >
        {children}
      </button>

      {open && typeof document !== "undefined" ? createPortal(modalContent, document.body) : null}
    </>
  );
};

export default SecurityConfirmAction;
