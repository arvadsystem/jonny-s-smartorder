// Sticky mobile CTA bar used in every step.
const StickyActionBar = ({
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel = 'Regresar',
  hideSecondary = false,
  onSecondary,
  helperText
}) => (
  <footer className="pm-sticky-bar" aria-live="polite">
    {helperText ? <p className="pm-sticky-bar__helper">{helperText}</p> : null}

    <div className="pm-sticky-bar__actions">
      {!hideSecondary ? (
        <button type="button" className="btn btn-outline-secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      ) : null}

      <button type="button" className="btn btn-dark" disabled={primaryDisabled} onClick={onPrimary}>
        {primaryLabel}
      </button>
    </div>
  </footer>
);

export default StickyActionBar;

