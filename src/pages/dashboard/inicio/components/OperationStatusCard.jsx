import React from 'react';

const OperationStatusCard = ({ icon, title, value, tone = 'neutral' }) => (
  <article className={`inicio-snapshot-card is-${tone}`}>
    <div className="inicio-snapshot-card__icon" aria-hidden="true">
      <i className={`bi ${icon}`} />
    </div>
    <div className="inicio-snapshot-card__content">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  </article>
);

export default OperationStatusCard;
