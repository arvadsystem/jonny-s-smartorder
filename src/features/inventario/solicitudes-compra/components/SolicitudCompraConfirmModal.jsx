import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function SolicitudCompraConfirmModal({
  open,
  title,
  description,
  icon,
  confirmLabel,
  busyLabel,
  busy = false,
  onClose,
  onConfirm,
  children
}) {
  const confirmRef = useRef(null);
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    openerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => confirmRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(panelRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => openerRef.current?.focus?.());
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const titleId = 'sol-comp-confirm-modal-title';
  const descriptionId = 'sol-comp-confirm-modal-description';

  return createPortal(
    <div
      className="inv-pro-confirm-backdrop sol-comp-confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={busy ? undefined : onClose}
    >
      <div ref={panelRef} className="inv-pro-confirm-panel sol-comp-confirm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-glow" aria-hidden="true" />
        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon" aria-hidden="true"><i className={`bi ${icon}`} /></div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Solicitudes de compra</div>
              <h3 className="inv-pro-confirm-title" id={titleId}>{title}</h3>
              <p className="inv-pro-confirm-sub" id={descriptionId}>{description}</p>
            </div>
          </div>
          <button type="button" className="inv-pro-confirm-close" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="inv-pro-confirm-body sol-comp-confirm-modal__body">{children}</div>

        <div className="inv-pro-confirm-footer sol-comp-confirm-modal__footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            <i className={`bi ${busy ? 'bi-arrow-repeat sol-comp-confirm-modal__spinner' : 'bi-check2-circle'}`} aria-hidden="true" />
            <span>{busy ? busyLabel : confirmLabel}</span>
          </button>
          <span className="visually-hidden" aria-live="polite">{busy ? busyLabel : ''}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
