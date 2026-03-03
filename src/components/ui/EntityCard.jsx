export default function EntityCard({
  className = "",
  index = 0,
  iconClass,
  titleIconClass,
  title,
  subtitle,
  badge,
  badgeClass = "",
  inactive = false,
  footerLeft,
  footerActions,
  children,
}) {
  return (
    <article
      className={`inv-catpro-item inv-cat-card inv-anim-in personas-page__entity-card ${
        inactive ? "is-inactive-state" : ""
      } ${className}`.trim()}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-cat-card__halo" aria-hidden="true">
        <i className={iconClass} />
      </div>

      <div className="inv-catpro-item-top">
        <div className="inv-cat-card__title-wrap">
          <span className="inv-cat-card__icon" aria-hidden="true">
            <i className={titleIconClass} />
          </span>
          <div>
            <div className="fw-bold">{title}</div>
            <div className="text-muted small">{subtitle}</div>
          </div>
        </div>

        {badge ? <span className={`inv-ins-card__badge ${badgeClass}`.trim()}>{badge}</span> : null}
      </div>

      <div className="personas-page__card-details">{children}</div>

      <div className="inv-catpro-meta inv-catpro-item-footer">
        <div className="inv-catpro-code-wrap">{footerLeft}</div>
        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">{footerActions}</div>
      </div>
    </article>
  );
}
