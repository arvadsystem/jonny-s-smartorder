export default function PlanillasModalLayout({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  className = '',
  children,
  actions
}) {
  if (!open) return null;

  const panelSizeClass = size === 'lg' ? 'planillas-modal--lg' : '';
  const panelClassName = ['planillas-modal', panelSizeClass, 'planillas-modal-shell', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={panelClassName} onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal-shell__head">
          <div className="planillas-modal-shell__title-wrap">
            <h5>{title}</h5>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <button
            type="button"
            className="planillas-modal-shell__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-modal-shell__body">{children}</div>

        {actions ? <div className="planillas-modal-shell__foot">{actions}</div> : null}
      </div>
    </div>
  );
}
