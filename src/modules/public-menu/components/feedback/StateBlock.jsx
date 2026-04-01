// Generic loading/empty/error/info block reused across screens.
const StateBlock = ({
  variant = 'info',
  title,
  description,
  actionLabel,
  onAction
}) => (
  <section className={`pm-state-block pm-state-block--${variant}`} role="status">
    <h2 className="pm-state-block__title">{title}</h2>
    {description ? <p className="pm-state-block__description">{description}</p> : null}

    {actionLabel && onAction ? (
      <button type="button" className="btn btn-outline-dark btn-sm" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </section>
);

export default StateBlock;

