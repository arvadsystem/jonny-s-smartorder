import React from 'react';

const OperationStatusCard = ({
  icon,
  title,
  value,
  tone = 'neutral',
  statusLabel = '',
  description = ''
}) => (
  <article className={`inicio-snapshot-card is-${tone}`} aria-label={`${title}: ${value}. ${description}`}>
    <div className="inicio-snapshot-card__icon" aria-hidden="true">
      <i className={`bi ${icon}`} />
    </div>
    <div className="inicio-snapshot-card__content">
      {statusLabel ? <span className="inicio-snapshot-card__eyebrow">{statusLabel}</span> : null}
      <p>{title}</p>
      <strong>{value}</strong>
      {description ? <small>{description}</small> : null}
    </div>
  </article>
);

export default OperationStatusCard;
