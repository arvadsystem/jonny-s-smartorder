import React from 'react';

const EmptyState = ({
  icon = 'bi-inbox',
  title = 'Sin datos disponibles',
  description = 'Cuando exista información, aquí la verás reflejada.',
  compact = false
}) => (
  <div className={`inicio-empty-state ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
    <div className="inicio-empty-state__icon" aria-hidden="true">
      <i className={`bi ${icon}`} />
    </div>
    <div className="inicio-empty-state__copy">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  </div>
);

export default EmptyState;
